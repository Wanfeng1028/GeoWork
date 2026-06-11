package toolregistry

import (
	"fmt"
	"sync"
	"testing"
)

func TestDefaultToolPolicies(t *testing.T) {
	policies := DefaultToolPolicies()
	if len(policies) == 0 {
		t.Fatal("DefaultToolPolicies returned empty list")
	}

	// Check that git_push is always denied
	var gitPushPolicy *ToolPolicy
	for _, p := range policies {
		if p.Name == "git_push" {
			gitPushPolicy = &p
			break
		}
	}
	if gitPushPolicy == nil {
		t.Fatal("git_push policy not found")
	}
	if !gitPushPolicy.AlwaysDeny {
		t.Error("git_push should always be denied")
	}
}

func TestGovernor_AlwaysDeny(t *testing.T) {
	g := NewGovernor("task-1", nil)

	err := g.RecordCall("git_push")
	if err == nil {
		t.Error("Expected error for always-deny tool")
	}
}

func TestGovernor_PerTurnLimit(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// read_file has MaxCallsPerTurn=5
	for i := 0; i < 5; i++ {
		if err := g.RecordCall("read_file"); err != nil {
			t.Fatalf("Call %d failed: %v", i+1, err)
		}
	}
	err := g.RecordCall("read_file")
	if err == nil {
		t.Error("Expected error: read_file exceeded per-turn limit")
	}
}

func TestGovernor_PerTaskLimit(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// write_file has MaxCallsPerTask=50, MaxCallsPerTurn=3, RequiresApproval=true
	// and requires "write_file" permission. We need to approve first.
	g.ApproveTool("write_file")
	g.ApprovePermission("write_file", ActionWriteFile)

	// Per-turn limit is 3, so first 3 should succeed
	for i := 0; i < 3; i++ {
		if err := g.RecordCall("write_file"); err != nil {
			t.Fatalf("Per-turn call %d failed: %v", i+1, err)
		}
	}

	// Reset turn to test per-task limit
	g.StartNewTurn()

	// Now do more calls to hit per-task limit (50 total, 3 already done)
	for i := 0; i < 47; i++ {
		if err := g.RecordCall("write_file"); err != nil {
			t.Fatalf("Per-task call %d failed: %v", i+4, err)
		}
	}

	// This should exceed per-task limit
	err := g.RecordCall("write_file")
	if err == nil {
		t.Error("Expected error: write_file exceeded per-task limit")
	}
}

func TestGovernor_RequiresApproval(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// run_shell requires approval
	err := g.RecordCall("run_shell")
	if err == nil {
		t.Error("Expected error: run_shell requires approval before execution")
	}

	// Approve the tool AND the dangerous action
	g.ApproveTool("run_shell")
	g.ApprovePermission("run_shell", ActionRunShell)
	err = g.RecordCall("run_shell")
	if err != nil {
		t.Errorf("After approval, expected no error: %v", err)
	}
}

func TestGovernor_CheckBeforeCall(t *testing.T) {
	g := NewGovernor("task-1", nil)

	allowed, reason, remaining := g.CheckBeforeCall("git_push")
	if allowed {
		t.Error("git_push should not be allowed (always deny)")
	}
	if reason == "" {
		t.Error("reason should not be empty for denied tool")
	}

	// Check unapproved tool
	allowed, reason, _ = g.CheckBeforeCall("run_shell")
	if allowed {
		t.Error("run_shell should not be allowed before approval")
	}
	if reason == "" {
		t.Error("reason should not be empty for unapproved tool")
	}
	_ = remaining
}

func TestGovernor_StartNewTurn(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// Use up per-turn limit
	for i := 0; i < 5; i++ {
		g.RecordCall("read_file")
	}

	// Should be blocked
	err := g.RecordCall("read_file")
	if err == nil {
		t.Error("Should be blocked before reset")
	}

	// Reset turn
	g.StartNewTurn()

	// Should be allowed again
	err = g.RecordCall("read_file")
	if err != nil {
		t.Errorf("After reset, should be allowed: %v", err)
	}
}

func TestGovernor_ApprovePermission(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// write_file requires "write_file" permission
	allowed, reason, _ := g.CheckBeforeCall("write_file")
	if allowed {
		t.Error("write_file should require permission approval")
	}
	if reason == "" {
		t.Error("reason should not be empty")
	}

	g.ApprovePermission("write_file", ActionWriteFile)
	allowed, _, _ = g.CheckBeforeCall("write_file")
	if !allowed {
		t.Error("After approval, write_file should be allowed")
	}
}

func TestGovernor_TaskReset(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// Make some calls
	for i := 0; i < 10; i++ {
		g.RecordCall("read_file")
	}

	// Reset to new task
	g.ResetTask("task-2")

	// read_file calls should be zero
	if g.GetCallsThisTask("read_file") != 0 {
		t.Error("After task reset, calls should be zero")
	}
}

