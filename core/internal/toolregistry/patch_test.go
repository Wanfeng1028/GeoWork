// GeoWork Go Core - Patch/Diff Tests

package toolregistry

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewPatch(t *testing.T) {
	p := NewPatch("test.go", "add feature")
	if p.FilePath != "test.go" {
		t.Errorf("FilePath = %s, want test.go", p.FilePath)
	}
	if p.Description != "add feature" {
		t.Errorf("Description = %s, want add feature", p.Description)
	}
	if len(p.Lines) != 0 {
		t.Error("New patch should have no lines")
	}
}

func TestPatchAddOperations(t *testing.T) {
	p := NewPatch("test.go", "")
	p.AddInsert("new line", 1)
	p.AddDelete("old line", 2)
	p.AddKeep("keep line", 3)

	if len(p.Lines) != 3 {
		t.Fatalf("Got %d lines, want 3", len(p.Lines))
	}

	if p.Lines[0].Operation != DiffOpInsert || p.Lines[0].Content != "new line" {
		t.Error("First line should be insert")
	}
	if p.Lines[1].Operation != DiffOpDelete || p.Lines[1].Content != "old line" {
		t.Error("Second line should be delete")
	}
	if p.Lines[2].Operation != DiffOpKeep || p.Lines[2].Content != "keep line" {
		t.Error("Third line should be keep")
	}
}

func TestComputeUnifiedDiff(t *testing.T) {
	old := "line1\nline2\nline3"
	new := "line1\nmodified\nline3\nline4"

	diff := ComputeUnifiedDiff(old, new)
	if len(diff.Lines) == 0 {
		t.Error("Diff should have lines")
	}

	// Check that changes are detected
	hasChange := false
	for _, l := range diff.Lines {
		if l.Operation != DiffOpKeep {
			hasChange = true
			break
		}
	}
	if !hasChange {
		t.Error("Diff should contain changes")
	}
}

func TestComputeUnifiedDiff_EmptyOld(t *testing.T) {
	old := ""
	new := "new content"

	diff := ComputeUnifiedDiff(old, new)
	if len(diff.Lines) == 0 {
		t.Error("Diff should have lines for new file")
	}
}

func TestComputeUnifiedDiff_EmptyNew(t *testing.T) {
	old := "old content"
	new := ""

	diff := ComputeUnifiedDiff(old, new)
	if len(diff.Lines) == 0 {
		t.Error("Diff should have lines for deleted content")
	}
}

func TestComputeUnifiedDiff_NoChanges(t *testing.T) {
	content := "same content"
	diff := ComputeUnifiedDiff(content, content)

	for _, l := range diff.Lines {
		if l.Operation != DiffOpKeep {
			t.Errorf("Expected keep for all lines, got %v", l.Operation)
		}
	}
}

func TestDiffLine_String(t *testing.T) {
	if DiffOpInsert.String() != "insert" {
		t.Error("DiffOpInsert.String() should be 'insert'")
	}
	if DiffOpDelete.String() != "delete" {
		t.Error("DiffOpDelete.String() should be 'delete'")
	}
	if DiffOpKeep.String() != "keep" {
		t.Error("DiffOpKeep.String() should be 'keep'")
	}
	if DiffOperation(99).String() != "unknown" {
		t.Error("Unknown diff operation should return 'unknown'")
	}
}

func TestDiffResult_ToUnifiedFormat(t *testing.T) {
	diff := &DiffResult{
		Lines: []DiffLine{
			{Operation: DiffOpKeep, Content: "keep"},
			{Operation: DiffOpInsert, Content: "added"},
			{Operation: DiffOpDelete, Content: "removed"},
		},
	}

	output := diff.ToUnifiedFormat(0)
	expectedLines := []string{" keep", "+added", "-removed"}

	for i, line := range splitLines(output) {
		if line != expectedLines[i] {
			t.Errorf("Line %d: got %q, want %q", i, line, expectedLines[i])
		}
	}
}

func TestNewPatchSet(t *testing.T) {
	ps := NewPatchSet("test set")
	if ps.Description != "test set" {
		t.Error("Description mismatch")
	}
	if len(ps.Patches) != 0 {
		t.Error("New patchset should have no patches")
	}
}

