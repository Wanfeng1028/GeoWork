// GeoWork Go Core - Approval state-machine tests (doc/22 BP2)
//
// waitForApproval and the approver's decision memory had ZERO test
// coverage, which is how the approve-retry loop (F2) survived: the
// user approved, the retry raised a NEW approval request, forever.
// These tests pin the full approval lifecycle.

package aiagent

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/zap"

	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"
)

// approvalAssembly mirrors newAssemblyOrchestrator plus one critical
// tool whose executions are counted.
type approvalAssembly struct {
	orch      *Orchestrator
	registry  *toolregistry.Registry
	ws        string
	execCount *atomic.Int32 // kept for registry-level crit_touch counting
}

func newApprovalAssembly(t *testing.T, gw modelgateway.ModelGateway) *approvalAssembly {
	t.Helper()
	ws := t.TempDir()
	log := zap.NewNop()
	registry := toolregistry.NewRegistry(log)
	if err := toolregistry.RegisterBuiltinTools(registry); err != nil {
		t.Fatalf("register builtin tools: %v", err)
	}
	registry.WithAllowedRoots([]string{ws})
	a := &approvalAssembly{registry: registry, ws: ws, execCount: &atomic.Int32{}}
	if err := registry.Register(toolregistry.NewBuilder("crit_touch").
		Description("critical test tool").
		Permission("exec").
		RiskLevel("critical").
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			return map[string]any{"exec": a.execCount.Add(1)}, nil
		}).
		Build()); err != nil {
		t.Fatalf("register crit tool: %v", err)
	}
	provider := &modelgateway.ModelProvider{ID: "scripted", DefaultModel: "scripted-model"}
	orch := NewOrchestrator(registry, gw, provider, log)
	orch.WithHarness(NewHarness(log))
	orch.WithPermissionPolicy(DefaultDesktopPolicy())
	orch.WithWorkspacePath(ws)
	a.orch = orch
	return a
}

// shellToolCall drives the REAL builtin run_shell (RiskLevel critical)
// through the full state-machine + approval path.
func wsOf(a *approvalAssembly) string { return a.ws }

func shellToolCall(id, command string) modelgateway.ToolCall {
	return modelgateway.ToolCall{
		Index: 0,
		ID:    id,
		Type:  "function",
		Function: modelgateway.ToolFunctionCall{
			Name:      "run_shell",
			Arguments: fmt.Sprintf(`{"command":%q}`, command),
		},
	}
}

// autoResolver resolves every pending approval with the given decision,
// counting UNIQUE request IDs so a re-ask loop is detectable.
func autoResolver(orch *Orchestrator, runID string, decision toolregistry.ApprovalDecision) (*atomic.Int32, func()) {
	var seen sync.Map // reqID -> struct{}{}
	count := &atomic.Int32{}
	stop := make(chan struct{})
	go func() {
		for {
			select {
			case <-stop:
				return
			default:
			}
			for _, p := range orch.approver.PendingApprovals(runID) {
				if _, dup := seen.LoadOrStore(p.ID, struct{}{}); !dup {
					count.Add(1)
				}
				_ = orch.approver.ResolveApproval(p.ID, decision, "test")
			}
			time.Sleep(2 * time.Millisecond)
		}
	}()
	return count, func() { close(stop) }
}

// F2 regression: after the user approves a critical call, the retry must
// proceed WITHOUT a second approval request. Before BP2 this looped
// forever (each retry raised a new approval request).
func TestApproval_ApproveRetryDoesNotReask(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{
		{toolCalls: []modelgateway.ToolCall{shellToolCall("c1", "echo approved > ok.txt")}},
		{content: "done"},
	}}
	a := newApprovalAssembly(t, gw)

	run, err := a.orch.StartRun(context.Background(), "Work", "run a shell command")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	asked, stop := autoResolver(a.orch, run.ID, toolregistry.ApprovalApproved)
	defer stop()

	done := waitRun(t, a.orch, run.ID)
	if done.Status != StatusCompleted {
		t.Fatalf("run status = %s (result: %s), want completed", done.Status, done.Result)
	}
	if got := asked.Load(); got != 1 {
		t.Fatalf("approval requested %d times, want exactly 1 (approve-retry re-asked)", got)
	}
	if _, err := os.Stat(filepath.Join(wsOf(a), "ok.txt")); err != nil {
		t.Fatalf("run_shell did not execute after approval: %v (run.Result=%q)", err, done.Result)
	}
	if got := asked.Load(); got != 1 {
		t.Fatalf("approval requested %d times, want exactly 1 (approve-retry re-asked)", got)
	}
}

// A denial must reach the model as a tool error without executing the
// tool; the run itself still completes.
func TestApproval_DenySurfacesToModel(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{
		{toolCalls: []modelgateway.ToolCall{shellToolCall("c1", "echo denied > no.txt")}},
		{content: "understood, the call was denied"},
	}}
	a := newApprovalAssembly(t, gw)

	run, err := a.orch.StartRun(context.Background(), "Work", "run a shell command")
	if err != nil {
		t.Fatalf("StartRun: %v", err)
	}
	_, stop := autoResolver(a.orch, run.ID, toolregistry.ApprovalDenied)
	defer stop()

	done := waitRun(t, a.orch, run.ID)
	if done.Status != StatusCompleted {
		t.Fatalf("run status = %s, want completed (denial must not fail the run)", done.Status)
	}
	if _, err := os.Stat(filepath.Join(wsOf(a), "no.txt")); !os.IsNotExist(err) {
		t.Fatalf("denied run_shell must not execute")
	}
}

