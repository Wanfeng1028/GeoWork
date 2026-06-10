// GeoWork Go Core - Diff Generator

package diff

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

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
	Diff        string          `json:"diff"`          // unified diff format
	OldContent  string          `json:"oldContent"`
	NewContent  string          `json:"newContent"`
	Path        string          `json:"path"`
	LineCount   int             `json:"lineCount"`
	MonacoData  json.RawMessage `json:"monacoPreview,omitempty"`
}

// Generator creates file diffs.
type Generator struct {
	log      *zap.Logger
	diffs    map[string]*Diff
	mgr      *Manager
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

func generateUnifiedDiff(path, old, new string) string {
	// Simplified unified diff format
	oldLines := splitLines(old)
	newLines := splitLines(new)

	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("--- a/%s\n", path))
	buf.WriteString(fmt.Sprintf("+++ b/%s\n", path))

	// Find common prefix
	prefixLines := 0
	for i := 0; i < len(oldLines) && i < len(newLines); i++ {
		if oldLines[i] == newLines[i] {
			prefixLines++
		} else {
			break
		}
	}

	// Write common prefix context
	start := 0
	if prefixLines > 3 {
		start = prefixLines - 3
	}
	for i := start; i < prefixLines; i++ {
		buf.WriteString(fmt.Sprintf(" %s\n", oldLines[i]))
	}

	// Write removed lines
	if prefixLines < len(oldLines) {
		var diffHeader strings.Builder
		diffHeader.WriteString("@@ -")
		diffHeader.WriteString(fmt.Sprintf("%d,%d", prefixLines+1, len(oldLines)-prefixLines))
		diffHeader.WriteString(fmt.Sprintf(" +%d,%d @@\n", prefixLines+1, len(newLines)-prefixLines))
		buf.WriteString(diffHeader.String())
		for i := prefixLines; i < len(oldLines); i++ {
			buf.WriteString(fmt.Sprintf("-%s\n", oldLines[i]))
		}
		for i := prefixLines; i < len(newLines); i++ {
			buf.WriteString(fmt.Sprintf("+%s\n", newLines[i]))
		}
	} else {
		// New file
		var header strings.Builder
		header.WriteString("@@ -0,0 +")
		header.WriteString(fmt.Sprintf("%d @@\n", len(newLines)))
		buf.WriteString(header.String())
		for _, line := range newLines {
			buf.WriteString(fmt.Sprintf("+%s\n", line))
		}
	}

	return buf.String()
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
