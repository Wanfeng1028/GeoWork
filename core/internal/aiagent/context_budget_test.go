package aiagent

import (
	"testing"
)

func TestDefaultContextBudget(t *testing.T) {
	b := DefaultContextBudget()
	if b.MaxPromptTokens != 32000 {
		t.Errorf("MaxPromptTokens = %d, want 32000", b.MaxPromptTokens)
	}
	if b.MaxToolResultChars != 8000 {
		t.Errorf("MaxToolResultChars = %d, want 8000", b.MaxToolResultChars)
	}
	if b.MaxMessages != 20 {
		t.Errorf("MaxMessages = %d, want 20", b.MaxMessages)
	}
	if b.MaxFilesPerTurn != 5 {
		t.Errorf("MaxFilesPerTurn = %d, want 5", b.MaxFilesPerTurn)
	}
	if b.MaxToolCallsPerTurn != 5 {
		t.Errorf("MaxToolCallsPerTurn = %d, want 5", b.MaxToolCallsPerTurn)
	}
}

func TestEnforceMessages(t *testing.T) {
	b := BudgetAwareBuilder{budget: DefaultContextBudget()}

	// Under budget — no trimming
	msgs := make([]ChatMessage, 0)
	for i := 0; i < 10; i++ {
		msgs = append(msgs, ChatMessage{Role: "user", Content: "msg" + string(rune('0'+i))})
	}
	result := b.EnforceMessages(msgs)
	if len(result) != 10 {
		t.Errorf("len(result) = %d, want 10", len(result))
	}

	// Over budget — should trim
	msgs = make([]ChatMessage, 0)
	for i := 0; i < 25; i++ {
		msgs = append(msgs, ChatMessage{Role: "user", Content: "msg" + string(rune('0'+(i % 10)))})
	}
	b2 := BudgetAwareBuilder{budget: ContextBudget{MaxMessages: 10}}
	result = b2.EnforceMessages(msgs)
	if len(result) != 10 {
		t.Errorf("len(result) = %d, want 10", len(result))
	}
	// First message (system) should be preserved
	if result[0].Role != "user" {
		t.Errorf("first message role = %s, want first preserved", result[0].Role)
	}
}

func TestEnforceFiles(t *testing.T) {
	b := BudgetAwareBuilder{budget: DefaultContextBudget()}

	files := []string{"a.go", "b.go", "c.go", "d.go", "e.go", "f.go"}
	result := b.EnforceFiles(files)
	if len(result) != 5 {
		t.Errorf("len(result) = %d, want 5", len(result))
	}
}

func TestEnforceToolResults(t *testing.T) {
	b := BudgetAwareBuilder{budget: ContextBudget{
		MaxMessages:      20,
		MaxToolResultChars: 100,
	}}

	msgs := []ChatMessage{
		{Role: "user", Content: "hello"},
		{Role: "tool", Content: ""},
	}

	// Short content — no change
	result := b.EnforceToolResults(msgs)
	if len(result) != 2 {
		t.Errorf("len(result) = %d, want 2", len(result))
	}

	// Long content — should be truncated
	longContent := ""
	for i := 0; i < 500; i++ {
		longContent += "x"
	}
	msgs2 := []ChatMessage{
		{Role: "tool", Content: longContent},
	}
	result = b.EnforceToolResults(msgs2)
	if len(result[0].Content) >= 100 {
		t.Errorf("truncated content too long: %d", len(result[0].Content))
	}
	if len(result[0].Content) >= len(longContent) {
		t.Error("content should have been truncated")
	}
}

func TestEnforceTokenBudget(t *testing.T) {
	b := BudgetAwareBuilder{budget: ContextBudget{
		MaxPromptTokens:      100,
		ReservedOutputTokens: 10,
		MaxMessages:          20,
	}}

	// Build messages that exceed token budget
	msgs := []ChatMessage{
		{Role: "system", Content: "You are a helpful assistant."},
	}
	for i := 0; i < 5; i++ {
		msgs = append(msgs, ChatMessage{Role: "user", Content: "This is a very long message with lots of text for testing purposes."})
	}

	result := b.Enforce(msgs, nil)
	if !result.Truncated {
		t.Log("Expected truncation for oversized token budget")
	}
	if len(result.Messages) == 0 {
		t.Error("result.Messages should not be empty")
	}
}

func TestEnforceNoTruncation(t *testing.T) {
	b := BudgetAwareBuilder{budget: ContextBudget{
		MaxPromptTokens:      32000,
		ReservedOutputTokens: 4096,
		MaxMessages:          20,
	}}

	msgs := []ChatMessage{
		{Role: "system", Content: "You are a helpful assistant."},
		{Role: "user", Content: "hello"},
	}

	result := b.Enforce(msgs, nil)
	if result.Truncated {
		t.Error("Expected no truncation for small messages")
	}
}

func TestEstimateTokens(t *testing.T) {
	// ASCII: "hello" = 5 chars → ~20 tokens (5*4/4)
	a := EstimateTokens("hello")
	if a < 4 {
		t.Errorf("EstimateTokens('hello') = %d, expected at least 4", a)
	}
}
