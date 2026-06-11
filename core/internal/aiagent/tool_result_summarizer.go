// GeoWork Go Core - Tool Result Summarizer

package aiagent

import (
	"bufio"
	"fmt"
	"strings"
)

// ToolResultSummarizer produces a condensed version of tool stdout/stderr.
type ToolResultSummarizer struct{}

func NewToolResultSummarizer() *ToolResultSummarizer {
	return &ToolResultSummarizer{}
}

// SummarizeToolResult returns a truncated/summarized version of tool output.
// Rules:
// - If total chars <= maxChars, return the original output unchanged.
// - Otherwise keep full error lines first, then fill remaining budget with head/tail.
// - Error keywords get priority: error, failed, traceback, panic, exception.
func SummarizeToolResult(toolName string, stdout string, stderr string, maxChars int) string {
	result := &strings.Builder{}

	// Header
	if toolName != "" {
		result.WriteString(fmt.Sprintf("[Tool: %s]\n", toolName))
	}

	// Merge stdout and stderr with labels
	stdoutParts := splitIntoLines(stdout)
	stderrParts := splitIntoLines(stderr)

	// Separate error lines from normal lines
	var errorLines, normalLines []string
	errorKeywords := []string{
		"error", "failed", "traceback", "panic", "exception",
		"err", "fatal", "stack trace", "segmentation fault",
	}
	for _, line := range stdoutParts {
		normalized := strings.ToLower(line)
		if isErrorMessage(normalized, errorKeywords) {
			errorLines = append(errorLines, "stdout: "+line)
		} else if line != "" {
			normalLines = append(normalLines, "stdout: "+line)
		}
	}
	for _, line := range stderrParts {
		normalized := strings.ToLower(line)
		if isErrorMessage(normalized, errorKeywords) {
			errorLines = append(errorLines, "stderr: "+line)
		} else if line != "" {
			normalLines = append(normalLines, "stderr: "+line)
		}
	}

	// Budget: reserve space for truncation indicator
	indicator := "\n--- output truncated ---\n"
	budget := maxChars - len(result.String()) - len(indicator)
	if budget <= 0 {
		budget = maxChars
	}

	// Always include all error lines first
	var written int
	for _, line := range errorLines {
		if written+len(line) > budget {
			break
		}
		result.WriteString(line)
		result.WriteByte('\n')
		written += len(line) + 1
	}

	// Fill remaining budget with head/tail of normal lines
	remaining := budget - written
	if len(normalLines) > 0 && remaining > 0 {
		headChars := remaining / 2
		tailChars := remaining - headChars
		headLines := charBudget(normalLines, headChars)
		tailLines := charBudgetReverse(normalLines, tailChars)

		// Deduplicate: if head covers all, skip tail
		if headLines >= len(normalLines) {
			tailLines = 0
		} else if headLines+tailLines > len(normalLines) {
			tailLines = len(normalLines) - headLines
			if tailLines < 0 {
				tailLines = 0
			}
		}

		for _, line := range normalLines[:headLines] {
			if written+len(line)+1 > maxChars {
				break
			}
			result.WriteString(line)
			result.WriteByte('\n')
			written += len(line) + 1
		}

		if headLines < len(normalLines) && tailLines > 0 {
			// Write truncation indicator
			if written+len(indicator) <= maxChars {
				result.WriteString(indicator)
				written += len(indicator)
			}
			startIdx := len(normalLines) - tailLines
			for _, line := range normalLines[startIdx:] {
				if written+len(line)+1 > maxChars {
					break
				}
				result.WriteString(line)
				result.WriteByte('\n')
				written += len(line) + 1
			}
		}
	}

	output := result.String()
	// Strip trailing newline
	output = strings.TrimRight(output, "\n")
	return output
}

// Summarize is a method version that formats a structured result.
func (s *ToolResultSummarizer) Summarize(toolName string, stdout string, stderr string, maxChars int) string {
	return SummarizeToolResult(toolName, stdout, stderr, maxChars)
}

// SummarizeOutput trims a single output string (stdout or stderr) according to the
// head-tail-with-truncation-indicator rule.
func (s *ToolResultSummarizer) SummarizeOutput(output string, maxChars int) string {
	if len(output) <= maxChars {
		return output
	}

	half := maxChars / 2
	indicator := "\n... (truncated) ...\n"

	// Build head: take first half characters worth of full lines
	head := takeByChars(output, half)
	// Build tail: take last half characters worth of full lines
	remaining := maxChars - len(head) - len(indicator)
	if remaining <= 0 {
		remaining = half
	}
	tail := takeByCharsReverse(output, remaining)

	return head + indicator + tail
}

