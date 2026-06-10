// GeoWork Go Core - OpenAI Compatible Client

package modelgateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// ChatMessage represents a chat message in the OpenAI API format.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ToolCall represents a tool call from the model.
type ToolCall struct {
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
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Tools    []ToolDef     `json:"tools,omitempty"`
	Stream   bool          `json:"stream"`
	Seed     *int          `json:"seed,omitempty"`
	Temperature *float64 `json:"temperature,omitempty"`
	MaxTokens int           `json:"max_tokens,omitempty"`
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
	ID      string           `json:"id"`
	Model   string           `json:"model"`
	Choices []Choice         `json:"choices"`
	Usage   *UsageInfo       `json:"usage,omitempty"`
}

// Choice is a single choice in the response.
type Choice struct {
	Index        int              `json:"index"`
	Message      ResponseMessage  `json:"message"`
	FinishReason string           `json:"finish_reason"`
	Delta        ResponseMessage  `json:"delta,omitempty"`
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
}

// StreamChunk is a single SSE chunk from streaming response.
type StreamChunk struct {
	Content  string
	ToolCalls []ToolCall
	IsDone   bool
	Usage    *UsageInfo
}

// OpenAICompatibleClient implements the model gateway for OpenAI-compatible APIs.
type OpenAICompatibleClient struct {
	provider  *ModelProvider
	httpClient *http.Client
	log       *zap.Logger
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
	}

	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.provider.BaseURL + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.provider.APIKeyRef != "" {
		req.Header.Set("Authorization", "Bearer "+c.provider.APIKeyRef)
	}

	resp, err := c.retryRequest(ctx, req)
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

func (c *OpenAICompatibleClient) doChat(ctx context.Context, reqBody ChatCompletionRequest) (*ChatCompletionResponse, error) {
	reqData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.provider.BaseURL + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.provider.APIKeyRef != "" {
		req.Header.Set("Authorization", "Bearer "+c.provider.APIKeyRef)
	}

	resp, err := c.retryRequest(ctx, req)
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

func (c *OpenAICompatibleClient) retryRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	var resp *http.Response
	var err error
	for i := 0; i <= c.retryCount; i++ {
		resp, err = c.httpClient.Do(req.WithContext(ctx))
		if err == nil && resp.StatusCode < 500 {
			break
		}
		if err != nil {
			c.log.Warn("request attempt failed", zap.Int("attempt", i+1), zap.Error(err))
		}
		time.Sleep(time.Duration(100*(i+1)) * time.Millisecond)
	}
	return resp, err
}

func (c *OpenAICompatibleClient) parseStream(body io.ReadCloser, ch chan StreamChunk) {
	defer body.Close()
	defer close(ch)

	decoder := json.NewDecoder(body)
	for decoder.More() {
		var rawLine map[string]any
		if err := decoder.Decode(&rawLine); err != nil {
			break
		}

		dataVal, ok := rawLine["data"]
		if !ok {
			continue
		}
		dataStr, _ := dataVal.(string)
		if dataStr == "[DONE]" {
			ch <- StreamChunk{IsDone: true}
			break
		}

		var chunk ChatCompletionResponse
		if err := json.Unmarshal([]byte(dataStr), &chunk); err != nil {
			continue
		}

		for _, choice := range chunk.Choices {
			if choice.Delta.Content != "" {
				ch <- StreamChunk{Content: choice.Delta.Content}
			}
			if len(choice.Delta.ToolCalls) > 0 {
				ch <- StreamChunk{ToolCalls: choice.Delta.ToolCalls}
			}
			if choice.FinishReason == "stop" || choice.FinishReason == "tool_calls" {
				ch <- StreamChunk{IsDone: true, Usage: chunk.Usage}
			}
		}
	}
}
