// GeoWork Go Core - Harness Rule Engine (P3-2 §3)
//
// Harness centralizes the security constraints that were previously
// scattered across StateMachine, Governor, Sandbox, and AuditLog. Rules
// are declarative (ID + condition + action + priority) and evaluated
// in priority order before every tool execution. This gives operators
// a single place to tune "what's allowed when" without touching code.
//
// Rule types:
//   - state_constraint: deny / allow based on agent state + tool
//   - approval: auto-approve or force-approve based on risk/tool
//   - sandbox: audit path-sandbox checks
//   - rate_limit: throttle tool frequency (delegates to Governor)
//
// The Harness is intentionally a read-only evaluator — it does not
// execute tools or block for user approval. When a rule says "approve",
// the Harness sets AutoApproved=true so the orchestrator skips the
// interactive approval flow. When a rule says "deny", the orchestrator
// surfaces the error to the model.

package aiagent

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"

	"go.uber.org/zap"
)

// RuleType categorizes a Harness rule.
type RuleType string

const (
	RuleStateConstraint RuleType = "state_constraint"
	RuleApproval        RuleType = "approval"
	RuleSandbox         RuleType = "sandbox"
	RuleRateLimit       RuleType = "rate_limit"
)

// RuleAction is what the Harness does when a rule's condition matches.
type RuleAction string

const (
	ActionDeny     RuleAction = "deny"
	ActionApprove  RuleAction = "approve"
	ActionAudit    RuleAction = "audit"
	ActionThrottle RuleAction = "throttle"
)

// HarnessRule is one declarative security rule.
type HarnessRule struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Type      RuleType   `json:"type"`
	Condition string     `json:"condition"` // simple expression, see matchCondition
	Action    RuleAction `json:"action"`
	Priority  int        `json:"priority"`
	Enabled   bool       `json:"enabled"`
}

// EvaluationContext carries everything a rule condition can reference.
type EvaluationContext struct {
	RunID     string
	ToolName  string
	Args      map[string]any
	State     State
	Mode      string // ExecutionMode as string
	RiskLevel string
	FilePath  string // extracted from Args["path"] when present
}

// EvaluationResult is the outcome of evaluating all rules.
type EvaluationResult struct {
	Allowed      bool     // false → orchestrator must reject the call
	AutoApproved bool     // true → orchestrator skips interactive approval
	Reason       string   // human-readable explanation
	RuleID       string   // ID of the rule that decided the outcome
	Audited      []string // IDs of rules that triggered audit logging
}

// Harness is the unified rule engine. It is safe for concurrent use.
type Harness struct {
	rules []HarnessRule
	log   *zap.Logger
	mu    sync.RWMutex
}

// NewHarness builds an empty Harness with default rules loaded.
func NewHarness(log *zap.Logger) *Harness {
	h := &Harness{log: log}
	h.LoadDefaults()
	return h
}

// LoadDefaults installs the built-in rule set. These mirror the
// constraints previously hard-coded in StateMachine and Governor so
// the Harness can serve as the single source of truth.
func (h *Harness) LoadDefaults() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.rules = []HarnessRule{
		{
			ID:        "no-delete-in-verifying",
			Name:      "Verifying state disallows delete_file",
			Type:      RuleStateConstraint,
			Condition: "state == 'verifying' && tool == 'delete_file'",
			Action:    ActionDeny,
			Priority:  100,
			Enabled:   true,
		},
		{
			ID:        "no-write-in-verifying",
			Name:      "Verifying state disallows write_file",
			Type:      RuleStateConstraint,
			Condition: "state == 'verifying' && tool == 'write_file'",
			Action:    ActionDeny,
			Priority:  100,
			Enabled:   true,
		},
		{
			ID:        "auto-approve-low-risk",
			Name:      "Low-risk tools skip interactive approval",
			Type:      RuleApproval,
			Condition: "risk == 'low'",
			Action:    ActionApprove,
			Priority:  50,
			Enabled:   true,
		},
		{
			ID:        "auto-approve-medium-risk",
			Name:      "Medium-risk tools skip interactive approval",
			Type:      RuleApproval,
			Condition: "risk == 'medium'",
			Action:    ActionApprove,
			Priority:  40,
			Enabled:   true,
		},
		{
			ID:        "audit-sandbox-paths",
			Name:      "Audit sandbox path checks",
			Type:      RuleSandbox,
			Condition: "sandbox == true",
			Action:    ActionAudit,
			Priority:  80,
			Enabled:   true,
		},
		{
			ID:        "throttle-shell",
			Name:      "Rate-limit run_shell",
			Type:      RuleRateLimit,
			Condition: "tool == 'run_shell'",
			Action:    ActionThrottle,
			Priority:  60,
			Enabled:   true,
		},
	}
}

