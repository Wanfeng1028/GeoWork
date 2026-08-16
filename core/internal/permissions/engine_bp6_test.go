// GeoWork Go Core - doc/22 BP6 permission engine TTL + category tests

package permissions

import (
	"testing"
	"time"
)

// TestEngineCleanup_PrunesExpired verifies Cleanup removes expired
// decisions, aged-out resolved requests, and stale policies.
func TestEngineCleanup_PrunesExpired(t *testing.T) {
	e := NewEngine()

	// Seed an expired decision, an aged-out resolved request, and a stale policy.
	e.mu.Lock()
	e.decisions["t1:run_shell"] = Decision{Decision: "approved", At: time.Now().Add(-48 * time.Hour)}
	e.requests["req-old"] = &PermissionRequest{
		ID: "req-old", TaskID: "t1", Action: ActionRunShell,
		Decision: "approved", ResolvedAt: time.Now().Add(-48 * time.Hour).UnixMilli(),
	}
	e.policies["stale-task"] = &PermissionPolicy{DefaultLevel: Limited}
	e.policySetAt["stale-task"] = time.Now().Add(-8 * 24 * time.Hour)
	e.mu.Unlock()

	removed := e.Cleanup()
	if removed != 3 {
		t.Fatalf("Cleanup removed %d entries, want 3 (decision + request + policy)", removed)
	}

	e.mu.RLock()
	defer e.mu.RUnlock()
	if len(e.decisions) != 0 {
		t.Errorf("decisions not pruned: %d remain", len(e.decisions))
	}
	if len(e.requests) != 0 {
		t.Errorf("requests not pruned: %d remain", len(e.requests))
	}
	if len(e.policies) != 0 {
		t.Errorf("policies not pruned: %d remain", len(e.policies))
	}
}

// TestEngineCleanup_KeepsFresh verifies Cleanup does not remove entries
// that are still within their TTL.
func TestEngineCleanup_KeepsFresh(t *testing.T) {
	e := NewEngine()
	e.SetPolicy("t1", &PermissionPolicy{DefaultLevel: Limited})
	e.CreateRequest(&PermissionRequest{ID: "req-pending", TaskID: "t1", Action: ActionRunShell})
	_ = e.ApproveRequest("req-pending", "ok")

	if removed := e.Cleanup(); removed != 0 {
		t.Fatalf("Cleanup removed %d fresh entries, want 0", removed)
	}
}

// TestEngineGetPendingRequests_PrunesAgedResolved verifies GetPendingRequests
// opportunistically drops resolved requests past the audit window while
// still returning unresolved ones.
func TestEngineGetPendingRequests_PrunesAgedResolved(t *testing.T) {
	e := NewEngine()
	e.CreateRequest(&PermissionRequest{ID: "pending", TaskID: "t1", Action: ActionRunShell})
	e.mu.Lock()
	e.requests["aged"] = &PermissionRequest{
		ID: "aged", TaskID: "t1", Action: ActionWriteFile,
		Decision: "denied", ResolvedAt: time.Now().Add(-48 * time.Hour).UnixMilli(),
	}
	e.mu.Unlock()

	pending := e.GetPendingRequests()
	if len(pending) != 1 {
		t.Fatalf("pending = %d, want 1 (only the unresolved request)", len(pending))
	}
	if pending[0].ID != "pending" {
		t.Fatalf("pending[0].ID = %q, want pending", pending[0].ID)
	}

	e.mu.RLock()
	_, agedStillThere := e.requests["aged"]
	e.mu.RUnlock()
	if agedStillThere {
		t.Errorf("aged resolved request was not pruned by GetPendingRequests")
	}
}

// TestEngineIsWriteAction_CategoryDriven verifies the write-action check
// follows the injected action-category classifier (tool Permission()).
func TestEngineIsWriteAction_CategoryDriven(t *testing.T) {
	e := NewEngine()
	e.WithActionCategory(func(action string) string {
		switch action {
		case "read_file", "list_files":
			return "read"
		case "write_file", "create_artifact":
			return "write"
		case "run_shell", "run_python", "git_commit":
			return "exec"
		case "delete_file":
			return "delete"
		}
		return ""
	})

	cases := []struct {
		action string
		want   bool
	}{
		{"read_file", false},
		{"list_files", false},
		{"write_file", true},
		{"create_artifact", true},
		{"run_shell", true},
		{"run_python", true},
		{"git_commit", true},
		{"delete_file", true},
	}
	for _, tc := range cases {
		if got := e.isWriteAction(tc.action); got != tc.want {
			t.Errorf("isWriteAction(%q) = %v, want %v", tc.action, got, tc.want)
		}
	}
}

// TestEngineIsWriteAction_FallbackDefault verifies that without a classifier
// (or for an unknown action) the conservative built-in set is used.
func TestEngineIsWriteAction_FallbackDefault(t *testing.T) {
	e := NewEngine()
	// No classifier wired.
	if !e.isWriteAction("write_file") {
		t.Errorf("write_file should be a write action under the default set")
	}
	if e.isWriteAction("read_file") {
		t.Errorf("read_file should NOT be a write action under the default set")
	}

	// Classifier that returns "" for an unknown action falls back to default.
	e2 := NewEngine()
	e2.WithActionCategory(func(action string) string { return "" })
	if !e2.isWriteAction("run_shell") {
		t.Errorf("unknown-category run_shell should fall back to the default write set")
	}
}
