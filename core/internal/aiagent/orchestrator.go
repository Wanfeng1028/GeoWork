// GeoWork Go Core - Agent Orchestrator

package aiagent

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"geowork/core/internal/aiagent/skills"
	"geowork/core/internal/diff"
	"geowork/core/internal/idgen"
	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// Status represents the current state of an agent run.
type Status string

const (
	StatusPending   Status = "pending"
	StatusRunning   Status = "running"
	StatusPaused    Status = "paused"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusStopped   Status = "stopped" // cancelled via StopRun / context cancellation
	StatusRecovery  Status = "recovery"
)

// Run represents a single agent execution.
type Run struct {
	ID         string    `json:"id"`
	Mode       string    `json:"mode"`
	Prompt     string    `json:"prompt"`
	Status     Status    `json:"status"`
	Plan       []Step    `json:"plan,omitempty"`
	Messages   []Message `json:"messages,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	StepIndex  int       `json:"stepIndex,omitempty"`
	Checkpoint []byte    `json:"checkpoint,omitempty"`

	// Result holds the final assistant output once the run reaches a
	// terminal state. Populated by executePlan's teardown from the last
	// assistant message so callers (e.g. SubAgentManager) can collect
	// the outcome without reaching into the (already-removed) RunContext.
	Result string `json:"result,omitempty"`

	// parentMemory carries the inherited parent conversation context for
	// floating-assistant sub-conversations. It is injected into the system
	// prompt at execution time. Unexported, so never serialized.
	parentMemory string

	// done is closed when the run reaches a terminal state (completed or
	// failed). It lets callers such as WaitForRun block until execution
	// finishes. It is unexported and therefore never serialized.
	done chan struct{}
}

// Step is a single step in the agent plan.
type Step struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Tool      string    `json:"tool,omitempty"`
	Args      string    `json:"args,omitempty"`
	Status    string    `json:"status"`
	Result    string    `json:"result,omitempty"`
	Duration  int64     `json:"duration,omitempty"` // ms
	StartTime time.Time `json:"startTime,omitempty"`
}

// Message represents a conversation message.
type Message struct {
	Role      string     `json:"role"`
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"toolCalls,omitempty"`
}

// ToolCall represents a tool invocation.
type ToolCall struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Args     map[string]any `json:"args"`
	Stdout   string         `json:"stdout,omitempty"`
	Stderr   string         `json:"stderr,omitempty"`
	Result   map[string]any `json:"result,omitempty"`
	Error    string         `json:"error,omitempty"`
	Duration int64          `json:"duration,omitempty"`
}

// Event is a streaming event from agent execution.
type Event struct {
	Type      string         `json:"type"` // plan, step_start, step_done, message, error, checkpoint, done
	Timestamp time.Time      `json:"timestamp"`
	RunID     string         `json:"runId"`
	Data      map[string]any `json:"data,omitempty"`

	// P1-3 §4.5.2: Run-local sequence number for Last-Event-ID
	// reconnect. The SSE handler serializes this as `id: {runID}:{seq}`.
	// Set by emitEvent when the event is appended to the buffer.
	Seq int `json:"seq,omitempty"`
}

// EventSink is the sink for agent events. It is implemented by the API
// layer's EventBridge so orchestrator events can be consumed via SSE
// subscribers without introducing an import cycle (aiagent must not
// depend on the api package).
type EventSink interface {
	Publish(eventType string, runID string, data map[string]any)
}

// RunContext encapsulates per-run mutable state, enabling concurrent Run isolation.
type RunContext struct {
	Run            *Run
	State          State
	Memory         *Memory
	EventCh        chan Event
	Cancel         context.CancelFunc
	readOnlyStreak int // consecutive read-only tool turns (for Verifying auto-inference)

	// P1-3 §4.5.3: ring buffer of recent SSE events for Last-Event-ID
	// reconnect replay. Lazily initialized on first emitEvent call.
	eventBuf *EventBuffer

	// P1-4: pause / resume support. PauseCh is recreated on each pause
	// and closed on resume; the ReAct loop blocks on <-PauseCh when
	// Paused is true. PauseReason is surfaced via the run_paused event
	// so the UI can show why the run is waiting.
	//
	// P1-5: State/Paused/PauseCh/PauseReason are written by the API
	// goroutine (PauseRun/ResumeRun) and the run goroutine (ReAct
	// loop) concurrently — every cross-goroutine access goes through
	// the stateMu-guarded methods below.
	stateMu     sync.RWMutex
	Paused      bool
	PauseCh     chan struct{}
	PauseReason string

	// P3-3: per-turn speculative executor. Created at the start of each
	// turn, shared with streamModelCall so read-only tools start during
	// streaming, and consulted by the tool-execution loop to reuse
	// cached results. Cleaned up at turn end.
	specExec *SpeculativeExecutor
}

// currentState returns the agent state machine's current state.
func (rc *RunContext) currentState() State {
	rc.stateMu.RLock()
	defer rc.stateMu.RUnlock()
	return rc.State
}

// setState updates the agent state.
func (rc *RunContext) setState(s State) {
	rc.stateMu.Lock()
	rc.State = s
	rc.stateMu.Unlock()
}

// isPaused reports whether the run is paused.
func (rc *RunContext) isPaused() bool {
	rc.stateMu.RLock()
	defer rc.stateMu.RUnlock()
	return rc.Paused
}

// pause atomically flips the run into the paused state and (re)creates
// the resume channel. Returns false when already paused (idempotent).
func (rc *RunContext) pause(reason string) bool {
	rc.stateMu.Lock()
	defer rc.stateMu.Unlock()
	if rc.Paused {
		return false
	}
	rc.Paused = true
	rc.PauseReason = reason
	rc.PauseCh = make(chan struct{})
	return true
}

// resume atomically clears the paused state and hands back the channel
// to close. Returns nil when not paused.
func (rc *RunContext) resume() chan struct{} {
	rc.stateMu.Lock()
	defer rc.stateMu.Unlock()
	if !rc.Paused {
		return nil
	}
	rc.Paused = false
	rc.PauseReason = ""
	ch := rc.PauseCh
	rc.PauseCh = nil
	return ch
}

// pauseChannel returns the current resume channel (nil when not
// paused). The ReAct loop snapshots it under the same lock as its
// isPaused check to avoid a resume racing between the two reads.
func (rc *RunContext) pauseChannel() chan struct{} {
	rc.stateMu.RLock()
	defer rc.stateMu.RUnlock()
	return rc.PauseCh
}

// pauseReason returns why the run was paused (for status snapshots).
func (rc *RunContext) pauseReason() string {
	rc.stateMu.RLock()
	defer rc.stateMu.RUnlock()
	return rc.PauseReason
}

// Orchestrator is the main agent loop controller with budget-aware context and bounded memory.
type Orchestrator struct {
	registry     *toolregistry.Registry
	gateway      modelgateway.ModelGateway // interface, not concrete type
	providerID   string
	provider     *modelgateway.ModelProvider
	planner      *Planner
	contextBld   *ContextBuilder
	recovery     *Recovery
	stateMachine *StateMachine
	eventSink    EventSink
	log          *zap.Logger
	budget       ContextBudget
	maxTurns     int
	approver     *InteractiveApprover      // P1-1: interactive approval for critical tools
	trajectory   *TrajectoryRecorder       // P1-2: per-run execution trace recorder (nil = disabled)
	usageMeter   *modelgateway.UsageMeter  // P1-2: token usage audit (nil = disabled)
	hooks        *HookManager              // P2-3: lifecycle hooks (nil = disabled)
	skillsReg    *skills.Registry          // P2-1: skills registry (nil = skill-less mode)
	harness      *Harness                  // P3-2: unified rule engine (nil = bypass)
	policy       *toolregistry.PolicyTable // P3-3: tool risk/ReadOnly lookup (nil = no speculative)
	// subAgentMgr is the manager that owns child orchestrators spawned
	// by this run's spawn_subagent tool calls (doc/22 BP5). nil when the
	// runtime didn't register the sub-agent tool. Teardown calls
	// CleanupChildren so finished parents don't leak their children.
	subAgentMgr *SubAgentManager
	// permPolicy is injected into every tool context (doc/22 BP1 / F1).
	// nil keeps the registry's read-only default — production must wire
	// DefaultDesktopPolicy via WithPermissionPolicy.
	permPolicy    *toolregistry.PermissionPolicy
	workspacePath string // pinned into tool ctx so run_shell/run_python execute inside the workspace

	mu          sync.Mutex
	runs        map[string]*Run
	running     map[string]bool
	runContexts map[string]*RunContext // per-run state isolation
}

// NewOrchestrator creates a new agent orchestrator with default budget.
func NewOrchestrator(
	registry *toolregistry.Registry,
	gateway modelgateway.ModelGateway,
	provider *modelgateway.ModelProvider,
	log *zap.Logger,
) *Orchestrator {
	// P1-1 §2.3.3: create the approval-flow governor and inject it into
	// the registry via WithApprovalGovernor. The registry only sees the
	// toolregistry.ApprovalGovernor interface, so this stays a one-way
	// dependency (aiagent → toolregistry). The orchestrator also keeps
	// a direct *InteractiveApprover reference so it can call ResolveApproval /
	// PendingApprovals without an interface dispatch.
	approver := NewInteractiveApprover(log, registry)
	registry.WithApprovalGovernor(approver)

	o := &Orchestrator{
		registry:     registry,
		gateway:      gateway,
		providerID:   provider.ID,
		provider:     provider,
		planner:      NewPlanner(log, nil),
		recovery:     NewRecovery(log),
		stateMachine: NewStateMachine(),
		log:          log,
		runs:         make(map[string]*Run),
		running:      make(map[string]bool),
		runContexts:  make(map[string]*RunContext),
		budget:       DefaultContextBudget(),
		maxTurns:     50,
		approver:     approver,
	}
	o.contextBld = NewContextBuilder(log, registry)
	o.contextBld.WithBudget(o.budget)
	return o
}

