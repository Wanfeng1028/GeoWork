// GeoWork Go Core - Agent Orchestrator

package aiagent

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

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
}

// Step is a single step in the agent plan.
type Step struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Tool      string `json:"tool,omitempty"`
	Args      string `json:"args,omitempty"`
	Status    string `json:"status"`
	Result    string `json:"result,omitempty"`
	Duration  int64  `json:"duration,omitempty"` // ms
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
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Args     map[string]any         `json:"args"`
	Stdout   string                 `json:"stdout,omitempty"`
	Stderr   string                 `json:"stderr,omitempty"`
	Result   map[string]any         `json:"result,omitempty"`
	Error    string                 `json:"error,omitempty"`
	Duration int64                  `json:"duration,omitempty"`
}

// Event is a streaming event from agent execution.
type Event struct {
	Type      string                 `json:"type"` // plan, step_start, step_done, message, error, checkpoint, done
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]any         `json:"data,omitempty"`
}

// Orchestrator is the main agent loop controller with budget-aware context and bounded memory.
type Orchestrator struct {
	registry      *toolregistry.Registry
	gateway       *modelgateway.OpenAICompatibleClient
	providerID    string
	provider      *modelgateway.ModelProvider
	planner       *Planner
	memory        *Memory
	contextBld    *ContextBuilder
	recovery      *Recovery
	stateMachine  *StateMachine
	eventCh       chan Event
	log           *zap.Logger
	mu            sync.Mutex
	runs          map[string]*Run
	running       map[string]bool
	currentState  State
	budget        ContextBudget
	maxTurns      int
}

// NewOrchestrator creates a new agent orchestrator with default budget.
func NewOrchestrator(
	registry *toolregistry.Registry,
	gateway *modelgateway.OpenAICompatibleClient,
	provider *modelgateway.ModelProvider,
	log *zap.Logger,
) *Orchestrator {
	o := &Orchestrator{
		registry:     registry,
		gateway:      gateway,
		providerID:   provider.ID,
		provider:     provider,
		planner:      NewPlanner(log),
		memory:       NewMemory(),
		recovery:     NewRecovery(log),
		stateMachine: NewStateMachine(),
		eventCh:      make(chan Event, 128),
		log:          log,
		runs:         make(map[string]*Run),
		running:      make(map[string]bool),
		currentState: StateIdle,
		budget:       DefaultContextBudget(),
		maxTurns:     50,
	}
	o.contextBld = NewContextBuilder(log, registry)
	o.contextBld.WithBudget(o.budget)
	return o
}