// LoadFromFile loads rules from a JSON config file, replacing the
// current rule set. Missing file is a no-op (defaults remain).
func (h *Harness) LoadFromFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // no config file → keep defaults
		}
		return fmt.Errorf("read harness config: %w", err)
	}
	var cfg struct {
		Rules []HarnessRule `json:"rules"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("parse harness config: %w", err)
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.rules = cfg.Rules
	if h.log != nil {
		h.log.Info("harness rules loaded from file",
			zap.String("path", path),
			zap.Int("count", len(h.rules)),
		)
	}
	return nil
}

// AddRule appends a single rule. Not thread-safe with LoadFromFile;
// callers should pick one initialization path.
func (h *Harness) AddRule(r HarnessRule) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.rules = append(h.rules, r)
}

// Evaluate runs all enabled rules in priority order against the context.
// The first deny wins (short-circuit). approve/audit/throttle rules are
// collected but do not short-circuit. Returns a result with Allowed=true
// when no deny rule matches.
func (h *Harness) Evaluate(ctx *EvaluationContext) *EvaluationResult {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Sort by priority descending (highest priority first).
	rules := make([]HarnessRule, len(h.rules))
	copy(rules, h.rules)
	sort.SliceStable(rules, func(i, j int) bool {
		return rules[i].Priority > rules[j].Priority
	})

	result := &EvaluationResult{Allowed: true}
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		if !h.matchCondition(rule.Condition, ctx) {
			continue
		}
		switch rule.Action {
		case ActionDeny:
			result.Allowed = false
			result.Reason = fmt.Sprintf("denied by rule %q", rule.Name)
			result.RuleID = rule.ID
			return result
		case ActionApprove:
			result.AutoApproved = true
		case ActionAudit:
			result.Audited = append(result.Audited, rule.ID)
			if h.log != nil {
				h.log.Info("harness audit",
					zap.String("ruleId", rule.ID),
					zap.String("tool", ctx.ToolName),
					zap.String("state", string(ctx.State)),
				)
			}
		case ActionThrottle:
			// Throttle is advisory — the Governor handles actual
			// rate limiting. We just flag it for observability.
			if h.log != nil {
				h.log.Info("harness throttle hint",
					zap.String("ruleId", rule.ID),
					zap.String("tool", ctx.ToolName),
				)
			}
		}
	}
	return result
}

// matchCondition evaluates a simple expression against the context.
// Supported syntax:
//
//	field == 'value'       equality
//	field != 'value'       inequality
//	expr && expr           AND
//	expr || expr            OR
//
// Fields: state, tool, risk, mode, sandbox, path, runId.
// `sandbox` is true when the tool requires sandboxing (FilePath is set).
// `path` matches when FilePath contains the value as a substring.
func (h *Harness) matchCondition(cond string, ctx *EvaluationContext) bool {
	cond = strings.TrimSpace(cond)
	if cond == "" {
		return true // empty condition = always match
	}
	return h.evalOr(cond, ctx)
}

// evalOr splits on || (at the top level, not inside quotes).
func (h *Harness) evalOr(expr string, ctx *EvaluationContext) bool {
	parts := splitTopLevel(expr, "||")
	for _, p := range parts {
		if h.evalAnd(p, ctx) {
			return true
		}
	}
	return false
}

// evalAnd splits on && (at the top level).
func (h *Harness) evalAnd(expr string, ctx *EvaluationContext) bool {
	parts := splitTopLevel(expr, "&&")
	for _, p := range parts {
		if !h.evalAtom(strings.TrimSpace(p), ctx) {
			return false
		}
	}
	return true
}

// evalAtom evaluates a single comparison like: field == 'value'
func (h *Harness) evalAtom(atom string, ctx *EvaluationContext) bool {
	atom = strings.TrimSpace(atom)
	atom = strings.Trim(atom, "()")
	atom = strings.TrimSpace(atom)

	// Match: field op 'value'
	re := regexp.MustCompile(`^(\w+)\s*(==|!=)\s*'([^']*)'$`)
	m := re.FindStringSubmatch(atom)
	if m == nil {
		// Unsupported expression — fail safe (don't match).
		return false
	}
	field, op, value := m[1], m[2], m[3]
	actual := h.fieldValue(field, ctx)
	if op == "==" {
		return actual == value
	}
	return actual != value
}

// fieldValue resolves a field name to its string value from the context.
func (h *Harness) fieldValue(field string, ctx *EvaluationContext) string {
	switch field {
	case "state":
		return string(ctx.State)
	case "tool":
		return ctx.ToolName
	case "risk":
		return ctx.RiskLevel
	case "mode":
		return ctx.Mode
	case "sandbox":
		if ctx.FilePath != "" {
			return "true"
		}
		return "false"
	case "path":
		return ctx.FilePath
	case "runId":
		return ctx.RunID
	default:
		return ""
	}
}

// splitTopLevel splits expr on sep, ignoring separators inside quotes
// or parentheses. This keeps the condition parser simple without a
// full expression AST.
func splitTopLevel(expr, sep string) []string {
	var parts []string
	depth := 0
	inStr := false
	current := strings.Builder{}

	for i := 0; i < len(expr); i++ {
		c := expr[i]
		if c == '\'' {
			inStr = !inStr
		}
		if !inStr {
			if c == '(' {
				depth++
			}
			if c == ')' {
				depth--
			}
			if depth == 0 && i+len(sep) <= len(expr) && expr[i:i+len(sep)] == sep {
				parts = append(parts, current.String())
				current.Reset()
				i += len(sep) - 1
				continue
			}
		}
		current.WriteByte(c)
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}

// Rules returns a copy of the current rule set (for inspection / API).
func (h *Harness) Rules() []HarnessRule {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]HarnessRule, len(h.rules))
	copy(out, h.rules)
	return out
}
