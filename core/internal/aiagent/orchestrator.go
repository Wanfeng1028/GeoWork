// GeoWork Go Core - Agent Orchestrator

package aiagent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
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
	RunID     string                 `json:"runId"`
	Data      map[string]any         `json:"data,omitempty"`
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
	Run         *Run
	State       State
	Memory      *Memory
	EventCh     chan Event
	Cancel      context.CancelFunc
	readOnlyStreak int  // consecutive read-only tool turns (for Verifying auto-inference)
}

// Orchestrator is the main agent loop controller with budget-aware context and bounded memory.
type Orchestrator struct {
	registry      *toolregistry.Registry
	gateway       modelgateway.ModelGateway // interface, not concrete type
	providerID    string
	provider      *modelgateway.ModelProvider
	planner       *Planner
	contextBld    *ContextBuilder
	recovery      *Recovery
	stateMachine  *StateMachine
	eventSink     EventSink
	log           *zap.Logger
	budget        ContextBudget
	maxTurns      int

	mu            sync.Mutex
	runs          map[string]*Run
	running       map[string]bool
	runContexts   map[string]*RunContext // per-run state isolation
}

// NewOrchestrator creates a new agent orchestrator with default budget.
func NewOrchestrator(
	registry *toolregistry.Registry,
	gateway modelgateway.ModelGateway,
	provider *modelgateway.ModelProvider,
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
	}
	o.contextBld = NewContextBuilder(log, registry)
	o.contextBld.WithBudget(o.budget)
	return o
}

// WithWorkspacePath enables RepoMap for the context builder.
func (o *Orchestrator) WithWorkspacePath(workspacePath string) *Orchestrator {
	if workspacePath != "" {
		repoMap := NewRepoMap([]string{workspacePath})
		repoMap.Load()
		o.contextBld.WithRepoMap(repoMap)
	}
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
	o.mu.Unlock()

	// Create per-run context
	runCtx, rc := o.createRunContext(run, ctx)

	// Transition: idle -> planning
	if _, _, err := o.stateMachine.Next(StateIdle, MachineEventStart); err != nil {
		o.log.Error("state machine transition failed", zap.Error(err))
	} else {
		rc.State = StatePlanning
	}

	run.Status = StatusRunning
	o.emitEvent(rc, Event{
		Type:      "plan",
		Timestamp: time.Now(),
		RunID:     run.ID,
		Data:      map[string]any{"runId": run.ID, "prompt": prompt, "mode": mode, "state": string(rc.State)},
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

	run.Plan = plan
	run.UpdatedAt = time.Now()

	go o.executePlan(runCtx, run, rc)

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

// executePlan is the ReAct loop: model calls -> tool execution -> feedback -> next turn.
func (o *Orchestrator) executePlan(ctx context.Context, run *Run, rc *RunContext) {
	defer func() {
		run.Status = StatusCompleted
		run.UpdatedAt = time.Now()
		o.mu.Lock()
		o.running[run.ID] = false
		o.mu.Unlock()
		o.saveCheckpoint(run, rc)
		o.emitEvent(rc, Event{
			Type:      "done",
			Timestamp: time.Now(),
			RunID:     run.ID,
			Data:      map[string]any{"runId": run.ID, "state": string(rc.State)},
		})
		o.removeRunContext(run.ID)
		close(run.done)
	}()

	// 1. Initialize context with Memory summary
	memorySummary := rc.Memory.Summary(2000)
	if run.parentMemory != "" {
		memorySummary = run.parentMemory + "\n\n" + memorySummary
	}

	// 2. ReAct loop
	turnCount := 0
	var chatHistory []modelgateway.ChatMessage

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

		// 2.2 Assemble context with budget enforcement
		budgetResult := o.contextBld.BuildWithMessages(
			run.Mode, run.Prompt, memorySummary, chatHistory,
		)
		messages := budgetResult.Messages
		tools := budgetResult.Tools

		// 2.3 Call model (try streaming first, fallback to non-streaming)
		content, toolCalls, err := o.streamModelCall(ctx, messages, tools, rc)
		if err != nil {
			o.log.Error("model call failed, trying non-streaming fallback",
				zap.String("runId", run.ID),
				zap.Error(err),
			)
			// Fallback to non-streaming
			content, toolCalls, err = o.fallbackModelCall(ctx, messages, tools)
			if err != nil {
				o.log.Error("fallback model call also failed", zap.Error(err))
				rc.State = StateFailed
				run.Status = StatusFailed
				o.emitEvent(rc, Event{
					Type:      "error",
					Timestamp: time.Now(),
					RunID:     run.ID,
					Data:      map[string]any{"error": err.Error()},
				})
				return
			}
		}

		// 2.4 Record assistant response
		chatHistory = append(chatHistory, modelgateway.ChatMessage{
			Role:    "assistant",
			Content: content,
		})
		rc.Memory.Append("assistant", content)

		o.emitEvent(rc, Event{
			Type:      "message",
			Timestamp: time.Now(),
			RunID:     run.ID,
			Data:      map[string]any{"content": content, "role": "assistant"},
		})

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
					Data:      map[string]any{"error": fmt.Sprintf("tool %q not allowed in state %s", tc.Function.Name, rc.State)},
				})
				chatHistory = append(chatHistory, modelgateway.ChatMessage{
					Role:    "tool",
					Content: fmt.Sprintf("Error: tool %q not allowed in state %s", tc.Function.Name, rc.State),
				})
				continue
			}

			// 2.7.3 Parse args
			var args map[string]any
			if tc.Function.Arguments != "" {
				_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
			}

			// 2.7.4 Emit tool_call event
			o.emitEvent(rc, Event{
				Type:      "tool_call",
				Timestamp: time.Now(),
				RunID:     run.ID,
				Data:      map[string]any{"toolName": tc.Function.Name, "args": args},
			})

			// 2.7.5 Execute tool via registry
			result, execErr := o.registry.Execute(ctx, tc.Function.Name, args)

			// 2.7.6 Build tool result content
			toolContent := ""
			if execErr != nil {
				toolContent = fmt.Sprintf("Error: %s", execErr.Error())
			} else {
				resultJSON, _ := json.Marshal(result)
				toolContent = string(resultJSON)
			}

			// 2.7.7 Record to chat history and memory
			chatHistory = append(chatHistory, modelgateway.ChatMessage{
				Role:    "tool",
				Content: toolContent,
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
		}

		turnCount++
	}
}

