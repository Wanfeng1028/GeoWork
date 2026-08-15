// GeoWork Go Core - Orchestrator ReAct loop tests
//
// Covers the ReAct loop (fresh runs via StartRun, resumed runs via
// ResumeFromCheckpoint) with a scripted model gateway so no network is
// involved. The loop variants were unified in 2b599d8: executePlan takes
// the chat history / start turn / resumed flag instead of a separate
// executePlanFromTurn entry point.

package aiagent

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"

	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"
)

// scriptedResponse is one model reply: text content plus optional tool calls.
type scriptedResponse struct {
	content   string
	toolCalls []modelgateway.ToolCall
}

// scriptedGateway implements modelgateway.ModelGateway with a fixed
// response queue. Each StreamChat call consumes the next response.
// failAll makes both call paths return errors (failure-path tests);
// block makes StreamChat hang until the context is cancelled
// (stop-path tests).
type scriptedGateway struct {
	mu        sync.Mutex
	responses []scriptedResponse
	calls     int
	failAll   bool
	block     bool
}

func (g *scriptedGateway) StreamChat(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef) (<-chan modelgateway.StreamChunk, error) {
	g.mu.Lock()
	idx := g.calls
	g.calls++
	var resp scriptedResponse
	if idx < len(g.responses) {
		resp = g.responses[idx]
	}
	g.mu.Unlock()

	if g.failAll {
		return nil, fmt.Errorf("scripted gateway: stream unavailable")
	}

	ch := make(chan modelgateway.StreamChunk, 4)
	if g.block {
		go func() {
			defer close(ch)
			<-ctx.Done()
		}()
		return ch, nil
	}
	go func() {
		defer close(ch)
		if resp.content != "" {
			ch <- modelgateway.StreamChunk{Content: resp.content}
		}
		if len(resp.toolCalls) > 0 {
			ch <- modelgateway.StreamChunk{ToolCalls: resp.toolCalls}
		}
		ch <- modelgateway.StreamChunk{IsDone: true}
	}()
	return ch, nil
}

func (g *scriptedGateway) Chat(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef, stream bool) (*modelgateway.ChatCompletionResponse, error) {
	if g.failAll {
		return nil, fmt.Errorf("scripted gateway: chat unavailable")
	}
	return nil, fmt.Errorf("scripted gateway: Chat not implemented")
}

func (g *scriptedGateway) ProviderID() string { return "scripted" }

func (g *scriptedGateway) callCount() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.calls
}

// recordingHook captures every lifecycle event it receives.
type recordingHook struct {
	mu     sync.Mutex
	events []HookEvent
}

func (h *recordingHook) Name() string { return "recording" }

func (h *recordingHook) record(e HookEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.events = append(h.events, e)
}

func (h *recordingHook) count(e HookEvent) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	n := 0
	for _, ev := range h.events {
		if ev == e {
			n++
		}
	}
	return n
}

func (h *recordingHook) OnRunStart(ctx *HookContext) error   { h.record(HookOnRunStart); return nil }
func (h *recordingHook) OnRunEnd(ctx *HookContext) error     { h.record(HookOnRunEnd); return nil }
func (h *recordingHook) OnTurnStart(ctx *HookContext) error  { h.record(HookOnTurnStart); return nil }
func (h *recordingHook) OnTurnEnd(ctx *HookContext) error    { h.record(HookOnTurnEnd); return nil }
func (h *recordingHook) OnToolBefore(ctx *HookContext) error { h.record(HookOnToolBefore); return nil }
func (h *recordingHook) OnToolAfter(ctx *HookContext) error  { h.record(HookOnToolAfter); return nil }

