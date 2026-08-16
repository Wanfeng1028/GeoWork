// GeoWork Go Core - Tool QuotaGovernor

package toolregistry

import (
	"fmt"
	"sync"
	"time"
)

// QuotaPolicy is a runtime-evaluated policy that the QuotaGovernor uses.
type QuotaPolicy struct {
	ToolPolicy
	CallsThisTurn int
	CallsThisTask int
	LastCallTime  time.Time
}

// QuotaGovernor enforces tool call limits and governance rules.
type QuotaGovernor struct {
	mu        sync.RWMutex
	policies  map[string]*QuotaPolicy // tool name -> policy
	taskCalls map[string]int          // tool name -> calls this task
	turnCalls map[string]int          // tool name -> calls this turn
	approved  map[string]bool         // tool name + taskID -> approved
	taskID    string
	log       QuotaLogger
}

// QuotaLogger is a minimal logging interface for the QuotaGovernor.
type QuotaLogger interface {
	Warn(format string, args ...any)
}

// NewQuotaGovernor creates a new QuotaGovernor for the given task.
func NewQuotaGovernor(taskID string, logger QuotaLogger) *QuotaGovernor {
	g := &QuotaGovernor{
		policies:  make(map[string]*QuotaPolicy),
		taskCalls: make(map[string]int),
		turnCalls: make(map[string]int),
		approved:  make(map[string]bool),
		taskID:    taskID,
		log:       logger,
	}

	// Register default policies
	for _, p := range DefaultToolPolicies() {
		g.policies[p.Name] = &QuotaPolicy{
			ToolPolicy: p,
		}
	}

	return g
}

// SetCustomPolicy allows overriding or adding a policy for a tool.
func (g *QuotaGovernor) SetCustomPolicy(policy ToolPolicy) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if _, ok := g.policies[policy.Name]; !ok {
		g.policies[policy.Name] = &QuotaPolicy{ToolPolicy: policy}
	} else {
		g.policies[policy.Name].ToolPolicy = policy
	}
}

// CheckBeforeCall evaluates whether a tool call is allowed without actually recording it.
// Returns: (allowed, reason, remainingCalls)
func (g *QuotaGovernor) CheckBeforeCall(toolName string) (bool, string, int) {
	g.mu.Lock()
	defer g.mu.Unlock()

	policy, ok := g.policies[toolName]
	if !ok {
		// No policy means default: allow with caution
		return true, "no policy (default allow)", 0
	}

	// Always-deny tools are never allowed
	if policy.AlwaysDeny {
		return false, fmt.Sprintf("tool %s is always denied by policy", toolName), 0
	}

	// Check per-turn limit
	if policy.MaxCallsPerTurn > 0 && g.turnCalls[toolName] >= policy.MaxCallsPerTurn {
		return false, fmt.Sprintf("tool %s called %d times this turn (max %d)", toolName, g.turnCalls[toolName], policy.MaxCallsPerTurn), policy.MaxCallsPerTurn - g.turnCalls[toolName]
	}

	// Check per-task limit
	if policy.MaxCallsPerTask > 0 && g.taskCalls[toolName] >= policy.MaxCallsPerTask {
		return false, fmt.Sprintf("tool %s called %d times this task (max %d)", toolName, g.taskCalls[toolName], policy.MaxCallsPerTask), policy.MaxCallsPerTask - g.taskCalls[toolName]
	}

	// Check approval requirement
	if policy.RequiresApproval {
		key := fmt.Sprintf("%s:%s", toolName, g.taskID)
		if !g.approved[key] {
			return false, fmt.Sprintf("tool %s requires approval for task %s", toolName, g.taskID), 0
		}
	}

	// Check if any required permissions need approval
	for _, action := range policy.RequiredPermission {
		key := fmt.Sprintf("%s:%s:%s", toolName, string(action), g.taskID)
		if !g.approved[key] {
			return false, fmt.Sprintf("permission %s required for tool %s in task %s", action, toolName, g.taskID), 0
		}
	}

	remaining := policy.MaxCallsPerTask - g.taskCalls[toolName]
	if remaining < 0 {
		remaining = 0
	}
	return true, "ok", remaining
}