func TestPatchSetAddAndGetPatch(t *testing.T) {
	ps := NewPatchSet("test")
	p1 := NewPatch("a.go", "patch a")
	p2 := NewPatch("b.go", "patch b")

	ps.AddPatch(p1)
	ps.AddPatch(p2)

	if !ps.HasPatch("a.go") {
		t.Error("Should have patch a.go")
	}
	if !ps.HasPatch("b.go") {
		t.Error("Should have patch b.go")
	}
	if ps.HasPatch("c.go") {
		t.Error("Should not have patch c.go")
	}

	got := ps.GetPatch("a.go")
	if got == nil || got.FilePath != "a.go" {
		t.Error("GetPatch should return correct patch")
	}
}

func TestPatchSetRemovePatch(t *testing.T) {
	ps := NewPatchSet("test")
	ps.AddPatch(NewPatch("a.go", ""))

	if !ps.RemovePatch("a.go") {
		t.Error("RemovePatch should return true")
	}
	if ps.HasPatch("a.go") {
		t.Error("Patch should be removed")
	}
	if ps.RemovePatch("a.go") {
		t.Error("RemovePatch on missing patch should return false")
	}
}

func TestPatchSetValidate(t *testing.T) {
	// Valid patchset
	ps := NewPatchSet("valid")
	ps.AddPatch(NewPatch("test.go", "add line"))
	ps.AddPatch(&Patch{FilePath: "", Lines: []DiffLine{{Operation: DiffOpInsert, Content: "x"}}})

	err := ps.Validate()
	if err == nil {
		t.Error("Empty patchset should fail validation")
	}

	ps.Patches = make(map[string]*Patch)
	ps.Description = "non-empty"
	p := NewPatch("test.go", "valid")
	p.AddKeep("content", 1)
	ps.AddPatch(p)

	err = ps.Validate()
	if err != nil {
		t.Errorf("Valid patchset should pass validation: %v", err)
	}
}

func TestPatchSetValidate_EmptyPath(t *testing.T) {
	ps := NewPatchSet("test")
	ps.Patches[""] = NewPatch("", "")

	err := ps.Validate()
	if err == nil {
		t.Error("Empty path should fail validation")
	}
}

func TestPatchSetValidate_EmptyLines(t *testing.T) {
	ps := NewPatchSet("test")
	ps.Patches["test.go"] = &Patch{FilePath: "test.go", Lines: []DiffLine{}}

	err := ps.Validate()
	if err == nil {
		t.Error("Empty lines should fail validation")
	}
}

func TestPatchSet_ToUnifiedDiffString(t *testing.T) {
	ps := NewPatchSet("multi-file")
	p1 := NewPatch("a.go", "add to a")
	p1.AddKeep("old a", 1)
	p1.AddInsert("new a", 1)
	ps.AddPatch(p1)

	p2 := NewPatch("b.go", "modify b")
	p2.AddDelete("old b", 1)
	p2.AddKeep("keep b", 2)
	ps.AddPatch(p2)

	output := ps.ToUnifiedDiffString()
	if len(output) == 0 {
		t.Error("ToUnifiedDiffString should produce output")
	}

	if !contains(output, "+++ b/a.go") {
		t.Error("Output should contain a.go header")
	}
	if !contains(output, "+++ b/b.go") {
		t.Error("Output should contain b.go header")
	}
}

func TestPatchSet_ToUnifiedDiffString_Empty(t *testing.T) {
	ps := NewPatchSet("")
	output := ps.ToUnifiedDiffString()
	if output != "" {
		t.Error("Empty patchset should produce empty string")
	}
}

func TestSplitLines(t *testing.T) {
	if len(splitLines("a\nb\nc")) != 3 {
		t.Error("Should split into 3 lines")
	}
	if len(splitLines("a\nb\nc\n")) != 3 {
		t.Error("Should not count trailing newline")
	}
	if len(splitLines("")) != 0 {
		t.Error("Empty string should have 0 lines")
	}
}

