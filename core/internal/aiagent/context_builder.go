// GeoWork Go Core - Agent Context Builder

package aiagent

import (
	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

// ToolDef represents a tool definition for LLM function calling.
type ToolDef struct {
	Type     string      `json:"type"`
	Function ToolFunction `json:"function"`
}

// ToolFunction represents a function tool definition.
type ToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// ContextBuilder assembles the full context for model calls.
type ContextBuilder struct {
	log     *zap.Logger
	registry *toolregistry.Registry
}

func NewContextBuilder(log *zap.Logger, registry *toolregistry.Registry) *ContextBuilder {
	return &ContextBuilder{log: log, registry: registry}
}

// BuildAssembles the system prompt, tool definitions, and conversation history.
func (cb *ContextBuilder) Build(mode, prompt, memory string) (messages []ChatMessage, tools []ToolDef) {
	// System prompt
	planner := NewPlanner(cb.log)
	systemPrompt := planner.BuildSystemPrompt(mode, memory)

	messages = []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: prompt},
	}

	// Build tool definitions from registry
	registryTools := cb.registry.List()
	for _, t := range registryTools {
		tools = append(tools, ToolDef{
			Type: "function",
			Function: ToolFunction{
				Name:        t.Name(),
				Description: t.Description(),
				Parameters:  t.InputSchema(),
			},
		})
	}

	return
}