// NewChildOrchestrator builds a child orchestrator that shares the
// parent's registry, gateway, provider, and approval governor, but has
// its own Memory, state machine, run map, and run-context map. P3-1 §2.3.
//
// Unlike NewOrchestrator, this does NOT call registry.WithApprovalGovernor
// again — the shared registry already has the parent's governor wired,
// and overriding it would break the parent's approval flow.
func NewChildOrchestrator(
	registry *toolregistry.Registry,
	gateway modelgateway.ModelGateway,
	provider *modelgateway.ModelProvider,
	parentApprover *InteractiveApprover,
	log *zap.Logger,
) *Orchestrator {
	o := &Orchestrator{
		registry:     registry,
		gateway:      gateway,
		providerID:   provider.ID,
		provider:     provider,
		planner:      NewPlanner(log, nil),
		recovery:     NewRecovery(log),
		stateMachine: NewStateMachine(),
		log:          log,
		runs:         make(map[string]*Run),
		running:      make(map[string]bool),
		runContexts:  make(map[string]*RunContext),
		budget:       DefaultContextBudget(),
		maxTurns:     50,
		// Reuse the parent's governor so approvals from child runs are
		// visible via the same PendingApprovals(runID) API. The governor
		// is keyed by runID, so there's no collision.
		approver: parentApprover,
	}
	o.contextBld = NewContextBuilder(log, registry)
	o.contextBld.WithBudget(o.budget)
	return o
}

// WithWorkspacePath enables RepoMap for the context builder and pins the
// workspace directory into every tool context so run_shell / run_python
// execute with cmd.Dir inside the workspace (doc/22 BP1 / F5).
func (o *Orchestrator) WithWorkspacePath(workspacePath string) *Orchestrator {
	o.workspacePath = workspacePath
	if workspacePath != "" {
		repoMap := NewRepoMap([]string{workspacePath})
		repoMap.Load()
		o.contextBld.WithRepoMap(repoMap)
	}
	return o
}

// WithPermissionPolicy attaches the permission policy injected into every
// tool context (doc/22 BP1 / F1). Without it the registry defaults to
// read-only and all write/exec tools fail with "permission denied".
func (o *Orchestrator) WithPermissionPolicy(p *toolregistry.PermissionPolicy) *Orchestrator {
	o.permPolicy = p
	return o
}

// WithTrajectoryRecorder attaches a TrajectoryRecorder. When non-nil,
// the orchestrator records every ReAct turn (input messages, model
// response, tool calls, token usage) so each Run is reproducible.
// P1-2 §3.4.
func (o *Orchestrator) WithTrajectoryRecorder(r *TrajectoryRecorder) *Orchestrator {
	o.trajectory = r
	return o
}

// WithUsageMeter attaches a UsageMeter. When non-nil, the orchestrator
// records per-call token usage (including prompt cache hits) so the
// GET /api/agent/usage/{runId} / summary endpoints can audit cost.
// P1-2 §3.5.
func (o *Orchestrator) WithUsageMeter(m *modelgateway.UsageMeter) *Orchestrator {
	o.usageMeter = m
	return o
}

// WithHooks attaches a HookManager (P2-3). When non-nil, the ReAct
// loop fires hooks at run/turn/tool boundaries. Pass nil to disable.
func (o *Orchestrator) WithHooks(hm *HookManager) *Orchestrator {
	o.hooks = hm
	return o
}

// WithSkills attaches the skills registry (P2-1). When non-nil, runs
// can call SetActiveSkill to inject a skill's prompt + recommended
// tools into the context builder.
func (o *Orchestrator) WithSkills(reg *skills.Registry) *Orchestrator {
	o.skillsReg = reg
	if o.contextBld != nil {
		o.contextBld.WithSkills(reg)
	}
	return o
}

// WithHarness attaches the unified rule engine (P3-2). When non-nil,
// every tool call is evaluated against the Harness rules before
// execution. A deny rule short-circuits the call; an approve rule
// skips interactive approval. Pass nil to disable (legacy behavior).
func (o *Orchestrator) WithHarness(h *Harness) *Orchestrator {
	o.harness = h
	return o
}

// Harness returns the attached Harness, if any.
func (o *Orchestrator) Harness() *Harness { return o.harness }

// WithPolicyTable attaches the tool policy table (P3-3). When non-nil,
// read-only tools are speculatively executed during model streaming.
func (o *Orchestrator) WithPolicyTable(pt *toolregistry.PolicyTable) *Orchestrator {
	o.policy = pt
	return o
}

// WithSubAgentManager attaches the sub-agent manager so executePlan's
// teardown can clean up child orchestrators when a parent run finishes
// (doc/22 BP5). nil is valid — it means the runtime didn't register the
// spawn_subagent tool.
func (o *Orchestrator) WithSubAgentManager(m *SubAgentManager) *Orchestrator {
	o.subAgentMgr = m
	return o
}

// Recovery returns the checkpoint store so the runtime can run periodic
// or shutdown-time retention (doc/22 BP5). nil-safe: returns nil when
// the orchestrator was built without one.
func (o *Orchestrator) Recovery() *Recovery {
	return o.recovery
}

// WithSummarizer attaches the conversation summarizer (P3-4 L4). When
// non-nil, BuildWithMessages will generate a model-based summary when
// L1-L3 trimming is insufficient. The orchestrator also uses it for
// L5 memory solidification.
func (o *Orchestrator) WithSummarizer(s *Summarizer) *Orchestrator {
	if o.contextBld != nil {
		o.contextBld.WithSummarizer(s)
	}
	return o
}

// RegisterHook adds a single hook to the attached HookManager. If no
// HookManager is attached yet, one is created. Convenience for
// programmatic registration from main.go wiring.
func (o *Orchestrator) RegisterHook(h Hook) {
	if o.hooks == nil {
		o.hooks = NewHookManager(o.log)
	}
	o.hooks.Register(h)
}

// Trajectory returns the attached TrajectoryRecorder, if any.
// Exposed for the GET /api/agent/trajectory/{runId} API.
func (o *Orchestrator) Trajectory() *TrajectoryRecorder { return o.trajectory }

// UsageMeter returns the attached UsageMeter, if any.
// Exposed for the GET /api/agent/usage/{runId} / summary APIs.
func (o *Orchestrator) UsageMeter() *modelgateway.UsageMeter { return o.usageMeter }

// Hooks returns the attached HookManager, if any. Exposed so callers
// can register hooks via the orchestrator's accessor.
func (o *Orchestrator) Hooks() *HookManager { return o.hooks }

// Skills returns the attached skills registry, if any.
func (o *Orchestrator) Skills() *skills.Registry { return o.skillsReg }

// fireHook is a nil-safe helper that dispatches an event to the
// HookManager. No-op when no hooks are attached.
func (o *Orchestrator) fireHook(event HookEvent, hctx *HookContext) {
	if o.hooks == nil || !o.hooks.HasHooks() {
		return
	}
	o.hooks.Fire(event, hctx)
}

// SetEventSink wires an external event sink (e.g. the API layer's
// EventBridge) so that orchestrator events are forwarded to SSE
// subscribers in addition to the internal event channel.
func (o *Orchestrator) SetEventSink(sink EventSink) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.eventSink = sink
}

// StartRun begins a new agent execution.
func (o *Orchestrator) StartRun(ctx context.Context, mode, prompt string) (*Run, error) {
	return o.StartRunWithMemory(ctx, mode, prompt, "")
}

// StartRunWithMemory begins a new agent execution with an optional parent
// memory string. When non-empty (e.g. for floating-assistant sub-conversations
// that inherit a parent conversation's context), the memory is injected into
// the system prompt so the agent can continue the prior context.
func (o *Orchestrator) StartRunWithMemory(ctx context.Context, mode, prompt, parentMemory string) (*Run, error) {
	run := &Run{
		ID:           idgen.NewPrefixed("run_"),
		Mode:         mode,
		Prompt:       prompt,
		Status:       StatusPending,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		parentMemory: parentMemory,
		done:         make(chan struct{}),
	}

	o.mu.Lock()
	o.runs[run.ID] = run
	o.running[run.ID] = true
	o.mu.Unlock()

	// Create per-run context
	runCtx, rc := o.createRunContext(run, ctx)

	// Transition: idle -> planning
	if _, _, err := o.stateMachine.Next(StateIdle, MachineEventStart); err != nil {
		o.log.Error("state machine transition failed", zap.Error(err))
	} else {
		rc.setState(StatePlanning)
	}

	// P1-5: written under o.mu so concurrent GetRun/ListRuns readers
	// (which copy the Run under the same lock) never see a torn write.
	o.mu.Lock()
	run.Status = StatusRunning
	o.mu.Unlock()
	o.emitEvent(rc, Event{
		Type:      "plan",
		Timestamp: time.Now(),
		RunID:     run.ID,
		Data:      map[string]any{"runId": run.ID, "prompt": prompt, "mode": mode, "state": string(rc.currentState())},
	})

	// Try to generate an initial plan (advisory, not rigid)
	plan, err := o.planner.Plan(mode, prompt)
	if err != nil {
		// Planner failure is non-blocking in ReAct mode; degrade to no-plan
		o.log.Warn("planning failed, degrading to no-plan ReAct mode",
			zap.String("runId", run.ID),
			zap.Error(err),
		)
		plan = nil
	}

	// doc/22 BP5 / S4: run.Plan is read by GetRun/ListRuns under o.mu —
	// write it under the same lock.
	o.mu.Lock()
	run.Plan = plan
	run.UpdatedAt = time.Now()
	o.mu.Unlock()

	go o.executePlan(runCtx, run, rc, nil, 0, false)

	return run, nil
}

