// GeoWork Go Core - doc/22 BP5 regression tests
//
// Covers the three BP5 fixes that change observable behavior:
//
//   - S7 speculative-executor lifetime: Cleanup moved from a defer in
//     streamModelCall (which fired BEFORE the tool loop consumed the
//     cached result) to the end of the turn. A read-only tool must now
//     execute exactly once — during streaming — and the tool loop must
//     reuse the cached result instead of re-executing.
//   - DeleteRun + retention: finished runs (and their checkpoints) can be
//     removed; running runs refuse deletion; the in-memory run map is
//     bounded to maxRetainedRuns terminal runs.
//   - SubAgentManager.CleanupChildren stops + drops a parent's children.

package aiagent

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/zap"

	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"
)

// countingReadTool wraps the read_file tool with an execution counter so
// the speculative-reuse test can assert the tool ran exactly once.
func newCountingOrchestrator(gw modelgateway.ModelGateway, count *int64) *Orchestrator {
	log := zap.NewNop()
	registry := toolregistry.NewRegistry(log)
	_ = registry.Register(toolregistry.NewBuilder("read_file").
		Description("test read tool").
		RiskLevel("low").
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			atomic.AddInt64(count, 1)
			return map[string]any{"content": "ok"}, nil
		}).Build())
	provider := &modelgateway.ModelProvider{ID: "scripted", DefaultModel: "scripted-model"}
	o := NewOrchestrator(registry, gw, provider, log)
	// ReadOnly policy is what makes read_file eligible for speculative
	// execution during streaming (P3-3 §4.5.2).
	o.WithPolicyTable(toolregistry.DefaultPolicyTable())
	return o
}

// TestSpeculativeReuse_ReadOnce verifies the S7 fix: a read-only tool
// whose arguments complete during streaming is executed speculatively and
// the tool-execution loop reuses the cached result. Before the fix the
// deferred Cleanup in streamModelCall wiped the result before the loop
// read it, so the tool ran twice.
func TestSpeculativeReuse_ReadOnce(t *testing.T) {
	var count int64
	gw := &scriptedGateway{responses: []scriptedResponse{
		// Turn 1: one read_file tool call with complete JSON args.
		{toolCalls: []modelgateway.ToolCall{readToolCall("call_1")}},
		// Turn 2: no tool calls → loop exits.
		{content: "done"},
	}}
	o := newCountingOrchestrator(gw, &count)

	run, err := o.StartRun(context.Background(), "test", "read a file")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	waitRun(t, o, run.ID)

	got := atomic.LoadInt64(&count)
	if got != 1 {
		t.Fatalf("read_file executed %d times, want exactly 1 (speculative result must be reused, not re-executed)", got)
	}
}

// TestDeleteRun_RemovesFinishedRun verifies DeleteRun drops a completed run
// and its checkpoint, and that a subsequent GetRun reports it gone.
func TestDeleteRun_RemovesFinishedRun(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{{content: "done"}}}
	o := newTestOrchestrator(gw)

	run, err := o.StartRun(context.Background(), "test", "quick run")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	waitRun(t, o, run.ID)

	// Seed a checkpoint so we can assert it is removed too.
	o.recovery.Save(run.ID, []byte(`{"status":"completed"}`))
	if _, ok := o.recovery.Load(run.ID); !ok {
		t.Fatalf("checkpoint was not saved before delete")
	}

	if err := o.DeleteRun(run.ID); err != nil {
		t.Fatalf("DeleteRun failed: %v", err)
	}
	if _, ok := o.GetRun(run.ID); ok {
		t.Fatalf("run still present after DeleteRun")
	}
	if _, ok := o.recovery.Load(run.ID); ok {
		t.Fatalf("checkpoint still present after DeleteRun")
	}
}

// TestDeleteRun_RefusesRunning verifies DeleteRun rejects a run that is
// still executing.
func TestDeleteRun_RefusesRunning(t *testing.T) {
	gw := &scriptedGateway{block: true}
	o := newTestOrchestrator(gw)

	run, err := o.StartRun(context.Background(), "test", "long run")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	// Give the run goroutine a moment to enter the blocking stream.
	time.Sleep(50 * time.Millisecond)

	if err := o.DeleteRun(run.ID); err == nil {
		t.Fatalf("DeleteRun should refuse a running run")
	}
	// Clean up so the blocked goroutine doesn't leak past the test.
	o.StopRun(run.ID)
}

// TestEnforceRunRetention_BoundsTerminalRuns verifies the run map is capped
// at maxRetainedRuns terminal runs, evicting the oldest first, and that
// running runs are never evicted.
func TestEnforceRunRetention_BoundsTerminalRuns(t *testing.T) {
	o := newTestOrchestrator(&scriptedGateway{})

	now := time.Now()
	total := maxRetainedRuns + 10
	for i := 0; i < total; i++ {
		id := "run_retention_" + string(rune('A'+i%26)) + string(rune('0'+i/26))
		o.runs[id] = &Run{
			ID:        id,
			Status:    StatusCompleted,
			UpdatedAt: now.Add(time.Duration(i) * time.Second), // older first
		}
	}
	// One running run must survive retention.
	o.runs["run_active"] = &Run{ID: "run_active", Status: StatusRunning, UpdatedAt: now}
	o.running["run_active"] = true

	o.enforceRunRetention()

	if got := len(o.runs); got != maxRetainedRuns+1 { // 100 terminal + 1 active
		t.Fatalf("run map has %d entries after retention, want %d", got, maxRetainedRuns+1)
	}
	if _, ok := o.runs["run_active"]; !ok {
		t.Fatalf("running run was evicted by retention")
	}
	// The oldest terminal run (i=0) must be gone; the newest must remain.
	if _, ok := o.runs["run_retention_A0"]; ok {
		t.Fatalf("oldest terminal run was not evicted")
	}
}

// TestCleanupChildren_StopsSubAgents verifies SubAgentManager.CleanupChildren
// removes a parent's children from the tracking maps.
func TestCleanupChildren_StopsSubAgents(t *testing.T) {
	parent := newTestOrchestrator(&scriptedGateway{})
	mgr := NewSubAgentManager(parent, zap.NewNop())

	// Register two fake children under a parent run.
	childA := newTestOrchestrator(&scriptedGateway{})
	childB := newTestOrchestrator(&scriptedGateway{})
	mgr.children["sub_a"] = childA
	mgr.children["sub_b"] = childB
	mgr.parentOf["sub_a"] = "parent_run"
	mgr.parentOf["sub_b"] = "parent_run"

	mgr.CleanupChildren("parent_run")

	if got := len(mgr.children); got != 0 {
		t.Fatalf("children map has %d entries after cleanup, want 0", got)
	}
	if got := len(mgr.parentOf); got != 0 {
		t.Fatalf("parentOf map has %d entries after cleanup, want 0", got)
	}
}