// Helper
func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (len(s) >= len(substr)) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestApplyPatch_NewFile(t *testing.T) {
	patch := NewPatch("new.go", "new file")
	patch.AddInsert("package main\n\nfunc main() {}\n", 0)

	newContent, err := applyPatch("", patch)
	if err != nil {
		t.Fatalf("applyPatch failed: %v", err)
	}
	if newContent == "" {
		t.Error("New file should have content")
	}
}

func TestApplyPatch_ModifyFile(t *testing.T) {
	oldContent := "line1\nline2\nline3"
	patch := NewPatch("test.go", "modify")
	patch.AddKeep("line1", 1)
	patch.AddDelete("line2", 2)
	patch.AddInsert("line2-modified", 2)
	patch.AddKeep("line3", 3)

	newContent, err := applyPatch(oldContent, patch)
	if err != nil {
		t.Fatalf("applyPatch failed: %v", err)
	}

	expected := "line1\nline2-modified\nline3\n"
	if newContent != expected {
		t.Errorf("Got %q, want %q", newContent, expected)
	}
}

func TestApplyPatch_ValidateNoChanges(t *testing.T) {
	patch := NewPatch("test.go", "")
	patch.AddKeep("line1", 1)

	_, err := applyPatch("line1", patch)
	if err == nil {
		t.Error("Patch with no changes should fail validation")
	}
}

func TestPreviewPatch(t *testing.T) {
	content := "hello\nworld"
	patch := NewPatch("test.go", "")
	patch.AddKeep("hello", 1)
	patch.AddInsert("new", 1)
	patch.AddKeep("world", 2)

	diff, err := PreviewPatch(content, patch)
	if err != nil {
		t.Fatalf("PreviewPatch failed: %v", err)
	}
	if diff == "" {
		t.Error("Preview should produce diff output")
	}
}

func TestRevertPatch(t *testing.T) {
	content := "line1\nline2"
	patch := NewPatch("test.go", "")
	patch.AddKeep("line1", 1)
	patch.AddDelete("line2", 2)

	reverted, err := RevertPatch(content, patch)
	if err != nil {
		t.Fatalf("RevertPatch failed: %v", err)
	}
	// Reverting a delete should bring back the content
	if reverted == content {
		t.Error("Reverted content should differ from original")
	}
}

func TestDiffContents(t *testing.T) {
	old := "line1\nline2"
	new := "line1\nline3"

	diff := DiffContents(old, new)
	if diff == "" {
		t.Error("DiffContents should produce output for different content")
	}
}

func TestCollectChangedFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create original files
	os.WriteFile(filepath.Join(tmpDir, "a.txt"), []byte("content a"), 0o644)
	os.WriteFile(filepath.Join(tmpDir, "b.txt"), []byte("content b"), 0o644)

	originalSnap := map[string]string{
		"a.txt": "content a",
		"b.txt": "content b",
	}

	// Modify a.txt, add c.txt
	os.WriteFile(filepath.Join(tmpDir, "a.txt"), []byte("modified a"), 0o644)
	os.Remove(filepath.Join(tmpDir, "b.txt"))
	os.WriteFile(filepath.Join(tmpDir, "c.txt"), []byte("new c"), 0o644)

	changed, err := CollectChangedFiles(tmpDir, originalSnap)
	if err != nil {
		t.Fatalf("CollectChangedFiles failed: %v", err)
	}

	if len(changed) == 0 {
		t.Error("Should have detected changed files")
	}
}

func TestCleanUpEmptyDirs(t *testing.T) {
	tmpDir := t.TempDir()
	os.MkdirAll(filepath.Join(tmpDir, "empty/sub"), 0o755)
	os.WriteFile(filepath.Join(tmpDir, "notempty", "x.txt"), []byte("x"), 0o644)

	err := CleanUpEmptyDirs(tmpDir)
	if err != nil {
		t.Fatalf("CleanUpEmptyDirs failed: %v", err)
	}

	// The empty/sub dir should be removed
	if _, err := os.Stat(filepath.Join(tmpDir, "empty")); !os.IsNotExist(err) {
		t.Error("Empty dirs should be cleaned up")
	}
}
