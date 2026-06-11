// GeoWork Go Core - Patch Application and Validation

package toolregistry

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ApplyResult records the outcome of applying a single patch.
type ApplyResult struct {
	FilePath    string `json:"filePath"`
	Success     bool   `json:"success"`
	OldContent  string `json:"oldContent,omitempty"`
	NewContent  string `json:"newContent,omitempty"`
	LineChanges int    `json:"lineChanges"`
	Error       string `json:"error,omitempty"`
}

// ApplyPatchSet applies a PatchSet to the filesystem.
// If dryRun is true, it validates but does not write any files.
func ApplyPatchSet(ps *PatchSet, basePath string, dryRun bool) ([]ApplyResult, error) {
	if err := ps.Validate(); err != nil {
		return nil, fmt.Errorf("patch set validation failed: %w", err)
	}

	results := make([]ApplyResult, 0, len(ps.Patches))
	snapshots := make(map[string]string) // for potential rollback

	for path, patch := range ps.Patches {
		fullPath := filepath.Join(basePath, path)

		result := ApplyResult{FilePath: path}

		// Read existing content or use empty string for new files
		oldContent, err := readFileIfExists(fullPath)
		if err != nil {
			result.Error = fmt.Sprintf("failed to read file: %v", err)
			results = append(results, result)
			return results, fmt.Errorf("applying patch for %s: %w", path, err)
		}
		result.OldContent = oldContent

		// Apply the patch
		newContent, err := applyPatch(oldContent, patch)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}
		result.NewContent = newContent

		if oldContent != newContent {
			result.Success = true
			lines := countLineChanges(oldContent, newContent)
			result.LineChanges = lines

			// Store snapshot for potential rollback
			snapshots[fullPath] = oldContent

			if !dryRun {
				// Ensure parent directory exists
				if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
					result.Error = fmt.Sprintf("failed to create directory: %v", err)
					results = append(results, result)
					continue
				}
				// Write new content
				if err := os.WriteFile(fullPath, []byte(newContent), 0o644); err != nil {
					result.Error = fmt.Sprintf("failed to write file: %v", err)
					results = append(results, result)
					continue
				}
			}
		}

		results = append(results, result)
	}

	return results, nil
}

// RollbackPatchSet restores files from their snapshots (reverse of ApplyPatchSet).
func RollbackPatchSet(snapshots map[string]string) error {
	for path, content := range snapshots {
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return fmt.Errorf("rollback failed for %s: %w", path, err)
		}
	}
	return nil
}

// validatePatch checks if a patch can be applied to the given content.
func validatePatch(_ string, patch *Patch) error {
	// A patch must contain at least one non-keep operation
	hasChange := false
	for _, line := range patch.Lines {
		if line.Operation != DiffOpKeep {
			hasChange = true
			break
		}
	}
	if !hasChange {
		return fmt.Errorf("patch for %s has no changes", patch.FilePath)
	}
	return nil
}

// applyPatch applies a Patch to existing content, returning the new content.
func applyPatch(oldContent string, patch *Patch) (string, error) {
	if err := validatePatch(oldContent, patch); err != nil {
		return "", err
	}

	var newLines []string

	for _, line := range patch.Lines {
		switch line.Operation {
		case DiffOpInsert:
			newLines = append(newLines, line.Content)
		case DiffOpDelete:
			// Skip this line (do not add it to newLines)
		case DiffOpKeep:
			newLines = append(newLines, line.Content)
		}
	}

	return strings.Join(newLines, "\n") + "\n", nil
}

// readFileIfExists reads a file if it exists, returns "" if not found.
func readFileIfExists(path string) (string, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return "", nil
	}
	return string(data), err
}

// countLineChanges counts net added/removed lines between two contents.
func countLineChanges(oldContent, newContent string) int {
	oldLines := splitLines(oldContent)
	newLines := splitLines(newContent)
	return len(newLines) - len(oldLines)
}

// RevertPatch reverses the changes of a patch (applies it a second time to undo).
func RevertPatch(content string, patch *Patch) (string, error) {
	// Compute the diff from old->new, then reverse it to get new->old
	diffResult := ComputeUnifiedDiff(content, "") // placeholder, we rebuild manually
	_ = diffResult

	// Actually, we reverse by swapping insert/delete and keeping same
	var reversed []DiffLine
	for _, line := range patch.Lines {
		switch line.Operation {
		case DiffOpInsert:
			reversed = append(reversed, DiffLine{Operation: DiffOpDelete, Content: line.Content, LineNum: line.LineNum})
		case DiffOpDelete:
			reversed = append(reversed, DiffLine{Operation: DiffOpInsert, Content: line.Content, LineNum: 0})
		case DiffOpKeep:
			reversed = append(reversed, DiffLine{Operation: DiffOpKeep, Content: line.Content, LineNum: line.LineNum})
		}
	}

	reversedPatch := &Patch{
		FilePath:  patch.FilePath,
		CreatedAt: patch.CreatedAt,
		Lines:     reversed,
	}
	return applyPatch(content, reversedPatch)
}

// PreviewPatch returns the diff content that would result from applying a patch.
func PreviewPatch(content string, patch *Patch) (string, error) {
	newContent, err := applyPatch(content, patch)
	if err != nil {
		return "", err
	}
	diffResult := ComputeUnifiedDiff(content, newContent)
	return diffResult.ToUnifiedFormat(0), nil
}
