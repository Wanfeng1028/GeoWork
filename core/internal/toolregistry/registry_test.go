package toolregistry

import (
	"context"
	"fmt"
	"testing"

	"go.uber.org/zap"
)

// doc/22 BP5: a tool call must produce exactly ONE audit entry, written
// after execution with the real outcome. Before the fix a successful call
// wrote a premature "success" entry before the tool ran, and a failed call
// ended up with one false success record AND one true failure record.
func TestAudit_SingleEntryPerCall(t *testing.T) {
	newReg := func(fail bool) (*Registry, *AuditLog) {
		reg := NewRegistry(zap.NewNop())
		audit := NewAuditLog()
		reg.WithAuditLog(audit)
		// Audit entries are only written when a QuotaGovernor is attached
		// (recordAudit guards on governor != nil), so wire one.
		reg.WithQuotaGovernor(NewQuotaGovernor("task-audit", nil))
		_ = reg.Register(NewBuilder("probe_tool").
			Description("audit probe").
			RiskLevel("low").
			Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
				if fail {
					return nil, fmt.Errorf("boom")
				}
				return map[string]any{"ok": true}, nil
			}).Build())
		return reg, audit
	}

	t.Run("success writes one truthful entry", func(t *testing.T) {
		reg, audit := newReg(false)
		if _, err := reg.Execute(context.Background(), "probe_tool", map[string]any{}, ModeAutonomous); err != nil {
			t.Fatalf("Execute failed: %v", err)
		}
		entries := audit.GetRecent(10)
		if len(entries) != 1 {
			t.Fatalf("got %d audit entries, want exactly 1", len(entries))
		}
		if !entries[0].Success {
			t.Fatalf("audit entry Success=false, want true")
		}
	})

	t.Run("failure writes one truthful entry", func(t *testing.T) {
		reg, audit := newReg(true)
		if _, err := reg.Execute(context.Background(), "probe_tool", map[string]any{}, ModeAutonomous); err == nil {
			t.Fatalf("Execute should have failed")
		}
		entries := audit.GetRecent(10)
		if len(entries) != 1 {
			t.Fatalf("got %d audit entries, want exactly 1 (no premature success record)", len(entries))
		}
		if entries[0].Success {
			t.Fatalf("audit entry Success=true for a failed call")
		}
		if entries[0].Error == "" {
			t.Fatalf("audit entry has empty Error for a failed call")
		}
	})
}

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
