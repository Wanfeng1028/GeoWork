// GeoWork Go Core - Agent Orchestrator

package aiagent

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

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

// EventSink is the sink for agent events. It is implemented by the API
// layer's EventBridge so orchestrator events can be consumed via SSE
// subscribers without introducing an import cycle (aiagent must not
// depend on the api package).
type EventSink interface {
	Publish(eventType string, runID string, data map[string]any)
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
	eventSink     EventSink
	log           *zap.Logger
	mu            sync.Mutex
	runs          map[string]*Run
	running       map[string]bool
	currentState  State
	currentRunID  string
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
		planner:      NewPlanner(log, gateway),
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
	o.currentRunID = run.ID
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
		Data:      map[string]any{"runId": run.ID, "prompt": prompt, "mode": mode, "state": string(o.currentState)},
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
			Data:      map[string]any{"runId": run.ID, "error": err.Error()},
		})
		o.mu.Lock()
		o.running[run.ID] = false
		o.currentRunID = ""
		o.mu.Unlock()
		close(run.done)
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
		o.currentRunID = ""
		o.mu.Unlock()
		o.emitEvent(Event{
			Type:      "done",
			Timestamp: time.Now(),
			Data:      map[string]any{"runId": run.ID, "state": string(o.currentState)},
		})
		o.saveCheckpoint(run)
		o.currentState = StateCompleted
		close(run.done)
	}()

	// Build conversation history for LLM feedback loop
	var chatHistory []modelgateway.ChatMessage
	if o.gateway != nil {
		config, ok := modeConfigs[run.Mode]
		if !ok {
			config = modeConfigs["Work"]
		}
		systemContent := config.Prompt + "\nYou are executing a plan step by step. After each step you will receive the result. Decide if the step succeeded or if retry is needed."
		// Inject inherited parent conversation memory for floating-assistant
		// sub-conversations so the agent can continue the prior context.
		if run.parentMemory != "" {
			systemContent += "\n\nInherited parent conversation context:\n" + run.parentMemory
		}
		chatHistory = append(chatHistory, modelgateway.ChatMessage{
			Role:    "system",
			Content: systemContent,
		})
		chatHistory = append(chatHistory, modelgateway.ChatMessage{
			Role:    "user",
			Content: run.Prompt,
		})
	}

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

		// Feed step result back to LLM for adaptive planning
		if o.gateway != nil && len(chatHistory) > 0 {
			chatHistory = append(chatHistory, modelgateway.ChatMessage{
				Role:    "assistant",
				Content: fmt.Sprintf("Step %d (%s) tool=%s status=%s result=%s", i+1, step.Title, step.Tool, step.Status, step.Result),
			})

			llmCtx, llmCancel := context.WithTimeout(ctx, 5*time.Second)
			resp, err := o.gateway.Chat(llmCtx, chatHistory, nil, false)
			llmCancel()

			if err == nil && len(resp.Choices) > 0 {
				reply := resp.Choices[0].Message.Content
				chatHistory = append(chatHistory, modelgateway.ChatMessage{
					Role:    "user",
					Content: reply,
				})
				o.log.Debug("LLM feedback received", zap.String("reply", reply))
			}
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
		if err := json.Unmarshal([]byte(step.Args), &args); err != nil {
			o.log.Warn("failed to parse step args",
				zap.String("stepId", step.ID),
				zap.String("args", step.Args),
				zap.Error(err),
			)
			step.Status = "failed"
			step.Result = fmt.Sprintf("invalid args JSON: %s", err.Error())
			o.emitEvent(Event{
				Type:      "error",
				Timestamp: time.Now(),
				Data:      map[string]any{"stepId": step.ID, "error": step.Result},
			})
			return
		}
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

// WaitForRun blocks until the run identified by id reaches a terminal state
// (completed or failed) or the context is cancelled. It returns the run so
// callers can inspect its final Status. This lets external schedulers treat
// an agent run as a synchronous unit of work.
func (o *Orchestrator) WaitForRun(ctx context.Context, id string) (*Run, error) {
	o.mu.Lock()
	run, ok := o.runs[id]
	o.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("run %s not found", id)
	}
	if run.done == nil {
		return run, nil
	}
	select {
	case <-run.done:
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
	// Forward to the external sink (e.g. EventBridge) so SSE subscribers
	// receive events. The run ID is taken from the event data, falling
	// back to the orchestrator's current run.
	o.mu.Lock()
	sink := o.eventSink
	runID := o.currentRunID
	o.mu.Unlock()

	if sink != nil {
		if e.Data == nil {
			e.Data = map[string]any{}
		}
		if rid, ok := e.Data["runId"].(string); ok && rid != "" {
			runID = rid
		} else {
			e.Data["runId"] = runID
		}
		sink.Publish(e.Type, runID, e.Data)
	}

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