// createRunContext creates an isolated context for a run.
func (o *Orchestrator) createRunContext(run *Run, parentCtx context.Context) (context.Context, *RunContext) {
	runCtx, cancel := context.WithCancel(parentCtx)
	rc := &RunContext{
		Run:     run,
		State:   StatePlanning,
		Memory:  NewMemory(),
		EventCh: make(chan Event, 128),
		Cancel:  cancel,
	}
	o.mu.Lock()
	o.runContexts[run.ID] = rc
	o.mu.Unlock()
	return runCtx, rc
}

// removeRunContext cleans up a RunContext after Run completion.
func (o *Orchestrator) removeRunContext(runID string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if rc, ok := o.runContexts[runID]; ok {
		close(rc.EventCh)
		delete(o.runContexts, runID)
	}
}

// maxRetainedRuns bounds the in-memory run map. Completed/failed/stopped
// runs accumulate unboundedly otherwise; we keep the most recent
// maxRetainedRuns terminal runs and drop the rest (oldest first).
const maxRetainedRuns = 100

// DeleteRun removes a run from the orchestrator's in-memory maps and
// deletes its checkpoint. It refuses to delete a run that is still
// executing (the caller must StopRun first). Returns an error if the
// run is unknown or still running.
func (o *Orchestrator) DeleteRun(runID string) error {
	o.mu.Lock()
	run, ok := o.runs[runID]
	if !ok {
		o.mu.Unlock()
		return fmt.Errorf("run %q not found", runID)
	}
	if o.running[runID] {
		o.mu.Unlock()
		return fmt.Errorf("run %q is still running; stop it first", runID)
	}
	delete(o.runs, runID)
	delete(o.running, runID)
	delete(o.runContexts, runID)
	o.mu.Unlock()

	// Drop the checkpoint so a deleted run can't be resumed.
	if o.recovery != nil {
		o.recovery.Delete(runID)
	}
	if o.log != nil {
		o.log.Debug("run deleted", zap.String("runId", runID), zap.String("status", string(run.Status)))
	}
	return nil
}

// enforceRunRetention trims the run map down to maxRetainedRuns terminal
// runs, evicting the oldest completed/failed/stopped runs first. Called
// from executePlan's teardown after a run reaches a terminal state so
// long-lived desktop sessions don't grow the map without bound. Running
// and pending runs are never evicted.
func (o *Orchestrator) enforceRunRetention() {
	o.mu.Lock()
	// Collect terminal runs (not currently executing).
	type candidate struct {
		id        string
		updatedAt time.Time
	}
	var terminal []candidate
	for id, run := range o.runs {
		if o.running[id] {
			continue
		}
		switch run.Status {
		case StatusCompleted, StatusFailed, StatusStopped:
			terminal = append(terminal, candidate{id: id, updatedAt: run.UpdatedAt})
		}
	}
	if len(terminal) <= maxRetainedRuns {
		o.mu.Unlock()
		return
	}
	// Sort oldest-first so we evict from the front.
	sort.Slice(terminal, func(i, j int) bool {
		return terminal[i].updatedAt.Before(terminal[j].updatedAt)
	})
	evict := terminal[:len(terminal)-maxRetainedRuns]
	for _, c := range evict {
		delete(o.runs, c.id)
		delete(o.running, c.id)
		delete(o.runContexts, c.id)
	}
	o.mu.Unlock()

	// Drop checkpoints for evicted runs outside the lock.
	if o.recovery != nil {
		for _, c := range evict {
			o.recovery.Delete(c.id)
		}
	}
}

