// GeoWork Go Core - Tool Registry

package toolregistry

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Tool defines a callable tool in the registry.
type Tool interface {
	Name() string
	Description() string
	InputSchema() map[string]any
	OutputSchema() map[string]any
	Permission() string
	RiskLevel() string
	SandboxRequired() bool
	StreamingSupported() bool
	Execute(ctx context.Context, args map[string]any) (map[string]any, error)
}

// Registry manages tool registration and lookup with governance support.
type Registry struct {
	mu           sync.RWMutex
	tools        map[string]Tool
	log          *zap.Logger
	governor     *Governor        // existing call-rate / policy Governor (frequency, quota)
	approvalGov  ApprovalGovernor // P1-1: interactive approval-flow governor (aiagent.GovernorImpl)
	auditLog     *AuditLog
	policies     map[string]*GovernorPolicy // cached governor policies
	allowedRoots []string                   // P1-1: sandbox path roots for write/exec tools
}

func NewRegistry(log *zap.Logger) *Registry {
	return &Registry{
		tools:    make(map[string]Tool),
		log:      log,
		policies: make(map[string]*GovernorPolicy),
	}
}

// WithApprovalGovernor injects an interactive approval-flow governor
// into the registry. The registry stays unaware of the concrete type
// (typically *aiagent.GovernorImpl) — it only depends on the
// ApprovalGovernor interface, keeping the dependency direction
// aiagent → toolregistry one-way.
func (r *Registry) WithApprovalGovernor(ag ApprovalGovernor) *Registry {
	r.mu.Lock()
	r.approvalGov = ag
	r.mu.Unlock()
	return r
}

// WithAllowedRoots configures the sandbox path roots used by
// validateSandboxPath when executing tools that opt into SandboxRequired.
// Tools whose `path` argument falls outside every root are rejected.
func (r *Registry) WithAllowedRoots(roots []string) *Registry {
	r.mu.Lock()
	// Copy to avoid external mutation.
	r.allowedRoots = append([]string(nil), roots...)
	r.mu.Unlock()
	return r
}

// GetApprovalGovernor returns the attached ApprovalGovernor, if any.
// Used by the aiagent package's waitForApproval path to talk to the
// concrete GovernorImpl when it needs the pending-requests list.
func (r *Registry) GetApprovalGovernor() ApprovalGovernor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.approvalGov
}

// AllowedRoots returns a copy of the configured sandbox roots.
func (r *Registry) AllowedRoots() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return append([]string(nil), r.allowedRoots...)
}

// Register adds a tool to the registry.
func (r *Registry) Register(t Tool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tools[t.Name()]; exists {
		return fmt.Errorf("tool %s already registered", t.Name())
	}
	r.tools[t.Name()] = t
	r.log.Info("tool registered", zap.String("name", t.Name()))
	return nil
}

// Get returns a tool by name.
func (r *Registry) Get(name string) (Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tools[name]
	return t, ok
}

// List returns all registered tools.
func (r *Registry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Tool, 0, len(r.tools))
	for _, t := range r.tools {
		out = append(out, t)
	}
	return out
}

// Remove removes a tool by name.
func (r *Registry) Remove(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.tools[name]; !ok {
		return fmt.Errorf("tool %s not found", name)
	}
	delete(r.tools, name)
	return nil
}

// WithGovernor attaches a Governor to the registry for runtime governance.
func (r *Registry) WithGovernor(g *Governor) *Registry {
	r.mu.Lock()
	r.governor = g
	r.mu.Unlock()
	return r
}

// WithAuditLog attaches an AuditLog to the registry.
func (r *Registry) WithAuditLog(a *AuditLog) *Registry {
	r.mu.Lock()
	r.auditLog = a
	r.mu.Unlock()
	return r
}

// GetGovernor returns the attached Governor, if any.
func (r *Registry) GetGovernor() *Governor {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.governor
}

// GetAuditLog returns the attached AuditLog, if any.
func (r *Registry) GetAuditLog() *AuditLog {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.auditLog
}

