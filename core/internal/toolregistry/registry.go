// GeoWork Go Core - Tool Registry

package toolregistry

import (
	"context"
	"encoding/json"
	"fmt"
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
	mu         sync.RWMutex
	tools      map[string]Tool
	log        *zap.Logger
	governor   *Governor
	auditLog   *AuditLog
	policies   map[string]*GovernorPolicy // cached governor policies
}

func NewRegistry(log *zap.Logger) *Registry {
	return &Registry{
		tools:    make(map[string]Tool),
		log:      log,
		policies: make(map[string]*GovernorPolicy),
	}
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
func (r *Registry) Execute(ctx context.Context, name string, args map[string]any) (map[string]any, error) {
	t, ok := r.Get(name)
	if !ok {
		return nil, fmt.Errorf("tool %s not found", name)
	}

	// Check governance
	r.mu.RLock()
	governor := r.governor
	auditLog := r.auditLog
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

	// Check sandbox
	if t.SandboxRequired() {
		// Sandbox enforcement would go here
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
	return result, nil
}

// ExecuteWithArgs is a convenience wrapper that accepts JSON bytes.
func (r *Registry) ExecuteWithArgs(ctx context.Context, name string, argsJSON []byte) (map[string]any, error) {
	var args map[string]any
	if err := json.Unmarshal(argsJSON, &args); err != nil {
		return nil, fmt.Errorf("parse args: %w", err)
	}
	return r.Execute(ctx, name, args)
}

// IsRegistered checks if a tool is registered.
func (r *Registry) IsRegistered(name string) bool {
	_, ok := r.Get(name)
	return ok
}
