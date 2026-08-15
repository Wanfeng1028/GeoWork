// GeoWork Go Core - Approval Governor Types (consumer-side contract)
//
// Defines ExecutionMode, ApprovalDecision, ApprovalRequest, ApprovalResult,
// ApprovalGovernor interface and ErrApprovalRequired. Lives in package
// toolregistry (the consumer) so that aiagent.GovernorImpl can implement
// ApprovalGovernor without creating a toolregistry ↔ aiagent import cycle
// (aiagent → toolregistry is one-directional).

package toolregistry

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// ═══════════════════════════════════════════════════════════════════════
// ExecutionMode
// ═══════════════════════════════════════════════════════════════════════

// ExecutionMode distinguishes autonomous (LLM-driven) execution from
// deterministic (workflow-driven) execution. The ApprovalGovernor uses it
// to decide whether a critical tool requires interactive approval.
type ExecutionMode int

const (
	// ModeAutonomous is LLM-driven: critical operations MUST be approved
	// by the user before they execute.
	ModeAutonomous ExecutionMode = iota
	// ModeDeterministic is workflow-driven: the user has authorized the
	// workflow at design time, so critical operations are audit-logged
	// but not blocked.
	ModeDeterministic
)

// String returns a human-readable label for the mode, used in logs/events.
func (m ExecutionMode) String() string {
	switch m {
	case ModeAutonomous:
		return "autonomous"
	case ModeDeterministic:
		return "deterministic"
	default:
		return "unknown"
	}
}

// ═══════════════════════════════════════════════════════════════════════
// Approval decision and request/result envelopes
// ═══════════════════════════════════════════════════════════════════════

// ApprovalDecision is the lifecycle state of an approval request.
type ApprovalDecision string

const (
	// ApprovalPending: request created, waiting for user response.
	ApprovalPending ApprovalDecision = "pending"
	// ApprovalApproved: user approved the operation; tool may execute.
	ApprovalApproved ApprovalDecision = "approved"
	// ApprovalRejected: request superseded by a newer decision (rare).
	ApprovalRejected ApprovalDecision = "rejected"
	// ApprovalDenied: user explicitly denied the operation.
	ApprovalDenied ApprovalDecision = "denied"
	// ApprovalTimeout: no user response within the timeout window; the
	// orchestrator pauses the run and emits approval_timeout.
	ApprovalTimeout ApprovalDecision = "timeout"
)

// ApprovalRequest represents a tool invocation that is waiting for user
// approval. The orchestrator creates one via ApprovalGovernor.CheckPermission
// and then blocks on req.DecisionCh until a decision arrives (or the
// timeout fires, in which case the orchestrator resolves it as timeout).
type ApprovalRequest struct {
	ID        string
	RunID     string
	ToolName  string
	Args      map[string]any
	RiskLevel string
	CreatedAt time.Time
	Decision  ApprovalDecision
	Reason    string
	// DecisionCh carries the user's decision back to the waiting goroutine.
	// Buffered with capacity 1 so ResolveApproval can write without
	// blocking even if the waiter hasn't reached the receive yet.
	DecisionCh chan ApprovalResult
}

// ApprovalResult is the envelope pushed onto ApprovalRequest.DecisionCh
// when a user (or the timeout handler) resolves a request.
type ApprovalResult struct {
	Decision   ApprovalDecision
	Reason     string
	ResolvedBy string
}

// ═══════════════════════════════════════════════════════════════════════
// ApprovalGovernor interface
// ═══════════════════════════════════════════════════════════════════════

// ApprovalGovernor manages interactive approval for critical tools.
//
// Naming note: this interface is intentionally NOT called Governor,
// because package toolregistry already has a `type Governor struct`
// (the rate-limit / policy manager in governor.go). The two are
// orthogonal:
//   - Governor (existing): call-frequency / quota / policy checks
//     (RecordCall / CheckBeforeCall / IsGoverned).
//   - ApprovalGovernor (this interface): interactive approval flow
//     (CheckPermission / ResolveApproval).
//
// The concrete implementation lives in package aiagent (GovernorImpl)
// and is wired into the Registry via WithApprovalGovernor.
type ApprovalGovernor interface {
	// CheckPermission inspects the tool + mode and returns either:
	//   - (nil, nil): execution may proceed without approval; or
	//   - (req, nil): execution must wait for the user; the caller
	//     blocks on req.DecisionCh; or
	//   - (nil, err): a hard rejection (e.g. tool not registered).
	CheckPermission(runID, toolName string, args map[string]any, mode ExecutionMode) (*ApprovalRequest, error)

	// ResolveApproval delivers a user (or timeout) decision to the
	// waiting goroutine. Must be idempotent: a second resolve on the
	// same request is a no-op.
	ResolveApproval(reqID string, decision ApprovalDecision, reason string) error

	// PendingApprovals returns the currently pending approval requests
	// for the given run, used by the GET /approvals/{runId} API.
	PendingApprovals(runID string) []*ApprovalRequest
}

// ═══════════════════════════════════════════════════════════════════════
// ErrApprovalRequired
// ═══════════════════════════════════════════════════════════════════════

// ErrApprovalRequired is returned by Registry.Execute when a tool call
// must wait for interactive approval. The orchestrator catches this error,
// extracts Req, and calls waitForApproval before retrying the call (by
// which point the governor has flipped the decision to approved and
// CheckPermission returns nil).
//
// Keeping the wait at the orchestrator layer avoids a Registry → aiagent
// reverse dependency: Registry stays unaware of how the wait is performed.
type ErrApprovalRequired struct {
	Req *ApprovalRequest
}

func (e *ErrApprovalRequired) Error() string {
	if e == nil || e.Req == nil {
		return "approval required (no request details)"
	}
	return fmt.Sprintf("approval required for tool %s (req %s)", e.Req.ToolName, e.Req.ID)
}

// IsApprovalRequired reports whether err wraps an *ErrApprovalRequired
// and returns the wrapped value when it does. Convenience helper for
// orchestrator call sites that need to extract Req.
func IsApprovalRequired(err error) (*ErrApprovalRequired, bool) {
	var target *ErrApprovalRequired
	if errors.As(err, &target) {
		return target, true
	}
	return nil, false
}

// ═══════════════════════════════════════════════════════════════════════
// Run ID context key
// ═══════════════════════════════════════════════════════════════════════

// runIDKey is the context key used to carry the current run ID through
// Registry.Execute so the ApprovalGovernor can attribute the approval
// request to the right run. Declared here so both the orchestrator
// (writer) and the registry (reader) reference the same key type.
type runIDKey struct{}

// WithRunID returns a new context that carries runID, so downstream
// Registry.Execute calls can recover it for approval attribution.
func WithRunID(ctx context.Context, runID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, runIDKey{}, runID)
}

// RunIDFromContext extracts the run ID previously attached via WithRunID.
// Returns empty string when none is set.
func RunIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	v, _ := ctx.Value(runIDKey{}).(string)
	return v
}
