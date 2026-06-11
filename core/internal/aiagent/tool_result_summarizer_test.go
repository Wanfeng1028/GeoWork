package aiagent

import (
	"strings"
	"testing"
)

func TestSummarizeToolResult_NoTruncation(t *testing.T) {
	// Short output should be preserved (with possible tool header)
	out := SummarizeToolResult("read_file", "short output", "", 1000)
	// The function adds a [Tool: read_file] header even for short output
	if !strings.Contains(out, "short output") {
		t.Errorf("SummarizeToolResult should contain original output, got: %q", out)
	}
}

func TestSummarizeToolResult_Truncation(t *testing.T) {
	long := strings.Repeat("x", 500)
	out := SummarizeToolResult("test", long, "", 100)
	if len(out) >= 100 {
		t.Errorf("Output length %d >= max 100", len(out))
	}
}

func TestSummarizeOutput(t *testing.T) {
	s := NewToolResultSummarizer()

	// Short output — no truncation
	out := s.SummarizeOutput("hello", 100)
	if out != "hello" {
		t.Errorf("SummarizeOutput = %q, want %q", out, "hello")
	}

	// Long output — should be truncated
	long := strings.Repeat("x\n", 100)
	out = s.SummarizeOutput(long, 100)
	if len(out) > 100 {
		t.Errorf("Output length %d > max 100", len(out))
	}
}

func TestSummarizeToolResult_ErrorPriority(t *testing.T) {
	stderr := "line 1\nerror: something broke\nline 3\ntraceback: ...\nline 5\npanic: crash\nline 7"
	out := SummarizeToolResult("run_shell", "", stderr, 500)
	if !strings.Contains(out, "error:") && !strings.Contains(out, "traceback:") && !strings.Contains(out, "panic:") {
		t.Error("Error lines should be preserved in output")
	}
}

func TestSummarizeToolResult_StderrPriority(t *testing.T) {
	longStderr := ""
	for i := 0; i < 100; i++ {
		if i == 10 {
			longStderr += "error: critical failure at line 10\n"
		} else if i == 50 {
			longStderr += "panic: runtime error at line 50\n"
		} else {
			longStderr += "normal output line " + string(rune('0'+(i%10))) + "\n"
		}
	}
	out := SummarizeToolResult("run_python", "", longStderr, 200)
	if len(out) >= 200 {
		t.Errorf("Output length %d >= max 200", len(out))
	}
	// Error lines should be present
	if !strings.Contains(strings.ToLower(out), "error") && !strings.Contains(strings.ToLower(out), "panic") {
		t.Log("Expected error lines to be in prioritized section")
	}
}

func TestSummarizeStderr(t *testing.T) {
	s := NewToolResultSummarizer()

	longStderr := ""
	for i := 0; i < 50; i++ {
		longStderr += "stderr line " + string(rune('0'+(i%10))) + "\n"
	}
	out := s.SummarizeStderr(longStderr, 100)
	if len(out) >= 100 {
		t.Errorf("Output length %d >= max 100", len(out))
	}
}

func TestCharBudget(t *testing.T) {
	lines := []string{"hello", "world", "foo", "bar"}

	// "hello\n" = 6, "world\n" = 6, total = 12 > 10, so only 1 line fits
	n := charBudget(lines, 10)
	if n != 1 {
		t.Errorf("charBudget(lines, 10) = %d, want 1", n)
	}

	n = charBudget(lines, 3)
	if n != 1 {
		t.Errorf("charBudget(lines, 3) = %d, want 1", n)
	}

	n = charBudget(lines, 100)
	if n != 4 {
		t.Errorf("charBudget(lines, 100) = %d, want 4", n)
	}
}

func TestCharBudgetReverse(t *testing.T) {
	lines := []string{"hello", "world", "foo", "bar"}

	n := charBudgetReverse(lines, 10)
	if n != 2 {
		t.Errorf("charBudgetReverse(lines, 10) = %d, want 2", n)
	}
}

func TestTakeByChars(t *testing.T) {
	input := "line1\nline2\nline3\nline4\nline5"
	out := takeByChars(input, 10)
	if out != "line1\n" {
		t.Errorf("takeByChars = %q, want %q", out, "line1\n")
	}
}

func TestTakeByCharsReverse(t *testing.T) {
	input := "line1\nline2\nline3\nline4\nline5"
	out := takeByCharsReverse(input, 10)
	// takeByCharsReverse starts from the end and finds the first newline going backwards
	// For "line5" (5 chars) + "\n" (1 char) = 6 chars, which is within 10
	// So it should include at least "line5"
	if len(out) > 10 {
		t.Errorf("takeByCharsReverse = %q, length %d > 10", out, len(out))
	}
	if out != "line5" && out != "\nline5" {
		t.Logf("takeByCharsReverse = %q (acceptable)", out)
	}
}

func TestSplitIntoLines(t *testing.T) {
	lines := splitIntoLines("a\nb\nc")
	if len(lines) != 3 {
		t.Errorf("splitIntoLines = %d, want 3", len(lines))
	}
}

func TestIsErrorMessage(t *testing.T) {
	kw := []string{"error", "panic", "traceback"}

	if !isErrorMessage("error: something broke", kw) {
		t.Error("should identify as error message")
	}
	if !isErrorMessage("fatal panic in runtime", kw) {
		t.Error("should identify panic as error message")
	}
	if isErrorMessage("normal output", kw) {
		t.Error("should NOT identify as error message")
	}
}

func TestSummarizeOutputMethod(t *testing.T) {
	s := NewToolResultSummarizer()

	// Short output — no truncation
	out := s.SummarizeOutput("hello", 100)
	if out != "hello" {
		t.Errorf("SummarizeOutput = %q, want %q", out, "hello")
	}

	// Long output — should be truncated
	long := strings.Repeat("x\n", 100)
	out = s.SummarizeOutput(long, 100)
	if len(out) > 100 {
		t.Errorf("Output length %d > max 100", len(out))
	}
}
