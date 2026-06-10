// GeoWork Go Core - Permission Engine

package permissions

import (
	"fmt"
	"sync"
	"time"
)

type Engine struct {
	mu         sync.RWMutex
	policies   map[string]*PermissionPolicy // taskID -> policy
	requests   map[string]*PermissionRequest
	decisions  map[string]Decision // taskID+action -> decision
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
	e.mu.RLock()
	defer e.mu.RUnlock()

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
	req.ResolvedAt = time.Now()
	e.decisions[fmt.Sprintf("%s:%s", req.TaskID, req.Action)] = Decision{
		Decision: "approved",
		Reason:   reason,
		At:       time.Now(),
	}
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
	req.ResolvedAt = time.Now()
	e.decisions[fmt.Sprintf("%s:%s", req.TaskID, req.Action)] = Decision{
		Decision: "denied",
		Reason:   reason,
		At:       time.Now(),
	}
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
