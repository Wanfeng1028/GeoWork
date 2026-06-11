// GeoWork Go Core - Tool Audit Logger

package toolregistry

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// AuditEntry records a single tool invocation for audit purposes.
type AuditEntry struct {
	ID         string    `json:"id"`
	TaskID     string    `json:"taskId"`
	ToolName   string    `json:"toolName"`
	Args       string    `json:"args,omitempty"` // JSON-serialized args
	Success    bool      `json:"success"`
	Error      string    `json:"error,omitempty"`
	DurationMs int64     `json:"durationMs"`
	Approved   bool      `json:"approved"`
	Timestamp  time.Time `json:"timestamp"`
}

// AuditLog provides append-only recording of tool invocations.
type AuditLog struct {
	mu      sync.Mutex
	entries []AuditEntry
	dir     string // disk persistence directory
}

// NewAuditLog creates a new audit log with optional disk persistence.
func NewAuditLog() *AuditLog {
	return &AuditLog{
		entries: make([]AuditEntry, 0),
	}
}

// SetDiskDir enables disk persistence of audit entries.
func (a *AuditLog) SetDiskDir(dir string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.dir = dir
	os.MkdirAll(dir, 0755)
}

// Record logs a tool invocation.
func (a *AuditLog) Record(entry AuditEntry) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if entry.ID == "" {
		entry.ID = generateAuditID()
	}
	entry.Timestamp = time.Now()
	a.entries = append(a.entries, entry)

	// Persist to disk if dir is set
	if a.dir != "" {
		a.persistLocked(entry)
	}
}

// GetEntries returns all audit entries, optionally filtered by task ID.
func (a *AuditLog) GetEntries(taskID string) []AuditEntry {
	a.mu.Lock()
	defer a.mu.Unlock()

	if taskID == "" {
		out := make([]AuditEntry, len(a.entries))
		copy(out, a.entries)
		return out
	}

	var filtered []AuditEntry
	for _, e := range a.entries {
		if e.TaskID == taskID {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// GetRecent returns the last N audit entries.
func (a *AuditLog) GetRecent(n int) []AuditEntry {
	a.mu.Lock()
	defer a.mu.Unlock()

	if n >= len(a.entries) {
		out := make([]AuditEntry, len(a.entries))
		copy(out, a.entries)
		return out
	}
	return a.entries[len(a.entries)-n:]
}

// GetFailures returns audit entries where the tool call failed.
func (a *AuditLog) GetFailures(taskID string) []AuditEntry {
	a.mu.Lock()
	defer a.mu.Unlock()

	var failures []AuditEntry
	for _, e := range a.entries {
		if taskID != "" && e.TaskID != taskID {
			continue
		}
		if !e.Success {
			failures = append(failures, e)
		}
	}
	return failures
}

// Summary returns a compact summary of audit data.
func (a *AuditLog) Summary(taskID string) map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()

	total := 0
	success := 0
	failed := 0
	approved := 0
	totalDuration := int64(0)

	toolCounts := make(map[string]int)
	errorCounts := make(map[string]int)

	for _, e := range a.entries {
		if taskID != "" && e.TaskID != taskID {
			continue
		}
		total++
		if e.Success {
			success++
		} else {
			failed++
			errorCounts[e.Error]++
		}
		if e.Approved {
			approved++
		}
		totalDuration += e.DurationMs
		toolCounts[e.ToolName]++
	}

	return map[string]any{
		"total":        total,
		"success":      success,
		"failed":       failed,
		"approved":     approved,
		"avgDurationMs": int64(totalDuration / int64(max(total, 1))),
		"toolCounts":   toolCounts,
		"errorCounts":  errorCounts,
	}
}

// Clear removes all audit entries.
func (a *AuditLog) Clear() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.entries = a.entries[:0]
}

func (a *AuditLog) persistLocked(entry AuditEntry) {
	if a.dir == "" {
		return
	}
	path := filepath.Join(a.dir, entry.ID+".json")
	data, _ := json.Marshal(entry)
	os.WriteFile(path, data, 0644)
}

func generateAuditID() string {
	return "audit_" + time.Now().Format("20060102T150405") + "_" + time.Now().Format("000000000")
}