// newTestOrchestrator wires an orchestrator with one low-risk read tool
// so tool calls flow through the real registry/state-machine path
// without approval, sandbox, or high-risk policy interference.
func newTestOrchestrator(gw modelgateway.ModelGateway) *Orchestrator {
	log := zap.NewNop()
	registry := toolregistry.NewRegistry(log)
	_ = registry.Register(toolregistry.NewBuilder("read_file").
		Description("test read tool").
		RiskLevel("low").
		Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
			return map[string]any{"content": "ok"}, nil
		}).Build())
	provider := &modelgateway.ModelProvider{ID: "scripted", DefaultModel: "scripted-model"}
	return NewOrchestrator(registry, gw, provider, log)
}

func readToolCall(id string) modelgateway.ToolCall {
	return modelgateway.ToolCall{
		Index: 0,
		ID:    id,
		Type:  "function",
		Function: modelgateway.ToolFunctionCall{
			Name:      "read_file",
			Arguments: `{"path":"a.txt"}`,
		},
	}
}

func waitRun(t *testing.T, o *Orchestrator, runID string) *Run {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	run, err := o.WaitForRun(ctx, runID)
	if err != nil {
		t.Fatalf("WaitForRun failed: %v", err)
	}
	return run
}

func TestExecutePlan_StopsAtMaxTurns(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{
		{content: "turn 1", toolCalls: []modelgateway.ToolCall{readToolCall("tc1")}},
		{content: "turn 2", toolCalls: []modelgateway.ToolCall{readToolCall("tc2")}},
		{content: "turn 3 should never run", toolCalls: []modelgateway.ToolCall{readToolCall("tc3")}},
	}}
	o := newTestOrchestrator(gw)
	o.maxTurns = 2

	run, err := o.StartRun(context.Background(), "Work", "max turns test")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}

	done := waitRun(t, o, run.ID)
	if done.Status != StatusCompleted {
		t.Errorf("run status = %s, want %s", done.Status, StatusCompleted)
	}
	if got := gw.callCount(); got != 2 {
		t.Errorf("model calls = %d, want 2 (maxTurns)", got)
	}
}

func TestExecutePlan_CompletesWhenModelStopsCallingTools(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{
		{content: "thinking", toolCalls: []modelgateway.ToolCall{readToolCall("tc1")}},
		{content: "final answer"},
	}}
	o := newTestOrchestrator(gw)

	run, err := o.StartRun(context.Background(), "Work", "completion test")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}

	done := waitRun(t, o, run.ID)
	if done.Status != StatusCompleted {
		t.Errorf("run status = %s, want %s", done.Status, StatusCompleted)
	}
	if done.Result != "final answer" {
		t.Errorf("run.Result = %q, want %q", done.Result, "final answer")
	}
	if got := gw.callCount(); got != 2 {
		t.Errorf("model calls = %d, want 2", got)
	}
}

func TestExecutePlan_FiresFullHookSequence(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{
		{content: "thinking", toolCalls: []modelgateway.ToolCall{readToolCall("tc1")}},
		{content: "final answer"},
	}}
	o := newTestOrchestrator(gw)
	hook := &recordingHook{}
	o.RegisterHook(hook)

	run, err := o.StartRun(context.Background(), "Work", "hook sequence test")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	waitRun(t, o, run.ID)

	// Two turns: one with a tool call, one final answer. Note the final
	// turn breaks out of the loop before OnTurnEnd fires, so OnTurnEnd
	// only counts turns that executed tools.
	checks := []struct {
		event HookEvent
		want  int
	}{
		{HookOnRunStart, 1},
		{HookOnTurnStart, 2},
		{HookOnToolBefore, 1},
		{HookOnToolAfter, 1},
		{HookOnTurnEnd, 1},
		{HookOnRunEnd, 1},
	}
	for _, c := range checks {
		if got := hook.count(c.event); got != c.want {
			t.Errorf("hook %s fired %d times, want %d", c.event, got, c.want)
		}
	}
}

