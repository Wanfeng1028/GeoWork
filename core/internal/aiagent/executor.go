// GeoWork Go Core - Agent Executor (tool call parsing from model response)

package aiagent

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"geowork/core/internal/modelgateway"
)

// ChatMessage is an alias to modelgateway.ChatMessage for backward compatibility
// within the aiagent package. All new code should use modelgateway.ChatMessage directly.
type ChatMessage = modelgateway.ChatMessage

// Executor handles parsing model responses and dispatching tool calls.
type Executor struct{}

func NewExecutor() *Executor {
	return &Executor{}
}

// ParseResponse parses a model response for tool calls in legacy XML format.
// Deprecated: Use ParseModelResponse for OpenAI native tool_calls support.
func (e *Executor) ParseResponse(content string) ([]ToolCall, string) {
	// Check if the model is requesting tool calls
	// The format is typically: <tool_call>tool_name{"args": "values"}
	var toolCalls []ToolCall
	plainContent := content

	// Simple parsing for <tool_call> format
	if strings.Contains(content, "<tool_call>") {
		start := strings.Index(content, "<tool_call>")
		end := strings.LastIndex(content, "</tool_call>")
		if start >= 0 && end > start {
			toolXML := content[start+11 : end] // skip "<tool_call>"
			toolCalls = parseToolXML(toolXML)
			plainContent = content[:start] + content[end+12:] // strip tool call tags
		}
	}

	return toolCalls, strings.TrimSpace(plainContent)
}

func parseToolXML(xml string) []ToolCall {
	var calls []ToolCall

	// Parse individual <call> blocks
	for strings.Contains(xml, "<call>") {
		nameStart := strings.Index(xml, "<name>")
		nameEnd := strings.Index(xml, "</name>")

		if nameStart < 0 || nameEnd < 0 {
			break
		}

		name := xml[nameStart+6 : nameEnd]
		argsStart := strings.Index(xml[nameEnd:], "{")
		argsEnd := strings.LastIndex(xml, "}")

		if argsStart < 0 || argsEnd < 0 || argsEnd <= argsStart+nameEnd {
			break
		}

		argsStr := xml[argsStart+nameEnd : argsEnd+1]
		var args map[string]any
		json.Unmarshal([]byte(argsStr), &args)

		calls = append(calls, ToolCall{
			ID:   fmt.Sprintf("call_%d", time.Now().UnixNano()),
			Name: name,
			Args: args,
		})

		// Remove processed call
		xml = xml[argsEnd+1:]
	}

	return calls
}

// openaiToolCallJSON is the JSON structure for OpenAI native tool_calls.
type openaiToolCallJSON struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// ParseModelResponse parses a model response that may contain OpenAI native tool_calls JSON.
// It first tries to parse the content as a JSON object with a "tool_calls" array.
// If that fails, it falls back to the legacy XML ParseResponse.
func (e *Executor) ParseModelResponse(content string) ([]ToolCall, string) {
	// Try to parse as JSON with tool_calls
	var parsed struct {
		ToolCalls []openaiToolCallJSON `json:"tool_calls"`
		Content   string              `json:"content"`
	}
	if err := json.Unmarshal([]byte(content), &parsed); err == nil && len(parsed.ToolCalls) > 0 {
		calls := make([]ToolCall, 0, len(parsed.ToolCalls))
		for _, tc := range parsed.ToolCalls {
			var args map[string]any
			if tc.Function.Arguments != "" {
				_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
			}
			calls = append(calls, ToolCall{
				ID:   tc.ID,
				Name: tc.Function.Name,
				Args: args,
			})
		}
		plainContent := parsed.Content
		if plainContent == "" {
			// Strip the JSON from content to get plain text
			plainContent = strings.TrimSpace(content)
		}
		return calls, plainContent
	}

	// Fallback: legacy XML format
	return e.ParseResponse(content)
}

// BuildMessages constructs the message list for the model.
func (e *Executor) BuildMessages(systemPrompt, userPrompt string, history []Message) []ChatMessage {
	messages := []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
	for _, h := range history {
		msg := ChatMessage{Role: h.Role, Content: h.Content}
		messages = append(messages, msg)
	}
	return messages
}

// AppendToolResult adds a tool execution result to the message history.
func (e *Executor) AppendToolResult(messages []ChatMessage, call ToolCall) []ChatMessage {
	// Add assistant message with tool call
	messages = append(messages, ChatMessage{
		Role: "assistant",
		Content: fmt.Sprintf("Calling tool: %s with args: %v", call.Name, call.Args),
	})

	// Add tool result message
	content := "Success"
	if call.Error != "" {
		content = fmt.Sprintf("Error: %s", call.Error)
	}

	messages = append(messages, ChatMessage{
		Role:    "tool",
		Content: content,
	})

	return messages
}