// streamModelCall calls the model via streaming and parses tool_calls from deltas.
func (o *Orchestrator) streamModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef, rc *RunContext) (string, []modelgateway.ToolCall, error) {
	if o.gateway == nil {
		return "", nil, fmt.Errorf("no model gateway configured")
	}

	ch, err := o.gateway.StreamChat(ctx, messages, tools)
	if err != nil {
		return "", nil, err
	}

	var contentBuilder strings.Builder
	var toolCalls []modelgateway.ToolCall
	toolCallMap := map[int]*modelgateway.ToolCall{} // incremental assembly by index

	for chunk := range ch {
		if chunk.IsDone {
			break
		}

		// 1. Text content increment
		if chunk.Content != "" {
			contentBuilder.WriteString(chunk.Content)
			o.emitEvent(rc, Event{
				Type:      "message",
				Timestamp: time.Now(),
				RunID:     rc.Run.ID,
				Data:      map[string]any{"content": chunk.Content, "role": "assistant"},
			})
		}

		// 2. Tool calls incremental assembly
		for _, tc := range chunk.ToolCalls {
			idx := tc.Index
			if existing, ok := toolCallMap[idx]; ok {
				existing.Function.Arguments += tc.Function.Arguments
			} else {
				toolCallMap[idx] = &modelgateway.ToolCall{
					ID:   tc.ID,
					Type: tc.Type,
					Function: modelgateway.ToolFunctionCall{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
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

	return contentBuilder.String(), toolCalls, nil
}

// fallbackModelCall uses non-streaming Chat when streaming fails.
func (o *Orchestrator) fallbackModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef) (string, []modelgateway.ToolCall, error) {
	if o.gateway == nil {
		return "", nil, fmt.Errorf("no model gateway configured")
	}

	resp, err := o.gateway.Chat(ctx, messages, tools, false)
	if err != nil {
		return "", nil, err
	}
	if len(resp.Choices) == 0 {
		return "", nil, fmt.Errorf("no choices in response")
	}

	content := resp.Choices[0].Message.Content

	// Parse tool_calls from response if present
	var toolCalls []modelgateway.ToolCall
	if len(resp.Choices[0].Message.ToolCalls) > 0 {
		for _, tc := range resp.Choices[0].Message.ToolCalls {
			toolCalls = append(toolCalls, tc)
		}
	}

	return content, toolCalls, nil
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
	oldState := rc.State
	rc.State = target
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

	if rc.readOnlyStreak >= 2 && rc.State != StateVerifying {
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

func (o *Orchestrator) saveCheckpoint(run *Run, rc *RunContext) {
	data, _ := json.Marshal(map[string]any{
		"status":     run.Status,
		"stepIndex":  run.StepIndex,
		"messages":   run.Messages,
		"plan":       run.Plan,
		"memory":     rc.Memory.Export(),
		"state":      string(rc.State),
		"checkpoint": time.Now().UTC().Format(time.RFC3339),
	})
	run.Checkpoint = data
	o.recovery.Save(run.ID, data)
}

// GetCurrentState returns the current state for a given run.
func (o *Orchestrator) GetCurrentState(runID string) State {
	o.mu.Lock()
	defer o.mu.Unlock()
	if rc, ok := o.runContexts[runID]; ok {
		return rc.State
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
