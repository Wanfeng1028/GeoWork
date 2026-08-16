// GeoWork Go Core - Permission Engine

package permissions

import (
	"fmt"
	"sync"
	"time"
)

type Engine struct {
	mu        sync.RWMutex
	policies  map[string]*PermissionPolicy // taskID -> policy
	requests  map[string]*PermissionRequest
	decisions map[string]Decision // taskID+action -> decision
	repo      *Repository         // optional persistent store
}

type Decision struct {
	Decision string    `json:"decision"`
	Reason   string    `json:"reason"`
	At       time.Time `json:"at"`
}

func NewEngine() *Engine {
	return &Engine{
		policies:  make(map[string]*PermissionPolicy),
		requests:  make(map[string]*PermissionRequest),
		decisions: make(map[string]Decision),
	}
}

func (e *Engine) SetPolicy(taskID string, policy *PermissionPolicy) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.policies[taskID] = policy
}

func (e *Engine) Evaluate(taskID string, action DangerousAction, context map[string]string) (string, error) {
	// Full lock (not RLock): this method may delete an expired entry from
	// e.decisions, which is a write and would race with concurrent readers.
	e.mu.Lock()
	defer e.mu.Unlock()

	policy, ok := e.policies[taskID]
	if !ok {
		return string(Limited), fmt.Errorf("no policy for task %s", taskID)
	}

	// Check remembered decisions
	key := fmt.Sprintf("%s:%s", taskID, action)
	if remembered, ok := e.decisions[key]; ok {
		if time.Since(remembered.At) < 24*time.Hour {
			return remembered.Decision, nil
		}
		delete(e.decisions, key)
	}

	// Check action-specific policy
	if level, ok := policy.Actions[string(action)]; ok {
		return level, nil
	}

	return string(policy.DefaultLevel), nil
}

func (e *Engine) CreateRequest(req *PermissionRequest) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.requests[req.ID] = req
}

func (e *Engine) GetPendingRequests() []*PermissionRequest {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var pending []*PermissionRequest
	for _, req := range e.requests {
		if req.Decision == "" {
			pending = append(pending, req)
		}
	}
	return pending
}

func (e *Engine) ApproveRequest(id, reason string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	req, ok := e.requests[id]
	if !ok {
		return fmt.Errorf("request not found: %s", id)
	}

	req.Decision = "approved"
	req.Reason = reason
	req.ResolvedAt = time.Now().UnixMilli()
	e.decisions[fmt.Sprintf("%s:%s", req.TaskID, req.Action)] = Decision{
		Decision: "approved",
		Reason:   reason,
		At:       time.Now(),
	}
	e.persistDecision(req.TaskID, req.Action, "approved", reason)
	return nil
}

func (e *Engine) DenyRequest(id, reason string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	req, ok := e.requests[id]
	if !ok {
		return fmt.Errorf("request not found: %s", id)
	}

	req.Decision = "denied"
	req.Reason = reason
	req.ResolvedAt = time.Now().UnixMilli()
	e.decisions[fmt.Sprintf("%s:%s", req.TaskID, req.Action)] = Decision{
		Decision: "denied",
		Reason:   reason,
		At:       time.Now(),
	}
	e.persistDecision(req.TaskID, req.Action, "denied", reason)
	return nil
}

func (e *Engine) GetPolicies(taskID string) *PermissionPolicy {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.policies[taskID]
}

func (e *Engine) UpdatePolicy(taskID string, policy *PermissionPolicy) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.policies[taskID] = policy
}

// WithRepository attaches a persistent repository so that decisions survive restarts.
func (e *Engine) WithRepository(repo *Repository) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.repo = repo
}

// IsAllowed evaluates whether the given action is permitted for a task.
// It returns false when the effective level is read_only or limited and the
// action is classified as a write action.
func (e *Engine) IsAllowed(taskID string, action string, context map[string]string) (bool, error) {
	level, err := e.Evaluate(taskID, DangerousAction(action), context)
	if err != nil {
		return false, err
	}
	if level == string(ReadOnly) || level == string(Limited) {
		if isWriteAction(action) {
			return false, nil
		}
	}
	return true, nil
}

// isWriteAction returns true for actions that mutate state.
func isWriteAction(action string) bool {
	writeActions := map[string]bool{
		"write_file": true, "delete_file": true, "run_shell": true,
		"run_python": true, "git_commit": true, "git_push": true,
		"modify": true, "create": true, "delete": true,
	}
	return writeActions[action]
}

// persistDecision writes a decision to the repository if one is attached.
func (e *Engine) persistDecision(taskID string, action DangerousAction, decision, reason string) {
	if e.repo == nil {
		return
	}
	// Best-effort persistence; ignore errors so the hot path is not blocked.
	_ = e.repo.Save(taskID, action, decision, reason, 24)
}
