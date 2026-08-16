// GeoWork Go Core - doc/22 BP6 RateLimitedGateway tests

package modelgateway

import (
	"context"
	"testing"
	"time"
)

// stubGateway is a minimal ModelGateway that counts calls.
type stubGateway struct {
	providerID string
	chatCalls  int
	streamCalls int
}

func (g *stubGateway) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	g.chatCalls++
	return &ChatCompletionResponse{}, nil
}

func (g *stubGateway) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	g.streamCalls++
	ch := make(chan StreamChunk)
	close(ch)
	return ch, nil
}

func (g *stubGateway) ProviderID() string { return g.providerID }

// TestRateLimitedGateway_PassThroughWhenNoLimit verifies the wrapper is a
// no-op when the limiter has no provider configured (AcquireProvider true).
func TestRateLimitedGateway_PassThroughWhenNoLimit(t *testing.T) {
	inner := &stubGateway{providerID: "p1"}
	gw := NewRateLimitedGateway(inner, NewRateLimiter())

	if _, err := gw.Chat(context.Background(), nil, nil, false); err != nil {
		t.Fatalf("Chat should pass through with no limit: %v", err)
	}
	if _, err := gw.StreamChat(context.Background(), nil, nil); err != nil {
		t.Fatalf("StreamChat should pass through with no limit: %v", err)
	}
	if inner.chatCalls != 1 || inner.streamCalls != 1 {
		t.Fatalf("inner calls = chat %d / stream %d, want 1/1", inner.chatCalls, inner.streamCalls)
	}
	if gw.ProviderID() != "p1" {
		t.Fatalf("ProviderID = %q, want p1", gw.ProviderID())
	}
}

// TestRateLimitedGateway_NilLimiter verifies a nil limiter degrades to a
// pass-through rather than panicking.
func TestRateLimitedGateway_NilLimiter(t *testing.T) {
	inner := &stubGateway{providerID: "p1"}
	gw := NewRateLimitedGateway(inner, nil)
	if _, err := gw.Chat(context.Background(), nil, nil, false); err != nil {
		t.Fatalf("Chat with nil limiter should pass through: %v", err)
	}
}

// TestRateLimitedGateway_EnforcesQPS verifies that once the provider bucket
// is exhausted the wrapper rejects calls instead of forwarding them.
func TestRateLimitedGateway_EnforcesQPS(t *testing.T) {
	inner := &stubGateway{providerID: "p1"}
	limiter := NewRateLimiter()
	// 1 QPS, 1x profile → bucket holds exactly 1 token.
	limiter.ConfigureProvider("p1", 1, SpeedProfile{ID: "1x", MaxParallel: 1, TokenBudgetMul: 1.0, RateLimitMul: 1.0})

	gw := NewRateLimitedGateway(inner, limiter)
	// Shrink the acquire timeout so the saturated call fails fast instead
	// of waiting the default 10s.
	gw.acquireTimeout = 50 * time.Millisecond

	// First call consumes the single token and succeeds.
	if _, err := gw.Chat(context.Background(), nil, nil, false); err != nil {
		t.Fatalf("first Chat should succeed: %v", err)
	}
	// Second call finds the bucket empty and must be rejected before it
	// reaches the inner gateway.
	if _, err := gw.Chat(context.Background(), nil, nil, false); err == nil {
		t.Fatalf("second Chat should be rate-limited")
	}
	if inner.chatCalls != 1 {
		t.Fatalf("inner chatCalls = %d, want 1 (rate-limited call must not reach inner)", inner.chatCalls)
	}
}
