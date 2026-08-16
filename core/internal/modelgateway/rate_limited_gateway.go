// GeoWork Go Core - Rate-Limited Gateway Wrapper (doc/22 BP6 / S6)
//
// RateLimitedGateway decorates any ModelGateway with the RateLimiter's
// per-provider QPS gate. It is a zero-intrusion wrapper: the underlying
// client (OpenAICompatibleClient) is unchanged, and the wrapper only
// blocks/rejects at the call boundary.
//
// Wiring (main.go): the runtime builds the concrete client, then wraps it
// before handing it to the orchestrator, so every Chat/StreamChat the
// agent issues passes through the limiter. When no provider limit is
// configured the limiter is a pass-through (AcquireProvider returns true).

package modelgateway

import (
	"context"
	"fmt"
	"time"
)

// RateLimitedGateway wraps a ModelGateway and enforces the RateLimiter's
// per-provider QPS before each call. It implements ModelGateway so it can
// be substituted anywhere the interface is accepted.
type RateLimitedGateway struct {
	inner   ModelGateway
	limiter *RateLimiter

	// acquireTimeout bounds how long a call waits for a rate-limit token
	// before giving up. Keeps a saturated provider from hanging the agent
	// indefinitely; the caller sees a clear error instead.
	acquireTimeout time.Duration
}

// NewRateLimitedGateway wraps inner with limiter. If limiter is nil the
// wrapper degrades to a pass-through (returns inner's results directly).
func NewRateLimitedGateway(inner ModelGateway, limiter *RateLimiter) *RateLimitedGateway {
	return &RateLimitedGateway{
		inner:          inner,
		limiter:        limiter,
		acquireTimeout: 10 * time.Second,
	}
}

// acquire blocks until a provider token is available or the timeout
// elapses. Returns nil when the call may proceed.
func (g *RateLimitedGateway) acquire(ctx context.Context) error {
	if g.limiter == nil || g.inner == nil {
		return nil
	}
	providerID := g.inner.ProviderID()
	deadline := time.Now().Add(g.acquireTimeout)
	for {
		if g.limiter.AcquireProvider(providerID) {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("rate limit exceeded for provider %q (waited %s)", providerID, g.acquireTimeout)
		}
		// Back off briefly before retrying; honor ctx cancellation so a
		// stopped run doesn't keep polling the limiter.
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(20 * time.Millisecond):
		}
	}
}

// Chat enforces the rate limit then delegates to the inner gateway.
func (g *RateLimitedGateway) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	if err := g.acquire(ctx); err != nil {
		return nil, err
	}
	return g.inner.Chat(ctx, messages, tools, stream)
}

// StreamChat enforces the rate limit then delegates to the inner gateway.
func (g *RateLimitedGateway) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	if err := g.acquire(ctx); err != nil {
		return nil, err
	}
	return g.inner.StreamChat(ctx, messages, tools)
}

// ProviderID delegates to the inner gateway.
func (g *RateLimitedGateway) ProviderID() string {
	if g.inner == nil {
		return ""
	}
	return g.inner.ProviderID()
}
