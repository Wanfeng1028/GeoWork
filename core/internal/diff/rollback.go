// GeoWork Go Core - Rollback and Recovery

package diff

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type RollbackOperation struct {
	FilePath   string
	OldContent string
	NewContent string
	Deleted    bool
}

type RollbackTracker struct {
	mu       sync.Mutex
	ops      []RollbackOperation
	basePath string
}

func NewRollbackTracker(basePath string) *RollbackTracker {
	return &RollbackTracker{
		ops:      make([]RollbackOperation, 0),
		basePath: basePath,
	}
}

func (rt *RollbackTracker) TrackAdd(filePath, content string) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = append(rt.ops, RollbackOperation{
		FilePath:   filePath,
		NewContent: content,
		Deleted:    false,
	})
}

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

func (rt *RollbackTracker) TrackDelete(filePath, content string) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = append(rt.ops, RollbackOperation{
		FilePath:   filePath,
		OldContent: content,
		Deleted:    true,
	})
}

func (rt *RollbackTracker) GetOps() []RollbackOperation {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	cpy := make([]RollbackOperation, len(rt.ops))
	copy(cpy, rt.ops)
	return cpy
}

func (rt *RollbackTracker) RollbackRevert() error {
	ops := rt.GetOps()

	for i := len(ops) - 1; i >= 0; i-- {
		op := ops[i]
		fullPath := filepath.Join(rt.basePath, op.FilePath)

		if op.Deleted {
			dir := filepath.Dir(fullPath)
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return fmt.Errorf("rollback: create dir for %s: %w", op.FilePath, err)
			}
			if err := os.WriteFile(fullPath, []byte(op.OldContent), 0o644); err != nil {
				return fmt.Errorf("rollback: restore %s: %w", op.FilePath, err)
			}
		} else {
			if op.OldContent == "" {
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

func (rt *RollbackTracker) RollbackUndo() error {
	ops := rt.GetOps()

	for _, op := range ops {
		fullPath := filepath.Join(rt.basePath, op.FilePath)

		if op.Deleted {
			_ = os.Remove(fullPath)
		} else if op.OldContent == "" {
			dir := filepath.Dir(fullPath)
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return fmt.Errorf("undo: create dir for %s: %w", op.FilePath, err)
			}
			if err := os.WriteFile(fullPath, []byte(op.NewContent), 0o644); err != nil {
				return fmt.Errorf("undo: write %s: %w", op.FilePath, err)
			}
		} else {
			if err := os.WriteFile(fullPath, []byte(op.NewContent), 0o644); err != nil {
				return fmt.Errorf("undo: apply %s: %w", op.FilePath, err)
			}
		}
	}

	return nil
}

type RollbackState struct {
	ID      string
	Ops     []RollbackOperation
	Tracker *RollbackTracker
}

func CreateRollback(basePath string) *RollbackTracker {
	return NewRollbackTracker(basePath)
}

func RestoreFromState(tracker *RollbackTracker) error {
	return tracker.RollbackRevert()
}

func (rt *RollbackTracker) Commit() {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	rt.ops = make([]RollbackOperation, 0)
}

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

func RestoreSnapshot(basePath string, snap map[string]string) error {
	for fp, content := range snap {
		fullPath := filepath.Join(basePath, fp)

		if content == "" {
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

func DiffContents(oldContent, newContent string) string {
	return generateUnifiedDiff("", oldContent, newContent)
}

func DiffSnapshots(snap1, snap2 map[string]string) string {
	var lines []string

	allFiles := make(map[string]bool)
	for f := range snap1 {
		allFiles[f] = true
	}
	for f := range snap2 {
		allFiles[f] = true
	}

	for f := range allFiles {
		_, in1 := snap1[f]
		_, in2 := snap2[f]

		if in1 && !in2 {
			lines = append(lines, fmt.Sprintf("- %s (deleted)", f))
		} else if !in1 && in2 {
			lines = append(lines, fmt.Sprintf("+ %s (added)", f))
		} else if snap1[f] != snap2[f] {
			lines = append(lines, fmt.Sprintf("~ %s (modified)", f))
		}
	}

	if len(lines) == 0 {
		return "no differences"
	}

	return fmt.Sprintf("%d file(s) differ:\n", len(lines)) + joinStringSlice(lines, "\n")
}

func CollectChangedFiles(basePath string, originalSnap map[string]string) ([]string, error) {
	var changed []string

	for fp := range originalSnap {
		fullPath := filepath.Join(basePath, fp)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
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

func CleanUpEmptyDirs(basePath string) error {
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
			return nil
		}
		dirs[path] = true
		return nil
	})

	var sortedDirs []string
	for d := range dirs {
		sortedDirs = append(sortedDirs, d)
	}
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

func joinStringSlice(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for i := 1; i < len(ss); i++ {
		result += sep + ss[i]
	}
	return result
}
