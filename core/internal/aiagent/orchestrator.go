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

// Orchestrator is the main agent loop controller.
type Orchestrator struct {
	registry   *toolregistry.Registry
	gateway    *modelgateway.OpenAICompatibleClient
	providerID string
	provider   *modelgateway.ModelProvider
	planner    *Planner
	memory     *Memory
	recovery   *Recovery
	eventCh    chan Event
	log        *zap.Logger
	mu         sync.Mutex
	runs       map[string]*Run
	running    map[string]bool
}

// NewOrchestrator creates a new agent orchestrator.
func NewOrchestrator(
	registry *toolregistry.Registry,
	gateway *modelgateway.OpenAICompatibleClient,
	provider *modelgateway.ModelProvider,
	log *zap.Logger,
) *Orchestrator {
	o := &Orchestrator{
		registry:   registry,
		gateway:    gateway,
		providerID: provider.ID,
		provider:   provider,
		planner:    NewPlanner(log),
		memory:     NewMemory(),
		recovery:   NewRecovery(log),
		eventCh:    make(chan Event, 128),
		log:        log,
		runs:       make(map[string]*Run),
		running:    make(map[string]bool),
	}
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

	// Step 1: Plan
	run.Status = StatusRunning
	o.emitEvent(Event{
		Type:      "plan",
		Timestamp: time.Now(),
		Data:      map[string]any{"prompt": prompt, "mode": mode},
	})

	plan, err := o.planner.Plan(mode, prompt)
	if err != nil {
		run.Status = StatusFailed
		run.UpdatedAt = time.Now()
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

	// Step 2: Execute plan
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
			Data:      map[string]any{"runId": run.ID},
		})
		// Save checkpoint
		o.saveCheckpoint(run)
	}()

	for i, step := range run.Plan {
		// Check if cancelled
		o.mu.Lock()
		if !o.running[run.ID] {
			run.Status = StatusCompleted
			o.mu.Unlock()
			return
		}
		o.mu.Unlock()

		run.StepIndex = i
		run.UpdatedAt = time.Now()

		// Execute step
		o.executeStep(ctx, run, &step)
	}
}

func (o *Orchestrator) executeStep(ctx context.Context, run *Run, step *Step) {
	step.Status = "running"
	step.StartTime = time.Now()
	o.emitEvent(Event{
		Type:      "step_start",
		Timestamp: time.Now(),
		Data:      map[string]any{"stepId": step.ID, "title": step.Title, "tool": step.Tool},
	})

	var args map[string]any
	if step.Args != "" {
		json.Unmarshal([]byte(step.Args), &args)
	}

	// Call tool via registry
	result, err := o.registry.Execute(ctx, step.Tool, args)
	step.Duration = time.Since(step.StartTime).Milliseconds()

	if err != nil {
		step.Status = "failed"
		step.Result = fmt.Sprintf("error: %s", err.Error())
		o.log.Error("step failed", zap.String("step", step.ID), zap.Error(err))
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

	// Store in memory
	o.memory.Append(step.Title, step.Result)
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
		"checkpoint": time.Now().UTC().Format(time.RFC3339),
	})
	run.Checkpoint = data
	o.recovery.Save(run.ID, data)
}

func generateID() string {
	return fmt.Sprintf("run_%d", time.Now().UnixNano())
}
