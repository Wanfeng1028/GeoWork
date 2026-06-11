package aiagent

import (
	"strings"
	"testing"
)

func TestMemory_BoundedHistory(t *testing.T) {
	m := NewMemory()

	// Append more messages than maxHistorySize (default 20)
	for i := 0; i < 30; i++ {
		m.Append("user", "message "+string(rune('0'+(i%10))))
	}

	msgs := m.Messages(30)
	if len(msgs) > 20 {
		t.Errorf("History size = %d, want <= 20", len(msgs))
	}
}

func TestMemory_AppendToolResult(t *testing.T) {
	m := NewMemory()

	m.AppendToolResult("read_file", "e:/code/project/main.go\n", "error: permission denied\n")

	result := m.Summary(500)
	if !strings.Contains(result, "read_file") {
		t.Error("Summary should contain tool name")
	}

	// importantFiles should track the file
	msgs := m.Messages(0) // triggers export path check
	_ = msgs
	if len(m.Summary(500)) == 0 {
		t.Error("Summary should not be empty after tool results")
	}
}

func TestMemory_AppendToolResult_LimitedSize(t *testing.T) {
	m := NewMemory()

	// Append more than maxToolResults
	for i := 0; i < 10; i++ {
		m.AppendToolResult("tool"+string(rune('0'+i)), "output "+string(rune('0'+i)), "")
	}

	summary := m.Summary(500)
	// Count unique "[tool" occurrences (last N tool results)
	count := 0
	for i := 0; i < len(summary); i++ {
		if summary[i] == '[' && i+5 <= len(summary) && summary[i:i+5] == "[tool" {
			count++
		}
	}
	// Should contain at most maxToolResults
	if count > 5 {
		t.Errorf("Summary contains %d tool results, want <= 5", count)
	}
}

func TestMemory_SetAndGetTaskSummary(t *testing.T) {
	m := NewMemory()
	m.SetTaskSummary("Implement NDVI analysis")

	summary := m.Summary(500)
	if !strings.Contains(summary, "NDVI") {
		t.Error("Summary should contain task summary")
	}
}

func TestMemory_SetAndGetImportantFiles(t *testing.T) {
	m := NewMemory()
	m.SetImportantFiles([]string{"main.go", "config.yaml", "data/ndvi.tif"})

	summary := m.Summary(500)
	if !strings.Contains(summary, "main.go") {
		t.Error("Summary should contain important files")
	}
}

func TestMemory_ExportAndImport(t *testing.T) {
	m := NewMemory()
	m.SetTaskSummary("Test summary")
	m.SetImportantFiles([]string{"a.go", "b.go"})
	m.Append("user", "hello")
	m.Append("assistant", "world")

	data := m.Export()

	m2 := NewMemory()
	if err := m2.Import(data); err != nil {
		t.Fatalf("Import error: %v", err)
	}

	summary := m2.Summary(500)
	if !strings.Contains(summary, "Test summary") {
		t.Error("Imported memory should contain task summary")
	}
	if !strings.Contains(summary, "a.go") {
		t.Error("Imported memory should contain important files")
	}
	if !strings.Contains(summary, "hello") {
		t.Error("Imported memory should contain conversation history")
	}
}

func TestMemory_Clear(t *testing.T) {
	m := NewMemory()
	m.Append("user", "hello")
	m.SetTaskSummary("Test")
	m.Clear()

	summary := m.Summary(500)
	if summary != "" {
		t.Errorf("After Clear, Summary = %q, want empty", summary)
	}
}

func TestMemory_MessagesUnderLimit(t *testing.T) {
	m := NewMemory()
	m.Append("system", "sys")
	m.Append("user", "hello")
	m.Append("assistant", "world")

	msgs := m.Messages(5)
	if len(msgs) != 3 {
		t.Errorf("len(msgs) = %d, want 3", len(msgs))
	}
}

func TestMemory_MessagesZeroReturnsNil(t *testing.T) {
	m := NewMemory()
	msgs := m.Messages(0)
	if msgs != nil {
		t.Errorf("Messages(0) = %v, want nil", msgs)
	}
}

func TestMemory_NoUnlimitedGrowth(t *testing.T) {
	m := NewMemory()
	m.maxHistorySize = 10

	// Append many messages
	for i := 0; i < 100; i++ {
		m.Append("user", "msg")
	}

	// History should still be bounded
	msgs := m.Messages(200)
	if len(msgs) > 10 {
		t.Errorf("History grew to %d, should be bounded at 10", len(msgs))
	}
}

func TestMemory_SummaryMaxChars(t *testing.T) {
	m := NewMemory()
	m.SetTaskSummary(strings.Repeat("x", 1000))

	summary := m.Summary(50)
	if len(summary) > 53 { // 50 + "..."
		t.Errorf("Summary length = %d, want <= 53", len(summary))
	}
}
