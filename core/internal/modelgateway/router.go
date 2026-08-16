// GeoWork Go Core - Model Router (P2-5)
//
// EXPERIMENTAL: not wired into production (doc/22 D-B4, v0.6 decision).
// The desktop runtime uses a single OpenAICompatibleClient wrapped by
// RateLimitedGateway; multi-provider routing is deferred. This file is
// kept complete and tested so v0.6 can adopt it without a rewrite, but
// nothing in cmd/geowork-runtime constructs a Router today.
//
// Router is a ModelGateway that picks a provider per call based on
// (mode, taskType) routing rules and falls back to a secondary provider
// when the primary fails. It composes OpenAICompatibleClient instances
// rather than reimplementing the OpenAI wire format.
//
// The Router satisfies modelgateway.ModelGateway so the orchestrator
// can drop it in where it previously held a single *OpenAICompatibleClient.
//
// Routing rules:
//   - The first rule whose Mode + TaskType matches wins.
//   - Mode="" / TaskType="" in a rule act as wildcards.
//   - If no rule matches, the default provider is used.
//   - On primary failure, if the rule has FallbackID, the fallback
//     provider is tried once (no recursion — fallback-of-fallback is
//     not supported, keeping failure modes predictable).
//
// Cost control: CostController.CheckBudget gates each call; a call
// that would exceed the daily budget is rejected with ErrBudgetExceeded
// before any provider is contacted. Record() is called after each
// successful call so the running totals stay current.

package modelgateway

import (
	"context"
	"fmt"
	"sync"

	"go.uber.org/zap"
)

// ErrBudgetExceeded is returned by Router.Chat/StreamChat when the
// estimated cost of the call would push daily spend over the limit.
// The orchestrator should surface this to the user (pause + notify)
// rather than retrying — retries just burn more budget.
var ErrBudgetExceeded = fmt.Errorf("daily cost budget exceeded")

// RoutingRule maps a (Mode, TaskType) pair to a primary + fallback
// provider. Empty Mode or TaskType matches any value (wildcard).
type RoutingRule struct {
	Mode       string `json:"mode"`
	TaskType   string `json:"taskType"` // planning | execution | summary | ""
	ProviderID string `json:"provider"`
	FallbackID string `json:"fallback,omitempty"`
	MaxRetries int    `json:"maxRetries,omitempty"`
}

// Router is a multi-provider ModelGateway. It is safe for concurrent
// use; the underlying OpenAICompatibleClients each have their own
// http.Client so they don't share connection pools.
type Router struct {
	mu        sync.RWMutex
	providers map[string]*ModelProvider
	clients   map[string]*OpenAICompatibleClient // cached per provider
	rules     []RoutingRule
	defaultID string
	cost      *CostController
	log       *zap.Logger
}

// NewRouter constructs a Router. defaultID is the provider used when no
// rule matches; if empty, the first registered provider is used.
func NewRouter(defaultID string, log *zap.Logger) *Router {
	if log == nil {
		log = zap.NewNop()
	}
	return &Router{
		providers: make(map[string]*ModelProvider),
		clients:   make(map[string]*OpenAICompatibleClient),
		defaultID: defaultID,
		log:       log,
	}
}

