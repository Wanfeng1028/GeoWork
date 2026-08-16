// GeoWork Go Core - Diff Generator

package diff

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/pmezard/go-difflib/difflib"
	"go.uber.org/zap"
)

// Diff represents a file diff for approval.
type Diff struct {
	ID         string    `json:"id"`
	Path       string    `json:"path"`
	OldContent string    `json:"oldContent,omitempty"`
	NewContent string    `json:"newContent"`
	Status     string    `json:"status"` // pending | approved | rejected
	ToolCallID string    `json:"toolCallId,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	ApprovedAt time.Time `json:"approvedAt,omitempty"`
	Approver   string    `json:"approver,omitempty"`
	Unified    string    `json:"unified,omitempty"` // unified diff string
}

// DiffResult is the output of a diff generation.
type DiffResult struct {
	Diff       string          `json:"diff"` // unified diff format
	OldContent string          `json:"oldContent"`
	NewContent string          `json:"newContent"`
	Path       string          `json:"path"`
	LineCount  int             `json:"lineCount"`
	MonacoData json.RawMessage `json:"monacoPreview,omitempty"`
}

// Generator creates file diffs.
type Generator struct {
	log   *zap.Logger
	diffs map[string]*Diff
	mgr   *Manager
}

func NewGenerator(log *zap.Logger, mgr *Manager) *Generator {
	return &Generator{log: log, diffs: make(map[string]*Diff), mgr: mgr}
}

// Generate creates a unified diff between old and new content.
func (g *Generator) Generate(ctx context.Context, path, oldContent, newContent, toolCallID string) (*DiffResult, error) {
	// Generate unified diff
	unified := generateUnifiedDiff(path, oldContent, newContent)

	oldLines := countLines(oldContent)
	newLines := countLines(newContent)
	lineCount := newLines - oldLines

	// Create diff record
	d := &Diff{
		ID:         fmt.Sprintf("diff_%d", time.Now().UnixNano()),
		Path:       path,
		OldContent: oldContent,
		NewContent: newContent,
		Status:     "pending",
		ToolCallID: toolCallID,
		CreatedAt:  time.Now(),
	}

	// Save to manager
	if err := g.mgr.Save(d); err != nil {
		g.log.Warn("failed to save diff", zap.Error(err))
	}

	// Build Monaco preview data
	monacoData, _ := json.Marshal(map[string]any{
		"diff":       unified,
		"oldContent": oldContent,
		"newContent": newContent,
		"path":       path,
		"lineCount":  lineCount,
	})

	result := &DiffResult{
		Diff:       unified,
		OldContent: oldContent,
		NewContent: newContent,
		Path:       path,
		LineCount:  lineCount,
		MonacoData: monacoData,
	}

	// Store unified diff in the saved diff record
	d.Unified = unified

	g.log.Info("diff generated",
		zap.String("path", path),
		zap.Int("lineDelta", lineCount),
		zap.String("id", d.ID),
	)

	return result, nil
}

// generateUnifiedDiff produces a real LCS-based unified diff (multiple
// hunks, 3 lines of context) via go-difflib. doc/23 A4: the previous
// single-hunk prefix matcher collapsed mid-file edits into one giant
// hunk and mislabeled line ranges, which broke frontend diff viewers.
func generateUnifiedDiff(path, old, new string) string {
	unified, err := difflib.GetUnifiedDiffString(difflib.UnifiedDiff{
		A:        splitKeepNewline(old),
		B:        splitKeepNewline(new),
		FromFile: "a/" + path,
		ToFile:   "b/" + path,
		Context:  3,
	})
	if err != nil {
		return ""
	}
	return unified
}

// splitKeepNewline splits content into lines that each retain their trailing
// "\n" (so WriteUnifiedDiff emits them verbatim), without the phantom extra
// line that difflib.SplitLines appends for content ending in a newline. An
// empty string yields a nil slice so new/deleted files get the canonical
// "@@ -0,0 +1,N @@" / "@@ -1,N +0,0 @@" headers.
func splitKeepNewline(s string) []string {
	if s == "" {
		return nil
	}
	lines := strings.SplitAfter(s, "\n")
	if lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

// Unified returns a unified diff string between old and new content for the
// file at path. Exported so the orchestrator can embed it in diff.created
// events without constructing a Generator/Manager.
func Unified(path, old, new string) string {
	return generateUnifiedDiff(path, old, new)
}

func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	lines := []string{}
	current := ""
	for _, c := range s {
		if c == '\n' {
			lines = append(lines, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}

func countLines(s string) int {
	if s == "" {
		return 0
	}
	n := 1
	for _, c := range s {
		if c == '\n' {
			n++
		}
	}
	return n
}
