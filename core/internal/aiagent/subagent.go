// GeoWork Go Core - Sub-agent (P3-1 §2)
//
// SubAgentManager spawns child Orchestrator instances that share the
// parent's registry/gateway/provider/governor but have independent
// Memory, state machine, and chat history. A child inherits a summary
// of the parent's memory so it starts with relevant context, but its
// execution is fully isolated — parent cannot directly mutate child
// memory or vice-versa.
//
// The manager also exposes the spawn_subagent tool (registered via the
// parent orchestrator's registry) so the model itself can delegate
// sub-tasks. The tool blocks until the child reaches a terminal state,
// then returns the child's final message as the tool result.

package aiagent

import (
	"context"
	"fmt"
	"sync"
	"time"

	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// SubAgentConfig configures one child agent run.
type SubAgentConfig struct {
	ParentRunID    string   `json:"parentRunId"`
	Mode           string   `json:"mode"`
	Prompt         string   `json:"prompt"`
	InheritContext bool     `json:"inheritContext"`
	MaxTurns       int      `json:"maxTurns,omitempty"`
	Tools          []string `json:"tools,omitempty"` // subset; empty = all
}

// SubAgentManager owns child orchestrators spawned by a parent orchestrator.
type SubAgentManager struct {
	parent   *Orchestrator
	children map[string]*Orchestrator // subRunID → child Orchestrator
	parentOf map[string]string        // subRunID → parentRunID (for event routing)
	mu       sync.Mutex
	log      *zap.Logger
}

// NewSubAgentManager builds a manager bound to a parent orchestrator.
func NewSubAgentManager(parent *Orchestrator, log *zap.Logger) *SubAgentManager {
	return &SubAgentManager{
		parent:   parent,
		children: make(map[string]*Orchestrator),
		parentOf: make(map[string]string),
		log:      log,
	}
}

// SpawnSubAgent starts a child orchestrator with its own RunContext and
// returns once the child run is created (non-blocking — the run executes
// in the child's own goroutine). Use WaitForSubAgent to block on the
// result.
func (m *SubAgentManager) SpawnSubAgent(ctx context.Context, cfg *SubAgentConfig) (*Run, error) {
	if m == nil || m.parent == nil {
		return nil, fmt.Errorf("subagent manager not initialized")
	}
	if cfg == nil {
		return nil, fmt.Errorf("nil subagent config")
	}
	parentRC := m.parent.getRunContext(cfg.ParentRunID)
	if parentRC == nil {
		return nil, fmt.Errorf("parent run %q not found", cfg.ParentRunID)
	}

	// Build a child orchestrator sharing the parent's registry/gateway/
	// provider/governor. The child gets its own Memory, state machine,
	// run map, and run-context map. NewChildOrchestrator deliberately
	// does NOT re-register the approval governor on the shared registry.
	childOrch := NewChildOrchestrator(
		m.parent.registry,
		m.parent.gateway,
		m.parent.provider,
		m.parent.approver,
		m.log,
	)
	if cfg.MaxTurns > 0 {
		childOrch.maxTurns = cfg.MaxTurns
	}
	// Inherit trajectory/usage meter so child runs are observable too.
	if m.parent.trajectory != nil {
		childOrch.WithTrajectoryRecorder(m.parent.trajectory)
	}
	if m.parent.usageMeter != nil {
		childOrch.WithUsageMeter(m.parent.usageMeter)
	}
	// Inherit hooks so sub-agent tool calls are also audited.
	if m.parent.hooks != nil {
		childOrch.WithHooks(m.parent.hooks)
	}
	// Inherit skills registry so the child can use the same skills.
	if m.parent.skillsReg != nil {
		childOrch.WithSkills(m.parent.skillsReg)
	}

	parentMemory := ""
	if cfg.InheritContext {
		// Summarize parent memory so the child starts with relevant
		// context without inheriting the full chat history (which would
		// duplicate tokens and risk confusion).
		parentMemory = parentRC.Memory.Summary(4000)
	}

	run, err := childOrch.StartRunWithMemory(ctx, cfg.Mode, cfg.Prompt, parentMemory)
	if err != nil {
		return nil, fmt.Errorf("spawn subagent: %w", err)
	}

	m.mu.Lock()
	m.children[run.ID] = childOrch
	m.parentOf[run.ID] = cfg.ParentRunID
	m.mu.Unlock()

	// Emit a subagent_spawned event into the parent run's event stream
	// so the UI can show "spawned child agent X for task Y".
	m.parent.emitEvent(parentRC, Event{
		Type:      "subagent_spawned",
		Timestamp: time.Now(),
		RunID:     cfg.ParentRunID,
		Data: map[string]any{
			"subRunId":       run.ID,
			"mode":           cfg.Mode,
			"prompt":         cfg.Prompt,
			"inheritContext": cfg.InheritContext,
			"maxTurns":       cfg.MaxTurns,
		},
	})
	if m.log != nil {
		m.log.Info("subagent spawned",
			zap.String("parentRun", cfg.ParentRunID),
			zap.String("subRun", run.ID),
			zap.String("mode", cfg.Mode),
		)
	}
	return run, nil
}

// WaitForSubAgent blocks until the child reaches a terminal state.
// Returns the final Run snapshot. Caller is responsible for any timeout
// via the supplied context.
func (m *SubAgentManager) WaitForSubAgent(ctx context.Context, subRunID string) (*Run, error) {
	m.mu.Lock()
	childOrch, ok := m.children[subRunID]
	m.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("sub-agent %q not found", subRunID)
	}
	return childOrch.WaitForRun(ctx, subRunID)
}