// executePlan is the ReAct loop: model calls -> tool execution -> feedback -> next turn.
//
// It serves both fresh runs (chatHistory nil, startTurn 0, resumed false)
// and checkpoint-resumed runs (chatHistory pre-seeded, startTurn > 0,
// resumed true). Resumed runs re-fire the run/turn lifecycle hooks so
// observers see a complete lifecycle regardless of entry point.
func (o *Orchestrator) executePlan(ctx context.Context, run *Run, rc *RunContext, chatHistory []modelgateway.ChatMessage, startTurn int, resumed bool) {
	// P1-2 §3.3: initialize the trajectory so per-turn Record() calls
	// have somewhere to append. FinishRun is deferred below so the
	// final trajectory is flushed to storage even on early return.
	if o.trajectory != nil {
		o.trajectory.StartRun(run.ID, run.Mode, run.Prompt)
	}
	defer func() {
		if o.trajectory != nil {
			o.trajectory.FinishRun(run.ID)
		}
	}()

	// P2-3: fire OnRunStart once the run context is live. rc.Cancel
	// is the same cancel wired into ctx, so a hook calling Cancel()
	// aborts the run at the next turn boundary.
	o.fireHook(HookOnRunStart, &HookContext{
		RunID:  run.ID,
		Run:    run,
		RunCtx: rc,
		Cancel: rc.Cancel,
	})
	// P2-3: OnRunEnd is fired by the teardown defer below, before
	// close(run.done) — waiters of done must be able to assume the full
	// lifecycle (including hooks) has completed. A separate defer here
	// would run after the teardown (LIFO) and race the waiters.

	// P1-7: declared before the deferred teardown below so the final
	// checkpoint can stamp the real turn counter (and history).
	turnCount := startTurn

	defer func() {
		// P3-1: capture the final assistant message as run.Result so
		// sub-agent callers can collect the outcome via CollectSubAgentResult
		// after the RunContext has been torn down. Prefer the last assistant
		// message; fall back to the memory summary. A Result already set
		// (e.g. the failure reason in the error path) is preserved.
		//
		// P1-5: all terminal-field writes happen under o.mu —
		// GetRun/ListRuns copy the Run under the same lock.
		o.mu.Lock()
		if run.Result == "" && rc.Memory != nil {
			run.Result = rc.Memory.LastAssistantMessage()
		}
		if run.Result == "" && rc.Memory != nil {
			run.Result = rc.Memory.Summary(2000)
		}
		// Terminal status follows the exit path: the model-call
		// failure path has already stamped StatusFailed (keep it);
		// a cancelled context (StopRun / shutdown) maps to
		// StatusStopped; everything else is a normal completion.
		// Previously this unconditionally set StatusCompleted, which
		// silently masked failed and cancelled runs.
		switch {
		case run.Status == StatusFailed:
			// keep — set by the error path before returning
		case ctx.Err() != nil:
			run.Status = StatusStopped
		default:
			run.Status = StatusCompleted
		}
		run.UpdatedAt = time.Now()
		o.running[run.ID] = false
		o.mu.Unlock()
		o.saveCheckpoint(run, rc, chatHistory, turnCount)
		doneData := map[string]any{"runId": run.ID, "state": string(rc.currentState()), "status": string(run.Status)}
		if resumed {
			doneData["resumed"] = true
		}
		o.emitEvent(rc, Event{
			Type:      "done",
			Timestamp: time.Now(),
			RunID:     run.ID,
			Data:      doneData,
		})
		o.removeRunContext(run.ID)
		// doc/22 BP5: stop + drop any child orchestrators this run spawned
		// so a finished parent doesn't leak its children.
		if o.subAgentMgr != nil {
			o.subAgentMgr.CleanupChildren(run.ID)
		}
		// doc/22 BP5: bound the in-memory run map — evict the oldest
		// terminal runs beyond maxRetainedRuns.
		o.enforceRunRetention()
		// P2-3: fire OnRunEnd after the loop exits (covers normal
		// completion, ctx cancel, and panic-recovered failure). It must
		// happen before close(run.done): waiters treat done as "the run's
		// entire lifecycle, hooks included, has finished".
		o.fireHook(HookOnRunEnd, &HookContext{
			RunID:  run.ID,
			Run:    run,
			RunCtx: rc,
			Cancel: rc.Cancel,
		})
		close(run.done)
	}()

	// 1. Initialize context with Memory summary
	memorySummary := rc.Memory.Summary(2000)
	if run.parentMemory != "" {
		memorySummary = run.parentMemory + "\n\n" + memorySummary
	}

	// 2. ReAct loop
	for {
		// 2.1 Check stop conditions
		if turnCount >= o.maxTurns {
			o.log.Warn("max turns reached, stopping",
				zap.Int("maxTurns", o.maxTurns),
				zap.String("runId", run.ID),
			)
			break
		}
		if ctx.Err() != nil {
			o.log.Info("context cancelled", zap.String("runId", run.ID), zap.Error(ctx.Err()))
			break
		}

		// P1-2 §3.3: per-turn bookkeeping for the trajectory recorder.
		// turnStart bounds the whole iteration (model call + tool exec).
		// toolCallRecords collects one entry per executed tool so the
		// TurnRecord captures the full picture, not just the model reply.
		turnStart := time.Now()
		var toolCallRecords []ToolCallRecord

		// P2-3: fire OnTurnStart before the model call so hooks can
		// inspect budget / apply per-turn limits.
		o.fireHook(HookOnTurnStart, &HookContext{
			RunID:     run.ID,
			Run:       run,
			RunCtx:    rc,
			TurnIndex: turnCount,
			Cancel:    rc.Cancel,
		})

		// 2.2 Assemble context with budget enforcement
		budgetResult := o.contextBld.BuildWithMessages(
			run.Mode, run.Prompt, memorySummary, chatHistory,
		)
		messages := budgetResult.Messages
		tools := budgetResult.Tools

		// P3-4 L5: if L4 summarization was applied but the prompt is
		// still over budget, solidify the summary to Memory and clear
		// chatHistory so the next turn starts from the memory summary.
		if budgetResult.Summary != "" {
			var msgContent strings.Builder
			for _, m := range budgetResult.Messages {
				msgContent.WriteString(m.Content)
			}
			if EstimateTokens(msgContent.String()) > o.budget.MaxPromptTokens-o.budget.ReservedOutputTokens {
				o.SolidifyMemory(rc, budgetResult.Summary)
				chatHistory = nil
				memorySummary = rc.Memory.Summary(2000)
				if run.parentMemory != "" {
					memorySummary = run.parentMemory + "\n\n" + memorySummary
				}
				budgetResult = o.contextBld.BuildWithMessages(
					run.Mode, run.Prompt, memorySummary, nil,
				)
				messages = budgetResult.Messages
				tools = budgetResult.Tools
			}
		}

		// P1-4 §5.3: at the start of each turn, if the run was paused
		// (manually or by an approval timeout), block until the user
		// resumes. Cancellation still wins so StopRun works while paused.
		//
		// P1-5: snapshot the channel ONCE under the same lock that guards
		// Paused — checking isPaused() first and PauseCh second could
		// deadlock if a resume lands between the two reads (PauseCh would
		// already be nil). A channel snapshotted just before a resume is
		// closed by it, so the wait unblocks immediately either way.
		if pauseCh := rc.pauseChannel(); pauseCh != nil {
			o.emitEvent(rc, Event{
				Type:      "state_change",
				Timestamp: time.Now(),
				RunID:     run.ID,
				Data:      map[string]any{"to": "waiting_for_user", "reason": rc.pauseReason()},
			})
			select {
			case <-ctx.Done():
				return
			case <-pauseCh:
				// resumed
			}
		}

		// 2.3 Call model (try streaming first, fallback to non-streaming).
		// P1-2: both call paths now return UsageInfo so the trajectory
		// recorder and usage meter can attribute tokens to this turn.
		content, toolCalls, usage, err := o.streamModelCall(ctx, messages, tools, rc)
		if err != nil {
			o.log.Error("model call failed, trying non-streaming fallback",
				zap.String("runId", run.ID),
				zap.Error(err),
			)
			// Fallback to non-streaming
			content, toolCalls, usage, err = o.fallbackModelCall(ctx, messages, tools)
			if err != nil {
				o.log.Error("fallback model call also failed", zap.Error(err))
				rc.setState(StateFailed)
				// P1-5: run terminal fields are read by GetRun/ListRuns
				// under o.mu — write them under the same lock.
				o.mu.Lock()
				run.Status = StatusFailed
				// Surface the failure reason via Result so callers (UI,
				// sub-agent manager) can show why the run died.
				run.Result = fmt.Sprintf("run failed: %v", err)
				o.mu.Unlock()
				o.emitEvent(rc, Event{
					Type:      "error",
					Timestamp: time.Now(),
					RunID:     run.ID,
					Data:      map[string]any{"error": err.Error()},
				})
				return
			}
		}

		// 2.4 Record assistant response. ToolCalls must be echoed back
		// on the assistant message: without them (and the matching
		// tool_call_id on each tool reply) strict OpenAI-compatible
		// servers reject the follow-up turn and lenient ones cannot
		// correlate results with calls.
		chatHistory = append(chatHistory, modelgateway.ChatMessage{
			Role:      "assistant",
			Content:   content,
			ToolCalls: historyToolCalls(toolCalls),
		})
		rc.Memory.Append("assistant", content)

		o.emitEvent(rc, Event{
			Type:      "message",
			Timestamp: time.Now(),
			RunID:     run.ID,
			Data:      map[string]any{"content": content, "role": "assistant"},
		})

		// doc/22 BP6 / S2: record this turn's token usage BEFORE the
		// no-tool-calls break below. The final turn of a run is almost
		// always a text-only answer (no tool calls), and the old code
		// recorded usage only in step 2.8 — which the break skips — so
		// the last (and often only) model call never reached the meter.
		if o.usageMeter != nil && usage != nil {
			modelName := ""
			if o.provider != nil {
				modelName = o.provider.DefaultModel
			}
			cost := estimateCost(usage, o.provider)
			o.usageMeter.Record(run.ID, o.providerID, "", modelName, usage, cost)

			// P1-3 §4.2: push a `usage` SSE event so the frontend can
			// update the token counter live. The event carries per-call
			// tokens plus the running total for the run.
			runTotal := o.usageMeter.GetRunUsage(run.ID)
			o.emitEvent(rc, Event{
				Type:      "usage",
				Timestamp: time.Now(),
				RunID:     run.ID,
				Data: map[string]any{
					"runId":            run.ID,
					"promptTokens":     usage.PromptTokens,
					"completionTokens": usage.CompletionTokens,
					"cachedTokens":     usage.CachedTokens,
					"totalTokens":      usage.TotalTokens,
					"runTotalTokens":   runTotal,
					"estimatedCost":    cost,
				},
			})
		}

		// 2.5 Check if task is complete (no tool calls)
		if len(toolCalls) == 0 {
			o.log.Info("task completed, no more tool calls", zap.String("runId", run.ID))
			rc.Memory.SetTaskSummary(run.Prompt)
			break
		}

		// 2.6 Check Verifying transition (consecutive read-only tools)
		o.checkVerifyingTransition(rc, toolCalls)

		// 2.7 Execute tool calls
		for _, tc := range toolCalls {
			toolStart := time.Now()
			approved := false
			// 2.7.3 Parse args first so ToolCallRecord can capture them
			// even when the state machine rejects the call below.
			var args map[string]any
			if tc.Function.Arguments != "" {
				_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
			}

			// 2.7.1 Infer state from tool type
			targetState := o.inferStateFromTool(tc.Function.Name)
			if targetState != rc.State && targetState != StateIdle {
				o.transitionTo(targetState, fmt.Sprintf("tool %s requires %s", tc.Function.Name, targetState), rc)
			}

			// 2.7.2 State machine check
			if !o.stateMachine.ToolIsAllowed(rc.State, tc.Function.Name) {
				o.emitEvent(rc, Event{
					Type:      "error",
					Timestamp: time.Now(),
					RunID:     run.ID,
					Data:      map[string]any{"error": fmt.Sprintf("tool %q not allowed in state %s", tc.Function.Name, rc.currentState())},
				})
				chatHistory = append(chatHistory, modelgateway.ChatMessage{
					Role:       "tool",
					Content:    fmt.Sprintf("Error: tool %q not allowed in state %s", tc.Function.Name, rc.currentState()),
					ToolCallID: tc.ID,
				})
				toolCallRecords = append(toolCallRecords, ToolCallRecord{
					ToolName: tc.Function.Name,
					Args:     args,
					Error:    fmt.Sprintf("not allowed in state %s", rc.currentState()),
					Duration: time.Since(toolStart),
				})
				continue
			}

			// 2.7.4 Emit tool_call event
			o.emitEvent(rc, Event{
				Type:      "tool_call",
				Timestamp: time.Now(),
				RunID:     run.ID,
				Data:      map[string]any{"toolName": tc.Function.Name, "args": args},
			})

			// 2.7.5 Execute tool via registry.
			// P1-1 §2.5: attach the run ID to the context so the
			// ApprovalGovernor can attribute the request to the right
			// run, then run in ModeAutonomous so critical tools
			// trigger interactive approval. If the registry returns
			// *ErrApprovalRequired we block in waitForApproval and
			// retry once the user approves (or surface the denial
			// to the model so it can react).
			//
			// doc/22 BP1: the permission policy (without which every
			// write/exec tool fails) and the workspace path (cmd.Dir
			// pinning for run_shell/run_python) ride on the same
			// context.
			toolCtx := toolregistry.WithRunID(ctx, run.ID)
			if o.permPolicy != nil {
				toolCtx = toolregistry.WithPolicy(toolCtx, o.permPolicy)
			}
			if o.workspacePath != "" {
				toolCtx = toolregistry.WithWorkspacePath(toolCtx, o.workspacePath)
			}
			// doc/23 A4: write tools report file mutations through this
			// recorder; each one becomes a diff.created event on the run's
			// SSE stream (routed to conversation subscribers like
			// step_start/step_done). The tool-call id is stamped here
			// because tools don't know their own call id.
			toolCtx = toolregistry.WithDiffRecorder(toolCtx, func(rec toolregistry.DiffRecord) {
				rec.ToolCallID = tc.ID
				o.emitDiffCreated(rc, run.ID, rec)
			})
			// P2-3: fire OnToolBefore so hooks can audit/log/inspect.
			o.fireHook(HookOnToolBefore, &HookContext{
				RunID:     run.ID,
				Run:       run,
				RunCtx:    rc,
				TurnIndex: turnCount,
				ToolName:  tc.Function.Name,
				ToolArgs:  args,
				Cancel:    rc.Cancel,
			})
			// P3-2 §3.5: evaluate Harness rules before execution. A deny
			// rule short-circuits the call; an approve rule switches the
			// execution mode to Deterministic so critical tools skip
			// interactive approval.
			execMode, harnessErr := o.evaluateHarness(rc, tc.Function.Name, args)
			var result map[string]any
			var execErr error
			if harnessErr != nil {
				result = nil
				execErr = harnessErr
			} else if rc.specExec != nil && rc.specExec.HasResult(tc.ID) {
				// P3-3 §4.5: reuse speculative result from streaming.
				// The read-only tool already ran during model output;
				// skip re-execution and use the cached result.
				specResult, _ := rc.specExec.GetResult(tc.ID)
				if specResult != nil {
					result = specResult.Result
					execErr = specResult.Error
					if o.log != nil {
						o.log.Info("tool executed speculatively",
							zap.String("tool", tc.Function.Name),
							zap.String("toolCallId", tc.ID),
						)
					}
				} else {
					result, execErr = o.registry.Execute(toolCtx, tc.Function.Name, args, execMode)
				}
			} else {
				result, execErr = o.registry.Execute(toolCtx, tc.Function.Name, args, execMode)
			}
			if approvalReq, ok := toolregistry.IsApprovalRequired(execErr); ok {
				waitErr := o.waitForApproval(ctx, rc, approvalReq.Req)
				if waitErr == nil {
					// User approved: retry the call once. NOTE (doc/22 BP2):
					// until the governor remembers resolved decisions, a
					// critical tool's retry re-enters CheckPermission and
					// raises a NEW approval request; that error is then
					// surfaced to the model, which typically retries the
					// tool (and the approval) on the next turn.
					approved = true
					result, execErr = o.registry.Execute(toolCtx, tc.Function.Name, args, toolregistry.ModeAutonomous)
				} else {
					result = nil
					execErr = waitErr
				}
			}
			// P2-3: fire OnToolAfter so hooks can post-process the
			// result or log failures.
			o.fireHook(HookOnToolAfter, &HookContext{
				RunID:      run.ID,
				Run:        run,
				RunCtx:     rc,
				TurnIndex:  turnCount,
				ToolName:   tc.Function.Name,
				ToolArgs:   args,
				ToolResult: result,
				ToolError:  execErr,
				Cancel:     rc.Cancel,
			})

			// 2.7.6 Build tool result content
			toolContent := ""
			if execErr != nil {
				toolContent = fmt.Sprintf("Error: %s", execErr.Error())
			} else {
				resultJSON, _ := json.Marshal(result)
				toolContent = string(resultJSON)
			}

			// 2.7.7 Record to chat history and memory. The tool_call_id
			// links this result to the assistant's ToolCall above.
			chatHistory = append(chatHistory, modelgateway.ChatMessage{
				Role:       "tool",
				Content:    toolContent,
				ToolCallID: tc.ID,
			})
			stdout, stderr := extractStdoutStderr(result)
			rc.Memory.AppendToolResult(tc.Function.Name, stdout, stderr)

			// 2.7.8 Emit tool_result event
			o.emitEvent(rc, Event{
				Type:      "tool_result",
				Timestamp: time.Now(),
				RunID:     run.ID,
				Data: map[string]any{
					"toolName": tc.Function.Name,
					"result":   result,
					"error":    execErr,
				},
			})

			// 2.7.9 P1-2 §3.4: append a ToolCallRecord so the
			// trajectory captures per-tool args/result/error/duration
			// (and whether the call went through interactive approval).
			rec := ToolCallRecord{
				ToolName: tc.Function.Name,
				Args:     args,
				Duration: time.Since(toolStart),
				Approved: approved,
			}
			if execErr != nil {
				rec.Error = execErr.Error()
			} else {
				rec.Result = result
			}
			toolCallRecords = append(toolCallRecords, rec)
		}

		// 2.8 P1-2 §3.3-3.5: record this turn for trajectory.
		// TrajectoryRecorder.Record is a no-op when nil.
		// doc/22 BP6 / S2: usage recording moved up to right after the
		// assistant message (before the no-tool-calls break) so the final
		// text-only turn is metered too — do NOT record it again here.
		if o.trajectory != nil {
			o.trajectory.Record(run.ID, TurnRecord{
				TurnIndex:     turnCount,
				Timestamp:     turnStart,
				InputMessages: messages,
				ModelResponse: content,
				ToolCalls:     toolCallRecords,
				TokenUsage:    usage,
				Duration:      time.Since(turnStart),
			})
		}

		// P1-6 §7.3: periodic checkpoint every 5 tool-call turns.
		// This bounds the work lost on a crash to ≤5 turns of ReAct
		// work, which at typical token rates is sub-cent. The final
		// checkpoint on Run completion is saved by the deferred
		// saveCheckpoint call in executePlan's teardown.
		if turnCount > 0 && turnCount%checkpointInterval == 0 {
			o.saveCheckpointWithReason(run, rc, "periodic", chatHistory, turnCount)
		}

	// P2-3: fire OnTurnEnd after the turn's model+tool work is done.
	o.fireHook(HookOnTurnEnd, &HookContext{
		RunID:     run.ID,
		Run:       run,
		RunCtx:    rc,
		TurnIndex: turnCount,
		Cancel:    rc.Cancel,
	})

	// doc/22 BP5 / S7: retire this turn's speculative executor AFTER
	// the tool loop consumed its results.
	if rc.specExec != nil {
		rc.specExec.Cleanup()
		rc.specExec = nil
	}

	turnCount++
	}
}

