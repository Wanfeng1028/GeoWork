// GeoWork Go Core - OpenAI Compatible Client

package modelgateway

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// ChatMessage represents a chat message in the OpenAI API format.
//
// Tool-calling protocol notes: an assistant turn that invokes tools must
// be echoed back with ToolCalls populated, and each role:"tool" reply
// must carry the ToolCallID of the call it answers. Without these the
// OpenAI API rejects the second turn (400) and lenient servers cannot
// correlate results with calls.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`

	// ToolCallID is required on role:"tool" messages: the id of the
	// tool call this result answers.
	ToolCallID string `json:"tool_call_id,omitempty"`

	// Name is the optional tool/function name hint (OpenAI accepts it
	// on tool and assistant messages).
	Name string `json:"name,omitempty"`

	// ToolCalls carries the calls an assistant message produced. Only
	// meaningful for role:"assistant". Index is not serialized here —
	// it is a streaming-assembly detail, not part of the wire format
	// for requests.
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}

// ToolCall represents a tool call from the model.
// In streaming responses, Index identifies which tool_call delta this belongs to
// (OpenAI streaming protocol: multiple tool_calls can be returned incrementally).
type ToolCall struct {
	Index    int              `json:"index,omitempty"`
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolFunctionCall `json:"function"`
}

// ToolFunctionCall is the function invocation part of a tool call.
type ToolFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// ChatCompletionRequest is the OpenAI chat completion request.
type ChatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Tools       []ToolDef     `json:"tools,omitempty"`
	Stream      bool          `json:"stream"`
	Seed        *int          `json:"seed,omitempty"`
	Temperature *float64      `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`

	// StreamOptions requests stream-mode extras (currently usage stats).
	// OpenAI-compatible servers that don't know the field ignore it.
	StreamOptions *StreamOptions `json:"stream_options,omitempty"`
}

// StreamOptions mirrors the OpenAI stream_options request field.
type StreamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

// ToolDef defines a tool for the model to call.
type ToolDef struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

// ToolFunction describes a callable tool.
type ToolFunction struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Parameters  any    `json:"parameters"`
}

// ChatCompletionResponse is the OpenAI chat completion response.
type ChatCompletionResponse struct {
	ID      string     `json:"id"`
	Model   string     `json:"model"`
	Choices []Choice   `json:"choices"`
	Usage   *UsageInfo `json:"usage,omitempty"`
}

// Choice is a single choice in the response.
type Choice struct {
	Index        int             `json:"index"`
	Message      ResponseMessage `json:"message"`
	FinishReason string          `json:"finish_reason"`
	Delta        ResponseMessage `json:"delta,omitempty"`
}

// ResponseMessage is the message part of a choice.
type ResponseMessage struct {
	Role      string     `json:"role"`
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}

// UsageInfo tracks token usage.
type UsageInfo struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
	// CachedTokens is the number of prompt tokens served from the
	// provider's prompt cache (P1-2 §3.5). 0 when the provider does
	// not report cache hit information.
	CachedTokens int `json:"cached_tokens,omitempty"`
}

// StreamChunk is a single SSE chunk from streaming response.
type StreamChunk struct {
	Content   string
	ToolCalls []ToolCall
	IsDone    bool
	Usage     *UsageInfo
}

// OpenAICompatibleClient implements the model gateway for OpenAI-compatible APIs.
type OpenAICompatibleClient struct {
	provider   *ModelProvider
	httpClient *http.Client
	log        *zap.Logger
	retryCount int
}

// NewOpenAICompatibleClient creates a new client for an OpenAI-compatible provider.
func NewOpenAICompatibleClient(provider *ModelProvider, log *zap.Logger) *OpenAICompatibleClient {
	return &OpenAICompatibleClient{
		provider: provider,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		log:        log,
		retryCount: 3,
	}
}

// Chat sends a chat completion request.
func (c *OpenAICompatibleClient) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
	reqBody := ChatCompletionRequest{
		Model:    c.provider.DefaultModel,
		Messages: messages,
		Tools:    tools,
		Stream:   false,
	}

	if stream {
		return nil, fmt.Errorf("streaming not yet implemented for non-SSE path")
	}

	return c.doChat(ctx, reqBody)
}

// StreamChat sends a streaming chat completion request, returning a channel of StreamChunk.
func (c *OpenAICompatibleClient) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
	reqBody := ChatCompletionRequest{
		Model:    c.provider.DefaultModel,
		Messages: messages,
		Tools:    tools,
		Stream:   true,
		// Ask for token usage on the final chunk. Servers that don't
		// support stream_options ignore it; usage then stays nil and
		// the caller treats it as "unreported".
		StreamOptions: &StreamOptions{IncludeUsage: true},
	}

	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.retryRequest(ctx, http.MethodPost, c.provider.BaseURL+"/v1/chat/completions", reqData)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("stream chat error %d: %s", resp.StatusCode, string(body))
	}

	ch := make(chan StreamChunk, 32)
	go c.parseStream(resp.Body, ch)
	return ch, nil
}

// ModelList fetches available models from the provider.
func (c *OpenAICompatibleClient) ModelList(ctx context.Context) ([]map[string]string, error) {
	url := c.provider.BaseURL + "/v1/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if c.provider.APIKeyRef != "" {
		req.Header.Set("Authorization", "Bearer "+c.provider.APIKeyRef)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	models := make([]map[string]string, len(result.Data))
	for i, m := range result.Data {
		models[i] = map[string]string{"id": m.ID, "name": m.ID}
	}
	return models, nil
}

