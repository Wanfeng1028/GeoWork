// GeoWork Go Core - Agent State Machine

package aiagent

import "fmt"

// State represents the current phase of an agent execution.
type State string

const (
	StateIdle           State = "idle"
	StatePlanning       State = "planning"
	StateInspecting     State = "inspecting"
	StateEditing        State = "editing"
	StateVerifying      State = "verifying"
	StateWaitingForUser State = "waiting_for_user"
	StateRecovering     State = "recovering"
	StateFailed         State = "failed"
	StateCompleted      State = "completed"
)

// MachineEvent triggers a state transition.
type MachineEvent string

const (
	MachineEventStart           MachineEvent = "start"
	MachineEventPlanReady       MachineEvent = "plan_ready"
	MachineEventInspectDone     MachineEvent = "inspect_done"
	MachineEventEditDone        MachineEvent = "edit_done"
	MachineEventVerifyPass      MachineEvent = "verify_pass"
	MachineEventVerifyFail      MachineEvent = "verify_fail"
	MachineEventUserApproved    MachineEvent = "user_approved"
	MachineEventUserRejected    MachineEvent = "user_rejected"
	MachineEventRetry           MachineEvent = "retry"
	MachineEventRecover         MachineEvent = "recover"
	MachineEventComplete        MachineEvent = "complete"
	MachineEventCheckpointSaved MachineEvent = "checkpoint_saved"
	MachineEventSystemPause     MachineEvent = "system_pause"
	MachineEventSystemResume    MachineEvent = "system_resume"
)

// Transition defines a valid state transition.
type Transition struct {
	From    State
	To      State
	OnEvent MachineEvent
}

// AllowedToolSet holds tool names allowed in a given state.
type AllowedToolSet struct {
	Tools []string
	// ReadAllowed indicates if read-only tools are permitted.
	ReadAllowed bool
	// WriteAllowed indicates if file-modifying tools are permitted.
	WriteAllowed bool
	// ShellAllowed indicates if shell execution is permitted.
	ShellAllowed bool
	// NetworkAllowed indicates if network tools are permitted.
	NetworkAllowed bool
}

// StateMachine enforces a strict lifecycle for agent execution.
type StateMachine struct {
	allowed map[State]AllowedToolSet
	// transitions[from][event] = to
	transitions map[State]map[MachineEvent]State
}

