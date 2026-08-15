// GeoWork Go Core - OpenAI compatible client tests
//
// Uses httptest servers that emit real SSE framing (data: prefixes,
// blank-line event boundaries, comment heartbeats, [DONE] sentinel) so
// the stream parser is exercised against the wire format OpenAI-
// compatible providers actually send.

package modelgateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
)

func newTestClient(baseURL string) *OpenAICompatibleClient {
	provider := &ModelProvider{
		ID:           "test",
		Name:         "test",
		Kind:         "openai_compatible",
		BaseURL:      baseURL,
		APIKeyRef:    "sk-test",
		DefaultModel: "test-model",
		Enabled:      true,
	}
	return NewOpenAICompatibleClient(provider, zap.NewNop())
}

// sseServer spins up an httptest server writing the given raw SSE text.
func sseServer(t *testing.T, body string, inspect func(r *http.Request)) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if inspect != nil {
			inspect(r)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		flusher := w.(http.Flusher)
		// Write line by line so flush boundaries mimic a real stream.
		for _, line := range strings.SplitAfter(body, "\n") {
			fmt.Fprint(w, line)
			flusher.Flush()
		}
	}))
}

func collectChunks(t *testing.T, ch <-chan StreamChunk) (content string, toolCalls []ToolCall, usage *UsageInfo) {
	t.Helper()
	timeout := time.After(5 * time.Second)
	for {
		select {
		case chunk, ok := <-ch:
			if !ok {
				return content, toolCalls, usage
			}
			if chunk.Usage != nil {
				usage = chunk.Usage
			}
			if chunk.Content != "" {
				content += chunk.Content
			}
			if len(chunk.ToolCalls) > 0 {
				toolCalls = append(toolCalls, chunk.ToolCalls...)
			}
		case <-timeout:
			t.Fatal("stream did not close within 5s")
			return
		}
	}
}

// TestStreamChat_ParsesSSEDeltas covers the core regression: the parser
// must handle `data: {...}` lines with SSE framing, incremental
// tool-call argument assembly, and the [DONE] sentinel. Before the
// bufio.Scanner rewrite this returned an empty stream against any real
// provider because a JSON decoder cannot parse `data:`-prefixed lines.
func TestStreamChat_ParsesSSEDeltas(t *testing.T) {
	body := "data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"}}]}\n" +
		"\n" +
		"data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n" +
		"\n" +
		"data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"read_file\",\"arguments\":\"{\\\"pa\"}}]}}]}\n" +
		"\n" +
		"data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"th\\\":\\\"a.txt\\\"}\"}}]}}]}\n" +
		"\n" +
		"data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n" +
		"\n" +
		"data: [DONE]\n" +
		"\n"
	srv := sseServer(t, body, nil)
	defer srv.Close()

	client := newTestClient(srv.URL)
	ch, err := client.StreamChat(context.Background(),
		[]ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}

	content, toolCalls, _ := collectChunks(t, ch)
	if content != "Hello" {
		t.Errorf("content = %q, want %q", content, "Hello")
	}
	if len(toolCalls) != 2 {
		t.Fatalf("tool call deltas = %d, want 2", len(toolCalls))
	}
	// The two deltas belong to one call: id on the first, args split.
	if toolCalls[0].ID != "call_1" || toolCalls[0].Function.Name != "read_file" {
		t.Errorf("first delta = %+v, want id call_1 / read_file", toolCalls[0])
	}
	args := toolCalls[0].Function.Arguments + toolCalls[1].Function.Arguments
	if args != `{"path":"a.txt"}` {
		t.Errorf("assembled arguments = %q, want %q", args, `{"path":"a.txt"}`)
	}
}

// TestStreamChat_CapturesStandaloneUsageChunk covers servers honoring
// stream_options.include_usage: usage arrives on its own event with an
// empty choices list, before [DONE].
func TestStreamChat_CapturesStandaloneUsageChunk(t *testing.T) {
	body := "data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n" +
		"\n" +
		"data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":5,\"total_tokens\":15}}\n" +
		"\n" +
		"data: [DONE]\n" +
		"\n"
	srv := sseServer(t, body, nil)
	defer srv.Close()

	client := newTestClient(srv.URL)
	ch, err := client.StreamChat(context.Background(),
		[]ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}
	_, _, usage := collectChunks(t, ch)
	if usage == nil {
		t.Fatal("usage = nil, want captured usage chunk")
	}
	if usage.TotalTokens != 15 {
		t.Errorf("usage.TotalTokens = %d, want 15", usage.TotalTokens)
	}
}

