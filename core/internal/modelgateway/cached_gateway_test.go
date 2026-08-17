// GeoWork Go Core - doc/25 R3 CachedGateway tests

package modelgateway

import (
	"context"
	"testing"
	"time"
)

// cannedGateway returns a configurable response and counts calls.
type cannedGateway struct {
	providerID string
	resp       *ChatCompletionResponse
	chatCalls  int
	streamCalls int
}

func (g *cannedGateway) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	g.chatCalls++
	return g.resp, nil
}

func (g *cannedGateway) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	g.streamCalls++
	ch := make(chan StreamChunk)
	close(ch)
	return ch, nil
}

func (g *cannedGateway) ProviderID() string { return g.providerID }

func textResponse(content string) *ChatCompletionResponse {
	return &ChatCompletionResponse{
		ID:    "cmpl-cached",
		Model: "test-model",
		Choices: []Choice{{
			Index:        0,
			Message:      ResponseMessage{Role: "assistant", Content: content},
			FinishReason: "stop",
		}},
		Usage: &UsageInfo{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15},
	}
}

func TestCachedGatewayHitMiss(t *testing.T) {
	inner := &cannedGateway{providerID: "p1", resp: textResponse("hello")}
	gw := NewCachedGateway(inner, NewCache(time.Minute, 10), nil)

	msgs := []ChatMessage{{Role: "user", Content: "summarize this"}}

	// First call: miss → inner is contacted.
	resp, err := gw.Chat(context.Background(), msgs, nil, false)
	if err != nil {
		t.Fatalf("first Chat: %v", err)
	}
	if resp.Choices[0].Message.Content != "hello" {
		t.Errorf("miss response content = %q", resp.Choices[0].Message.Content)
	}

	// Second identical call: hit → inner must NOT be contacted again.
	resp, err = gw.Chat(context.Background(), msgs, nil, false)
	if err != nil {
		t.Fatalf("second Chat: %v", err)
	}
	if resp.Choices[0].Message.Content != "hello" {
		t.Errorf("hit response content = %q", resp.Choices[0].Message.Content)
	}
	if inner.chatCalls != 1 {
		t.Fatalf("inner chatCalls = %d, want 1 (second call must be a cache hit)", inner.chatCalls)
	}

	// Different messages → different key → miss again.
	if _, err := gw.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "other"}}, nil, false); err != nil {
		t.Fatalf("third Chat: %v", err)
	}
	if inner.chatCalls != 2 {
		t.Fatalf("inner chatCalls = %d, want 2", inner.chatCalls)
	}
}

func TestCachedGatewayTTLExpiry(t *testing.T) {
	inner := &cannedGateway{providerID: "p1", resp: textResponse("hello")}
	gw := NewCachedGateway(inner, NewCache(10*time.Millisecond, 10), nil)

	msgs := []ChatMessage{{Role: "user", Content: "hi"}}
	if _, err := gw.Chat(context.Background(), msgs, nil, false); err != nil {
		t.Fatalf("first Chat: %v", err)
	}
	time.Sleep(25 * time.Millisecond) // outlive the TTL
	if _, err := gw.Chat(context.Background(), msgs, nil, false); err != nil {
		t.Fatalf("second Chat: %v", err)
	}
	if inner.chatCalls != 2 {
		t.Fatalf("inner chatCalls = %d, want 2 (expired entry must miss)", inner.chatCalls)
	}
}