// StartRun begins a new agent execution.
func (o *Orchestrator) StartRun(ctx context.Context, mode, prompt string) (*Run, error) {
	run := &Run{
		ID:        generateID(),
		Mode:      mode,
		Prompt:    prompt,
		Status:    StatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	o.mu.Lock()
	o.runs[run.ID] = run
	o.running[run.ID] = true
	o.mu.Unlock()

	// Transition: idle -> planning
	if _, _, err := o.stateMachine.Next(StateIdle, MachineEventStart); err != nil {
		o.log.Error("state machine transition failed", zap.Error(err))
	} else {
		o.currentState = StatePlanning
	}

	run.Status = StatusRunning
	o.emitEvent(Event{
		Type:      "plan",
		Timestamp: time.Now(),
		Data:      map[string]any{"prompt": prompt, "mode": mode, "state": string(o.currentState)},
	})

	plan, err := o.planner.Plan(mode, prompt)
	if err != nil {
		run.Status = StatusFailed
		run.UpdatedAt = time.Now()
		o.currentState = StateFailed
		o.log.Error("planning failed", zap.Error(err))
		o.emitEvent(Event{
			Type:      "error",
			Timestamp: time.Now(),
			Data:      map[string]any{"error": err.Error()},
		})
		o.mu.Lock()
		o.running[run.ID] = false
		o.mu.Unlock()
		return run, err
	}

	run.Plan = plan
	run.UpdatedAt = time.Now()

	// Transition: planning -> inspecting (plan is ready)
	o.transitionState(MachineEventPlanReady, "planning complete")

	go o.executePlan(ctx, run)

	return run, nil
}

func (o *Orchestrator) executePlan(ctx context.Context, run *Run) {
	defer func() {
		run.Status = StatusCompleted
		run.UpdatedAt = time.Now()
		o.mu.Lock()
		o.running[run.ID] = false
		o.mu.Unlock()
		o.emitEvent(Event{
			Type:      "done",
			Timestamp: time.Now(),
			Data:      map[string]any{"runId": run.ID, "state": string(o.currentState)},
		})
		o.saveCheckpoint(run)
		o.currentState = StateCompleted
	}()

	turnCount := 0
	for i, step := range run.Plan {
		o.mu.Lock()
		if !o.running[run.ID] {
			run.Status = StatusCompleted
			o.mu.Unlock()
			return
		}
		o.mu.Unlock()

		if turnCount >= o.maxTurns {
			o.log.Warn("max turns reached, stopping", zap.Int("maxTurns", o.maxTurns))
			o.currentState = StateFailed
			return
		}

		run.StepIndex = i
		run.UpdatedAt = time.Now()
		turnCount++

		o.executeStep(ctx, run, &step)

		// Auto-advance state based on step completion
		if step.Status == "completed" {
			o.advanceStateForStep(&step)
		}
	}
}

func (o *Orchestrator) executeStep(ctx context.Context, run *Run, step *Step) {
	// Check if tool is allowed in current state
	if !o.stateMachine.ToolIsAllowed(o.currentState, step.Tool) {
		step.Status = "rejected"
		step.Result = fmt.Sprintf("tool %q not allowed in state %s", step.Tool, o.currentState)
		o.log.Warn("tool rejected by state machine",
			zap.String("tool", step.Tool),
			zap.String("state", string(o.currentState)),
		)
		o.emitEvent(Event{
			Type:      "error",
			Timestamp: time.Now(),
			Data:      map[string]any{"stepId": step.ID, "error": step.Result},
		})
		return
	}

	step.Status = "running"
	step.StartTime = time.Now()
	o.emitEvent(Event{
		Type:      "step_start",
		Timestamp: time.Now(),
		Data:      map[string]any{"stepId": step.ID, "title": step.Title, "tool": step.Tool, "state": string(o.currentState)},
	})

	var args map[string]any
	if step.Args != "" {
		json.Unmarshal([]byte(step.Args), &args)
	}

	// Call tool via registry
	result, err := o.registry.Execute(ctx, step.Tool, args)
	step.Duration = time.Since(step.StartTime).Milliseconds()

	// Extract stdout/stderr from result for summarization
	var stdout, stderr string
	if result != nil {
		if v, ok := result["stdout"]; ok {
			stdout = fmt.Sprintf("%v", v)
		}
		if v, ok := result["stderr"]; ok {
			stderr = fmt.Sprintf("%v", v)
		}
	}

	if err != nil {
		step.Status = "failed"
		step.Result = fmt.Sprintf("error: %s", err.Error())
		o.log.Error("step failed", zap.String("step", step.ID), zap.Error(err))

		// Summarize stderr even on error
		o.memory.AppendToolResult(step.Tool, stdout, stderr)
		o.memory.Append("assistant", fmt.Sprintf("Tool %s failed: %s", step.Tool, err.Error()))

		o.emitEvent(Event{
			Type:      "error",
			Timestamp: time.Now(),
			Data:      map[string]any{"stepId": step.ID, "error": err.Error()},
		})
		return
	}

	step.Status = "completed"
	step.Result = fmt.Sprintf("result: %d keys", len(result))
	o.emitEvent(Event{
		Type:      "step_done",
		Timestamp: time.Now(),
		Data: map[string]any{
			"stepId":   step.ID,
			"duration": step.Duration,
		},
	})

	// Summarize and store tool result (bounded)
	o.memory.AppendToolResult(step.Tool, stdout, stderr)
	o.memory.Append("assistant", fmt.Sprintf("Tool %s completed successfully", step.Tool))
}

// GetRun returns a run by ID.
func (o *Orchestrator) GetRun(id string) (*Run, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	run, ok := o.runs[id]
	return run, ok
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

// StreamEvents returns the event channel for a run.
func (o *Orchestrator) StreamEvents() <-chan Event {
	return o.eventCh
}

// StopRun stops a running agent.
func (o *Orchestrator) StopRun(id string) {
	o.mu.Lock()
	o.running[id] = false
	o.mu.Unlock()
}

func (o *Orchestrator) emitEvent(e Event) {
	select {
	case o.eventCh <- e:
	default:
	}
}

func (o *Orchestrator) saveCheckpoint(run *Run) {
	data, _ := json.Marshal(map[string]any{
		"status":     run.Status,
		"stepIndex":  run.StepIndex,
		"messages":   run.Messages,
		"plan":       run.Plan,
		"memory":     o.memory.Export(),
		"state":      string(o.currentState),
		"checkpoint": time.Now().UTC().Format(time.RFC3339),
	})
	run.Checkpoint = data
	o.recovery.Save(run.ID, data)
}

// transitionState attempts a state machine transition and logs the result.
func (o *Orchestrator) transitionState(event MachineEvent, reason string) {
	nextState, allowed, err := o.stateMachine.Next(o.currentState, event)
	if err != nil {
		o.log.Warn("state transition failed",
			zap.String("from", string(o.currentState)),
			zap.String("event", string(event)),
			zap.Error(err),
		)
		return
	}
	o.currentState = nextState
	o.log.Info("state transition",
		zap.String("to", string(nextState)),
		zap.String("event", string(event)),
		zap.String("reason", reason),
		zap.Bool("readAllowed", allowed.ReadAllowed),
		zap.Bool("writeAllowed", allowed.WriteAllowed),
		zap.Bool("shellAllowed", allowed.ShellAllowed),
	)
	o.emitEvent(Event{
		Type:      "state_change",
		Timestamp: time.Now(),
		Data: map[string]any{
			"state":  string(nextState),
			"event":  string(event),
			"reason": reason,
		},
	})
}

// advanceStateForStep auto-advances the state machine based on step tool type.
func (o *Orchestrator) advanceStateForStep(step *Step) {
	switch {
	case step.Tool == "planner" || step.Tool == "model":
		o.transitionState(MachineEventInspectDone, "planning step done")
	case step.Tool == "read_file" || step.Tool == "list_files" || step.Tool == "search_workspace":
		if o.currentState == StateInspecting {
			o.transitionState(MachineEventInspectDone, "inspection step done")
		}
	case step.Tool == "apply_patch" || step.Tool == "write_file" || step.Tool == "edit_by_anchor":
		if o.currentState == StateEditing {
			o.transitionState(MachineEventEditDone, "editing step done")
		}
	case step.Tool == "test" || step.Tool == "build" || step.Tool == "lint":
		if o.currentState == StateVerifying {
			o.transitionState(MachineEventVerifyPass, "verification step done")
		}
	}
}

// GetCurrentState returns the current state machine state.
func (o *Orchestrator) GetCurrentState() State {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.currentState
}

func generateID() string {
	return fmt.Sprintf("run_%d", time.Now().UnixNano())
}
