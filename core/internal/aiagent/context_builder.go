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
	log        *zap.Logger
	registry   *toolregistry.Registry
	repoMap    *RepoMap
	budget     ContextBudget
	summarizer *ToolResultSummarizer
}

func NewContextBuilder(log *zap.Logger, registry *toolregistry.Registry) *ContextBuilder {
	return &ContextBuilder{
		log:        log,
		registry:   registry,
		summarizer: NewToolResultSummarizer(),
		budget:     DefaultContextBudget(),
	}
}

// WithRepoMap attaches a repository map to the builder for context awareness.
func (cb *ContextBuilder) WithRepoMap(rm *RepoMap) *ContextBuilder {
	cb.repoMap = rm
	return cb
}

// WithBudget sets the context budget.
func (cb *ContextBuilder) WithBudget(budget ContextBudget) *ContextBuilder {
	cb.budget = budget
	return cb
}

// BuildAssembles the system prompt, tool definitions, and conversation history.
func (cb *ContextBuilder) Build(mode, prompt, memory string) (messages []ChatMessage, tools []ToolDef) {
	planner := NewPlanner(cb.log)
	systemPrompt := planner.BuildSystemPrompt(mode, memory)

	messages = []ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: prompt},
	}

	// Append repo map if available
	if cb.repoMap != nil && cb.repoMap != (*RepoMap)(nil) {
		if rmCtx := cb.repoMap.FormatAsContext(50); rmCtx != "" {
			messages = append(messages, ChatMessage{
				Role:    "system",
				Content: rmCtx,
			})
		}
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

// BuildWithMessages assembles context and applies budget constraints.
func (cb *ContextBuilder) BuildWithMessages(
	mode, prompt, memory string,
	existingMessages []ChatMessage,
) BudgetResult {
	baseMsgs, tools := cb.Build(mode, prompt, memory)

	// Append existing messages (skip the first two: system + user we just added)
	if len(existingMessages) > 0 {
		baseMsgs = append(baseMsgs, existingMessages...)
	}

	bab := NewBudgetAwareBuilder(cb, cb.budget)
	return bab.Enforce(baseMsgs, tools)
}

// SummarizeToolOutput is a convenience wrapper around SummarizeToolResult.
func (cb *ContextBuilder) SummarizeToolOutput(stdout, stderr string, maxChars int) string {
	return SummarizeToolResult("", stdout, stderr, maxChars)
}
