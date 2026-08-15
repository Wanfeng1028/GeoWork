// GeoWork Go Core - Approval Governor Implementation
//
// GovernorImpl is the concrete implementation of
// toolregistry.ApprovalGovernor. It lives in package aiagent (the
// implementer), so the dependency direction stays one-way:
// aiagent → toolregistry. The Registry only sees the interface
// (ApprovalGovernor) and never imports aiagent.
//
// Naming note: this struct is intentionally NOT called Governor,
// because package toolregistry already has a `type Governor struct`
// (the rate-limit / policy manager in toolregistry/governor.go).
// The two are orthogonal:
//   - toolregistry.Governor (existing): call frequency / quota / policy
//   - aiagent.GovernorImpl (this struct): interactive user approval flow

package aiagent

import (
	"fmt"
	"sync"
	"time"

	"geowork/core/internal/idgen"
	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// Compile-time assertion: GovernorImpl implements ApprovalGovernor.
// If the interface drifts (e.g. a method is renamed), this fails at
// compile time rather than at the first call site.
var _ toolregistry.ApprovalGovernor = (*GovernorImpl)(nil)

// GovernorImpl tracks pending approval requests and resolves them
// when the user (or the approval-timeout handler) makes a decision.
//
// The pendingApps map is keyed by request ID; each entry is also
// discoverable via PendingApprovals(runID) for the
// GET /api/agent/approvals/{runId} API.
type GovernorImpl struct {
	log      *zap.Logger
	registry *toolregistry.Registry // read-only: tool metadata (RiskLevel) lookup

	mu          sync.Mutex
	pendingApps map[string]*toolregistry.ApprovalRequest // reqID -> pending request
}

// NewGovernorImpl constructs a GovernorImpl bound to a registry for
// RiskLevel lookups. The registry reference is intentionally *Registry
// (concrete) rather than an interface because GovernorImpl also relies
// on Registry.Get for tool metadata — and we accept that aiagent already
// imports toolregistry, so this does not introduce a new cycle.
func NewGovernorImpl(log *zap.Logger, registry *toolregistry.Registry) *GovernorImpl {
	return &GovernorImpl{
		log:         log,
		registry:    registry,
		pendingApps: make(map[string]*toolregistry.ApprovalRequest),
	}
}

// CheckPermission implements toolregistry.ApprovalGovernor.
//
// Decision matrix:
//
//	tool not registered        → (nil, err)            hard reject
//	risk != "critical"          → (nil, nil)            proceed, no approval
//	risk == critical + deterministic → (nil, nil)       audit-only (workflow)
//	risk == critical + autonomous   → (req, nil)        block for approval
//
// When (req, nil) is returned, the caller (orchestrator) MUST block on
// req.DecisionCh until either the user resolves it or the timeout fires.
// The orchestrator owns the wait because blocking here would force
// toolregistry to import aiagent (reverse dependency).
func (g *GovernorImpl) CheckPermission(
	runID, toolName string,
	args map[string]any,
	mode toolregistry.ExecutionMode,
) (*toolregistry.ApprovalRequest, error) {
	tool, ok := g.registry.Get(toolName)
	if !ok {
		return nil, fmt.Errorf("tool %q not registered", toolName)
	}

	// Non-critical tools never require interactive approval.
	if tool.RiskLevel() != "critical" {
		return nil, nil
	}

	// Deterministic (workflow) path: critical but pre-authorized at
	// design time. Audit-log only and let the call proceed.
	if mode == toolregistry.ModeDeterministic {
		g.log.Info("critical tool in deterministic mode, audit only",
			zap.String("tool", toolName),
			zap.String("runID", runID),
		)
		return nil, nil
	}

	// Autonomous (LLM) path: critical operation requires user approval.
	req := &toolregistry.ApprovalRequest{
		ID:         idgen.NewPrefixed("apr_"),
		RunID:      runID,
		ToolName:   toolName,
		Args:       args,
		RiskLevel:  tool.RiskLevel(),
		CreatedAt:  time.Now(),
		Decision:   toolregistry.ApprovalPending,
		DecisionCh: make(chan toolregistry.ApprovalResult, 1), // buffered: ResolveApproval writes without blocking
	}

	g.mu.Lock()
	g.pendingApps[req.ID] = req
	g.mu.Unlock()

	g.log.Info("approval required",
		zap.String("approvalId", req.ID),
		zap.String("runID", runID),
		zap.String("tool", toolName),
		zap.String("risk", req.RiskLevel),
	)
	return req, nil
}

// ResolveApproval implements toolregistry.ApprovalGovernor.
//
// Idempotent: a second resolve on the same request is a no-op
// (DecisionCh has capacity 1; the first write wins, subsequent writes
// fall through the select-default branch).
func (g *GovernorImpl) ResolveApproval(reqID string, decision toolregistry.ApprovalDecision, reason string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	req, ok := g.pendingApps[reqID]
	if !ok {
		return fmt.Errorf("approval request %q not found", reqID)
	}

	req.Decision = decision
	req.Reason = reason

	// Non-blocking push: if the orchestrator has already moved on
	// (e.g. context cancelled before reaching the receive), the write
	// is still buffered and will be drained when the waiter arrives.
	select {
	case req.DecisionCh <- toolregistry.ApprovalResult{
		Decision:   decision,
		Reason:     reason,
		ResolvedBy: "system",
	}:
	default:
		// Already has a pending decision — ignore duplicate resolve.
	}

	g.log.Info("approval resolved",
		zap.String("approvalId", reqID),
		zap.String("decision", string(decision)),
		zap.String("reason", reason),
	)
	return nil
}

// PendingApprovals implements toolregistry.ApprovalGovernor.
// Returns a snapshot of pending requests attributed to runID, used by
// the GET /api/agent/approvals/{runId} API.
func (g *GovernorImpl) PendingApprovals(runID string) []*toolregistry.ApprovalRequest {
	g.mu.Lock()
	defer g.mu.Unlock()

	out := make([]*toolregistry.ApprovalRequest, 0)
	for _, req := range g.pendingApps {
		if req.RunID == runID && req.Decision == toolregistry.ApprovalPending {
			// Return a shallow copy so callers cannot mutate state.
			cp := *req
			out = append(out, &cp)
		}
	}
	return out
}

// RemoveApproval drops a request from the pending map. Called by the
// orchestrator after waitForApproval returns (regardless of outcome)
// so the pending list only ever contains requests that are still
// actively waiting on a user decision.
func (g *GovernorImpl) RemoveApproval(reqID string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.pendingApps, reqID)
}