// AddProvider registers a provider with the router. Returns the router
// for chaining. If the provider was already added, it's replaced.
func (r *Router) AddProvider(p *ModelProvider) *Router {
	if p == nil || p.ID == "" {
		return r
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[p.ID] = p
	r.clients[p.ID] = NewOpenAICompatibleClient(p, r.log)
	return r
}

// SetRules replaces the routing rule set. Rules are evaluated in order;
// the first match wins.
func (r *Router) SetRules(rules []RoutingRule) *Router {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rules = append([]RoutingRule(nil), rules...)
	return r
}

// SetCostController attaches a budget guard. Pass nil to disable
// budget enforcement (e.g. for tests).
func (r *Router) SetCostController(c *CostController) *Router {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cost = c
	return r
}

// findRule returns the first rule matching (mode, taskType). Wildcards
// (empty Mode or TaskType) match anything. Returns nil if no match.
func (r *Router) findRule(mode, taskType string) *RoutingRule {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.rules {
		rl := &r.rules[i]
		modeMatch := rl.Mode == "" || rl.Mode == mode
		taskMatch := rl.TaskType == "" || rl.TaskType == taskType
		if modeMatch && taskMatch {
			return rl
		}
	}
	return nil
}

// Route returns the provider selected for (mode, taskType). If a rule
// matches, its ProviderID is used; otherwise the default provider.
// Returns an error if the selected provider doesn't exist.
func (r *Router) Route(mode, taskType string) (*ModelProvider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if rule := r.findRuleLocked(mode, taskType); rule != nil {
		if p, ok := r.providers[rule.ProviderID]; ok {
			return p, nil
		}
		// Primary missing — fall back if one is configured.
		if rule.FallbackID != "" {
			if p, ok := r.providers[rule.FallbackID]; ok {
				return p, nil
			}
		}
		return nil, fmt.Errorf("routing rule selected provider %q but it is not registered", rule.ProviderID)
	}

	// No rule matched — use default.
	if r.defaultID != "" {
		if p, ok := r.providers[r.defaultID]; ok {
			return p, nil
		}
	}
	// Final fallback: first registered provider.
	for _, p := range r.providers {
		return p, nil
	}
	return nil, fmt.Errorf("no providers registered with router")
}

// findRuleLocked is the lock-free inner used by Route and findRule
// (both already hold the read lock).
func (r *Router) findRuleLocked(mode, taskType string) *RoutingRule {
	for i := range r.rules {
		rl := &r.rules[i]
		modeMatch := rl.Mode == "" || rl.Mode == mode
		taskMatch := rl.TaskType == "" || rl.TaskType == taskType
		if modeMatch && taskMatch {
			return rl
		}
	}
	return nil
}

// clientFor returns the cached OpenAICompatibleClient for a provider ID.
// Must be called with the read lock held.
func (r *Router) clientFor(id string) (*OpenAICompatibleClient, bool) {
	c, ok := r.clients[id]
	return c, ok
}

// Chat implements ModelGateway.Chat. It routes by (mode inferred from
// the first message, taskType="") — the full (mode, taskType) routing
// is exposed via ChatWithFallback for internal callers that know the
// task type. For the interface contract, we default taskType to "" so
// wildcard rules match.
func (r *Router) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	// The interface doesn't carry mode/taskType; infer mode from the
	// system message if present, else "" (wildcard).
	mode := inferMode(messages)
	return r.ChatWithFallback(ctx, mode, "", messages, tools, stream)
}

// StreamChat implements ModelGateway.StreamChat with the same routing
// semantics as Chat. On stream-open failure, falls back per rule.
func (r *Router) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	mode := inferMode(messages)
	return r.StreamChatWithFallback(ctx, mode, "", messages, tools)
}

// ProviderID returns the currently-selected default provider ID.
func (r *Router) ProviderID() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.defaultID != "" {
		if _, ok := r.providers[r.defaultID]; ok {
			return r.defaultID
		}
	}
	for id := range r.providers {
		return id
	}
	return "router"
}

// ChatWithFallback is the routing entry point for non-streaming chat.
// mode + taskType select the rule; on primary failure the rule's
// FallbackID is tried once.
func (r *Router) ChatWithFallback(ctx context.Context, mode, taskType string, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	if err := r.checkBudgetGuard(); err != nil {
		return nil, err
	}

	rule := r.findRule(mode, taskType)
	primaryID := r.primaryID(rule)

	r.mu.RLock()
	client, ok := r.clientFor(primaryID)
	r.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("provider %q not registered", primaryID)
	}

	resp, err := client.Chat(ctx, messages, tools, stream)
	if err == nil {
		r.recordCost(primaryID, resp)
		return resp, nil
	}

	// Primary failed — try fallback if the rule has one.
	if rule != nil && rule.FallbackID != "" {
		r.mu.RLock()
		fbClient, ok := r.clientFor(rule.FallbackID)
		r.mu.RUnlock()
		if ok {
			r.log.Warn("primary provider failed, falling back",
				zap.String("primary", primaryID),
				zap.String("fallback", rule.FallbackID),
				zap.Error(err))
			resp, fbErr := fbClient.Chat(ctx, messages, tools, stream)
			if fbErr == nil {
				r.recordCost(rule.FallbackID, resp)
			}
			return resp, fbErr
		}
	}
	return resp, err
}

