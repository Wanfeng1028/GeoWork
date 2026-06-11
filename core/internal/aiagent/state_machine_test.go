package aiagent

import (
	"testing"
)

func TestStateMachine_PlanningToInspecting(t *testing.T) {
	sm := NewStateMachine()

	next, tools, err := sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("transition planning -> inspecting failed: %v", err)
	}
	if next != StateInspecting {
		t.Errorf("next state = %s, want %s", next, StateInspecting)
	}
	if !tools.ReadAllowed {
		t.Error("inspecting should allow read")
	}
}

func TestStateMachine_InspectingToEditing(t *testing.T) {
	sm := NewStateMachine()

	// Start from idle, go to planning
	_, _, err := sm.Next(StateIdle, MachineEventStart)
	if err != nil {
		t.Fatalf("idle -> planning failed: %v", err)
	}

	next, _, err := sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("planning -> inspecting failed: %v", err)
	}
	if next != StateInspecting {
		t.Errorf("next state = %s, want %s", next, StateInspecting)
	}

	next, _, err = sm.Next(StateInspecting, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("inspecting -> editing failed: %v", err)
	}
	if next != StateEditing {
		t.Errorf("next state = %s, want %s", next, StateEditing)
	}
}

func TestStateMachine_EditingToVerifying(t *testing.T) {
	sm := NewStateMachine()

	// idle -> planning -> inspecting -> editing
	_, _, err := sm.Next(StateIdle, MachineEventStart)
	if err != nil {
		t.Fatalf("idle -> planning failed: %v", err)
	}
	_, _, err = sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("planning -> inspecting failed: %v", err)
	}
	_, _, err = sm.Next(StateInspecting, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("inspecting -> editing failed: %v", err)
	}

	next, _, err := sm.Next(StateEditing, MachineEventEditDone)
	if err != nil {
		t.Fatalf("editing -> verifying failed: %v", err)
	}
	if next != StateVerifying {
		t.Errorf("next state = %s, want %s", next, StateVerifying)
	}
}

func TestStateMachine_VerifyingToCompleted(t *testing.T) {
	sm := NewStateMachine()

	// idle -> planning -> inspecting -> editing -> verifying
	_, _, err := sm.Next(StateIdle, MachineEventStart)
	if err != nil {
		t.Fatalf("idle -> planning failed: %v", err)
	}
	_, _, err = sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("planning -> inspecting failed: %v", err)
	}
	_, _, err = sm.Next(StateInspecting, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("inspecting -> editing failed: %v", err)
	}
	_, _, err = sm.Next(StateEditing, MachineEventEditDone)
	if err != nil {
		t.Fatalf("editing -> verifying failed: %v", err)
	}

	next, _, err := sm.Next(StateVerifying, MachineEventVerifyPass)
	if err != nil {
		t.Fatalf("verifying -> completed failed: %v", err)
	}
	if next != StateCompleted {
		t.Errorf("next state = %s, want %s", next, StateCompleted)
	}
}

func TestStateMachine_DangerousToolInInspecting(t *testing.T) {
	sm := NewStateMachine()

	// In inspecting, write_file should be denied
	allowed := sm.ToolIsAllowed(StateInspecting, "write_file")
	if allowed {
		t.Error("write_file should NOT be allowed in inspecting state")
	}

	// read_file should be allowed
	allowed = sm.ToolIsAllowed(StateInspecting, "read_file")
	if !allowed {
		t.Error("read_file should be allowed in inspecting state")
	}
}

func TestStateMachine_WaitingForUserNoTools(t *testing.T) {
	sm := NewStateMachine()

	// In waiting_for_user, no tools should be executable
	tools := sm.GetAllowedTools(StateWaitingForUser)
	if tools.ReadAllowed || tools.WriteAllowed || tools.ShellAllowed || tools.NetworkAllowed {
		t.Error("waiting_for_user should have no permissions")
	}

	// Shell execution should be denied
	allowed := sm.ToolIsAllowed(StateWaitingForUser, "run_shell")
	if allowed {
		t.Error("run_shell should NOT be allowed in waiting_for_user")
	}
}

func TestStateMachine_CompletedNoTransitions(t *testing.T) {
	sm := NewStateMachine()

	_, _, err := sm.Next(StateCompleted, MachineEventStart)
	if err == nil {
		t.Error("expected error for transition from completed state")
	}

	_, _, err = sm.Next(StateCompleted, MachineEventComplete)
	if err == nil {
		t.Error("expected error for transition from completed state")
	}
}

func TestStateMachine_FailedRetry(t *testing.T) {
	sm := NewStateMachine()

	next, _, err := sm.Next(StateFailed, MachineEventRetry)
	if err != nil {
		t.Fatalf("failed -> recovering failed: %v", err)
	}
	if next != StateRecovering {
		t.Errorf("next state = %s, want %s", next, StateRecovering)
	}
}

func TestStateMachine_RecoverToPlanning(t *testing.T) {
	sm := NewStateMachine()

	next, _, err := sm.Next(StateFailed, MachineEventRecover)
	if err != nil {
		t.Fatalf("failed -> planning failed: %v", err)
	}
	if next != StatePlanning {
		t.Errorf("next state = %s, want %s", next, StatePlanning)
	}
}

