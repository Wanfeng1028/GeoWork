// GeoWork Go Core - Context Budget Manager

package aiagent

// ContextBudget constrains how much token/character budget a single agent turn may consume.
type ContextBudget struct {
	// MaxPromptTokens hard ceiling for the prompt sent to the LLM per turn.
	MaxPromptTokens int
	// MaxToolResultChars hard ceiling for tool-result text embedded in the prompt.
	MaxToolResultChars int
	// MaxMessages maximum number of chat messages (system + user + assistant + tool) in context.
	MaxMessages int
	// ReservedOutputTokens tokens reserved for model output.
	ReservedOutputTokens int
	// MaxFilesPerTurn maximum distinct files the agent may reference in one turn.
	MaxFilesPerTurn int
	// MaxToolCallsPerTurn maximum tool invocations allowed per turn.
	MaxToolCallsPerTurn int
}

// DefaultContextBudget returns the default budget configuration.
func DefaultContextBudget() ContextBudget {
	return ContextBudget{
		MaxPromptTokens:      32000,
		ReservedOutputTokens: 4096,
		MaxToolResultChars:   8000,
		MaxMessages:          20,
		MaxFilesPerTurn:      5,
		MaxToolCallsPerTurn:  5,
	}
}

// BudgetAwareBuilder wraps ContextBuilder and enforces the budget during Build.
type BudgetAwareBuilder struct {
	*ContextBuilder
	budget ContextBudget
}

// NewBudgetAwareBuilder creates a budget-aware context builder.
func NewBudgetAwareBuilder(cb *ContextBuilder, budget ContextBudget) *BudgetAwareBuilder {
	return &BudgetAwareBuilder{
		ContextBuilder: cb,
		budget:         budget,
	}
}

// BudgetResult holds the budget status after building context.
type BudgetResult struct {
	// Messages is the trimmed message list.
	Messages []ChatMessage
	// Tools is the tool definition list.
	Tools []ToolDef
	// Files lists file paths included in context.
	Files []string
	// Truncated indicates whether any content was truncated due to budget.
	Truncated bool
	// ToolCallsThisTurn is the number of tool calls included.
	ToolCallsThisTurn int
}

// EstimateTokens is a rough token estimator.
func EstimateTokens(text string) int {
	tokens := 0
	for _, r := range text {
		if r < 128 {
			tokens += 4
		} else {
			tokens += int(r/64) + 1
		}
	}
	return tokens / 4
}

// EnforceMessages trims the message list to MaxMessages, keeping system + recent.
func (b *BudgetAwareBuilder) EnforceMessages(messages []ChatMessage) []ChatMessage {
	maxMsg := b.budget.MaxMessages
	if maxMsg <= 0 {
		return messages
	}
	if len(messages) <= maxMsg {
		return messages
	}
	// Always keep system message first, then keep last (maxMsg-1) messages
	kept := make([]ChatMessage, 0, maxMsg)
	kept = append(kept, messages[0]) // system
	remaining := maxMsg - 1
	appendStart := len(messages) - remaining
	if appendStart < 1 {
		appendStart = 1
	}
	kept = append(kept, messages[appendStart:]...)
	return kept
}

// EnforceFiles trims file references to MaxFilesPerTurn.
func (b *BudgetAwareBuilder) EnforceFiles(files []string) []string {
	max := b.budget.MaxFilesPerTurn
	if max <= 0 || len(files) <= max {
		return files
	}
	return files[:max]
}

// EnforceToolResults trims tool results and summarizes oversized ones.
func (b *BudgetAwareBuilder) EnforceToolResults(messages []ChatMessage) []ChatMessage {
	maxChars := b.budget.MaxToolResultChars
	if maxChars <= 0 {
		return messages
	}

	result := make([]ChatMessage, 0, len(messages))
	for _, msg := range messages {
		if msg.Role == "tool" && len(msg.Content) > maxChars {
			msg.Content = SummarizeToolResult("", msg.Content, "", maxChars)
		}
		result = append(result, msg)
	}
	return result
}

// Enforce checks all budget constraints and returns the budget result.
func (b *BudgetAwareBuilder) Enforce(messages []ChatMessage, tools []ToolDef) BudgetResult {
	truncated := false

	// Enforce message count
	if len(messages) > b.budget.MaxMessages {
		messages = b.EnforceMessages(messages)
		truncated = true
	}

	// Enforce tool result size
	messages = b.EnforceToolResults(messages)

	// Estimate token usage
	tokenEstimate := EstimateTokens(b.estimateMessageContent(messages))
	if b.budget.MaxPromptTokens > 0 && tokenEstimate > b.budget.MaxPromptTokens-b.budget.ReservedOutputTokens {
		truncated = true
		messages = b.trimForTokens(messages)
	}

	// Count tool calls (naive: count "tool" role messages)
	toolCallCount := 0
	for _, m := range messages {
		if m.Role == "tool" {
			toolCallCount++
		}
	}

	return BudgetResult{
		Messages:          messages,
		Tools:             tools,
		Files:             nil,
		Truncated:         truncated,
		ToolCallsThisTurn: toolCallCount,
	}
}

func (b *BudgetAwareBuilder) estimateMessageContent(messages []ChatMessage) string {
	var total string
	for _, m := range messages {
		total += m.Content
	}
	return total
}

func (b *BudgetAwareBuilder) trimForTokens(messages []ChatMessage) []ChatMessage {
	// Keep: system, first user, last N tool results
	result := make([]ChatMessage, 0, len(messages))
	if len(messages) == 0 {
		return result
	}
	result = append(result, messages[0]) // system
	if len(messages) > 1 {
		result = append(result, messages[1]) // first user prompt
	}
	remaining := len(messages) - 2
	if remaining > 3 {
		remaining = 3
	}
	if remaining > 0 {
		result = append(result, messages[2:2+remaining]...)
	}
	return result
}

// SummarizeToolOutput is a convenience wrapper around SummarizeToolResult.
func (b *BudgetAwareBuilder) SummarizeToolOutput(stdout, stderr string, maxChars int) string {
	return SummarizeToolResult("", stdout, stderr, maxChars)
}