// TestConnection checks if the provider is reachable.
func (c *OpenAICompatibleClient) TestConnection(ctx context.Context) error {
	_, err := c.ModelList(ctx)
	return err
}

// ProviderID returns the current provider's identifier, implementing ModelGateway interface.
// Used for audit logs and P2-5 Router routing tracking.
func (c *OpenAICompatibleClient) ProviderID() string {
	return c.provider.ID
}

func (c *OpenAICompatibleClient) doChat(ctx context.Context, reqBody ChatCompletionRequest) (*ChatCompletionResponse, error) {
	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.retryRequest(ctx, http.MethodPost, c.provider.BaseURL+"/v1/chat/completions", reqData)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("chat error %d: %s", resp.StatusCode, string(body))
	}

	var result ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// retryRequest POSTs reqData to url with exponential backoff. A fresh
// *http.Request (and a fresh body reader) is built per attempt: reusing
// one request object would send an empty body after the first attempt
// consumed the reader.
func (c *OpenAICompatibleClient) retryRequest(ctx context.Context, method, url string, reqData []byte) (*http.Response, error) {
	var resp *http.Response
	var err error
	for i := 0; i <= c.retryCount; i++ {
		req, rerr := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(reqData))
		if rerr != nil {
			return nil, fmt.Errorf("create request: %w", rerr)
		}
		req.Header.Set("Content-Type", "application/json")
		if c.provider.APIKeyRef != "" {
			req.Header.Set("Authorization", "Bearer "+c.provider.APIKeyRef)
		}

		resp, err = c.httpClient.Do(req)
		retryable := err != nil || resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests
		if !retryable {
			break
		}
		// Drain and close the failed attempt so the connection can be
		// reused (or discarded) before we retry.
		if resp != nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			resp = nil
		}
		if err != nil {
			c.log.Warn("request attempt failed", zap.Int("attempt", i+1), zap.Error(err))
		}
		time.Sleep(time.Duration(100*(i+1)) * time.Millisecond)
	}
	// doc/22 BP1 / F3: when the LAST attempt returned a retryable status
	// the loop drained the body and set resp=nil; returning (nil, nil)
	// would make callers dereference a nil response. Convert to an error.
	if resp == nil && err == nil {
		err = fmt.Errorf("request to %s failed after %d attempts (last status retryable)", url, c.retryCount+1)
	}
	return resp, err
}

// parseStream decodes an SSE ("text/event-stream") body into StreamChunks.
//
// The body is a sequence of lines: `data: <json>` payloads terminated by
// a blank line, with `data: [DONE]` as the end sentinel. Per the SSE
// spec, lines starting with ":" are comments (heartbeats), other field
// names (event:, id:, retry:) are ignored, and consecutive data: lines
// are joined with "\n" before dispatch. A bufio.Scanner handles the
// framing; JSON decoding only sees the extracted payload.
func (c *OpenAICompatibleClient) parseStream(body io.ReadCloser, ch chan StreamChunk) {
	defer body.Close()
	defer close(ch)

	scanner := bufio.NewScanner(body)
	// SSE payloads can be large (tool-call argument deltas); allow up
	// to 4 MiB per line instead of the 64 KiB default.
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)

	var dataLines []string
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case line == "":
			// Blank line: dispatch the accumulated event, if any.
			if len(dataLines) == 0 {
				continue
			}
			data := strings.Join(dataLines, "\n")
			dataLines = dataLines[:0]
			if data == "[DONE]" {
				ch <- StreamChunk{IsDone: true}
				return
			}
			var chunk ChatCompletionResponse
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				// Malformed payload: skip it, keep the stream alive.
				continue
			}
			// Usage arrives on its own chunk (choices empty) when
			// stream_options.include_usage was requested.
			if chunk.Usage != nil {
				ch <- StreamChunk{Usage: chunk.Usage}
			}
			for _, choice := range chunk.Choices {
				if choice.Delta.Content != "" {
					ch <- StreamChunk{Content: choice.Delta.Content}
				}
				if len(choice.Delta.ToolCalls) > 0 {
					ch <- StreamChunk{ToolCalls: choice.Delta.ToolCalls}
				}
				if choice.FinishReason == "stop" || choice.FinishReason == "tool_calls" || choice.FinishReason == "length" {
					ch <- StreamChunk{IsDone: true}
				}
			}
		case strings.HasPrefix(line, ":"):
			// SSE comment / heartbeat — ignore.
		case strings.HasPrefix(line, "data:"):
			payload := strings.TrimPrefix(line, "data:")
			// The spec allows a single optional space after the colon.
			payload = strings.TrimPrefix(payload, " ")
			dataLines = append(dataLines, payload)
		default:
			// event:, id:, retry: and any unknown field — ignore.
		}
	}
	// Stream ended without [DONE]: flush any residual event so a
	// truncated-but-parseable final chunk is not lost.
	if len(dataLines) > 0 {
		data := strings.Join(dataLines, "\n")
		if data != "[DONE]" {
			var chunk ChatCompletionResponse
			if err := json.Unmarshal([]byte(data), &chunk); err == nil {
				if chunk.Usage != nil {
					ch <- StreamChunk{Usage: chunk.Usage}
				}
				for _, choice := range chunk.Choices {
					if choice.Delta.Content != "" {
						ch <- StreamChunk{Content: choice.Delta.Content}
					}
					if len(choice.Delta.ToolCalls) > 0 {
						ch <- StreamChunk{ToolCalls: choice.Delta.ToolCalls}
					}
				}
			}
		}
	}
}