// RecordCall records a tool call, enforcing the policy first.
// Returns an error if the call is not allowed.
func (g *QuotaGovernor) RecordCall(toolName string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	policy, ok := g.policies[toolName]
	if !ok {
		// No policy: default allow
		g.turnCalls[toolName]++
		g.taskCalls[toolName]++
		return nil
	}

	// Always-deny
	if policy.AlwaysDeny {
		return fmt.Errorf("tool %s is always denied by policy", toolName)
	}

	// Per-turn limit
	if policy.MaxCallsPerTurn > 0 && g.turnCalls[toolName] >= policy.MaxCallsPerTurn {
		return fmt.Errorf("tool %s exceeded per-turn limit (%d/%d)", toolName, g.turnCalls[toolName], policy.MaxCallsPerTurn)
	}

	// Per-task limit
	if policy.MaxCallsPerTask > 0 && g.taskCalls[toolName] >= policy.MaxCallsPerTask {
		return fmt.Errorf("tool %s exceeded per-task limit (%d/%d)", toolName, g.taskCalls[toolName], policy.MaxCallsPerTask)
	}

	// Approval check
	if policy.RequiresApproval {
		key := fmt.Sprintf("%s:%s", toolName, g.taskID)
		if !g.approved[key] {
			return fmt.Errorf("tool %s requires approval", toolName)
		}
	}

	// Check required permissions
	for _, action := range policy.RequiredPermission {
		key := fmt.Sprintf("%s:%s:%s", toolName, string(action), g.taskID)
		if !g.approved[key] {
			return fmt.Errorf("permission %s required for tool %s", action, toolName)
		}
	}

	g.turnCalls[toolName]++
	g.taskCalls[toolName]++
	policy.LastCallTime = time.Now()
	policy.CallsThisTurn++
	policy.CallsThisTask++
	return nil
}

// ApproveTool approves a tool for the current task.
func (g *QuotaGovernor) ApproveTool(toolName string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := fmt.Sprintf("%s:%s", toolName, g.taskID)
	g.approved[key] = true
}

// ApprovePermission approves a specific dangerous action for a tool in a task.
func (g *QuotaGovernor) ApprovePermission(toolName string, action DangerousAction) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := fmt.Sprintf("%s:%s:%s", toolName, string(action), g.taskID)
	g.approved[key] = true
}

// StartNewTurn resets per-turn counters.
func (g *QuotaGovernor) StartNewTurn() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.turnCalls = make(map[string]int)
}

// GetCallsThisTask returns how many times a tool has been called this task.
func (g *QuotaGovernor) GetCallsThisTask(toolName string) int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.taskCalls[toolName]
}

// IsGoverned returns true if a tool has a governance policy.
func (g *QuotaGovernor) IsGoverned(toolName string) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	_, ok := g.policies[toolName]
	return ok
}

// GetPolicy returns the policy for a tool.
func (g *QuotaGovernor) GetPolicy(toolName string) (*ToolPolicy, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	p, ok := g.policies[toolName]
	if !ok {
		return nil, false
	}
	cp := p.ToolPolicy
	return &cp, true
}

// ApproveAction approves a dangerous action (e.g., run_shell) for the current task.
func (g *QuotaGovernor) ApproveAction(action DangerousAction) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := fmt.Sprintf("action:%s:%s", string(action), g.taskID)
	g.approved[key] = true
}

// CheckActionApproval checks if a dangerous action is approved.
func (g *QuotaGovernor) CheckActionApproval(action DangerousAction) (bool, string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := fmt.Sprintf("action:%s:%s", string(action), g.taskID)
	if g.approved[key] {
		return true, ""
	}
	return false, fmt.Sprintf("action %s requires approval for task %s", action, g.taskID)
}

// ResetTask resets all counters for a new task (called internally when task ID changes).
func (g *QuotaGovernor) ResetTask(taskID string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.taskID = taskID
	g.taskCalls = make(map[string]int)
	g.turnCalls = make(map[string]int)
	g.approved = make(map[string]bool)
}
