// GeoWork Go Core - Diff recorder tests (doc/23 A4)

package toolregistry

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"go.uber.org/zap"
)

// writePolicy grants the "write" permission that write_file requires
// (registry.Execute enforces CheckPermission against the context policy).
func writePolicy() *PermissionPolicy {
	return &PermissionPolicy{DefaultLevel: "full"}
}

// write_file must capture the pre-write content and report it through the
// context recorder so the orchestrator can emit diff.created. A missing
// file reads as "" (new-file diff).
func TestDiffRecorder_WriteFileReportsBeforeAfter(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "out.txt")
	if err := os.WriteFile(target, []byte("old content"), 0644); err != nil {
		t.Fatal(err)
	}

	reg := NewRegistry(zap.NewNop())
	if err := RegisterBuiltinTools(reg); err != nil {
		t.Fatal(err)
	}

	var got []DiffRecord
	ctx := WithDiffRecorder(WithPolicy(context.Background(), writePolicy()), func(rec DiffRecord) {
		got = append(got, rec)
	})

	_, err := reg.Execute(ctx, "write_file", map[string]any{
		"path":    target,
		"content": "new content",
	}, ModeAutonomous)
	if err != nil {
		t.Fatalf("write_file failed: %v", err)
	}

	if len(got) != 1 {
		t.Fatalf("want 1 diff record, got %d", len(got))
	}
	if got[0].Path != target {
		t.Fatalf("path = %q, want %q", got[0].Path, target)
	}
	if got[0].OldContent != "old content" {
		t.Fatalf("OldContent = %q, want %q", got[0].OldContent, "old content")
	}
	if got[0].NewContent != "new content" {
		t.Fatalf("NewContent = %q, want %q", got[0].NewContent, "new content")
	}
}

// Writing a brand-new file reports an empty OldContent (new-file diff).
func TestDiffRecorder_WriteFileNewFile(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "fresh.txt")

	reg := NewRegistry(zap.NewNop())
	if err := RegisterBuiltinTools(reg); err != nil {
		t.Fatal(err)
	}

	var got []DiffRecord
	ctx := WithDiffRecorder(WithPolicy(context.Background(), writePolicy()), func(rec DiffRecord) {
		got = append(got, rec)
	})

	if _, err := reg.Execute(ctx, "write_file", map[string]any{
		"path":    target,
		"content": "hello",
	}, ModeAutonomous); err != nil {
		t.Fatalf("write_file failed: %v", err)
	}

	if len(got) != 1 || got[0].OldContent != "" || got[0].NewContent != "hello" {
		t.Fatalf("unexpected record: %+v", got)
	}
}

// No recorder on the context: ReportDiff is a silent no-op (tools must not
// panic when executed outside an orchestrator run).
func TestDiffRecorder_NoRecorderIsNoop(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "x.txt")

	reg := NewRegistry(zap.NewNop())
	if err := RegisterBuiltinTools(reg); err != nil {
		t.Fatal(err)
	}

	if _, err := reg.Execute(WithPolicy(context.Background(), writePolicy()), "write_file", map[string]any{
		"path":    target,
		"content": "data",
	}, ModeAutonomous); err != nil {
		t.Fatalf("write_file without recorder failed: %v", err)
	}
}