// Approver-level: an approved decision is reused for identical args.
func TestApproval_MemoReusedForSameArgs(t *testing.T) {
	a := newApprovalAssembly(t, &scriptedGateway{})
	approver := a.orch.approver

	req, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req == nil {
		t.Fatalf("expected approval request, got req=%v err=%v", req, err)
	}
	if err := approver.ResolveApproval(req.ID, toolregistry.ApprovalApproved, "ok"); err != nil {
		t.Fatalf("resolve: %v", err)
	}
	req2, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req2 != nil {
		t.Fatalf("identical call after approve must be memo-pass-through, got req=%v err=%v", req2, err)
	}
}

// Approver-level: different args invalidate the memo and re-ask.
func TestApproval_ArgsChangeReasks(t *testing.T) {
	a := newApprovalAssembly(t, &scriptedGateway{})
	approver := a.orch.approver

	req, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req == nil {
		t.Fatalf("expected approval request, got req=%v err=%v", req, err)
	}
	_ = approver.ResolveApproval(req.ID, toolregistry.ApprovalApproved, "ok")

	req2, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 999}, toolregistry.ModeAutonomous)
	if err != nil || req2 == nil {
		t.Fatalf("changed args must raise a NEW approval request, got req=%v err=%v", req2, err)
	}
}

// Approver-level: a denied decision is also remembered within the TTL —
// an identical re-call is rejected outright instead of re-prompting.
func TestApproval_DeniedMemoRejects(t *testing.T) {
	a := newApprovalAssembly(t, &scriptedGateway{})
	approver := a.orch.approver

	req, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req == nil {
		t.Fatalf("expected approval request, got req=%v err=%v", req, err)
	}
	_ = approver.ResolveApproval(req.ID, toolregistry.ApprovalDenied, "no")
	if _, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous); err == nil {
		t.Fatalf("identical denied call must be rejected from memo, got no error")
	}
}

// Timeout resolves are NOT memoized (a timeout is not a user decision);
// the next identical call must be able to ask again.
func TestApproval_TimeoutNotMemoized(t *testing.T) {
	a := newApprovalAssembly(t, &scriptedGateway{})
	approver := a.orch.approver

	req, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req == nil {
		t.Fatalf("expected approval request, got req=%v err=%v", req, err)
	}
	_ = approver.ResolveApproval(req.ID, toolregistry.ApprovalTimeout, "5min")
	req2, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req2 == nil {
		t.Fatalf("post-timeout identical call must re-ask, got req=%v err=%v", req2, err)
	}
}

// Memo expiry: a backdated memo no longer authorizes the call.
func TestApproval_MemoTTLExpiry(t *testing.T) {
	a := newApprovalAssembly(t, &scriptedGateway{})
	approver := a.orch.approver

	req, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req == nil {
		t.Fatalf("expected approval request, got req=%v err=%v", req, err)
	}
	_ = approver.ResolveApproval(req.ID, toolregistry.ApprovalApproved, "ok")

	approver.mu.Lock()
	key := memoKey("run-1", "crit_touch", map[string]any{"x": 1})
	if m, ok := approver.memos[key]; ok {
		m.at = time.Now().Add(-approvalMemoTTL - time.Second)
		approver.memos[key] = m
	} else {
		approver.mu.Unlock()
		t.Fatalf("memo missing after resolve")
	}
	approver.mu.Unlock()

	req2, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req2 == nil {
		t.Fatalf("expired memo must re-ask, got req=%v err=%v", req2, err)
	}
}

// Double resolve on the same request is idempotent (single buffered
// decision; no panic, no second signal).
func TestApproval_DoubleResolveIdempotent(t *testing.T) {
	a := newApprovalAssembly(t, &scriptedGateway{})
	approver := a.orch.approver

	req, err := approver.CheckPermission("run-1", "crit_touch", map[string]any{"x": 1}, toolregistry.ModeAutonomous)
	if err != nil || req == nil {
		t.Fatalf("expected approval request, got req=%v err=%v", req, err)
	}
	if err := approver.ResolveApproval(req.ID, toolregistry.ApprovalApproved, "first"); err != nil {
		t.Fatalf("first resolve: %v", err)
	}
	if err := approver.ResolveApproval(req.ID, toolregistry.ApprovalDenied, "second"); err != nil {
		t.Fatalf("second resolve must not error: %v", err)
	}
	select {
	case r := <-req.DecisionCh:
		if r.Decision != toolregistry.ApprovalApproved {
			t.Fatalf("first decision must win, got %s", r.Decision)
		}
	default:
		// Waiter not yet listening: the buffered value is the approve.
		select {
		case r := <-req.DecisionCh:
			if r.Decision != toolregistry.ApprovalApproved {
				t.Fatalf("first decision must win, got %s", r.Decision)
			}
		case <-time.After(100 * time.Millisecond):
			t.Fatalf("no decision buffered")
		}
	}
	// Exactly one buffered result — the deny fell through.
	if len(req.DecisionCh) != 0 {
		t.Fatalf("duplicate decision buffered")
	}
}
