package toolregistry

import (
	"fmt"
	"testing"
)

// doc/22 BP1 / F5: run_shell carries targets in the command string; the
// sandbox gate scans it with extractAbsolutePaths.
func TestExtractAbsolutePaths(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"echo hi > out.txt", nil},
		{"cat /etc/passwd", []string{"/etc/passwd"}},
		{`sh -c "cat /etc/shadow"`, []string{"/etc/shadow"}},
		{"type C:\\Windows\\system32\\config", []string{"C:\\Windows\\system32\\config"}},
		{"copy D:/data/a.csv D:/data/b.csv", []string{"D:/data/a.csv", "D:/data/b.csv"}},
		{"cd /tmp; rm -rf /", []string{"/tmp", "/"}},
	}
	for _, c := range cases {
		got := extractAbsolutePaths(c.in)
		if fmt.Sprint(got) != fmt.Sprint(c.want) {
			t.Errorf("extractAbsolutePaths(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}
