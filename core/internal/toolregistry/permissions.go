// GeoWork Go Core - Tool Permissions

package toolregistry

import (
	"context"
)

// Permission levels.
const (
	PermRead   = "read"
	PermWrite  = "write"
	PermExec   = "exec"
	PermDelete = "delete"
	PermAdmin  = "admin"
)

// PermissionPolicy defines allowed actions.
type PermissionPolicy struct {
	DefaultLevel string            `json:"defaultLevel"`
	Actions      map[string]string `json:"actions"`
	Remembered   map[string]bool   `json:"remembered"`
	TaskID       string            `json:"taskId,omitempty"`
}

// CheckPermission verifies if an action is allowed under the current context policy.
func CheckPermission(ctx context.Context, action string) bool {
	policy, ok := ctx.Value(policyKey{}).(*PermissionPolicy)
	if !ok {
		return action == PermRead // read allowed by default
	}
	if policy.Remembered[action] {
		return true
	}
	allowed, hasExplicit := policy.Actions[action]
	if hasExplicit {
		return allowed == "allow"
	}
	return policy.DefaultLevel == "full" || (action == PermRead && policy.DefaultLevel == "limited")
}

// WithPolicy attaches a permission policy to a context.
func WithPolicy(ctx context.Context, policy *PermissionPolicy) context.Context {
	return context.WithValue(ctx, policyKey{}, policy)
}

type policyKey struct{}

// RememberAction marks an action as remembered (no re-approval needed).
func (p *PermissionPolicy) RememberAction(action string) {
	if p.Remembered == nil {
		p.Remembered = make(map[string]bool)
	}
	p.Remembered[action] = true
}

// SetAction explicitly allows or denies an action.
func (p *PermissionPolicy) SetAction(action string, allow bool) {
	if p.Actions == nil {
		p.Actions = make(map[string]string)
	}
	if allow {
		p.Actions[action] = "allow"
	} else {
		p.Actions[action] = "deny"
	}
}
