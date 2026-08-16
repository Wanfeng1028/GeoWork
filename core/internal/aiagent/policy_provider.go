// GeoWork Go Core - Desktop permission policy provider
//
// doc/22 BP1 / D-B1: the desktop runtime is a single-user local product —
// the agent is SUPPOSED to write files and run code inside the workspace.
// The defense layers for dangerous operations are, in order:
//
//  1. toolregistry sandbox path validation (workspace-only roots)
//  2. Harness declarative rules (per-tool allow/deny)
//  3. interactive approval for RiskLevel=="critical" tools
//  4. guardrails size/MIME limits on artifacts
//
// The permission policy below is the coarse "what classes of action may
// this run take at all" gate. Without it the registry defaults to
// read-only (permissions.go: CheckPermission), which silently turned
// every write/exec tool call into "permission denied" in production
// assembly (doc/22 病灶 F1).

package aiagent

import "geowork/core/internal/toolregistry"

// DefaultDesktopPolicy returns the permission policy for desktop runs:
// full access to read/write/exec classes. Critical tools are NOT
// unconditionally released by this policy — they still pass through the
// interactive approval governor and the Harness rule engine.
func DefaultDesktopPolicy() *toolregistry.PermissionPolicy {
	return &toolregistry.PermissionPolicy{
		DefaultLevel: "full",
		Actions: map[string]string{
			toolregistry.PermRead:  "allow",
			toolregistry.PermWrite: "allow",
			toolregistry.PermExec:  "allow",
		},
		Remembered: map[string]bool{},
	}
}
