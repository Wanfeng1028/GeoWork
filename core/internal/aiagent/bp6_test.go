// GeoWork Go Core - doc/22 BP6 regression tests
//
// Covers the BP6 fixes:
//
//   - S2 streaming usage: the trailing usage chunk arrives AFTER the
//     finish_reason chunk that carries IsDone. The orchestrator must keep
//     draining past IsDone to capture it, otherwise every streaming call
//     reports zero tokens.
//   - RateLimitedGateway: the QPS wrapper gates calls and degrades to a
//     pass-through when no limit is configured.
//   - Permission engine TTL cleanup + category-based write-action check.

package aiagent

import (
	"context"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"

	"geowork/core/internal/modelgateway"
	"geowork/core/internal/toolregistry"
)

// usageAfterDoneGateway emits content, then an IsDone chunk (finish_reason),
// then a trailing usage chunk — mirroring the OpenAI wire order when
// stream_options.include_usage is honored.
type usageAfterDoneGateway struct {
	mu    sync.Mutex
	calls int
}

func (g *usageAfterDoneGateway) StreamChat(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef) (<-chan modelgateway.StreamChunk, error) {
	g.mu.Lock()
	g.calls++
	g.mu.Unlock()

	ch := make(chan modelgateway.StreamChunk, 8)
	go func() {
		defer close(ch)
		ch <- modelgateway.StreamChunk{Content: "hello"}
		// finish_reason chunk — carries IsDone but NO usage yet.
		ch <- modelgateway.StreamChunk{IsDone: true}
		// Trailing usage chunk arrives AFTER IsDone (the S2 ordering).
		ch <- modelgateway.StreamChunk{Usage: &modelgateway.UsageInfo{
			PromptTokens:     10,
			CompletionTokens: 5,
			TotalTokens:      15,
		}}
	}()
	return ch, nil
}

func (g *usageAfterDoneGateway) Chat(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef, stream bool) (*modelgateway.ChatCompletionResponse, error) {
	return nil, nil
}

func (g *usageAfterDoneGateway) ProviderID() string { return "usage-after-done" }

// TestStreamingUsage_CapturedAfterIsDone verifies the S2 fix: token usage
// sent on a chunk after the finish_reason IsDone chunk is still captured
// and recorded by the UsageMeter. Before the fix the loop broke on IsDone
// and dropped the trailing usage, leaving /api/agent/usage at zero.
func TestStreamingUsage_CapturedAfterIsDone(t *testing.T) {
	gw := &usageAfterDoneGateway{}
	log := zap.NewNop()
	registry := toolregistry.NewRegistry(log)
	provider := &modelgateway.ModelProvider{ID: "usage-after-done", DefaultModel: "m"}
	o := NewOrchestrator(registry, gw, provider, log)

	meter := modelgateway.NewUsageMeter(log)
	o.WithUsageMeter(meter)

	run, err := o.StartRun(context.Background(), "test", "say hello")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	waitRun(t, o, run.ID)

	total := meter.GetRunUsage(run.ID)
	if total != 15 {
		t.Fatalf("run usage = %d tokens, want 15 (trailing usage chunk must be captured after IsDone)", total)
	}
}

// TestStreamingUsage_NoUsageChunkDoesNotHang verifies the drain loop exits
// promptly when the provider never sends a trailing usage chunk (bounded by
// the drain timeout, not a hang).
func TestStreamingUsage_NoUsageChunkDoesNotHang(t *testing.T) {
	gw := &scriptedGateway{responses: []scriptedResponse{{content: "done"}}}
	o := newTestOrchestrator(gw)

	start := time.Now()
	run, err := o.StartRun(context.Background(), "test", "quick")
	if err != nil {
		t.Fatalf("StartRun failed: %v", err)
	}
	waitRun(t, o, run.ID)

	// The drain timeout is 500ms; allow generous slack but assert we did
	// not hang well past it.
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("run took %s; drain loop likely hung waiting for a usage chunk that never arrives", elapsed)
	}
}
