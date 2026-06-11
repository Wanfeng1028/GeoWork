// GeoWork Go Core - Agent Memory

package aiagent

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// Memory stores agent conversation history and state with bounded growth.
type Memory struct {
	mu            sync.Mutex
	shortHistory  []ChatMessage // bounded conversation history
	taskSummary   string        // high-level task summary
	importantFiles []string     // files the agent has read/modified
	lastToolResults []string     // last N tool result summaries
	maxHistorySize int
	maxToolResults int
}

func NewMemory() *Memory {
	return &Memory{
		maxHistorySize: 20,
		maxToolResults: 5,
	}
}

// Append adds a message to the bounded short history.
func (m *Memory) Append(role, content string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.shortHistory = append(m.shortHistory, ChatMessage{
		Role:    role,
		Content: content,
	})

	// Enforce bounded history
	if len(m.shortHistory) > m.maxHistorySize {
		// Keep first 2 messages (system + user prompt), trim middle
		kept := make([]ChatMessage, 0, m.maxHistorySize)
		kept = append(kept, m.shortHistory[0], m.shortHistory[1])
		remaining := m.maxHistorySize - 2
		appendStart := len(m.shortHistory) - remaining
		if appendStart < 2 {
			appendStart = 2
		}
		kept = append(kept, m.shortHistory[appendStart:]...)
		m.shortHistory = kept
	}
}

// AppendToolResult stores a tool result summary and tracks referenced files.
func (m *Memory) AppendToolResult(toolName, stdout, stderr string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	summarized := summarizeStderr(stderr, 500)
	resultStr := fmt.Sprintf("[%s] stdout: %s", toolName, stdout)
	if stderr != "" {
		resultStr += fmt.Sprintf(" | stderr: %s", summarized)
	}

	m.lastToolResults = append(m.lastToolResults, resultStr)
	if len(m.lastToolResults) > m.maxToolResults {
		m.lastToolResults = m.lastToolResults[len(m.lastToolResults)-m.maxToolResults:]
	}

	// Extract file paths from stdout
	for _, line := range splitIntoLines(stdout) {
		if path := extractPath(line); path != "" {
			m.importantFiles = append(m.importantFiles, path)
		}
	}
	// Deduplicate
	seen := make(map[string]struct{})
	deduped := make([]string, 0, len(m.importantFiles))
	for _, f := range m.importantFiles {
		if _, ok := seen[f]; !ok {
			seen[f] = struct{}{}
			deduped = append(deduped, f)
		}
	}
	m.importantFiles = deduped
}

// SetTaskSummary records a high-level summary of the current task.
func (m *Memory) SetTaskSummary(summary string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.taskSummary = summary
}

// SetImportantFiles records files that are important for the current task.
func (m *Memory) SetImportantFiles(files []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.importantFiles = append([]string(nil), files...)
}

// Summary returns a compact representation of the memory suitable for context.
func (m *Memory) Summary(maxChars int) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	var parts []string

	if m.taskSummary != "" {
		parts = append(parts, "Task Summary: "+m.taskSummary)
	}
	if len(m.importantFiles) > 0 {
		parts = append(parts, "Important Files: "+fmt.Sprintf("%v", m.importantFiles))
	}
	if len(m.lastToolResults) > 0 {
		parts = append(parts, "Recent Tool Results:")
		for _, r := range m.lastToolResults {
			parts = append(parts, "  - "+r)
		}
	}
	if len(m.shortHistory) > 0 {
		parts = append(parts, "Recent Conversation:")
		// Show last 6 messages
		start := len(m.shortHistory) - 6
		if start < 0 {
			start = 0
		}
		for i := start; i < len(m.shortHistory); i++ {
			msg := m.shortHistory[i]
			truncated := msg.Content
			if len(truncated) > 200 {
				truncated = truncated[:200] + "..."
			}
			parts = append(parts, fmt.Sprintf("  [%s] %s", msg.Role, truncated))
		}
	}

	result := joinStrings(parts, "\n\n")
	if len(result) > maxChars {
		result = result[:maxChars] + "..."
	}
	return result
}

// Messages returns the last N short-history messages.
func (m *Memory) Messages(n int) []ChatMessage {
	m.mu.Lock()
	defer m.mu.Unlock()

	if n <= 0 {
		return nil
	}
	if n >= len(m.shortHistory) {
		out := make([]ChatMessage, len(m.shortHistory))
		copy(out, m.shortHistory)
		return out
	}
	return m.shortHistory[len(m.shortHistory)-n:]
}

// Export returns the full memory as JSON.
func (m *Memory) Export() []byte {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, _ := json.Marshal(map[string]any{
		"taskSummary":      m.taskSummary,
		"importantFiles":   m.importantFiles,
		"lastToolResults":  m.lastToolResults,
		"shortHistory":     m.shortHistory,
	})
	return data
}

// Import loads memory state from JSON.
func (m *Memory) Import(data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var state map[string]any
	if err := json.Unmarshal(data, &state); err != nil {
		return err
	}

	if ts, ok := state["taskSummary"].(string); ok {
		m.taskSummary = ts
	}
	if files, ok := state["importantFiles"].([]any); ok {
		m.importantFiles = make([]string, 0, len(files))
		for _, f := range files {
			if s, ok := f.(string); ok {
				m.importantFiles = append(m.importantFiles, s)
			}
		}
	}
	if results, ok := state["lastToolResults"].([]any); ok {
		m.lastToolResults = make([]string, 0, len(results))
		for _, r := range results {
			if s, ok := r.(string); ok {
				m.lastToolResults = append(m.lastToolResults, s)
			}
		}
	}
	if history, ok := state["shortHistory"].([]any); ok {
		m.shortHistory = make([]ChatMessage, 0, len(history))
		for _, h := range history {
			if hm, ok := h.(map[string]any); ok {
				if role, ok := hm["role"].(string); ok {
					if content, ok := hm["content"].(string); ok {
						m.shortHistory = append(m.shortHistory, ChatMessage{
							Role:    role,
							Content: content,
						})
					}
				}
			}
		}
	}
	return nil
}

// Clear removes all memory state.
func (m *Memory) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shortHistory = nil
	m.taskSummary = ""
	m.importantFiles = nil
	m.lastToolResults = nil
}

// Helper functions -------------------------------------------------------------------

func summarizeStderr(stderr string, maxChars int) string {
	if len(stderr) <= maxChars {
		return stderr
	}
	lines := splitIntoLines(stderr)
	var result []string
	for _, line := range lines {
		if strings.Contains(strings.ToLower(line), "error") ||
			strings.Contains(strings.ToLower(line), "traceback") ||
			strings.Contains(strings.ToLower(line), "panic") ||
			strings.Contains(strings.ToLower(line), "exception") {
			result = append(result, line)
		}
	}
	if len(result) > 3 {
		result = result[len(result)-3:]
	}
	output := strings.Join(result, "\n")
	if len(output) > maxChars {
		return output[:maxChars] + "..."
	}
	return output
}

func extractPath(line string) string {
	// Simple heuristic: look for path-like patterns
	trimmed := strings.TrimSpace(line)
	if strings.HasPrefix(trimmed, "/") || (len(trimmed) > 1 && trimmed[1] == ':') {
		parts := strings.Fields(trimmed)
		for _, p := range parts {
			if strings.Contains(p, "/") || strings.Contains(p, "\\") {
				return strings.Trim(p, "\"' \t")
			}
		}
	}
	return ""
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for i := 1; i < len(parts); i++ {
		result += sep + parts[i]
	}
	return result
}
