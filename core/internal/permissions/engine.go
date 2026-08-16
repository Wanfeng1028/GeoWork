// GeoWork Go Core - Permission Engine

package permissions

import (
	"fmt"
	"sync"
	"time"
)

// Retention bounds for the engine's in-memory maps (doc/22 BP6). Without
// these the maps grow without bound over a long-lived desktop session:
// every resolved request stays in `requests` forever, every decision stays
// in `decisions` until the same key happens to be re-evaluated, and every
// task's policy stays in `policies` indefinitely. Cleanup prunes them, and
// GetPendingRequests opportunistically sweeps stale resolved requests.
const (
	// decisionTTL is how long a remembered decision stays valid. Matches
	// the expiry check in Evaluate.
	decisionTTL = 24 * time.Hour
	// resolvedRequestTTL is how long a resolved (approved/denied) request
	// is kept for audit before it is pruned.
	resolvedRequestTTL = 24 * time.Hour
	// policyTTL is how long an unused task policy is kept.
	policyTTL = 7 * 24 * time.Hour
)

type Engine struct {
	mu          sync.RWMutex
	policies    map[string]*PermissionPolicy // taskID -> policy
	policySetAt map[string]time.Time         // taskID -> last set/update time
	requests    map[string]*PermissionRequest
	decisions   map[string]Decision // taskID+action -> decision
	repo        *Repository         // optional persistent store

	// actionCategory maps an action/tool name to its permission category
	// ("read"/"write"/"exec"/"delete"/"admin"). Injected from the tool
	// registry at startup so isWriteAction derives from the real tool
	// classification instead of a brittle hardcoded list. nil falls back
	// to the conservative built-in set.
	actionCategory func(action string) string
}

type Decision struct {
	Decision string    `json:"decision"`
	Reason   string    `json:"reason"`
	At       time.Time `json:"at"`
}

func NewEngine() *Engine {
	return &Engine{
		policies:    make(map[string]*PermissionPolicy),
		policySetAt: make(map[string]time.Time),
		requests:    make(map[string]*PermissionRequest),
		decisions:   make(map[string]Decision),
	}
}

// WithActionCategory injects a classifier that returns the permission
// category ("read"/"write"/"exec"/"delete"/"admin") for an action/tool
// name. Wired from the tool registry in main.go so the write-action check
// tracks the tools' declared Permission() instead of a hardcoded list.
func (e *Engine) WithActionCategory(fn func(action string) string) *Engine {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.actionCategory = fn
	return e
}

func (e *Engine) SetPolicy(taskID string, policy *PermissionPolicy) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.policies[taskID] = policy
	e.policySetAt[taskID] = time.Now()
}

func (e *Engine) Evaluate(taskID string, action DangerousAction) (string, error) {
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
		if time.Since(remembered.At) < decisionTTL {
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

// GetPendingRequests returns unresolved requests. It opportunistically
// prunes resolved requests older than resolvedRequestTTL so the requests
// map does not grow without bound (doc/22 BP6).
func (e *Engine) GetPendingRequests() []*PermissionRequest {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	var pending []*PermissionRequest
	for id, req := range e.requests {
		if req.Decision == "" {
			pending = append(pending, req)
			continue
		}
		// Resolved: drop it once it has aged past the audit window.
		if req.ResolvedAt > 0 && now.Sub(time.UnixMilli(req.ResolvedAt)) > resolvedRequestTTL {
			delete(e.requests, id)
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
	e.policySetAt[taskID] = time.Now()
}

// WithRepository attaches a persistent repository so that decisions survive restarts.
func (e *Engine) WithRepository(repo *Repository) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.repo = repo
}

// Cleanup prunes expired decisions, aged-out resolved requests, and stale
// task policies. Returns the number of entries removed across all maps.
// Safe to call periodically (e.g. from a shutdown hook or a ticker).
func (e *Engine) Cleanup() int {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	removed := 0

	for key, d := range e.decisions {
		if now.Sub(d.At) > decisionTTL {
			delete(e.decisions, key)
			removed++
		}
	}
	for id, req := range e.requests {
		if req.Decision != "" && req.ResolvedAt > 0 &&
			now.Sub(time.UnixMilli(req.ResolvedAt)) > resolvedRequestTTL {
			delete(e.requests, id)
			removed++
		}
	}
	for taskID, setAt := range e.policySetAt {
		if now.Sub(setAt) > policyTTL {
			delete(e.policies, taskID)
			delete(e.policySetAt, taskID)
			removed++
		}
	}
	return removed
}

// IsAllowed evaluates whether the given action is permitted for a task.
// It returns false when the effective level is read_only or limited and the
// action is classified as a write (mutating) action.
func (e *Engine) IsAllowed(taskID string, action string) (bool, error) {
	level, err := e.Evaluate(taskID, DangerousAction(action))
	if err != nil {
		return false, err
	}
	if level == string(ReadOnly) || level == string(Limited) {
		if e.isWriteAction(action) {
			return false, nil
		}
	}
	return true, nil
}

// isWriteAction reports whether the action mutates state. When an
// action-category classifier is injected (wired from the tool registry),
// the classification follows the tool's declared Permission(): "read" is
// non-mutating, every other category (write/exec/delete/admin) is mutating.
// Without a classifier it falls back to a conservative built-in set.
func (e *Engine) isWriteAction(action string) bool {
	e.mu.RLock()
	classify := e.actionCategory
	e.mu.RUnlock()

	if classify != nil {
		switch classify(action) {
		case "read":
			return false
		case "write", "exec", "delete", "admin":
			return true
		}
		// Unknown category: fall through to the conservative default so
		// an unrecognized action is still treated as potentially mutating.
	}
	return defaultWriteActions[action]
}

// defaultWriteActions is the fallback mutating-action set used when no
// action-category classifier is wired. Kept conservative: anything not
// obviously a read is treated as a write under read_only/limited policies.
var defaultWriteActions = map[string]bool{
	"write_file": true, "delete_file": true, "run_shell": true,
	"run_python": true, "git_commit": true, "git_push": true,
	"run_git_add": true, "run_git_reset": true, "create_artifact": true,
	"install_package": true, "exec_binary": true, "network_access": true,
	"modify_system": true, "write_env": true,
	"modify": true, "create": true, "delete": true,
}

// persistDecision writes a decision to the repository if one is attached.
func (e *Engine) persistDecision(taskID string, action DangerousAction, decision, reason string) {
	if e.repo == nil {
		return
	}
	// Best-effort persistence; ignore errors so the hot path is not blocked.
	_ = e.repo.Save(taskID, action, decision, reason, 24)
}
