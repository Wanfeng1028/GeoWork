// GeoWork Go Core - Agent Executor (tool call parsing from model response)

package aiagent

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ChatMessage represents a message sent to or received from an LLM.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Executor handles parsing model responses and dispatching tool calls.
type Executor struct{}

func NewExecutor() *Executor {
	return &Executor{}
}

// ParseResponse parses a model response for tool calls.
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