// TestStreamChat_IgnoresCommentsAndNonDataFields ensures SSE comment
// heartbeats (": ping") and unknown fields (event:, id:, retry:) don't
// break parsing or get misread as payloads.
func TestStreamChat_IgnoresCommentsAndNonDataFields(t *testing.T) {
	body := ": keepalive\n" +
		"\n" +
		"event: message\n" +
		"id: 42\n" +
		"retry: 1000\n" +
		"data: {\"choices\":[{\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n" +
		"\n" +
		"data: [DONE]\n" +
		"\n"
	srv := sseServer(t, body, nil)
	defer srv.Close()

	client := newTestClient(srv.URL)
	ch, err := client.StreamChat(context.Background(),
		[]ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}
	content, _, _ := collectChunks(t, ch)
	if content != "ok" {
		t.Errorf("content = %q, want %q", content, "ok")
	}
}

// TestStreamChat_TruncatedStreamFlushesResidualEvent: a stream that ends
// without [DONE] (server crash / connection drop) must still surface the
// last complete event instead of dropping it silently.
func TestStreamChat_TruncatedStreamFlushesResidualEvent(t *testing.T) {
	body := "data: {\"choices\":[{\"delta\":{\"content\":\"tail\"}}]}\n" +
		"\n" +
		"data: {\"choices\":[{\"delta\":{\"content\":\"end\"}}]}\n" // no trailing blank line, no [DONE]
	srv := sseServer(t, body, nil)
	defer srv.Close()

	client := newTestClient(srv.URL)
	ch, err := client.StreamChat(context.Background(),
		[]ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}
	content, _, _ := collectChunks(t, ch)
	if content != "tailend" {
		t.Errorf("content = %q, want %q (residual event flushed)", content, "tailend")
	}
}

// TestStreamChat_RequestsIncludeUsage verifies the request body asks for
// stream_options.include_usage so usage accounting works on providers
// that support it.
func TestStreamChat_RequestsIncludeUsage(t *testing.T) {
	srv := sseServer(t, "data: [DONE]\n\n", func(r *http.Request) {
		var req ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("decode request body: %v", err)
			return
		}
		if !req.Stream {
			t.Error("request stream = false, want true")
		}
		if req.StreamOptions == nil || !req.StreamOptions.IncludeUsage {
			t.Error("request stream_options.include_usage not set")
		}
	})
	defer srv.Close()

	client := newTestClient(srv.URL)
	ch, err := client.StreamChat(context.Background(),
		[]ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}
	collectChunks(t, ch)
}

// TestChat_RetriesWithFreshBody covers the retry regression: the first
// attempt fails with a 500, and the retried request must carry the full
// JSON body (a reused *http.Request would send an empty body after the
// reader was consumed).
func TestChat_RetriesWithFreshBody(t *testing.T) {
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		var req ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("attempt %d: request body undecodable: %v", attempts, err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if len(req.Messages) == 0 {
			t.Errorf("attempt %d: request body lost messages", attempts)
		}
		if attempts == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"id":"1","model":"test-model","choices":[{"index":0,"message":{"role":"assistant","content":"recovered"},"finish_reason":"stop"}]}`)
	}))
	defer srv.Close()

	client := newTestClient(srv.URL)
	resp, err := client.Chat(context.Background(),
		[]ChatMessage{{Role: "user", Content: "hi"}}, nil, false)
	if err != nil {
		t.Fatalf("Chat failed: %v", err)
	}
	if attempts != 2 {
		t.Errorf("attempts = %d, want 2 (one 500 retry)", attempts)
	}
	if len(resp.Choices) != 1 || resp.Choices[0].Message.Content != "recovered" {
		t.Errorf("unexpected response: %+v", resp)
	}
}

// TestChatMessage_ToolProtocolSerialization pins the wire format for the
// tool-calling protocol: assistant messages carry tool_calls, tool
// replies carry tool_call_id. This is what strict OpenAI-compatible
// servers validate on the second turn.
func TestChatMessage_ToolProtocolSerialization(t *testing.T) {
	assistant := ChatMessage{
		Role: "assistant",
		ToolCalls: []ToolCall{{
			ID:   "call_1",
			Type: "function",
			Function: ToolFunctionCall{
				Name:      "read_file",
				Arguments: `{"path":"a.txt"}`,
			},
		}},
	}
	tool := ChatMessage{
		Role:       "tool",
		Content:    "file contents",
		ToolCallID: "call_1",
	}

	aJSON, err := json.Marshal(assistant)
	if err != nil {
		t.Fatalf("marshal assistant: %v", err)
	}
	if !strings.Contains(string(aJSON), `"tool_calls"`) || !strings.Contains(string(aJSON), `"call_1"`) {
		t.Errorf("assistant JSON missing tool_calls/call id: %s", aJSON)
	}
	// Index must not leak into request serialization.
	if strings.Contains(string(aJSON), `"index"`) {
		t.Errorf("assistant JSON leaks streaming index field: %s", aJSON)
	}

	tJSON, err := json.Marshal(tool)
	if err != nil {
		t.Fatalf("marshal tool: %v", err)
	}
	if !strings.Contains(string(tJSON), `"tool_call_id":"call_1"`) {
		t.Errorf("tool JSON missing tool_call_id: %s", tJSON)
	}
}