// Execute calls a registered tool with the given arguments, enforcing governance.
//
// The mode parameter tells the registry whether the call originates from the
// LLM-driven autonomous ReAct loop (ModeAutonomous) or from a deterministic
// workflow / direct API call (ModeDeterministic). The ApprovalGovernor uses
// it to decide whether a critical tool requires interactive user approval:
//
//   - ModeAutonomous + critical risk → blocks via *ErrApprovalRequired
//     until the orchestrator's waitForApproval resolves the request.
//   - ModeDeterministic + critical risk → audit-logged only (the workflow
//     author pre-authorized the operation at design time).
//
// When ApprovalGovernor is not attached (nil), the call proceeds without
// approval checks — preserving the pre-P1-1 behavior for callers that have
// not yet wired a governor (e.g. tests, workflow engine without orchestrator).
func (r *Registry) Execute(ctx context.Context, name string, args map[string]any, mode ExecutionMode) (map[string]any, error) {
	t, ok := r.Get(name)
	if !ok {
		return nil, fmt.Errorf("tool %s not found", name)
	}

	// Snapshot fields under the read lock so the rest of Execute can run
	// without holding the registry mutex.
	r.mu.RLock()
	governor := r.governor
	auditLog := r.auditLog
	approvalGov := r.approvalGov
	allowedRoots := append([]string(nil), r.allowedRoots...)
	r.mu.RUnlock()

	if governor != nil {
		if err := governor.RecordCall(name); err != nil {
			// Record failed governance check
			if auditLog != nil {
				argsJSON, _ := json.Marshal(args)
				auditLog.Record(AuditEntry{
					TaskID:   governor.taskID,
					ToolName: name,
					Args:     string(argsJSON),
					Success:  false,
					Error:    err.Error(),
				})
			}
			return nil, fmt.Errorf("governance denied: %w", err)
		}

		// Record successful call
		if auditLog != nil {
			argsJSON, _ := json.Marshal(args)
			auditLog.Record(AuditEntry{
				TaskID:   governor.taskID,
				ToolName: name,
				Args:     string(argsJSON),
				Success:  true,
				Approved: governor.IsGoverned(name),
			})
		}
	}

	// Check permissions
	if perm := t.Permission(); perm != "" {
		if !CheckPermission(ctx, perm) {
			return nil, fmt.Errorf("permission denied: %s", perm)
		}
	}

	// Enforce policy on high-risk tools: deny when no policy is present or policy is read-only.
	if isHighRiskTool(name) {
		policy, hasPolicy := ctx.Value(policyKey{}).(*PermissionPolicy)
		if !hasPolicy || policy == nil {
			return nil, fmt.Errorf("high-risk tool %s requires an explicit permission policy", name)
		}
		if policy.DefaultLevel == "read_only" || policy.DefaultLevel == "limited" {
			// doc/22 BP1: check the tool's permission CLASS (read/write/exec).
			// The previous CheckPermission(ctx, name) passed the tool NAME,
			// which never matches the class-keyed Actions map and always
			// fell through to DefaultLevel — a semantic no-op.
			if !CheckPermission(ctx, t.Permission()) {
				return nil, fmt.Errorf("high-risk tool %s denied by read-only/limited policy", name)
			}
		}
	}

	// P1-1 §2.4: sandbox path validation. Applied only to tools that
	// declared SandboxRequired (write_file / run_shell / run_python /
	// delete_file / git_commit / git_push / run_git_add / run_git_reset).
	// When allowedRoots is empty the check is skipped (caller has not
	// configured a sandbox boundary yet — preserves legacy behavior).
	if t.SandboxRequired() && len(allowedRoots) > 0 {
		if pathArg, ok := args["path"].(string); ok && pathArg != "" {
			if err := validateSandboxPath(pathArg, allowedRoots); err != nil {
				return nil, err
			}
		}
		// doc/22 BP1 / F5 (minimal fix): run_shell carries its targets
		// inside the command STRING, not in args["path"]. Scan the
		// command for absolute-path tokens and reject any that fall
		// outside the sandbox roots. Best-effort defense in depth —
		// the hard gates for run_shell are its critical risk level
		// (interactive approval) and cmd.Dir pinning to the workspace.
		if cmdArg, ok := args["command"].(string); ok && cmdArg != "" {
			for _, p := range extractAbsolutePaths(cmdArg) {
				if err := validateSandboxPath(p, allowedRoots); err != nil {
					return nil, fmt.Errorf("command references a path outside the sandbox: %w", err)
				}
			}
		}
	}

	// P1-1 §2.5: interactive approval flow. The registry delegates the
	// wait back to the orchestrator by returning *ErrApprovalRequired —
	// it does NOT block here, otherwise Registry would need to import the
	// aiagent package (reverse dependency). The orchestrator catches the
	// error, extracts Req, runs waitForApproval, then retries Execute.
	if approvalGov != nil {
		runID := RunIDFromContext(ctx)
		approvalReq, err := approvalGov.CheckPermission(runID, name, args, mode)
		if err != nil {
			return nil, err
		}
		if approvalReq != nil {
			return nil, &ErrApprovalRequired{Req: approvalReq}
		}
	}

	start := time.Now()
	result, err := t.Execute(ctx, args)
	duration := time.Since(start).Milliseconds()

	if err != nil && auditLog != nil && governor != nil {
		argsJSON, _ := json.Marshal(args)
		auditLog.Record(AuditEntry{
			TaskID:     governor.taskID,
			ToolName:   name,
			Args:       string(argsJSON),
			Success:    false,
			Error:      err.Error(),
			DurationMs: duration,
		})
	}

	if err != nil {
		return nil, fmt.Errorf("tool %s execution failed: %w", name, err)
	}

	// Enforce the declared OutputSchema so a tool cannot silently return
	// a shape that contradicts its contract. Tools without an
	// OutputSchema (e.g. dynamically registered worker tools) skip this.
	if schema := t.OutputSchema(); len(schema) > 0 {
		if verr := validateOutput(schema, result); verr != nil {
			if auditLog != nil && governor != nil {
				argsJSON, _ := json.Marshal(args)
				auditLog.Record(AuditEntry{
					TaskID:     governor.taskID,
					ToolName:   name,
					Args:       string(argsJSON),
					Success:    false,
					Error:      verr.Error(),
					DurationMs: duration,
				})
			}
			return nil, fmt.Errorf("tool %s output rejected: %w", name, verr)
		}
	}
	return result, nil
}

