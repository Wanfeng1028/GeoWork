// GeoWork Go Core - Diff Apply/Reject

package diff

import (
	"os"
	"path/filepath"
	"strings"
)

// Apply applies a diff to the old content, producing new content.
func Apply(d *Diff) (string, error) {
	patch, err := ParseUnifiedDiff(d.Unified)
	if err != nil {
		// Fallback: just return new content
		return d.NewContent, nil
	}

	oldLines := splitLines(d.OldContent)
	newLines := make([]string, 0, len(oldLines))
	idx := 0

	for _, hunk := range patch.Hunks {
		// Add context and non-modified lines before this hunk
		for idx < hunk.OldStart-1 && idx < len(oldLines) {
			newLines = append(newLines, oldLines[idx])
			idx++
		}

		// Process hunk lines
		for _, hl := range hunk.Line {
			switch hl.Type {
			case ' ':
				newLines = append(newLines, hl.Text)
				idx++
			case '+':
				newLines = append(newLines, hl.Text)
			case '-':
				idx++
			}
		}
	}

	// Add remaining lines
	for idx < len(oldLines) {
		newLines = append(newLines, oldLines[idx])
		idx++
	}

	return joinLines(newLines), nil
}

// Reject removes a diff from consideration, keeping original content.
func Reject(diff *Diff) string {
	return diff.OldContent
}

// ApplyAll applies multiple pending diffs to their respective files.
func ApplyAll(diffs []*Diff, workspaceDir string) error {
	for _, d := range diffs {
		if d.Status != "pending" {
			continue
		}

		// Apply the diff
		content, err := Apply(d)
		if err != nil {
			return err
		}

		// Write to file
		fullPath := filepath.Join(workspaceDir, d.Path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return err
		}

		d.Status = "approved"
	}
	return nil
}

// RejectAll rejects all pending diffs.
func RejectAll(diffs []*Diff) {
	for _, d := range diffs {
		if d.Status == "pending" {
			d.Status = "rejected"
		}
	}
}

// SavePatch saves the diff as a .patch file.
func SavePatch(d *Diff, path string) error {
	return os.WriteFile(path, []byte(d.Unified), 0644)
}

// CreateBranchSnapshot creates a copy of workspace files for branch rollback.
func CreateBranchSnapshot(workspaceDir, snapshotDir string) error {
	snapshotDir = filepath.Join(snapshotDir, "snapshot_"+filePathSafe(workspaceDir))

	return filepath.Walk(workspaceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}

		rel, _ := filepath.Rel(workspaceDir, path)
		outPath := filepath.Join(snapshotDir, rel)
		if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
			return err
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(outPath, data, 0644)
	})
}

func joinLines(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	var buf strings.Builder
	for i, l := range lines {
		if i > 0 {
			buf.WriteByte('\n')
		}
		buf.WriteString(l)
	}
	return buf.String()
}

func filePathSafe(path string) string {
	safe := path
	for _, c := range []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"} {
		safe = strings.ReplaceAll(safe, c, "_")
	}
	return safe
}