// SummarizeStderr prioritizes error/stack-trace lines in stderr output.
func (s *ToolResultSummarizer) SummarizeStderr(stderr string, maxChars int) string {
	lines := splitIntoLines(stderr)
	errorKeywords := []string{
		"error", "failed", "traceback", "panic", "exception", "fatal",
		"stack trace", "segfault", "panic:", "uncaught",
	}
	var errorLines, normalLines []string
	for _, line := range lines {
		if strings.ToLower(line) != "" {
			if isErrorMessage(strings.ToLower(line), errorKeywords) {
				errorLines = append(errorLines, line)
			} else {
				normalLines = append(normalLines, line)
			}
		}
	}

	var result strings.Builder
	budget := maxChars
	indicator := "\n... stderr truncated ... \n"

	// Always keep error lines first
	for _, line := range errorLines {
		lineStr := line + "\n"
		if result.Len()+len(lineStr) > budget {
			break
		}
		result.WriteString(lineStr)
	}

	// Fill remaining with head/tail of normal lines
	remaining := budget - result.Len()
	if remaining > 0 && len(normalLines) > 0 {
		headChars := remaining / 2
		tailChars := remaining - headChars - len(indicator)
		headCount := charBudget(normalLines, headChars)
		tailCount := charBudgetReverse(normalLines, tailChars)

		if headCount >= len(normalLines) {
			tailCount = 0
		} else if headCount+tailCount > len(normalLines) {
			tailCount = len(normalLines) - headCount
			if tailCount < 0 {
				tailCount = 0
			}
		}

		for _, line := range normalLines[:headCount] {
			lineStr := line + "\n"
			if result.Len()+len(lineStr) > budget {
				break
			}
			result.WriteString(lineStr)
		}

		if headCount < len(normalLines) {
			if result.Len()+len(indicator) <= budget {
				result.WriteString(indicator)
			}
			startIdx := len(normalLines) - tailCount
			for _, line := range normalLines[startIdx:] {
				lineStr := line + "\n"
				if result.Len()+len(lineStr) > budget {
					break
				}
				result.WriteString(lineStr)
			}
		}
	}

	return strings.TrimRight(result.String(), "\n")
}

// Helpers -------------------------------------------------------------------

func isErrorMessage(line string, keywords []string) bool {
	for _, kw := range keywords {
		if strings.Contains(line, kw) {
			return true
		}
	}
	return false
}

func splitIntoLines(s string) []string {
	var lines []string
	scanner := bufio.NewScanner(strings.NewReader(s))
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	return lines
}

// takeByChars returns a prefix of `s` that is at most `maxChars` long,
// truncated at a line boundary.
func takeByChars(s string, maxChars int) string {
	if len(s) <= maxChars {
		return s
	}
	cut := strings.LastIndex(s[:maxChars], "\n")
	if cut < 0 {
		return s[:maxChars]
	}
	return s[:cut+1]
}

// takeByCharsReverse returns a suffix of `s` that is at most `maxChars` long,
// truncated at a line boundary.
func takeByCharsReverse(s string, maxChars int) string {
	totalLen := len(s)
	if totalLen <= maxChars {
		return s
	}
	start := totalLen - maxChars
	cut := strings.Index(s[start:], "\n")
	if cut < 0 {
		return s[start:]
	}
	return s[start+cut:]
}

// charBudget returns how many full lines from `lines` fit within `maxChars`.
func charBudget(lines []string, maxChars int) int {
	var total int
	count := 0
	for _, line := range lines {
		lineWithNewline := len(line) + 1 // +1 for newline
		if total+lineWithNewline > maxChars && count > 0 {
			break
		}
		total += lineWithNewline
		count++
	}
	return count
}

// charBudgetReverse returns how many full lines from the end of `lines` fit within `maxChars`.
func charBudgetReverse(lines []string, maxChars int) int {
	var total int
	count := 0
	for i := len(lines) - 1; i >= 0; i-- {
		lineWithNewline := len(lines[i]) + 1
		if total+lineWithNewline > maxChars && count > 0 {
			break
		}
		total += lineWithNewline
		count++
	}
	return count
}