// validateSandboxPath ensures path stays inside one of the allowed roots.
// Used by Registry.Execute for tools that declared SandboxRequired.
// Resolves symlinks on the absolute path before comparison so ../
// traversals cannot escape the sandbox.
func validateSandboxPath(path string, allowedRoots []string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("invalid path %q: %w", path, err)
	}
	for _, root := range allowedRoots {
		absRoot, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		// filepath.Rel already handles the boundary correctly: a path
		// like "/data/evil" yields rel "evil" against root "/data/e"
		// (NOT "."), so the HasPrefix("..") check below rejects it.
		// No manual separator-padding is needed.
		rel, err := filepath.Rel(absRoot, absPath)
		if err != nil {
			continue
		}
		if rel == "." || !strings.HasPrefix(rel, "..") {
			return nil
		}
	}
	return fmt.Errorf("path %q outside sandbox roots", path)
}

// extractAbsolutePaths scans a shell command string for absolute-path
// tokens (POSIX "/…" and Windows "C:\…" / "C:/…"). Tokenization is
// whitespace/quote based and strips trailing shell punctuation; relative
// paths are not reported because they resolve against cmd.Dir (pinned to
// the workspace). Best-effort: obfuscated commands can evade it — the
// authoritative gates for run_shell are interactive approval (critical
// risk) and the workspace cwd pin.
func extractAbsolutePaths(command string) []string {
	fields := strings.FieldsFunc(command, func(r rune) bool {
		switch r {
		case ' ', '\t', '\n', '"', '\'', '`':
			return true
		}
		return false
	})
	trimPunct := func(s string) string {
		return strings.TrimRight(s, ";,|&><")
	}
	var out []string
	for _, f := range fields {
		f = trimPunct(f)
		if len(f) >= 1 && f[0] == '/' {
			out = append(out, f)
			continue
		}
		// Windows drive form: letter + ':' + separator.
		if len(f) >= 3 && f[1] == ':' && (f[2] == '\\' || f[2] == '/') && f[0] >= 'A' && f[0] <= 'z' {
			out = append(out, f)
		}
	}
	return out
}

// ExecuteWithArgs is a convenience wrapper that accepts JSON bytes.
// Defaults to ModeDeterministic since this entry point is intended for
// direct API callers (HTTP / CLI), where the user has authorized the
// call explicitly.
func (r *Registry) ExecuteWithArgs(ctx context.Context, name string, argsJSON []byte) (map[string]any, error) {
	var args map[string]any
	if err := json.Unmarshal(argsJSON, &args); err != nil {
		return nil, fmt.Errorf("parse args: %w", err)
	}
	return r.Execute(ctx, name, args, ModeDeterministic)
}

// IsRegistered checks if a tool is registered.
func (r *Registry) IsRegistered(name string) bool {
	_, ok := r.Get(name)
	return ok
}
