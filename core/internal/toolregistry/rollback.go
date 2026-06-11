// GeoWork Go Core - Rollback and Recovery

package toolregistry

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// RollbackOperation represents a single reversible file change.
type RollbackOperation struct {
	FilePath   string
	OldContent string
	NewContent string
	Deleted    bool
}

// RollbackTracker tracks all file operations in a session for potential rollback.
type RollbackTracker struct {
	mu       sync.Mutex
	ops      []RollbackOperation
	basePath string
}

// NewRollbackTracker creates a new tracker for the given base path.
func NewRollbackTracker(basePath string) *RollbackTracker {
	return &RollbackTracker{
		ops:      make([]RollbackOperation, 0),
		basePath: basePath,
	}
}

// TrackAdd records a new file creation.
func (rt *RollbackTracker) TrackAdd(filePath, content string) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = append(rt.ops, RollbackOperation{
		FilePath:   filePath,
		NewContent: content,
		Deleted:    false,
	})
}

// TrackModify records a file modification.
func (rt *RollbackTracker) TrackModify(filePath, oldContent, newContent string) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = append(rt.ops, RollbackOperation{
		FilePath:   filePath,
		OldContent: oldContent,
		NewContent: newContent,
		Deleted:    false,
	})
}

// TrackDelete records a file deletion.
func (rt *RollbackTracker) TrackDelete(filePath, content string) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = append(rt.ops, RollbackOperation{
		FilePath:   filePath,
		OldContent: content,
		Deleted:    true,
	})
}

// GetOps returns all tracked operations.
func (rt *RollbackTracker) GetOps() []RollbackOperation {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	cpy := make([]RollbackOperation, len(rt.ops))
	copy(cpy, rt.ops)
	return cpy
}

// RollbackRevert applies all tracked operations in reverse (restores original state).
func (rt *RollbackTracker) RollbackRevert() error {
	ops := rt.GetOps()

	// Reverse order
	for i := len(ops) - 1; i >= 0; i-- {
		op := ops[i]
		fullPath := filepath.Join(rt.basePath, op.FilePath)

		if op.Deleted {
			// Re-create deleted file
			dir := filepath.Dir(fullPath)
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return fmt.Errorf("rollback: create dir for %s: %w", op.FilePath, err)
			}
			if err := os.WriteFile(fullPath, []byte(op.OldContent), 0o644); err != nil {
				return fmt.Errorf("rollback: restore %s: %w", op.FilePath, err)
			}
		} else {
			// Restore old content
			if op.OldContent == "" {
				// File was new, remove it
				if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
					return fmt.Errorf("rollback: delete %s: %w", op.FilePath, err)
				}
			} else {
				if err := os.WriteFile(fullPath, []byte(op.OldContent), 0o644); err != nil {
					return fmt.Errorf("rollback: restore %s: %w", op.FilePath, err)
				}
			}
		}
	}

	return nil
}

// RollbackUndo applies all tracked operations forward (re-applies the changes).
func (rt *RollbackTracker) RollbackUndo() error {
	ops := rt.GetOps()

	for _, op := range ops {
		fullPath := filepath.Join(rt.basePath, op.FilePath)

		if op.Deleted {
			// File was deleted, remove it (already gone, do nothing)
			_ = os.Remove(fullPath)
		} else if op.OldContent == "" {
			// File was new, keep it with current content
			dir := filepath.Dir(fullPath)
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return fmt.Errorf("undo: create dir for %s: %w", op.FilePath, err)
			}
			if err := os.WriteFile(fullPath, []byte(op.NewContent), 0o644); err != nil {
				return fmt.Errorf("undo: write %s: %w", op.FilePath, err)
			}
		} else {
			// File was modified, restore the modified content
			if err := os.WriteFile(fullPath, []byte(op.NewContent), 0o644); err != nil {
				return fmt.Errorf("undo: apply %s: %w", op.FilePath, err)
			}
		}
	}

	return nil
}

// RollbackState tracks the state for a full session rollback (like a stack frame).
type RollbackState struct {
	ID     string
	Ops    []RollbackOperation
	Traker *RollbackTracker
}

// CreateRollback creates a named rollback point.
func CreateRollback(basePath string) *RollbackTracker {
	return NewRollbackTracker(basePath)
}

// RestoreFromState restores files to a specific rollback state.
func RestoreFromState(traker *RollbackTracker) error {
	return traker.RollbackRevert()
}

// CommitRollback makes all tracked changes permanent by clearing the tracker.
func (rt *RollbackTracker) Commit() {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = make([]RollbackOperation, 0)
}

// Snapshot creates a point-in-time snapshot of specified files.
func SnapshotFiles(basePath string, filePaths []string) (map[string]string, error) {
	snap := make(map[string]string, len(filePaths))

	for _, fp := range filePaths {
		fullPath := filepath.Join(basePath, fp)
		data, err := os.ReadFile(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				snap[fp] = ""
				continue
			}
			return nil, fmt.Errorf("snapshot %s: %w", fp, err)
		}
		snap[fp] = string(data)
	}

	return snap, nil
}

// RestoreSnapshot restores files from a snapshot map.
func RestoreSnapshot(basePath string, snap map[string]string) error {
	for fp, content := range snap {
		fullPath := filepath.Join(basePath, fp)

		if content == "" {
			// Original was empty or non-existent, remove the file
			if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("restore snapshot: remove %s: %w", fp, err)
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
			return fmt.Errorf("restore snapshot: mkdir %s: %w", fp, err)
		}
		if err := os.WriteFile(fullPath, []byte(content), 0o644); err != nil {
			return fmt.Errorf("restore snapshot: write %s: %w", fp, err)
		}
	}

	return nil
}

// DiffContents computes a simple diff between two content strings.
func DiffContents(oldContent, newContent string) string {
	diffResult := ComputeUnifiedDiff(oldContent, newContent)
	return diffResult.ToUnifiedFormat(3)
}

// CollectChangedFiles scans the base path and returns files that differ from their original snapshot.
func CollectChangedFiles(basePath string, originalSnap map[string]string) ([]string, error) {
	var changed []string

	for fp := range originalSnap {
		fullPath := filepath.Join(basePath, fp)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			// File was deleted
			changed = append(changed, fp)
			continue
		}

		current, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, fmt.Errorf("collect changed: %w", err)
		}

		if string(current) != originalSnap[fp] {
			changed = append(changed, fp)
		}
	}

	return changed, nil
}

// CleanUpEmptyDirs removes empty directories up to (but not including) basePath.
func CleanUpEmptyDirs(basePath string) error {
	// Walk up and find empty dirs
	dirs := make(map[string]bool)
	filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(basePath, path)
		if err != nil {
			return nil
		}
		if rel == "." || rel == "" {
			return nil // skip basePath itself
		}
		dirs[path] = true
		return nil
	})

	// Remove empty dirs (deepest first)
	var sortedDirs []string
	for d := range dirs {
		sortedDirs = append(sortedDirs, d)
	}
	// Sort by depth descending
	for i := 0; i < len(sortedDirs); i++ {
		for j := i + 1; j < len(sortedDirs); j++ {
			if strings.Count(sortedDirs[j], string(os.PathSeparator)) > strings.Count(sortedDirs[i], string(os.PathSeparator)) {
				sortedDirs[i], sortedDirs[j] = sortedDirs[j], sortedDirs[i]
			}
		}
	}

	for _, d := range sortedDirs {
		entries, err := os.ReadDir(d)
		if err != nil {
			continue
		}
		if len(entries) == 0 {
			os.Remove(d)
		}
	}

	return nil
}