// checkpointInterval is the number of ReAct turns between periodic
// checkpoints. P1-6 §7.3 specifies 5; tuned to balance disk I/O
// against recovery granularity (5 turns ≈ 1-2 seconds of agent work).
const checkpointInterval = 5

// ResumeFromCheckpoint loads a saved checkpoint and resumes the run
// from where it left off. The resumed run re-enters the state machine
// at the checkpointed state and hands the saved chatHistory back to
// the ReAct loop so prior turns aren't re-executed.
//
// Returns an error if the checkpoint doesn't exist, the run is unknown,
// or the run is still actively executing (resume while running is a
// no-op — the caller should call PauseRun first or wait for completion).
// P1-6 §7.5.
func (o *Orchestrator) ResumeFromCheckpoint(ctx context.Context, runID string) error {
	cp, ok := o.recovery.LoadCheckpoint(runID)
	if !ok {
		return fmt.Errorf("checkpoint for run %q not found", runID)
	}

	o.mu.Lock()
	run, runOK := o.runs[runID]
	running := o.running[runID]
	o.mu.Unlock()

	if !runOK {
		return fmt.Errorf("run %q not found", runID)
	}
	if running {
		// Resuming a still-running run would create two concurrent
		// ReAct loops on the same RunContext — explicitly forbidden.
		return fmt.Errorf("run %q is still running; pause or stop it first", runID)
	}

	// Decode the checkpoint blob to recover chatHistory + memory.
	var state struct {
		Memory      json.RawMessage            `json:"memory"`
		ChatHistory []modelgateway.ChatMessage `json:"chatHistory"`
		State       string                     `json:"state"`
		TurnIndex   int                        `json:"turnIndex"`
	}
	if err := json.Unmarshal(cp.Data, &state); err != nil {
		return fmt.Errorf("decode checkpoint: %w", err)
	}

	// Reconstruct the RunContext.
	runCtx, rc := o.createRunContext(run, ctx)
	if state.State != "" {
		rc.setState(State(state.State))
	}
	if len(state.Memory) > 0 {
		_ = rc.Memory.Import(state.Memory)
	}
	// chatHistory is passed into executePlan below rather than re-derived
	// from Memory (which only keeps the bounded shortHistory, not the full
	// ReAct conversation).

	// The first leg's teardown already closed run.done. Re-arm it so
	// WaitForRun blocks again and the resumed teardown's close(run.done)
	// does not panic on an already-closed channel.
	// doc/22 BP5 / S4: the done re-arm joins the same lock as the running
	// flag — WaitForRun reads run.done without a lock, so the re-arm
	// must not race a concurrent reader between the two writes.
	o.mu.Lock()
	run.done = make(chan struct{})
	o.running[runID] = true
	o.runContexts[runID] = rc
	o.mu.Unlock()

	// P1-2: re-initialize the trajectory recorder so resumed turns
	// append to the same trajectory record (if it was loaded back).
	if o.trajectory != nil {
		o.trajectory.StartRun(run.ID, run.Mode, run.Prompt)
	}

	// doc/22 BP5 / S4: terminal-field discipline — status writes go
	// through o.mu like every other terminal write.
	o.mu.Lock()
	run.Status = StatusRecovery
	o.mu.Unlock()
	o.emitEvent(rc, Event{
		Type:      "state_change",
		Timestamp: time.Now(),
		RunID:     run.ID,
		Data:      map[string]any{"to": string(rc.currentState()), "reason": "resumed from checkpoint"},
	})

	// Re-enter the ReAct loop from the saved turn index.
	go o.executePlan(runCtx, run, rc, state.ChatHistory, state.TurnIndex, true)

	return nil
}