// TestCachedGatewayToolsRequestNotCached: requests that carry tool
// definitions are agent loop turns — the response depends on more than the
// prompt, so they must bypass the cache entirely.
func TestCachedGatewayToolsRequestNotCached(t *testing.T) {
	inner := &cannedGateway{providerID: "p1", resp: textResponse("hello")}
	gw := NewCachedGateway(inner, NewCache(time.Minute, 10), nil)

	msgs := []ChatMessage{{Role: "user", Content: "hi"}}
	tools := []ToolDef{{Type: "function", Function: ToolFunction{Name: "read_file"}}}

	if _, err := gw.Chat(context.Background(), msgs, tools, false); err != nil {
		t.Fatalf("first Chat: %v", err)
	}
	if _, err := gw.Chat(context.Background(), msgs, tools, false); err != nil {
		t.Fatalf("second Chat: %v", err)
	}
	if inner.chatCalls != 2 {
		t.Fatalf("inner chatCalls = %d, want 2 (tools requests must not be cached)", inner.chatCalls)
	}
}

// TestCachedGatewayToolCallsResponseNotCached: a response that asks for a
// tool call is an instruction, not an answer — caching it would replay the
// same tool call forever.
func TestCachedGatewayToolCallsResponseNotCached(t *testing.T) {
	resp := textResponse("")
	resp.Choices[0].Message.ToolCalls = []ToolCall{{ID: "call_1", Type: "function", Function: ToolFunctionCall{Name: "read_file", Arguments: "{}"}}}
	inner := &cannedGateway{providerID: "p1", resp: resp}
	gw := NewCachedGateway(inner, NewCache(time.Minute, 10), nil)

	msgs := []ChatMessage{{Role: "user", Content: "hi"}}
	if _, err := gw.Chat(context.Background(), msgs, nil, false); err != nil {
		t.Fatalf("first Chat: %v", err)
	}
	if _, err := gw.Chat(context.Background(), msgs, nil, false); err != nil {
		t.Fatalf("second Chat: %v", err)
	}
	if inner.chatCalls != 2 {
		t.Fatalf("inner chatCalls = %d, want 2 (tool_calls responses must not be cached)", inner.chatCalls)
	}
}

// TestCachedGatewayStreamPassthrough: streaming is never cached — the
// channel semantics make replay unsafe and the savings are nil.
func TestCachedGatewayStreamPassthrough(t *testing.T) {
	inner := &cannedGateway{providerID: "p1", resp: textResponse("hello")}
	gw := NewCachedGateway(inner, NewCache(time.Minute, 10), nil)

	for i := 0; i < 2; i++ {
		ch, err := gw.StreamChat(context.Background(), nil, nil)
		if err != nil {
			t.Fatalf("StreamChat: %v", err)
		}
		for range ch {
		}
	}
	if inner.streamCalls != 2 {
		t.Fatalf("inner streamCalls = %d, want 2 (streams must never be cached)", inner.streamCalls)
	}
}

// TestCachedGatewayModePartitionsCache: the same prompt under different
// run modes routes to different providers, so the mode must be part of the
// cache key or a Paper-mode answer could be replayed in Code mode.
func TestCachedGatewayModePartitionsCache(t *testing.T) {
	inner := &cannedGateway{providerID: "p1", resp: textResponse("hello")}
	gw := NewCachedGateway(inner, NewCache(time.Minute, 10), nil)

	msgs := []ChatMessage{{Role: "user", Content: "hi"}}
	if _, err := gw.Chat(WithMode(context.Background(), "Code"), msgs, nil, false); err != nil {
		t.Fatalf("Chat in Code mode: %v", err)
	}
	if _, err := gw.Chat(WithMode(context.Background(), "Paper"), msgs, nil, false); err != nil {
		t.Fatalf("Chat in Paper mode: %v", err)
	}
	if inner.chatCalls != 2 {
		t.Fatalf("inner chatCalls = %d, want 2 (modes must partition the cache)", inner.chatCalls)
	}
}

func TestCachedGatewayProviderIDDelegates(t *testing.T) {
	inner := &cannedGateway{providerID: "p1", resp: textResponse("x")}
	gw := NewCachedGateway(inner, NewCache(time.Minute, 10), nil)
	if gw.ProviderID() != "p1" {
		t.Fatalf("ProviderID = %q, want p1", gw.ProviderID())
	}
}
