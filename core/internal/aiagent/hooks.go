// GeoWork Go Core - Lifecycle Hooks (P2-3)
//
// Hooks let external code observe and influence the ReAct loop at
// well-defined points: run start/end, turn start/end, tool before/after,
// model call. Each hook returns an error; a non-nil error is logged
// but does NOT abort the main flow (hooks are advisory by design —
// only ctx.Cancel() can stop a run, mirroring the doc's §4.6 #3 rule).
//
// Hooks are registered in order and called in that order for each
// event. The orchestrator holds the slice behind a mutex so hooks can
// be registered at any time (e.g. by plugins loaded after startup).

package aiagent

import (
	"context"
	"sync"

	"go.uber.org/zap"
)

// HookEvent names the point in the lifecycle a hook is invoked at.
type HookEvent string

const (
	HookOnRunStart   HookEvent = "OnRunStart"
	HookOnRunEnd     HookEvent = "OnRunEnd"
	HookOnTurnStart  HookEvent = "OnTurnStart"
	HookOnTurnEnd    HookEvent = "OnTurnEnd"
	HookOnToolBefore HookEvent = "OnToolBefore"
	HookOnToolAfter  HookEvent = "OnToolAfter"
)

// HookContext is passed to every hook invocation. Fields are populated
// only with what's relevant to the event — e.g. ToolName/ToolArgs are
// set for OnToolBefore/OnToolAfter but zero on OnRunStart.
//
// Cancel, if invoked, cancels the run's context (same effect as
// StopRun but cooperative — the loop checks ctx.Err() at the next
// turn boundary).
type HookContext struct {
	RunID      string
	Run        *Run
	RunCtx     *RunContext
	TurnIndex  int
	ToolName   string
	ToolArgs   map[string]any
	ToolResult map[string]any
	ToolError  error
	Cancel     context.CancelFunc
}

// Hook is the interface every lifecycle hook implements. A hook that
// has nothing to do for an event should return nil.
type Hook interface {
	Name() string
	OnRunStart(ctx *HookContext) error
	OnRunEnd(ctx *HookContext) error
	OnTurnStart(ctx *HookContext) error
	OnTurnEnd(ctx *HookContext) error
	OnToolBefore(ctx *HookContext) error
	OnToolAfter(ctx *HookContext) error
}

// HookManager holds the registered hooks and dispatches events.
type HookManager struct {
	mu    sync.RWMutex
	hooks []Hook
	log   *zap.Logger
}

func NewHookManager(log *zap.Logger) *HookManager {
	if log == nil {
		log = zap.NewNop()
	}
	return &HookManager{log: log}
}

// Register adds a hook to the chain. Hooks fire in registration order.
func (m *HookManager) Register(h Hook) {
	if h == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.hooks = append(m.hooks, h)
}

// Fire dispatches one event to all hooks. A hook returning an error is
// logged but does NOT abort the dispatch or the main flow (per §4.6 #3:
// "Hook 错误不影响主流程"). The only way a hook can stop a run is by
// calling ctx.Cancel(), which is honored at the next turn boundary.
func (m *HookManager) Fire(event HookEvent, hctx *HookContext) {
	m.mu.RLock()
	hooks := m.hooks
	m.mu.RUnlock()

	for _, h := range hooks {
		var err error
		switch event {
		case HookOnRunStart:
			err = h.OnRunStart(hctx)
		case HookOnRunEnd:
			err = h.OnRunEnd(hctx)
		case HookOnTurnStart:
			err = h.OnTurnStart(hctx)
		case HookOnTurnEnd:
			err = h.OnTurnEnd(hctx)
		case HookOnToolBefore:
			err = h.OnToolBefore(hctx)
		case HookOnToolAfter:
			err = h.OnToolAfter(hctx)
		}
		if err != nil {
			m.log.Warn("hook returned error (ignored)",
				zap.String("hook", h.Name()),
				zap.String("event", string(event)),
				zap.Error(err))
		}
	}
}

// HasHooks reports whether any hook is registered. Used by the
// orchestrator to skip the (cheap but non-zero) Fire call when nothing
// is listening.
func (m *HookManager) HasHooks() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.hooks) > 0
}

// Count returns the number of registered hooks.
func (m *HookManager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.hooks)
}

// AuditHook is a built-in hook that logs every tool call to the audit
// logger. Registered by default when the orchestrator has a logger.
type AuditHook struct {
	log *zap.Logger
}

func NewAuditHook(log *zap.Logger) *AuditHook {
	if log == nil {
		log = zap.NewNop()
	}
	return &AuditHook{log: log}
}

func (h *AuditHook) Name() string { return "audit" }
func (h *AuditHook) OnRunStart(ctx *HookContext) error {
	h.log.Info("run started", zap.String("runId", ctx.RunID))
	return nil
}
func (h *AuditHook) OnRunEnd(ctx *HookContext) error {
	h.log.Info("run ended", zap.String("runId", ctx.RunID))
	return nil
}
func (h *AuditHook) OnTurnStart(ctx *HookContext) error {
	h.log.Debug("turn start", zap.String("runId", ctx.RunID), zap.Int("turn", ctx.TurnIndex))
	return nil
}
func (h *AuditHook) OnTurnEnd(ctx *HookContext) error {
	h.log.Debug("turn end", zap.String("runId", ctx.RunID), zap.Int("turn", ctx.TurnIndex))
	return nil
}
func (h *AuditHook) OnToolBefore(ctx *HookContext) error {
	h.log.Info("tool executing",
		zap.String("runId", ctx.RunID),
		zap.Int("turn", ctx.TurnIndex),
		zap.String("tool", ctx.ToolName),
		zap.Any("args", ctx.ToolArgs),
	)
	return nil
}
func (h *AuditHook) OnToolAfter(ctx *HookContext) error {
	if ctx.ToolError != nil {
		h.log.Warn("tool failed",
			zap.String("runId", ctx.RunID),
			zap.String("tool", ctx.ToolName),
			zap.Error(ctx.ToolError))
	} else {
		h.log.Info("tool completed",
			zap.String("runId", ctx.RunID),
			zap.String("tool", ctx.ToolName))
	}
	return nil
}