// estimateCost computes a dollar cost estimate for a model call.
// Returns 0 when pricing is unknown — callers treat 0 as "unbilled"
// rather than "free" so audits can distinguish the two cases.
// P1-2 §3.5: prices are USD per 1K tokens; pricing tables will be
// externalized in P2-5 (Router) when multi-provider routing lands.
func estimateCost(usage *modelgateway.UsageInfo, p *modelgateway.ModelProvider) float64 {
	if usage == nil || p == nil {
		return 0
	}
	// Most OpenAI-compatible providers expose price-per-1k via
	// PricePer1KInput / PricePer1KOutput; if absent, fall back to 0.
	prompt := float64(usage.PromptTokens) / 1000.0
	completion := float64(usage.CompletionTokens) / 1000.0
	return prompt*p.PricePer1KInput + completion*p.PricePer1KOutput
}

// streamModelCall calls the model via streaming and parses tool_calls from deltas.
// Returns (content, toolCalls, usage, err). usage is non-nil only when the
// provider's final stream chunk carried a Usage block (P1-2 §3.4).
func (o *Orchestrator) streamModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef, rc *RunContext) (string, []modelgateway.ToolCall, *modelgateway.UsageInfo, error) {
	if o.gateway == nil {
		return "", nil, nil, fmt.Errorf("no model gateway configured")
	}

	ch, err := o.gateway.StreamChat(ctx, messages, tools)
	if err != nil {
		return "", nil, nil, err
	}

	var contentBuilder strings.Builder
	var toolCalls []modelgateway.ToolCall
	var usage *modelgateway.UsageInfo
	toolCallMap := map[int]*modelgateway.ToolCall{} // incremental assembly by index

	// P3-3 §4.5: create a per-turn speculative executor so read-only
	// tools start during streaming. The executor is stored on rc so
	// the tool-execution loop can reuse cached results.
	// doc/22 BP5 / S7: Cleanup must NOT defer here. The deferred call
	// fired when streamModelCall RETURNED — i.e. before the tool
	// execution phase consulted HasResult — so speculative results were
	// always wiped and every read-only tool executed twice. Cleanup now
	// runs at the END of the turn (after tool execution), in executePlan.
	if o.policy != nil {
		rc.specExec = NewSpeculativeExecutor(o.registry, o.policy, o.log)
	}

	// doc/22 BP6 / S2: the usage chunk arrives AFTER the finish_reason
	// chunk that carries IsDone (OpenAI sends it as a dedicated trailing
	// event when stream_options.include_usage is honored). The old loop
	// broke on the first IsDone and therefore dropped the token counts
	// for every streaming call, leaving /api/agent/usage at zero. After
	// IsDone we keep draining — bounded by a short deadline — until the
	// usage chunk lands, the stream closes, or the timeout elapses.
	const usageDrainTimeout = 500 * time.Millisecond
	draining := false
	var drainDeadline <-chan time.Time

	for {
		var chunk modelgateway.StreamChunk
		var ok bool
		if draining {
			select {
			case chunk, ok = <-ch:
			case <-drainDeadline:
				// Provider never sent the trailing usage chunk in time.
				ok = false
			}
		} else {
			chunk, ok = <-ch
		}
		if !ok {
			break
		}

		// Usage can arrive on a dedicated chunk (choices empty) when
		// stream_options.include_usage is honored, or on the final
		// choice chunk. Capture it wherever it shows up.
		if chunk.Usage != nil {
			usage = chunk.Usage
			if draining {
				// Got the trailing usage — nothing left to read.
				break
			}
		}
		if chunk.IsDone {
			if !draining {
				draining = true
				drainDeadline = time.After(usageDrainTimeout)
			}
			if usage != nil {
				break
			}
			continue
		}
		if draining {
			// Past finish_reason we only care about the usage chunk;
			// any stray content/tool deltas are spurious.
			continue
		}

		// 1. Text content increment
		if chunk.Content != "" {
			contentBuilder.WriteString(chunk.Content)
			o.emitEvent(rc, Event{
				Type:      "message",
				Timestamp: time.Now(),
				RunID:     rc.Run.ID,
				Data:      map[string]any{"content": chunk.Content, "role": "assistant", "isDelta": true},
			})
		}

		// 2. Tool calls incremental assembly
		for _, tc := range chunk.ToolCalls {
			idx := tc.Index
			if existing, ok := toolCallMap[idx]; ok {
				existing.Function.Arguments += tc.Function.Arguments
				// P3-3 §4.5.4: when arguments JSON is complete, start
				// speculative execution for read-only tools. This
				// overlaps tool I/O with remaining model generation.
				if rc.specExec != nil && IsJSONComplete(existing.Function.Arguments) {
					rc.specExec.TryExecuteInStream(ctx, existing.ID, existing.Function.Name, existing.Function.Arguments)
				}
			} else {
				toolCallMap[idx] = &modelgateway.ToolCall{
					ID:   tc.ID,
					Type: tc.Type,
					Function: modelgateway.ToolFunctionCall{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				}
				// Try speculative execution on the first chunk too —
				// some providers send complete args in one delta.
				newTC := toolCallMap[idx]
				if rc.specExec != nil && IsJSONComplete(newTC.Function.Arguments) {
					rc.specExec.TryExecuteInStream(ctx, newTC.ID, newTC.Function.Name, newTC.Function.Arguments)
				}
			}
		}
	}

	// Collect tool_calls in index order
	for i := 0; i < len(toolCallMap); i++ {
		if tc, ok := toolCallMap[i]; ok {
			toolCalls = append(toolCalls, *tc)
		}
	}


	return contentBuilder.String(), toolCalls, usage, nil
}

// fallbackModelCall uses non-streaming Chat when streaming fails.
// Returns (content, toolCalls, usage, err). usage mirrors resp.Usage.
func (o *Orchestrator) fallbackModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef) (string, []modelgateway.ToolCall, *modelgateway.UsageInfo, error) {
	if o.gateway == nil {
		return "", nil, nil, fmt.Errorf("no model gateway configured")
	}

	resp, err := o.gateway.Chat(ctx, messages, tools, false)
	if err != nil {
		return "", nil, nil, err
	}
	if len(resp.Choices) == 0 {
		return "", nil, nil, fmt.Errorf("no choices in response")
	}

	content := resp.Choices[0].Message.Content

	// Parse tool_calls from response if present
	var toolCalls []modelgateway.ToolCall
	if len(resp.Choices[0].Message.ToolCalls) > 0 {
		for _, tc := range resp.Choices[0].Message.ToolCalls {
			toolCalls = append(toolCalls, tc)
		}
	}

	return content, toolCalls, resp.Usage, nil
}

// inferStateFromTool infers which state the agent should be in based on tool name.
func (o *Orchestrator) inferStateFromTool(toolName string) State {
	switch toolName {
	// read_only tools -> Inspecting
	case "read_file", "list_files", "search_workspace", "scan_folder",
		"screenshot", "paper_search":
		return StateInspecting

	// write/exec tools -> Editing
	case "write_file", "run_python", "run_shell", "delete_file",
		"git_commit", "git_push", "run_git_add", "run_git_reset",
		"create_artifact",
		"browser_control", "network_request":
		return StateEditing

	// Orchestration tools — no state change (delegation, not direct action)
	case "spawn_subagent":
		return StateIdle

	default:
		// Dynamically registered Python Worker tools
		if strings.Contains(toolName, "search") || strings.Contains(toolName, "inspect") {
			return StateInspecting
		}
		if strings.Contains(toolName, "write") || strings.Contains(toolName, "generate") {
			return StateEditing
		}
		return StateIdle
	}
}

// transitionTo directly transitions to a target state with logging and event.
func (o *Orchestrator) transitionTo(target State, reason string, rc *RunContext) {
	oldState := rc.currentState()
	rc.setState(target)
	o.log.Info("state transition",
		zap.String("from", string(oldState)),
		zap.String("to", string(target)),
		zap.String("reason", reason),
		zap.String("runId", rc.Run.ID),
	)
	o.emitEvent(rc, Event{
		Type:      "state_change",
		Timestamp: time.Now(),
		RunID:     rc.Run.ID,
		Data: map[string]any{
			"from":   string(oldState),
			"to":     string(target),
			"reason": reason,
		},
	})
}

// checkVerifyingTransition auto-infers Verifying state after N consecutive read-only turns.
func (o *Orchestrator) checkVerifyingTransition(rc *RunContext, toolCalls []modelgateway.ToolCall) {
	allReadOnly := true
	for _, tc := range toolCalls {
		if o.inferStateFromTool(tc.Function.Name) == StateEditing {
			allReadOnly = false
			break
		}
	}
	if allReadOnly {
		rc.readOnlyStreak++
	} else {
		rc.readOnlyStreak = 0
	}

	if rc.readOnlyStreak >= 2 && rc.currentState() != StateVerifying {
		o.transitionTo(StateVerifying, "连续 2 轮只读工具，自动推断验证阶段", rc)
	}
}

