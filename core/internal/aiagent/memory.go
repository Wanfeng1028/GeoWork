// GeoWork Go Core - Agent Memory

package aiagent

import (
	"encoding/json"
	"sync"
)

// Memory stores agent conversation history and state.
type Memory struct {
	mu       sync.Mutex
	history  []string
	maxSize  int
}

func NewMemory() *Memory {
	return &Memory{maxSize: 100}
}

// Append adds a message to history.
func (m *Memory) Append(role, content string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.history = append(m.history, role+": "+content)
	if len(m.history) > m.maxSize {
		m.history = m.history[len(m.history)-m.maxSize:]
	}
}

// Export returns the history as JSON.
func (m *Memory) Export() []byte {
	m.mu.Lock()
	defer m.mu.Unlock()
	data, _ := json.Marshal(m.history)
	return data
}

// Import loads history from JSON.
func (m *Memory) Import(data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return json.Unmarshal(data, &m.history)
}

// Last returns the last N messages.
func (m *Memory) Last(n int) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n > len(m.history) {
		n = len(m.history)
	}
	if n <= 0 {
		return nil
	}
	start := len(m.history) - n
	if start < 0 {
		start = 0
	}
	return m.history[start:]
}

// Clear removes all history.
func (m *Memory) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.history = nil
}