// TestResumeFromCheckpoint_FiresLifecycleHooks pins the resume-path
// behavior: a resumed run must fire the same lifecycle hooks as a fresh
// run, and must not panic on the second close(run.done).
//
// This is the acceptance test for the executePlan unification:
// ResumeFromCheckpoint re-arms run.done before re-entering the loop, and
// the unified executePlan fires OnRunStart / OnTurnStart / OnRunEnd on
// the resumed leg just like a fresh run.
func TestResumeFromCheckpoint_FiresLifecycleHooks(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{
		{content: "first leg", toolCalls: []modelgateway.ToolCall{readToolCall("tc1")}},
		{content: "first leg done"},
		{content: "resumed leg done"},
	}}
	o := newTestOrchestrator(gw)
	hook := &recordingHook{}
	o.RegisterHook(hook)

	run, err := o.StartRun(context.Background(), "Work", "resume test")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	waitRun(t, o, run.ID)

	if err := o.ResumeFromCheckpoint(context.Background(), run.ID); err != nil {
		t.Fatalf("ResumeFromCheckpoint failed: %v", err)
	}

	// WaitForRun must block until the resumed leg completes: this only
	// works because ResumeFromCheckpoint re-arms run.done (the old channel
	// was closed by the first leg's teardown). If the re-arm regresses,
	// WaitForRun returns immediately and the hook counts below fail.
	done := waitRun(t, o, run.ID)
	if done.Status != StatusCompleted {
		t.Fatalf("resumed run status = %s, want %s", done.Status, StatusCompleted)
	}

	if got := gw.callCount(); got < 3 {
		t.Fatalf("resumed leg never ran: model calls = %d, want >= 3", got)
	}
	if got := hook.count(HookOnRunStart); got != 2 {
		t.Errorf("OnRunStart fired %d times across fresh+resumed runs, want 2", got)
	}
	if got := hook.count(HookOnTurnStart); got != 3 {
		t.Errorf("OnTurnStart fired %d times, want 3 (2 fresh + 1 resumed)", got)
	}
	if got := hook.count(HookOnRunEnd); got != 2 {
		t.Errorf("OnRunEnd fired %d times, want 2", got)
	}
}

// TestExecutePlan_ModelFailureKeepsFailedStatus pins the failure path:
// when both the streaming call and its non-streaming fallback fail, the
// run must end as StatusFailed with the reason in Result. This guards
// the teardown fix — it previously overwrote the status with
// StatusCompleted on every exit path, masking failures.
func TestExecutePlan_ModelFailureKeepsFailedStatus(t *testing.T) {
	gw := &scriptedGateway{failAll: true}
	o := newTestOrchestrator(gw)

	run, err := o.StartRun(context.Background(), "Work", "failure test")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}

	done := waitRun(t, o, run.ID)
	if done.Status != StatusFailed {
		t.Errorf("run status = %q, want %q (failure must not be masked as completed)", done.Status, StatusFailed)
	}
	if !strings.Contains(done.Result, "run failed") {
		t.Errorf("run.Result = %q, want it to carry the failure reason", done.Result)
	}
}

// TestExecutePlan_StopRunMarksStopped pins the stop path: a run aborted
// via StopRun (context cancellation) must end as StatusStopped, not
// StatusCompleted.
func TestExecutePlan_StopRunMarksStopped(t *testing.T) {
	gw := &scriptedGateway{block: true}
	o := newTestOrchestrator(gw)

	run, err := o.StartRun(context.Background(), "Work", "stop test")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}

	// Wait until the loop is actually inside the (blocked) model call
	// before stopping, so the cancellation is what ends the run.
	deadline := time.Now().Add(5 * time.Second)
	for gw.callCount() < 1 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if gw.callCount() < 1 {
		t.Fatal("model call never started within 5s")
	}

	o.StopRun(run.ID)

	done := waitRun(t, o, run.ID)
	if done.Status != StatusStopped {
		t.Errorf("run status = %q, want %q (cancelled run must not read as completed)", done.Status, StatusStopped)
	}
}