// GetRun returns a run by ID.
func (o *Orchestrator) GetRun(id string) (*Run, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	run, ok := o.runs[id]
	return run, ok
}

// WaitForRun blocks until the run identified by id reaches a terminal state
// (completed or failed) or the context is cancelled.
func (o *Orchestrator) WaitForRun(ctx context.Context, id string) (*Run, error) {
	// doc/22 BP5 / S4: read run.done under o.mu — ResumeFromCheckpoint
	// re-arms run.done under the same lock, so an unlocked read here
	// would race the re-arm.
	o.mu.Lock()
	run, ok := o.runs[id]
	var done chan struct{}
	if ok {
		done = run.done
	}
	o.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("run %s not found", id)
	}
	if done == nil {
		return run, nil
	}
	select {
	case <-done:
		return run, nil
	case <-ctx.Done():
		return run, ctx.Err()
	}
}

// ListRuns returns all runs.
func (o *Orchestrator) ListRuns() []Run {
	o.mu.Lock()
	defer o.mu.Unlock()
	out := make([]Run, 0, len(o.runs))
	for _, r := range o.runs {
		out = append(out, *r)
	}
	return out
}

// StreamEvents returns the global event channel (all runs merged).
// Note: For production use, prefer StreamEventsForRun for per-run filtering.
func (o *Orchestrator) StreamEvents() <-chan Event {
	o.mu.Lock()
	defer o.mu.Unlock()

	merged := make(chan Event, 256)
	go func() {
		defer close(merged)
		var wg sync.WaitGroup
		for _, rc := range o.runContexts {
			wg.Add(1)
			go func(ch <-chan Event) {
				defer wg.Done()
				for e := range ch {
					select {
					case merged <- e:
					default:
					}
				}
			}(rc.EventCh)
		}
		wg.Wait()
	}()
	return merged
}

// StreamEventsForRun returns the event channel for a specific run.
func (o *Orchestrator) StreamEventsForRun(runID string) <-chan Event {
	o.mu.Lock()
	defer o.mu.Unlock()

	if rc, ok := o.runContexts[runID]; ok {
		return rc.EventCh
	}
	// Run not found or already finished, return closed channel
	ch := make(chan Event)
	close(ch)
	return ch
}

// StopRun stops a running agent.
func (o *Orchestrator) StopRun(id string) {
	o.mu.Lock()
	rc, ok := o.runContexts[id]
	o.running[id] = false
	o.mu.Unlock()

	if ok && rc.Cancel != nil {
		rc.Cancel()
	}
}

// getRunContext returns the per-run context for runID, or nil if not found.
func (o *Orchestrator) getRunContext(runID string) *RunContext {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.runContexts[runID]
}

// Governor returns the approval-flow governor. Exposed so the API layer
// can call PendingApprovals(runID) and ResolveApproval(reqID, decision,
// reason) without re-implementing the lookup. Returns nil when no
// orchestrator is wired (e.g. in tests).
func (o *Orchestrator) Approver() *InteractiveApprover {
	return o.approver
}

// PauseRun pauses a run, blocking the ReAct loop at the next turn boundary.
// Idempotent: pausing an already-paused run is a no-op (the design called
// out this case in v0.4 to prevent PauseCh from being overwritten).
// P1-4 §5.2.
func (o *Orchestrator) PauseRun(runID string, reason string) error {
	rc := o.getRunContext(runID)
	if rc == nil {
		return fmt.Errorf("run %q not found", runID)
	}
	// P1-5: pause() flips Paused/PauseCh/PauseReason atomically; the
	// loop snapshots PauseCh under the same lock.
	if !rc.pause(reason) {
		return nil // already paused — idempotent
	}
	if _, _, err := o.stateMachine.Next(rc.currentState(), MachineEventSystemPause); err == nil {
		// State machine transition is best-effort: even if it fails we
		// still mark the run as paused so the loop blocks at the next
		// turn boundary. The error is logged for observability.
		// The Next call returns the new state but we intentionally
		// keep rc.State as-is until the loop hits the pause check,
		// so transitions like StateEditing -> StateWaitingForUser
		// happen there with proper event emission.
	}
	o.emitEvent(rc, Event{
		Type:      "run_paused",
		Timestamp: time.Now(),
		RunID:     runID,
		Data:      map[string]any{"reason": reason},
	})
	return nil
}

// ResumeRun unblocks a paused run. The ReAct loop will pick up at the
// next turn boundary after the PauseCh is closed. P1-4 §5.2.
func (o *Orchestrator) ResumeRun(runID string) error {
	rc := o.getRunContext(runID)
	if rc == nil {
		return fmt.Errorf("run %q not found", runID)
	}
	// P1-5: resume() clears the paused state atomically and hands
	// back the channel to close (outside the lock — closing under it
	// would wake the loop while the state is mid-transition).
	ch := rc.resume()
	if ch == nil {
		return nil // not paused — idempotent
	}
	close(ch)
	if _, _, err := o.stateMachine.Next(rc.currentState(), MachineEventSystemResume); err == nil {
		// best-effort state transition; logged for observability
	}
	o.emitEvent(rc, Event{
		Type:      "run_resumed",
		Timestamp: time.Now(),
		RunID:     runID,
		Data:      map[string]any{"reason": "user resumed"},
	})
	return nil
}

// evaluateHarness runs the Harness rule engine against a pending tool
// call. Returns the execution mode to use (ModeDeterministic when
// auto-approved, ModeAutonomous otherwise) and an error when the call
// is denied. When no Harness is attached, returns (ModeAutonomous, nil)
// — the legacy behavior.
// P3-2 §3.5.
func (o *Orchestrator) evaluateHarness(rc *RunContext, toolName string, args map[string]any) (toolregistry.ExecutionMode, error) {
	if o.harness == nil {
		return toolregistry.ModeAutonomous, nil
	}

	// Extract FilePath from args for sandbox-conditioned rules.
	filePath := ""
	if p, ok := args["path"].(string); ok {
		filePath = p
	}
	riskLevel := ""
	if tool, ok := o.registry.Get(toolName); ok {
		riskLevel = tool.RiskLevel()
	}

	evalCtx := &EvaluationContext{
		RunID:     rc.Run.ID,
		ToolName:  toolName,
		Args:      args,
		State:     rc.currentState(),
		Mode:      toolregistry.ModeAutonomous.String(),
		RiskLevel: riskLevel,
		FilePath:  filePath,
	}
	result := o.harness.Evaluate(evalCtx)
	if !result.Allowed {
		return toolregistry.ModeAutonomous, fmt.Errorf("harness: %s", result.Reason)
	}
	if result.AutoApproved {
		return toolregistry.ModeDeterministic, nil
	}
	return toolregistry.ModeAutonomous, nil
}

// waitForApproval blocks until the user resolves the request, the timeout
// fires, or the run is cancelled. P1-1 §2.5.1.
//
// Outcomes:
//   - approval (ApprovalApproved): returns nil; caller retries Execute.
//   - denial (ApprovalDenied): returns the error; caller surfaces it to
//     the model so the next turn can react ("user denied the call").
//   - timeout (5min): resolves the request as ApprovalTimeout, pauses
//     the run, emits approval_timeout + run_paused events, returns error.
//   - ctx cancel (StopRun): resolves as ApprovalDenied, returns wrapped err.
//
// On any terminal outcome the request is removed from the governor's
// pending map so it no longer appears in GET /approvals/{runId}.
func (o *Orchestrator) waitForApproval(ctx context.Context, rc *RunContext, req *toolregistry.ApprovalRequest) error {
	// 1. Surface the approval request to the UI.
	o.emitEvent(rc, Event{
		Type:      "approval_request",
		Timestamp: time.Now(),
		RunID:     req.RunID,
		Data: map[string]any{
			"approvalId": req.ID,
			"runId":      req.RunID,
			"toolName":   req.ToolName,
			"args":       req.Args,
			"riskLevel":  req.RiskLevel,
		},
	})

	// 2. Set up the 5-minute timeout (main doc §14.3).
	timeout := 5 * time.Minute
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	// 3. Wait for one of: user decision, timeout, or run cancellation.
	select {
	case <-ctx.Done():
		_ = o.approver.ResolveApproval(req.ID, toolregistry.ApprovalDenied, "context cancelled")
		o.approver.RemoveApproval(req.ID)
		return fmt.Errorf("approval cancelled: %w", ctx.Err())

	case <-timer.C:
		_ = o.approver.ResolveApproval(req.ID, toolregistry.ApprovalTimeout, "5min timeout")
		o.approver.RemoveApproval(req.ID)
		o.emitEvent(rc, Event{
			Type:      "approval_timeout",
			Timestamp: time.Now(),
			RunID:     req.RunID,
			Data: map[string]any{
				"approvalId": req.ID,
				"toolName":   req.ToolName,
				"timeout":    timeout.String(),
			},
		})
		// Pause so the user can resume later (instead of failing the run).
		_ = o.PauseRun(req.RunID, "approval timeout for "+req.ToolName)
		return fmt.Errorf("approval timeout after %s for tool %s", timeout, req.ToolName)

	case decision := <-req.DecisionCh:
		o.approver.RemoveApproval(req.ID)
		o.emitEvent(rc, Event{
			Type:      "approval_resolved",
			Timestamp: time.Now(),
			RunID:     req.RunID,
			Data: map[string]any{
				"approvalId": req.ID,
				"decision":   string(decision.Decision),
				"reason":     decision.Reason,
			},
		})
		switch decision.Decision {
		case toolregistry.ApprovalApproved:
			return nil
		case toolregistry.ApprovalDenied, toolregistry.ApprovalRejected:
			return fmt.Errorf("approval denied: %s", decision.Reason)
		default:
			return fmt.Errorf("unknown approval decision: %s", decision.Decision)
		}
	}
}