// NewStateMachine creates a state machine with the GeoWork state lifecycle.
func NewStateMachine() *StateMachine {
	sm := &StateMachine{
		allowed:     make(map[State]AllowedToolSet),
		transitions: make(map[State]map[MachineEvent]State),
	}

	// Define allowed tool sets per state (aligned with builtin_tools.go registry)
	// Registry truth source: read_file, write_file, list_files, search_workspace,
	// run_python, run_shell, create_artifact, delete_file, git_commit, git_push,
	// run_git_add, run_git_reset, scan_folder
	sm.allowed[StateIdle] = AllowedToolSet{}
	sm.allowed[StatePlanning] = AllowedToolSet{
		// Planning does not call tools; Planner is an internal component
		ReadAllowed:  false,
		WriteAllowed: false,
		ShellAllowed: false,
	}
	sm.allowed[StateInspecting] = AllowedToolSet{
		Tools:          []string{"read_file", "list_files", "search_workspace", "scan_folder", "browser_control", "screenshot", "network_request", "paper_search", "spawn_subagent"},
		ReadAllowed:    true,
		NetworkAllowed: true,
	}
	sm.allowed[StateEditing] = AllowedToolSet{
		// doc/22 BP2: the explicit list must cover every tool that
		// inferStateFromTool routes to Editing — the previous list was
		// missing run_shell/delete_file/git_push/run_git_reset/
		// browser_control/network_request, so those tools inferred
		// themselves INTO Editing and were then rejected by Editing's
		// own (incomplete) list: unreachable in the ReAct path, and the
		// interactive-approval flow could never trigger for run_shell.
		Tools:        []string{"read_file", "write_file", "list_files", "create_artifact", "run_python", "run_shell", "delete_file", "git_commit", "git_push", "run_git_add", "run_git_reset", "browser_control", "network_request", "spawn_subagent"},
		ReadAllowed:  true,
		WriteAllowed: true,
		ShellAllowed: true,
	}
	sm.allowed[StateVerifying] = AllowedToolSet{
		Tools:        []string{"read_file", "list_files", "run_python", "run_shell", "spawn_subagent"},
		ReadAllowed:  true,
		ShellAllowed: true,
	}
	sm.allowed[StateWaitingForUser] = AllowedToolSet{}
	sm.allowed[StateRecovering] = AllowedToolSet{
		Tools:       []string{"read_file", "list_files"},
		ReadAllowed: true,
	}
	sm.allowed[StateFailed] = AllowedToolSet{}
	sm.allowed[StateCompleted] = AllowedToolSet{}

	// Define transitions: [from][event] = to
	transitions := make(map[State]map[MachineEvent]State)

	transitions[StateIdle] = map[MachineEvent]State{
		MachineEventStart: StatePlanning,
	}
	transitions[StatePlanning] = map[MachineEvent]State{
		MachineEventInspectDone: StateInspecting,
		MachineEventRetry:       StatePlanning,
	}
	transitions[StateInspecting] = map[MachineEvent]State{
		MachineEventInspectDone: StateEditing,
		MachineEventRetry:       StateInspecting,
	}
	transitions[StateEditing] = map[MachineEvent]State{
		MachineEventEditDone:     StateVerifying,
		MachineEventUserRejected: StateInspecting,
		MachineEventUserApproved: StateVerifying,
		MachineEventSystemPause:  StateWaitingForUser,
	}
	transitions[StateVerifying] = map[MachineEvent]State{
		MachineEventVerifyPass:  StateCompleted,
		MachineEventVerifyFail:  StateEditing,
		MachineEventSystemPause: StateWaitingForUser,
	}
	transitions[StateWaitingForUser] = map[MachineEvent]State{
		MachineEventUserApproved: StateVerifying,
		MachineEventUserRejected: StateInspecting,
		MachineEventSystemResume: StatePlanning,
		MachineEventComplete:     StateCompleted,
	}
	transitions[StateRecovering] = map[MachineEvent]State{
		MachineEventRecover:         StatePlanning,
		MachineEventCheckpointSaved: StateInspecting,
	}
	transitions[StateFailed] = map[MachineEvent]State{
		MachineEventRetry:   StateRecovering,
		MachineEventRecover: StatePlanning,
	}
	transitions[StateCompleted] = map[MachineEvent]State{}

	sm.transitions = transitions
	return sm
}

// Next returns the next state and allowed tool set for the given event.
// Returns an error if the transition is not allowed.
func (sm *StateMachine) Next(current State, event MachineEvent) (State, AllowedToolSet, error) {
	nextEvents := sm.transitions[current]
	if nextEvents == nil {
		return current, AllowedToolSet{}, fmt.Errorf("no transitions defined from state %s", current)
	}

	nextState, ok := nextEvents[event]
	if !ok {
		return current, AllowedToolSet{}, fmt.Errorf("event %q not allowed in state %s", event, current)
	}

	tools := sm.allowed[nextState]
	return nextState, tools, nil
}

// CanTransition checks whether the event is valid in the current state without mutating.
func (sm *StateMachine) CanTransition(current State, event MachineEvent) bool {
	events := sm.transitions[current]
	if events == nil {
		return false
	}
	_, ok := events[event]
	return ok
}

// GetAllowedTools returns the allowed tool set for a state.
func (sm *StateMachine) GetAllowedTools(state State) AllowedToolSet {
	t, ok := sm.allowed[state]
	if !ok {
		return AllowedToolSet{}
	}
	return t
}

// ToolIsAllowed checks if a specific tool name is allowed in the given state.
func (sm *StateMachine) ToolIsAllowed(state State, toolName string) bool {
	tools := sm.allowed[state]

	// Check explicit tool list first
	if len(tools.Tools) > 0 {
		for _, t := range tools.Tools {
			if t == toolName {
				return true
			}
		}
		return false
	}

	// If no explicit list, check permissions by category
	switch toolName {
	case "read_file", "list_files", "search_workspace", "scan_folder", "paper_search":
		return tools.ReadAllowed
	case "write_file", "create_artifact", "delete_file":
		return tools.WriteAllowed
	case "run_python", "run_shell":
		return tools.ShellAllowed
	case "git_commit", "git_push", "run_git_add", "run_git_reset":
		return tools.ShellAllowed
	case "network_request", "browser_control":
		return tools.NetworkAllowed
	case "screenshot":
		// Screenshot is read-like; treat as ReadAllowed unless NetworkAllowed
		// is set (state machine enforces via Tools list above).
		return tools.ReadAllowed
	}
	return false
}
