// GeoWork Go Core - Interactive Approval (doc/22 BP2)
//
// InteractiveApprover is the concrete implementation of
// toolregistry.ApprovalGovernor. It lives in package aiagent (the
// implementer), so the dependency direction stays one-way:
// aiagent → toolregistry. The Registry only sees the interface
// (ApprovalGovernor) and never imports aiagent.
//
// Naming (doc/22 D-B2): there used to be two unrelated types both named
// "Governor" — toolregistry.Governor (call frequency / quota, now
// QuotaGovernor) and this struct (formerly GovernorImpl). The collision
// made approval-flow debugging point at the wrong file.
//
// Decision memory (doc/22 F2): a resolved decision is remembered per
// (run, tool, args-hash) for a short TTL. Without it, the orchestrator's
// approve-and-retry path re-entered CheckPermission, which raised a NEW
// approval request for the identical call — the user had to approve the
// same operation forever.

package aiagent

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"geowork/core/internal/idgen"
	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// approvalMemoTTL bounds how long an approved/denied decision is reused
// for identical (run, tool, args) calls. Short by design: approvals are
// security-sensitive, and the memory exists to make approve-then-retry
// terminate, not to batch-approve a whole session.
const approvalMemoTTL = 10 * time.Minute

// approvalMemoMax caps the memo map to bound memory on very long runs;
// expired entries are pruned opportunistically on insert.
const approvalMemoMax = 256

type approvalMemo struct {
	decision toolregistry.ApprovalDecision
	at       time.Time
}

// Compile-time assertion: InteractiveApprover implements ApprovalGovernor.
// If the interface drifts (e.g. a method is renamed), this fails at
// compile time rather than at the first call site.
var _ toolregistry.ApprovalGovernor = (*InteractiveApprover)(nil)

// InteractiveApprover tracks pending approval requests and resolves them
// when the user (or the approval-timeout handler) makes a decision.
//
// The pendingApps map is keyed by request ID; each entry is also
// discoverable via PendingApprovals(runID) for the
// GET /api/agent/approvals/{runId} API.
type InteractiveApprover struct {
	log      *zap.Logger
	registry *toolregistry.Registry // read-only: tool metadata (RiskLevel) lookup

	mu          sync.Mutex
	pendingApps map[string]*toolregistry.ApprovalRequest // reqID -> pending request
	memos       map[string]approvalMemo                  // runID|tool|argsHash -> remembered decision
}

// NewInteractiveApprover constructs an InteractiveApprover bound to a
// registry for RiskLevel lookups. The registry reference is intentionally
// *Registry (concrete) rather than an interface because the approver also
// relies on Registry.Get for tool metadata — and we accept that aiagent
// already imports toolregistry, so this does not introduce a new cycle.
func NewInteractiveApprover(log *zap.Logger, registry *toolregistry.Registry) *InteractiveApprover {
	return &InteractiveApprover{
		log:         log,
		registry:    registry,
		pendingApps: make(map[string]*toolregistry.ApprovalRequest),
		memos:       make(map[string]approvalMemo),
	}
}

// argsHash canonicalizes the call arguments: json.Marshal sorts map keys,
// so identical args always hash identically.
func argsHash(args map[string]any) string {
	b, err := json.Marshal(args)
	if err != nil {
		// Unserializable args (should not happen for JSON-schema tools)
		// degrade to a length marker; the run+tool key parts still apply.
		b = []byte(fmt.Sprintf("unserializable:%d", len(args)))
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:8])
}

func memoKey(runID, toolName string, args map[string]any) string {
	return runID + "|" + toolName + "|" + argsHash(args)
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
func (g *InteractiveApprover) CheckPermission(
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

	// Decision memory (doc/22 F2): an identical (run, tool, args) call
	// that was already decided within the TTL does not ask again —
	// this is what makes the orchestrator's approve-and-retry path
	// terminate instead of looping on new approval requests.
	key := memoKey(runID, toolName, args)
	g.mu.Lock()
	if memo, ok := g.memos[key]; ok {
		if time.Since(memo.at) < approvalMemoTTL {
			decision := memo.decision
			g.mu.Unlock()
			if decision == toolregistry.ApprovalApproved {
				g.log.Info("reusing approved decision",
					zap.String("runID", runID),
					zap.String("tool", toolName),
				)
				return nil, nil
			}
			return nil, fmt.Errorf("tool %q was denied by user decision (within TTL): reuse of denial", toolName)
		}
		delete(g.memos, key)
	}
	g.mu.Unlock()

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
func (g *InteractiveApprover) ResolveApproval(reqID string, decision toolregistry.ApprovalDecision, reason string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	req, ok := g.pendingApps[reqID]
	if !ok {
		return fmt.Errorf("approval request %q not found", reqID)
	}

	req.Decision = decision
	req.Reason = reason

	// Record the decision in memory (doc/22 F2) so the orchestrator's
	// retry of the identical call does not raise a new approval request.
	if decision == toolregistry.ApprovalApproved || decision == toolregistry.ApprovalDenied {
		key := memoKey(req.RunID, req.ToolName, req.Args)
		g.memos[key] = approvalMemo{decision: decision, at: time.Now()}
		if len(g.memos) > approvalMemoMax {
			for k, m := range g.memos {
				if time.Since(m.at) >= approvalMemoTTL {
					delete(g.memos, k)
				}
			}
			// Still over cap (all fresh): drop the oldest entry.
			if len(g.memos) > approvalMemoMax {
				var oldestKey string
				var oldestAt time.Time
				first := true
				for k, m := range g.memos {
					if first || m.at.Before(oldestAt) {
						oldestKey, oldestAt, first = k, m.at, false
					}
				}
				delete(g.memos, oldestKey)
			}
		}
	}

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
func (g *InteractiveApprover) PendingApprovals(runID string) []*toolregistry.ApprovalRequest {
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
func (g *InteractiveApprover) RemoveApproval(reqID string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.pendingApps, reqID)
}