func (o *Orchestrator) emitEvent(rc *RunContext, e Event) {
	// Forward to external sink (e.g. EventBridge) for SSE subscribers
	o.mu.Lock()
	sink := o.eventSink
	o.mu.Unlock()

	if sink != nil {
		if e.Data == nil {
			e.Data = map[string]any{}
		}
		if e.RunID != "" {
			e.Data["runId"] = e.RunID
		}
		sink.Publish(e.Type, e.RunID, e.Data)
	}

	// P1-3 §4.5.3: append to the per-run ring buffer so Last-Event-ID
	// reconnect can replay missed events. The buffer is lazily created.
	// We pre-marshal the data here so the replay path can stream bytes
	// without re-marshalling under lock.
	// doc/22 BP5 / S4: emitEvent is reached from the ReAct goroutine AND
	// from PauseRun/ResumeRun HTTP handlers — guard the lazy init with
	// rc.stateMu (the same lock GetEventBuffer takes on the read side).
	dataJSON, _ := json.Marshal(e.Data)
	rc.stateMu.Lock()
	if rc.eventBuf == nil {
		rc.eventBuf = NewEventBuffer(DefaultEventBufferCapacity)
	}
	buf := rc.eventBuf
	rc.stateMu.Unlock()
	seq := buf.Append(e.Type, string(dataJSON))
	// Stamp the assigned seq + runID onto the event so the SSE handler
	// can construct the `id: {runID}:{seq}` line for EventSource.
	e.Seq = seq

	// Non-blocking write to per-run channel
	select {
	case rc.EventCh <- e:
	default:
		// Channel full, drop oldest and retry
		select {
		case <-rc.EventCh:
		default:
		}
		select {
		case rc.EventCh <- e:
		default:
		}
	}
}

// emitDiffCreated publishes a diff.created event for a file mutation
// captured by a write tool (doc/23 A4). The unified diff is computed
// lazily here (not inside the tool) so write tools stay free of diff
// dependencies. No-op when the content is unchanged. The payload carries
// only the self-contained unified diff (not full old/new contents) to keep
// SSE frames and the persisted conversation snapshot lean.
func (o *Orchestrator) emitDiffCreated(rc *RunContext, runID string, rec toolregistry.DiffRecord) {
	if rec.OldContent == rec.NewContent {
		return
	}
	unified := diff.Unified(rec.Path, rec.OldContent, rec.NewContent)
	if unified == "" {
		return
	}
	o.emitEvent(rc, Event{
		Type:      "diff.created",
		Timestamp: time.Now(),
		RunID:     runID,
		Data: map[string]any{
			"path":       rec.Path,
			"toolCallId": rec.ToolCallID,
			"unified":    unified,
		},
	})
}

// GetEventBuffer returns the per-run event buffer, or nil if the run
// is unknown. Used by the SSE handler to replay events after a
// Last-Event-ID reconnect (P1-3 §4.5.2).
func (o *Orchestrator) GetEventBuffer(runID string) *EventBuffer {
	o.mu.Lock()
	rc, ok := o.runContexts[runID]
	o.mu.Unlock()
	if !ok {
		return nil
	}
	// doc/22 BP5 / S4: read under rc.stateMu — emitEvent lazily creates
	// the buffer under the same lock.
	rc.stateMu.RLock()
	defer rc.stateMu.RUnlock()
	return rc.eventBuf
}

// BuildStateSnapshot constructs a state_snapshot event payload for a run.
// Emitted when a Last-Event-ID reconnect requests events older than the
// buffer holds (P1-3 §4.5.4). The snapshot lets the client rebuild its
// UI from scratch: current state + recent messages + pending approval.
func (o *Orchestrator) BuildStateSnapshot(runID string) map[string]any {
	o.mu.Lock()
	rc, ok := o.runContexts[runID]
	o.mu.Unlock()
	if !ok {
		return map[string]any{"runId": runID, "exists": false}
	}
	snapshot := map[string]any{
		"runId":  runID,
		"state":  string(rc.currentState()),
		"paused": rc.isPaused(),
	}
	if rc.Memory != nil {
		snapshot["recentMessages"] = rc.Memory.Summary(2000)
	}
	if o.approver != nil {
		pending := o.approver.PendingApprovals(runID)
		if len(pending) > 0 {
			// Surface the first pending approval so the client can
			// re-render the approval dialog.
			p := pending[0]
			snapshot["pendingApproval"] = map[string]any{
				"approvalId": p.ID,
				"toolName":   p.ToolName,
				"args":       p.Args,
				"riskLevel":  p.RiskLevel,
				"createdAt":  p.CreatedAt,
			}
		}
	}
	return snapshot
}

func (o *Orchestrator) saveCheckpoint(run *Run, rc *RunContext, chatHistory []modelgateway.ChatMessage, turnCount int) {
	o.saveCheckpointWithReason(run, rc, "", chatHistory, turnCount)
}

// saveCheckpointWithReason persists the run state with a reason tag
// ("periodic", "paused", "completed"). The reason is surfaced in the
// Checkpoint struct so the UI can explain why a checkpoint was saved.
// P1-6 §7.3.
//
// P1-7: chatHistory/turnCount come from the live ReAct loop — the
// loop's REAL message history including tool_call_id-paired tool
// turns, and the loop's actual turn counter. The previous version
// exported Memory's bounded 20-message view and proxied the turn
// index off the event buffer seq, so resumed runs lost tool-pair
// fidelity and landed on a wrong turn.
func (o *Orchestrator) saveCheckpointWithReason(run *Run, rc *RunContext, reason string, chatHistory []modelgateway.ChatMessage, turnCount int) {
	checkpointTime := time.Now().UTC().Format(time.RFC3339)
	// P1-6 §7.4: include turnIndex + chatHistory so ResumeFromCheckpoint
	// can pick up exactly where the run left off. Without these the
	// resumed run would restart from turn 0 with an empty history,
	// re-doing all the model calls (and re-charging tokens).
	var history []modelgateway.ChatMessage
	if len(chatHistory) > 0 {
		history = chatHistory
	} else if rc != nil && rc.Memory != nil {
		// Defensive fallback for callers without a live loop.
		history = rc.Memory.ExportMessages()
	}
	data, _ := json.Marshal(map[string]any{
		"status":      run.Status,
		"stepIndex":   run.StepIndex,
		"messages":    run.Messages,
		"plan":        run.Plan,
		"memory":      rc.Memory.Export(),
		"state":       string(rc.currentState()),
		"checkpoint":  checkpointTime,
		"turnIndex":   turnCount,
		"chatHistory": history,
	})
	run.Checkpoint = data
	if reason != "" {
		o.recovery.SaveWithReason(run.ID, data, reason)
	} else {
		o.recovery.Save(run.ID, data)
	}

	// P1-3 §4.2: emit a `checkpoint` event so the frontend can show
	// "saved at HH:MM:SS" badges and the user knows the run is
	// recoverable if the process crashes.
	o.emitEvent(rc, Event{
		Type:      "checkpoint",
		Timestamp: time.Now(),
		RunID:     run.ID,
		Data: map[string]any{
			"runId":        run.ID,
			"checkpointId": checkpointTime,
			"state":        string(rc.currentState()),
			"reason":       reason,
		},
	})
}

// GetCurrentState returns the current state for a given run.
func (o *Orchestrator) GetCurrentState(runID string) State {
	o.mu.Lock()
	defer o.mu.Unlock()
	if rc, ok := o.runContexts[runID]; ok {
		return rc.currentState()
	}
	return StateIdle
}

// extractStdoutStderr extracts stdout and stderr strings from a tool result map.
func extractStdoutStderr(result map[string]any) (string, string) {
	var stdout, stderr string
	if result != nil {
		if v, ok := result["stdout"]; ok {
			stdout = fmt.Sprintf("%v", v)
		}
		if v, ok := result["stderr"]; ok {
			stderr = fmt.Sprintf("%v", v)
		}
	}
	return stdout, stderr
}

// historyToolCalls converts assembled tool calls into the form stored on
// assistant history messages. Index is a streaming-assembly detail and is
// stripped: the request wire format identifies calls by ID only.
func historyToolCalls(toolCalls []modelgateway.ToolCall) []modelgateway.ToolCall {
	if len(toolCalls) == 0 {
		return nil
	}
	out := make([]modelgateway.ToolCall, len(toolCalls))
	for i, tc := range toolCalls {
		out[i] = modelgateway.ToolCall{
			ID:       tc.ID,
			Type:     tc.Type,
			Function: tc.Function,
		}
	}
	return out
}