// StreamChatWithFallback is the streaming counterpart of ChatWithFallback.
// Fallback applies when opening the stream fails; mid-stream errors
// are surfaced to the caller (we can't cleanly restart a partial stream).
func (r *Router) StreamChatWithFallback(ctx context.Context, mode, taskType string, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	if err := r.checkBudgetGuard(); err != nil {
		return nil, err
	}

	rule := r.findRule(mode, taskType)
	primaryID := r.primaryID(rule)

	r.mu.RLock()
	client, ok := r.clientFor(primaryID)
	r.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("provider %q not registered", primaryID)
	}

	ch, err := client.StreamChat(ctx, messages, tools)
	if err == nil {
		return ch, nil
	}

	if rule != nil && rule.FallbackID != "" {
		r.mu.RLock()
		fbClient, ok := r.clientFor(rule.FallbackID)
		r.mu.RUnlock()
		if ok {
			r.log.Warn("primary stream failed, falling back",
				zap.String("primary", primaryID),
				zap.String("fallback", rule.FallbackID),
				zap.Error(err))
			return fbClient.StreamChat(ctx, messages, tools)
		}
	}
	return ch, err
}

// primaryID returns the provider ID a rule selects, or the router's
// default if rule is nil.
func (r *Router) primaryID(rule *RoutingRule) string {
	if rule != nil && rule.ProviderID != "" {
		return rule.ProviderID
	}
	return r.ProviderID()
}

// checkBudgetGuard returns ErrBudgetExceeded if the cost controller is
// attached and the next call's estimated cost would exceed the daily
// budget. We use a tiny fixed estimate (1 cent) since the real cost is
// only known post-call; the goal is to stop runaway loops, not to be
// precise. Record() updates the true running total after each call.
func (r *Router) checkBudgetGuard() error {
	r.mu.RLock()
	c := r.cost
	r.mu.RUnlock()
	if c == nil {
		return nil
	}
	return c.CheckBudget(0.01)
}

// recordCost feeds the actual usage from a completed call into the
// cost controller so the running total is accurate. No-op if no
// controller is attached or the response carries no usage.
//
// doc/22 BP6 / D-B4: the previous version hardcoded $0.002/1K tokens
// regardless of provider — a lie for any model that isn't GPT-3.5-tier.
// Cost is now computed from the provider's own PricePer1KInput/Output
// (the same口径 the orchestrator's estimateCost uses); unknown pricing
// yields 0, which the CostController treats as "unbilled" rather than
// "free".
func (r *Router) recordCost(providerID string, resp *ChatCompletionResponse) {
	if resp == nil || resp.Usage == nil {
		return
	}
	r.mu.RLock()
	c := r.cost
	p := r.providers[providerID]
	r.mu.RUnlock()
	if c == nil {
		return
	}
	var cost float64
	if p != nil {
		cost = float64(resp.Usage.PromptTokens)/1000.0*p.PricePer1KInput +
			float64(resp.Usage.CompletionTokens)/1000.0*p.PricePer1KOutput
	}
	c.Record(cost)
}

// inferMode extracts the agent Mode from the system message if the
// caller embedded it as "Mode: <mode>" (the planner does this). Returns
// "" if not found, which routes to wildcard rules.
func inferMode(messages []ChatMessage) string {
	for _, m := range messages {
		if m.Role == "system" {
			// Look for "Mode: <x>" token in the system prompt.
			s := m.Content
			for i := 0; i+5 < len(s); i++ {
				if s[i] == 'M' && s[i:i+5] == "Mode:" {
					rest := s[i+5:]
					// skip spaces
					j := 0
					for j < len(rest) && (rest[j] == ' ' || rest[j] == '\t') {
						j++
					}
					// read until whitespace
					start := j
					for j < len(rest) && rest[j] != ' ' && rest[j] != '\n' && rest[j] != '\t' {
						j++
					}
					if j > start {
						return rest[start:j]
					}
				}
			}
		}
	}
	return ""
}

// Compile-time assertion: Router must implement ModelGateway.
var _ ModelGateway = (*Router)(nil)