// CollectSubAgentResult waits for the child and extracts its final
// output. Preference order: Run.Result (final assistant summary,
// populated by executePlan teardown) → last assistant Message →
// empty string. Also emits a subagent_done event into the parent run.
func (m *SubAgentManager) CollectSubAgentResult(ctx context.Context, subRunID string) (string, *Run, error) {
	run, err := m.WaitForSubAgent(ctx, subRunID)
	if err != nil {
		return "", nil, err
	}

	// Notify the parent that the sub-agent finished.
	m.mu.Lock()
	parentRunID := m.parentOf[subRunID]
	if parentRunID != "" {
		if parentRC := m.parent.getRunContext(parentRunID); parentRC != nil {
			m.parent.emitEvent(parentRC, Event{
				Type:      "subagent_done",
				Timestamp: time.Now(),
				RunID:     parentRunID,
				Data: map[string]any{
					"subRunId": subRunID,
					"status":   string(run.Status),
				},
			})
		}
	}
	m.mu.Unlock()

	// Prefer Run.Result (set by executePlan teardown); fall back to
	// the last assistant message in run.Messages.
	if run.Result != "" {
		return run.Result, run, nil
	}
	for i := len(run.Messages) - 1; i >= 0; i-- {
		if run.Messages[i].Role == "assistant" {
			return run.Messages[i].Content, run, nil
		}
	}
	return "", run, nil
}

// ListSubAgents returns the IDs of currently-tracked child orchestrators.
func (m *SubAgentManager) ListSubAgents() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]string, 0, len(m.children))
	for id := range m.children {
		out = append(out, id)
	}
	return out
}

// CleanupChildren removes all child orchestrators spawned by the given
// parent run. Called from the parent's executePlan teardown so a
// finished parent doesn't leak its children's run maps / goroutines.
// Children that are still executing are cancelled first via their own
// StopRun so the teardown is prompt rather than waiting for natural exit.
func (m *SubAgentManager) CleanupChildren(parentRunID string) {
	if m == nil {
		return
	}
	m.mu.Lock()
	var toRemove []string
	for subRunID, pid := range m.parentOf {
		if pid == parentRunID {
			toRemove = append(toRemove, subRunID)
		}
	}
	var children []*Orchestrator
	for _, subRunID := range toRemove {
		if child, ok := m.children[subRunID]; ok {
			children = append(children, child)
		}
		delete(m.children, subRunID)
		delete(m.parentOf, subRunID)
	}
	m.mu.Unlock()

	for i, child := range children {
		subRunID := toRemove[i]
		// Best-effort stop: if the child is still running, cancel it so
		// its goroutine exits instead of leaking.
		child.StopRun(subRunID)
	}
	if m.log != nil && len(toRemove) > 0 {
		m.log.Debug("cleaned up subagents",
			zap.String("parentRun", parentRunID),
			zap.Int("count", len(toRemove)),
		)
	}
}

// RegisterSubAgentTool registers the spawn_subagent tool against the
// parent orchestrator's registry. The tool blocks until the spawned
// child completes, then returns its result as the tool output.
//
// Call this once at startup (idempotent — skips if already registered).
func (m *SubAgentManager) RegisterSubAgentTool() error {
	if m == nil || m.parent == nil || m.parent.registry == nil {
		return fmt.Errorf("subagent manager or parent registry not initialized")
	}
	if m.parent.registry.IsRegistered("spawn_subagent") {
		return nil
	}
	manager := m
	tool := toolregistry.NewBuilder("spawn_subagent").
		Description("Spawn a sub-agent to handle a sub-task. The sub-agent runs independently with its own context, inheriting a summary of the parent's memory. Blocks until the sub-agent completes and returns its final output.").
		InputSchema(map[string]any{
			"type": "object",
			"properties": map[string]any{
				"prompt":   map[string]any{"type": "string", "description": "The sub-task prompt for the sub-agent"},
				"mode":     map[string]any{"type": "string", "description": "Agent Mode for the sub-agent (defaults to parent's mode)"},
				"maxTurns": map[string]any{"type": "integer", "description": "Maximum turns the sub-agent may run (default 10)"},
			},
			"required": []string{"prompt"},
		}).
		OutputSchema(map[string]any{
			"type": "object",
			"properties": map[string]any{
				"subRunId": map[string]any{"type": "string"},
				"result":   map[string]any{"type": "string"},
				"status":   map[string]any{"type": "string"},
			},
		}).
		Permission("exec").
		RiskLevel("medium").
		Sandbox(false).
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			prompt, _ := args["prompt"].(string)
			if prompt == "" {
				return nil, fmt.Errorf("prompt is required")
			}
			mode, _ := args["mode"].(string)
			maxTurns := 10
			if v, ok := args["maxTurns"].(int); ok && v > 0 {
				maxTurns = v
			}
			if v, ok := args["maxTurns"].(float64); ok && v > 0 {
				maxTurns = int(v)
			}

			// Recover the parent runID from the context. The orchestrator
			// stashes it via toolregistry.WithRunID when invoking tools.
			parentRunID := toolregistry.RunIDFromContext(ctx)
			if parentRunID == "" {
				return nil, fmt.Errorf("spawn_subagent: no parent runID in context")
			}

			run, err := manager.SpawnSubAgent(ctx, &SubAgentConfig{
				ParentRunID:    parentRunID,
				Mode:           mode,
				Prompt:         prompt,
				InheritContext: true,
				MaxTurns:       maxTurns,
			})
			if err != nil {
				return nil, err
			}
			result, finalRun, err := manager.CollectSubAgentResult(ctx, run.ID)
			if err != nil {
				return nil, err
			}
			status := ""
			if finalRun != nil {
				status = string(finalRun.Status)
			}
			return map[string]any{
				"subRunId": run.ID,
				"result":   result,
				"status":   status,
			}, nil
		}).
		Build()
	return m.parent.registry.Register(tool)
}
