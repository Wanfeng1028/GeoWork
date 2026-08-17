// GeoWork Go Core - Model Router (P2-5, productized in doc/25 R1)
//
// Router is a ModelGateway that picks a provider per call based on
// (mode, taskType) routing rules and falls back to a secondary provider
// when the primary fails. It composes OpenAICompatibleClient instances
// rather than reimplementing the OpenAI wire format.
//
// The mode travels on the context (WithMode / ModeFromContext) — set by
// the orchestrator from run.Mode. The old prompt-scanning inferMode was
// dead code (no system prompt ever embedded a "Mode:" marker) and is
// removed.
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

// Chat implements ModelGateway.Chat. The mode is read from the context
// (WithMode); taskType defaults to "" so wildcard rules match. Full
// (mode, taskType) routing is exposed via ChatWithFallback for internal
// callers that know the task type.
func (r *Router) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	return r.ChatWithFallback(ctx, ModeFromContext(ctx), "", messages, tools, stream)
}

// StreamChat implements ModelGateway.StreamChat with the same routing
// semantics as Chat. On stream-open failure, falls back per rule.
func (r *Router) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	return r.StreamChatWithFallback(ctx, ModeFromContext(ctx), "", messages, tools)
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
//
// doc/25 R2: if the matched rule sets MaxRetries, the primary is
// retried that many extra times before the fallback is consulted.
// Retries stop immediately when the context is done. Default (0) keeps
// the historical single-attempt behavior — note the underlying client
// already retries transient HTTP errors internally.
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

	maxRetries := 0
	if rule != nil && rule.MaxRetries > 0 {
		maxRetries = rule.MaxRetries
	}

	var resp *ChatCompletionResponse
	var err error
	for attempt := 0; ; attempt++ {
		resp, err = client.Chat(ctx, messages, tools, stream)
		if err == nil {
			r.recordCost(primaryID, resp)
			return resp, nil
		}
		if attempt >= maxRetries || ctx.Err() != nil {
			break
		}
		r.log.Warn("provider call failed, retrying",
			zap.String("provider", primaryID),
			zap.Int("attempt", attempt+1),
			zap.Int("maxRetries", maxRetries),
			zap.Error(err))
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
//
// doc/25 R2: the returned channel is wrapped in an observer that
// captures the trailing usage chunk and records its cost when the
// stream completes. Before this, streaming calls accrued zero cost —
// the budget guard could never trip on real spend.
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
		return r.observeStream(primaryID, ch), nil
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
			fbCh, fbErr := fbClient.StreamChat(ctx, messages, tools)
			if fbErr != nil {
				return nil, fbErr
			}
			return r.observeStream(rule.FallbackID, fbCh), nil
		}
	}
	return ch, err
}

// observeStream forwards every chunk from src to a new channel and, when
// src closes, records the cost of the last usage chunk seen. OpenAI-style
// providers send usage as a dedicated trailing event
// (stream_options.include_usage); providers that never send one simply
// record nothing — cost stays 0, same as before, but honestly.
func (r *Router) observeStream(providerID string, src <-chan StreamChunk) <-chan StreamChunk {
	out := make(chan StreamChunk)
	go func() {
		defer close(out)
		var usage *UsageInfo
		for chunk := range src {
			if chunk.Usage != nil {
				usage = chunk.Usage
			}
			out <- chunk
		}
		if usage != nil {
			r.recordStreamCost(providerID, usage)
		}
	}()
	return out
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
	r.recordStreamCost(providerID, resp.Usage)
}

// recordStreamCost computes the dollar cost of a usage report against the
// provider's own pricing and feeds it to the cost controller. Shared by
// the non-streaming (recordCost) and streaming (observeStream) paths.
func (r *Router) recordStreamCost(providerID string, usage *UsageInfo) {
	if usage == nil {
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
		cost = float64(usage.PromptTokens)/1000.0*p.PricePer1KInput +
			float64(usage.CompletionTokens)/1000.0*p.PricePer1KOutput
	}
	c.Record(cost)
}

// Compile-time assertion: Router must implement ModelGateway.
var _ ModelGateway = (*Router)(nil)
