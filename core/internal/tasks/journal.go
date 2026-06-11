// GeoWork Go Core - Task Journal (Operation Audit Trail)

package tasks

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

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

type PatchRecord struct {
	FilePath string `json:"filePath"`
	OldData  string `json:"oldData,omitempty"`
	NewData  string `json:"newData,omitempty"`
}

type JournalEntry struct {
	ID        string         `json:"id"`
	Action    JournalAction  `json:"action"`
	TaskID    string         `json:"taskId,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
	Patch     *PatchRecord   `json:"patch,omitempty"`
	FilePath  string         `json:"filePath,omitempty"`
	Success   bool           `json:"success"`
	Error     string         `json:"error,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
	Snapshot  map[string]any `json:"snapshot,omitempty"`
}

type Journal struct {
	mu      sync.Mutex
	entries []*JournalEntry
	path    string
}

func NewJournal() *Journal {
	return &Journal{
		entries: make([]*JournalEntry, 0),
	}
}

func NewJournalToFile(path string) (*Journal, error) {
	j := &Journal{
		entries: make([]*JournalEntry, 0),
		path:    path,
	}

	if data, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(data, &j.entries); err != nil {
			return nil, fmt.Errorf("load journal: %w", err)
		}
	}

	return j, nil
}

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

	if j.path != "" {
		j.persist()
	}
}

func (j *Journal) GetEntries() []*JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	cpy := make([]*JournalEntry, len(j.entries))
	copy(cpy, j.entries)
	return cpy
}

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

func (j *Journal) GetLastEntry() *JournalEntry {
	j.mu.Lock()
	defer j.mu.Unlock()

	if len(j.entries) == 0 {
		return nil
	}
	return j.entries[len(j.entries)-1]
}

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

func (j *Journal) Clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.entries = make([]*JournalEntry, 0)
	if j.path != "" {
		j.persist()
	}
}

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

func (j *Journal) RevertJournal(basePath string) error {
	entries := j.GetEntries()
	if len(entries) == 0 {
		return nil
	}

	for i := len(entries) - 1; i >= 0; i-- {
		entry := entries[i]
		if entry.Action != ActionPatchApply && entry.Action != ActionFileModify {
			continue
		}

		if entry.Patch != nil && entry.Success && entry.Patch.OldData != "" {
			fullPath := filepath.Join(basePath, entry.Patch.FilePath)
			if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
				j.Append(&JournalEntry{
					Action:    ActionRollback,
					Timestamp: time.Now(),
					Success:   false,
					Error:     fmt.Sprintf("failed to create dir for %s: %v", entry.Patch.FilePath, err),
				})
				continue
			}
			if err := os.WriteFile(fullPath, []byte(entry.Patch.OldData), 0o644); err != nil {
				j.Append(&JournalEntry{
					Action:    ActionRollback,
					Timestamp: time.Now(),
					Success:   false,
					Error:     fmt.Sprintf("failed to revert %s: %v", entry.Patch.FilePath, err),
				})
			}
		}
	}

	return nil
}