func TestStateMachine_ToolIsAllowed_Planning(t *testing.T) {
	sm := NewStateMachine()

	// Planning allows planner and model
	if !sm.ToolIsAllowed(StatePlanning, "planner") {
		t.Error("planner should be allowed in planning")
	}
	if !sm.ToolIsAllowed(StatePlanning, "model") {
		t.Error("model should be allowed in planning")
	}

	// Planning should NOT allow write
	if sm.ToolIsAllowed(StatePlanning, "write_file") {
		t.Error("write_file should NOT be allowed in planning")
	}
}

func TestStateMachine_ToolIsAllowed_Editing(t *testing.T) {
	sm := NewStateMachine()

	if !sm.ToolIsAllowed(StateEditing, "write_file") {
		t.Error("write_file should be allowed in editing")
	}
	if !sm.ToolIsAllowed(StateEditing, "read_file") {
		t.Error("read_file should be allowed in editing")
	}

	// Shell should NOT be allowed in editing
	if sm.ToolIsAllowed(StateEditing, "run_shell") {
		t.Error("run_shell should NOT be allowed in editing")
	}
}

func TestStateMachine_ToolIsAllowed_Verifying(t *testing.T) {
	sm := NewStateMachine()

	allowedTools := []string{"test", "build", "lint", "read_file"}
	for _, tool := range allowedTools {
		if !sm.ToolIsAllowed(StateVerifying, tool) {
			t.Errorf("%s should be allowed in verifying", tool)
		}
	}

	// write_file should NOT be allowed in verifying
	if sm.ToolIsAllowed(StateVerifying, "write_file") {
		t.Error("write_file should NOT be allowed in verifying")
	}
}

func TestStateMachine_CanTransition(t *testing.T) {
	sm := NewStateMachine()

	if !sm.CanTransition(StateIdle, MachineEventStart) {
		t.Error("start should be valid from idle")
	}
	if sm.CanTransition(StateIdle, MachineEventComplete) {
		t.Error("complete should NOT be valid from idle")
	}
}

func TestStateMachine_RecoveringState(t *testing.T) {
	sm := NewStateMachine()

	tools := sm.GetAllowedTools(StateRecovering)
	if !tools.ReadAllowed {
		t.Error("recovering should allow read")
	}
	if tools.WriteAllowed {
		t.Error("recovering should NOT allow write")
	}

	allowed := sm.ToolIsAllowed(StateRecovering, "read_file")
	if !allowed {
		t.Error("read_file should be allowed in recovering")
	}
	allowed = sm.ToolIsAllowed(StateRecovering, "write_file")
	if allowed {
		t.Error("write_file should NOT be allowed in recovering")
	}
}

func TestStateMachine_InvalidTransition(t *testing.T) {
	sm := NewStateMachine()

	_, _, err := sm.Next(StatePlanning, MachineEventComplete)
	if err == nil {
		t.Error("expected error: complete is not a valid event from planning")
	}
}

func TestStateMachine_FullLifecycle(t *testing.T) {
	sm := NewStateMachine()

	// Full happy path
	_, _, err := sm.Next(StateIdle, MachineEventStart)
	if err != nil {
		t.Fatalf("idle -> planning: %v", err)
	}
	_, _, err = sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("planning -> inspecting: %v", err)
	}
	_, _, err = sm.Next(StateInspecting, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("inspecting -> editing: %v", err)
	}
	_, _, err = sm.Next(StateEditing, MachineEventEditDone)
	if err != nil {
		t.Fatalf("editing -> verifying: %v", err)
	}
	_, _, err = sm.Next(StateVerifying, MachineEventVerifyPass)
	if err != nil {
		t.Fatalf("verifying -> completed: %v", err)
	}
}

func TestStateMachine_EditingVerifyFail(t *testing.T) {
	sm := NewStateMachine()

	_, _, err := sm.Next(StateIdle, MachineEventStart)
	if err != nil {
		t.Fatalf("idle -> planning: %v", err)
	}
	_, _, err = sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("planning -> inspecting: %v", err)
	}
	_, _, err = sm.Next(StateInspecting, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("inspecting -> editing: %v", err)
	}
	_, _, err = sm.Next(StateEditing, MachineEventEditDone)
	if err != nil {
		t.Fatalf("editing -> verifying: %v", err)
	}

	// Verify fails, goes back to editing
	next, _, err := sm.Next(StateVerifying, MachineEventVerifyFail)
	if err != nil {
		t.Fatalf("verifying -> editing (fail): %v", err)
	}
	if next != StateEditing {
		t.Errorf("next state = %s, want %s", next, StateEditing)
	}
}

func TestStateMachine_UserRejected(t *testing.T) {
	sm := NewStateMachine()

	_, _, err := sm.Next(StateIdle, MachineEventStart)
	if err != nil {
		t.Fatalf("idle -> planning: %v", err)
	}
	_, _, err = sm.Next(StatePlanning, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("planning -> inspecting: %v", err)
	}
	_, _, err = sm.Next(StateInspecting, MachineEventInspectDone)
	if err != nil {
		t.Fatalf("inspecting -> editing: %v", err)
	}

	// User rejects editing
	next, _, err := sm.Next(StateEditing, MachineEventUserRejected)
	if err != nil {
		t.Fatalf("editing -> inspecting (rejected): %v", err)
	}
	if next != StateInspecting {
		t.Errorf("next state = %s, want %s", next, StateInspecting)
	}
}
