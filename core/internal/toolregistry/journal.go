// GeoWork Go Core - Journal (Operation Audit Trail)

package toolregistry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// JournalAction represents the type of action recorded in the journal.
type JournalAction string

const (
	ActionPatchApply  JournalAction = "patch_apply"
	ActionPatchRevert JournalAction = "patch_revert"
	ActionCheckpoint  JournalAction = "checkpoint"
	ActionFileCreate  JournalAction = "file_create"
	ActionFileModify  JournalAction = "file_modify"
	ActionFileDelete  JournalAction = "file_delete"
	ActionRollback    JournalAction = "rollback"
	ActionManual      JournalAction = "manual"
)

// JournalEntry records a single operation for auditing and recovery.
type JournalEntry struct {
	ID        string         `json:"id"`
	Action    JournalAction  `json:"action"`
	TaskID    string         `json:"taskId,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
	PatchSet  *PatchSet      `json:"patchSet,omitempty"`
	FilePath  string         `json:"filePath,omitempty"`
	Success   bool           `json:"success"`
	Error     string         `json:"error,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
	Snapshot  map[string]any `json:"snapshot,omitempty"` // pre-operation state
}

// Journal provides an append-only audit trail for all patch operations.
type Journal struct {
	mu      sync.Mutex
	entries []*JournalEntry
	path    string // optional file path for persistence
}

// NewJournal creates a new in-memory Journal.
func NewJournal() *Journal {
	return &Journal{
		entries: make([]*JournalEntry, 0),
	}
}

// NewJournalToFile creates a Journal that persists entries to the given file path.
func NewJournalToFile(path string) (*Journal, error) {
	j := &Journal{
		entries: make([]*JournalEntry, 0),
		path:    path,
	}

	// Load existing entries if the file exists
	if data, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(data, &j.entries); err != nil {
			return nil, fmt.Errorf("load journal: %w", err)
		}
	}

	return j, nil
}

// Append records a new entry to the journal.
func (j *Journal) Append(entry *JournalEntry) {
	j.mu.Lock()
	defer j.mu.Unlock()

	if entry.ID == "" {
		entry.ID = fmt.Sprintf("j-%d", time.Now().UnixNano())
	}
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	j.entries = append(j.entries, entry)

	// Persist if file-backed
	if j.path != "" {
		j.persist()
	}
}

// GetEntries returns all entries.
func (j *Journal) GetEntries() []*JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	cpy := make([]*JournalEntry, len(j.entries))
	copy(cpy, j.entries)
	return cpy
}

// GetEntriesByAction returns entries filtered by action type.
func (j *Journal) GetEntriesByAction(action JournalAction) []*JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	var filtered []*JournalEntry
	for _, e := range j.entries {
		if e.Action == action {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// GetEntriesByTask returns entries for a specific task.
func (j *Journal) GetEntriesByTask(taskID string) []*JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	var filtered []*JournalEntry
	for _, e := range j.entries {
		if e.TaskID == taskID {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// GetLastEntry returns the most recent entry, or nil if empty.
func (j *Journal) GetLastEntry() *JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	if len(j.entries) == 0 {
		return nil
	}
	return j.entries[len(j.entries)-1]
}

// GetLastSuccess returns the most recent successful entry.
func (j *Journal) GetLastSuccess() *JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	for i := len(j.entries) - 1; i >= 0; i-- {
		if j.entries[i].Success {
			return j.entries[i]
		}
	}
	return nil
}

// GetFailures returns all failed entries.
func (j *Journal) GetFailures() []*JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	var failures []*JournalEntry
	for _, e := range j.entries {
		if !e.Success {
			failures = append(failures, e)
		}
	}
	return failures
}

// Summary returns a summary of journal activity.
func (j *Journal) Summary() map[string]any {
	j.mu.Lock()
	defer j.mu.Unlock()

	summary := map[string]any{
		"total":   len(j.entries),
		"success": 0,
		"failed":  0,
		"actions": map[string]int{},
	}

	for _, e := range j.entries {
		if e.Success {
			summary["success"] = summary["success"].(int) + 1
		} else {
			summary["failed"] = summary["failed"].(int) + 1
		}
		summary["actions"].(map[string]int)[string(e.Action)]++
	}

	return summary
}

// Clear removes all entries.
func (j *Journal) Clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.entries = make([]*JournalEntry, 0)
	if j.path != "" {
		j.persist()
	}
}

// persist writes the journal entries to disk.
func (j *Journal) persist() error {
	dir := filepath.Dir(j.path)
	if dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}

	data, err := json.Marshal(j.entries)
	if err != nil {
		return err
	}

	return os.WriteFile(j.path, data, 0o644)
}

// RevertJournal undoes all entries in reverse order (only reversible actions).
func (j *Journal) RevertJournal(basePath string) error {
	entries := j.GetEntries()
	if len(entries) == 0 {
		return nil
	}

	// Reverse order
	for i := len(entries) - 1; i >= 0; i-- {
		entry := entries[i]
		if entry.Action != ActionPatchApply && entry.Action != ActionFileModify {
			continue
		}

		if entry.PatchSet != nil && entry.Success {
			// Try to find the file and revert
			for path, patch := range entry.PatchSet.Patches {
				fullPath := filepath.Join(basePath, path)
				existingContent, err := readFileIfExists(fullPath)
				if err != nil {
					continue
				}
				// Apply reverted patch (swap insert/delete)
				_, err = RevertPatch(existingContent, patch)
				if err != nil {
					// Log failure but continue
					j.Append(&JournalEntry{
						Action:    ActionRollback,
						Timestamp: time.Now(),
						Success:   false,
						Error:     fmt.Sprintf("failed to revert %s: %v", path, err),
					})
				}
			}
		}
	}

	return nil
}
