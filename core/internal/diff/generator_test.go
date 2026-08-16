// GeoWork Go Core - Diff generator tests (doc/23 A4)

package diff

import (
	"strings"
	"testing"
)

func TestUnified_MultiHunk(t *testing.T) {
	// Two edits separated by unchanged lines must produce two hunks, not
	// one collapsed block (the old prefix-matcher bug).
	old := "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n"
	new := "line1\nEDIT2\nline3\nline4\nline5\nline6\nline7\nline8\nEDIT9\nline10\n"

	got := Unified("a.txt", old, new)

	if !strings.Contains(got, "--- a/a.txt") || !strings.Contains(got, "+++ b/a.txt") {
		t.Fatalf("missing file headers:\n%s", got)
	}
	hunks := strings.Count(got, "@@")
	if hunks != 2 {
		t.Fatalf("want 2 hunks, got %d:\n%s", hunks, got)
	}
	if !strings.Contains(got, "-line2") || !strings.Contains(got, "+EDIT2") {
		t.Fatalf("first edit missing:\n%s", got)
	}
	if !strings.Contains(got, "-line9") || !strings.Contains(got, "+EDIT9") {
		t.Fatalf("second edit missing:\n%s", got)
	}
}

func TestUnified_NewFile(t *testing.T) {
	got := Unified("new.txt", "", "hello\nworld\n")
	if !strings.Contains(got, "@@ -0,0 +1,2 @@") {
		t.Fatalf("want new-file hunk header, got:\n%s", got)
	}
	if !strings.Contains(got, "+hello") || !strings.Contains(got, "+world") {
		t.Fatalf("want added lines, got:\n%s", got)
	}
}

func TestUnified_NoChange(t *testing.T) {
	got := Unified("same.txt", "a\nb\n", "a\nb\n")
	if got != "" {
		t.Fatalf("identical content should produce empty diff, got:\n%s", got)
	}
}

func TestUnified_DeletedLines(t *testing.T) {
	got := Unified("del.txt", "keep\ndrop\nkeep2\n", "keep\nkeep2\n")
	if !strings.Contains(got, "-drop") {
		t.Fatalf("want removed line, got:\n%s", got)
	}
}
