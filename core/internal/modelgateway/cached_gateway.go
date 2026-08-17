// GeoWork Go Core - Cached Gateway (doc/25 R3)
//
// CachedGateway is a ModelGateway decorator that serves repeat
// non-streaming Chat requests from a local Cache instead of re-billing
// the provider. It mirrors the RateLimitedGateway decorator shape so the
// production stack composes as Cache → Router → RateLimit.
//
// What is cached (and what is not):
//   - Only non-streaming Chat. StreamChat always passes through —
//     replaying channel semantics is unsafe and the savings are nil.
//   - Only requests WITHOUT tool definitions. A tools request is an
//     agent-loop turn whose response depends on more than the prompt.
//   - Only responses WITHOUT tool_calls. A tool_calls response is an
//     instruction to act, not an answer — caching it would replay the
//     same tool call forever.
//   - The run mode (WithMode) partitions the key: the same prompt under
//     different modes routes to different providers, so a Paper-mode
//     answer must never be replayed in Code mode.
//
// Opt-in: the desktop runtime constructs this only when
// GEOWORK_LLM_CACHE=1 (default off). A cached response replays its
// original Usage verbatim, so downstream usage meters see the original
// token counts — cost accounting in the inner Router only bills the
// original call.

package modelgateway

import (
	"context"
	"encoding/json"
	"time"

	"go.uber.org/zap"
)

// CachedGateway wraps a ModelGateway with a response cache.
type CachedGateway struct {
	inner ModelGateway
	cache *Cache
	log   *zap.Logger
}

// NewCachedGateway constructs the decorator. A nil cache degrades to a
// pass-through (same nil-tolerance discipline as RateLimitedGateway).
func NewCachedGateway(inner ModelGateway, cache *Cache, log *zap.Logger) *CachedGateway {
	if log == nil {
		log = zap.NewNop()
	}
	return &CachedGateway{inner: inner, cache: cache, log: log}
}

// Chat serves cacheable requests from the cache when possible. See the
// package comment for the cacheability rules.
func (g *CachedGateway) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	if stream || len(tools) > 0 || g.cache == nil || !g.cache.Enabled() {
		return g.inner.Chat(ctx, messages, tools, stream)
	}

	key := Key(ModeFromContext(ctx), HashContext(messages), "", "")
	if entry, ok := g.cache.Get(key); ok {
		var resp ChatCompletionResponse
		if err := json.Unmarshal(entry.Response, &resp); err == nil {
			g.log.Debug("model response cache hit", zap.String("key", key))
			return &resp, nil
		}
		// Corrupt entry — drop it and fall through to the provider.
		g.cache.Delete(key)
	}

	resp, err := g.inner.Chat(ctx, messages, tools, stream)
	if err != nil {
		return resp, err
	}

	if !responseHasToolCalls(resp) {
		if data, merr := json.Marshal(resp); merr == nil {
			tokenCount := 0
			if resp.Usage != nil {
				tokenCount = resp.Usage.TotalTokens
			}
			g.cache.Set(key, CacheEntry{
				Response:   data,
				Timestamp:  time.Now(),
				PromptHash: key,
				Model:      resp.Model,
				TokenCount: tokenCount,
			})
		}
	}
	return resp, nil
}

// StreamChat always passes through — streaming is never cached.
func (g *CachedGateway) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	return g.inner.StreamChat(ctx, messages, tools)
}

// ProviderID delegates to the inner gateway.
func (g *CachedGateway) ProviderID() string {
	if g.inner == nil {
		return ""
	}
	return g.inner.ProviderID()
}

// responseHasToolCalls reports whether any choice asks for a tool call.
func responseHasToolCalls(resp *ChatCompletionResponse) bool {
	if resp == nil {
		return false
	}
	for _, choice := range resp.Choices {
		if len(choice.Message.ToolCalls) > 0 {
			return true
		}
	}
	return false
}

// Compile-time assertion: CachedGateway must implement ModelGateway.
var _ ModelGateway = (*CachedGateway)(nil)