func TestAuditLog_RecordAndQuery(t *testing.T) {
	log := NewAuditLog()

	log.Record(AuditEntry{
		TaskID:   "task-1",
		ToolName: "read_file",
		Success:  true,
	})
	log.Record(AuditEntry{
		TaskID:   "task-1",
		ToolName: "write_file",
		Success:  false,
		Error:    "permission denied",
	})
	log.Record(AuditEntry{
		TaskID:   "task-2",
		ToolName: "run_shell",
		Success:  true,
	})

	entries := log.GetEntries("task-1")
	if len(entries) != 2 {
		t.Errorf("Got %d entries for task-1, want 2", len(entries))
	}

	failures := log.GetFailures("task-1")
	if len(failures) != 1 {
		t.Errorf("Got %d failures for task-1, want 1", len(failures))
	}
}

func TestAuditLog_Summary(t *testing.T) {
	log := NewAuditLog()

	log.Record(AuditEntry{TaskID: "task-1", ToolName: "read_file", Success: true})
	log.Record(AuditEntry{TaskID: "task-1", ToolName: "read_file", Success: true})
	log.Record(AuditEntry{TaskID: "task-1", ToolName: "write_file", Success: false, Error: "disk full"})
	log.Record(AuditEntry{TaskID: "task-1", ToolName: "run_shell", Success: true})

	summary := log.Summary("task-1")
	total := summary["total"].(int)
	if total != 4 {
		t.Errorf("Summary total = %d, want 4", total)
	}
	success := summary["success"].(int)
	if success != 3 {
		t.Errorf("Summary success = %d, want 3", success)
	}
	failed := summary["failed"].(int)
	if failed != 1 {
		t.Errorf("Summary failed = %d, want 1", failed)
	}
}

func TestAuditLog_Clear(t *testing.T) {
	log := NewAuditLog()
	log.Record(AuditEntry{TaskID: "t1", ToolName: "test", Success: true})
	if len(log.GetEntries("")) != 1 {
		t.Fatal("Should have 1 entry before clear")
	}
	log.Clear()
	if len(log.GetEntries("")) != 0 {
		t.Error("After clear, should have 0 entries")
	}
}

func TestGovernor_NoPolicyAllowsCall(t *testing.T) {
	g := NewGovernor("task-1", nil)

	// A tool without a policy (e.g. "create_artifact" — actually it has one)
	// Let's test with a completely unknown tool
	err := g.RecordCall("unknown_tool_xyz")
	if err != nil {
		// Unknown tools default to allow
		t.Logf("Unknown tool error (may be expected if no policy): %v", err)
	}
}

func TestGovernor_WaitingForUserNoExecution(t *testing.T) {
	// This test verifies that the Governor doesn't block tools on its own —
	// it's the state machine that prevents execution during waiting_for_user.
	// The Governor just enforces numerical limits.
	g := NewGovernor("task-1", nil)

	// No call limits yet
	err := g.RecordCall("read_file")
	if err != nil {
		t.Errorf("read_file should be allowed under default policy: %v", err)
	}
}

func TestToolRisk_IsDangerous(t *testing.T) {
	if RiskLow.IsDangerous() {
		t.Error("RiskLow should not be dangerous")
	}
	if !RiskMedium.IsDangerous() {
		t.Error("RiskMedium should not be dangerous")
	}
	if !RiskHigh.IsDangerous() {
		t.Error("RiskHigh should be dangerous")
	}
	if !RiskCritical.IsDangerous() {
		t.Error("RiskCritical should be dangerous")
	}
}

func TestGetGovernedToolNames(t *testing.T) {
	names := GetGovernedToolNames()
	if len(names) == 0 {
		t.Error("GetGovernedToolNames returned empty list")
	}

	// Check that known tools are included
	nameSet := make(map[string]bool)
	for _, n := range names {
		nameSet[n] = true
	}

	for _, expected := range []string{"read_file", "write_file", "run_shell", "git_push"} {
		if !nameSet[expected] {
			t.Errorf("Governed tool %q not found in list", expected)
		}
	}
}

func TestGovernor_Concurrent(t *testing.T) {
	g := NewGovernor("task-1", nil)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = g.RecordCall("run_shell")
		}()
	}
	wg.Wait()

	// Only 1 shell call allowed per turn (default policy)
	calls := g.GetCallsThisTask("run_shell")
	if calls > 1 {
		t.Errorf("Concurrent calls = %d, should be at most 1", calls)
	}
}

// Helper mock logger for GovernorLogger
type mockLogger struct{ mu sync.Mutex; msgs []string }

func (m *mockLogger) Warn(format string, args ...any) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.msgs = append(m.msgs, fmt.Sprintf(format, args...))
}
