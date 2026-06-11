// GeoWork Go Core - Patch/Diff Data Structures and Algorithms

package toolregistry

import (
	"fmt"
	"strings"
	"time"
)

// DiffOperation represents a single line-level diff operation.
type DiffOperation int

const (
	DiffOpInsert DiffOperation = iota
	DiffOpDelete
	DiffOpKeep
)

func (d DiffOperation) String() string {
	switch d {
	case DiffOpInsert:
		return "insert"
	case DiffOpDelete:
		return "delete"
	case DiffOpKeep:
		return "keep"
	default:
		return "unknown"
	}
}

// DiffLine represents a single line in a unified diff.
type DiffLine struct {
	Operation DiffOperation
	Content   string
	LineNum   int // original file line number (0 if not applicable)
}

// Patch represents a complete patch against a single file.
type Patch struct {
	FilePath    string     `json:"filePath"`
	Description string     `json:"description"`
	Lines       []DiffLine `json:"lines"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// NewPatch creates a new Patch for the given file.
func NewPatch(filePath, description string) *Patch {
	return &Patch{
		FilePath:    filePath,
		Description: description,
		Lines:       []DiffLine{},
		CreatedAt:   time.Now(),
	}
}

// AddInsert appends an insert line at the given position.
func (p *Patch) AddInsert(content string, lineNum int) {
	p.Lines = append(p.Lines, DiffLine{Operation: DiffOpInsert, Content: content, LineNum: lineNum})
}

// AddDelete appends a delete line at the given position.
func (p *Patch) AddDelete(content string, lineNum int) {
	p.Lines = append(p.Lines, DiffLine{Operation: DiffOpDelete, Content: content, LineNum: lineNum})
}

// AddKeep appends a keep line at the given position.
func (p *Patch) AddKeep(content string, lineNum int) {
	p.Lines = append(p.Lines, DiffLine{Operation: DiffOpKeep, Content: content, LineNum: lineNum})
}

// DiffResult holds the result of computing a diff between old and new content.
type DiffResult struct {
	Lines []DiffLine
}

// ComputeUnifiedDiff computes a simple unified diff between old and new content.
// Returns a DiffResult with line-level operations.
func ComputeUnifiedDiff(oldContent, newContent string) *DiffResult {
	oldLines := splitLines(oldContent)
	newLines := splitLines(newContent)

	// LCS-based diff
	ops := lcsDiff(oldLines, newLines)

	result := &DiffResult{Lines: ops}
	// Assign line numbers to keep/delete lines
	lineNum := 1
	for i := range result.Lines {
		switch result.Lines[i].Operation {
		case DiffOpKeep:
			result.Lines[i].LineNum = lineNum
			lineNum++
		case DiffOpDelete:
			result.Lines[i].LineNum = lineNum
			lineNum++
		case DiffOpInsert:
			result.Lines[i].LineNum = 0
		}
	}

	return result
}

// splitLines splits content into lines, preserving trailing newline info.
func splitLines(content string) []string {
	if content == "" {
		return []string{}
	}
	lines := strings.Split(content, "\n")
	// Remove trailing empty string from final newline
	if strings.HasSuffix(content, "\n") && len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

// lcsDiff computes the longest common subsequence and returns diff operations.
// Returns operations in unified diff order: deletions followed by insertions.
func lcsDiff(oldLines, newLines []string) []DiffLine {
	m := len(oldLines)
	n := len(newLines)

	// Build LCS table
	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
	}

	for i := m - 1; i >= 0; i-- {
		for j := n - 1; j >= 0; j-- {
			if oldLines[i] == newLines[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else {
				dp[i][j] = max(dp[i+1][j], dp[i][j+1])
			}
		}
	}

	// Backtrack to find operations
	var ops []DiffLine
	i, j := 0, 0
	for i < m || j < n {
		if i < m && j < n && oldLines[i] == newLines[j] {
			ops = append(ops, DiffLine{Operation: DiffOpKeep, Content: oldLines[i]})
			i++
			j++
		} else if j < n && (i >= m || dp[i][j+1] >= dp[i+1][j]) {
			ops = append(ops, DiffLine{Operation: DiffOpInsert, Content: newLines[j]})
			j++
		} else if i < m && (j >= n || dp[i+1][j] > dp[i][j+1]) {
			ops = append(ops, DiffLine{Operation: DiffOpDelete, Content: oldLines[i]})
			i++
		}
	}

	return ops
}

// ToUnifiedFormat converts a DiffResult to unified diff string format.
func (d *DiffResult) ToUnifiedFormat(contextLines int) string {
	var sb strings.Builder
	for _, line := range d.Lines {
		switch line.Operation {
		case DiffOpKeep:
			sb.WriteString(fmt.Sprintf(" %s\n", line.Content))
		case DiffOpInsert:
			sb.WriteString(fmt.Sprintf("+%s\n", line.Content))
		case DiffOpDelete:
			sb.WriteString(fmt.Sprintf("-%s\n", line.Content))
		}
	}
	return sb.String()
}

// PatchSet contains multiple patches for a single commit/operation.
type PatchSet struct {
	ID          string            `json:"id"`
	Description string            `json:"description"`
	CreatedAt   time.Time         `json:"createdAt"`
	Patches     map[string]*Patch `json:"patches"`
}

// NewPatchSet creates a new empty PatchSet.
func NewPatchSet(description string) *PatchSet {
	return &PatchSet{
		Description: description,
		CreatedAt:   time.Now(),
		Patches:     make(map[string]*Patch),
	}
}

// AddPatch adds a patch to the set.
func (ps *PatchSet) AddPatch(p *Patch) {
	ps.Patches[p.FilePath] = p
}

// HasPatch checks if a patch exists for the given file path.
func (ps *PatchSet) HasPatch(filePath string) bool {
	_, ok := ps.Patches[filePath]
	return ok
}

// GetPatch returns the patch for a file, or nil if not found.
func (ps *PatchSet) GetPatch(filePath string) *Patch {
	return ps.Patches[filePath]
}

// RemovePatch removes a patch from the set.
func (ps *PatchSet) RemovePatch(filePath string) bool {
	if _, ok := ps.Patches[filePath]; !ok {
		return false
	}
	delete(ps.Patches, filePath)
	return true
}

// Validate checks that the PatchSet is valid.
func (ps *PatchSet) Validate() error {
	if ps.Description == "" {
		return fmt.Errorf("patch set description is required")
	}
	if len(ps.Patches) == 0 {
		return fmt.Errorf("patch set must contain at least one patch")
	}
	for path, p := range ps.Patches {
		if path == "" {
			return fmt.Errorf("patch file path cannot be empty")
		}
		if len(p.Lines) == 0 {
			return fmt.Errorf("patch for %s must contain at least one line", path)
		}
	}
	return nil
}

// ToUnifiedDiffString converts the entire PatchSet to a multi-file unified diff string.
func (ps *PatchSet) ToUnifiedDiffString() string {
	var sb strings.Builder
	var index int
	for path, patch := range ps.Patches {
		if index > 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(fmt.Sprintf("--- a/%s\n", path))
		sb.WriteString(fmt.Sprintf("+++ b/%s\n", path))

		// Extract only insert and delete lines for the hunk
		var diffLines []DiffLine
		for _, line := range patch.Lines {
			if line.Operation == DiffOpInsert || line.Operation == DiffOpDelete {
				diffLines = append(diffLines, line)
			}
		}
		if len(diffLines) > 0 {
			diffResult := &DiffResult{Lines: diffLines}
			sb.WriteString(diffResult.ToUnifiedFormat(0))
		}
		index++
	}
	return sb.String()
}
