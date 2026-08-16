package permissions

import (
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

// newTestRepo builds a Repository on an in-memory SQLite database. The
// repository creates its own schema in NewRepository, so no migrations run.
func newTestRepo(t *testing.T) *Repository {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	repo, err := NewRepository(db)
	if err != nil {
		t.Fatalf("NewRepository: %v", err)
	}
	return repo
}

func TestRepositoryRequestRoundTrip(t *testing.T) {
	repo := newTestRepo(t)

	req := &PermissionRequest{
		ID:          "req-1",
		TaskID:      "task-1",
		Action:      ActionRunShell,
		Title:       "Run shell",
		Description: "ls -la",
		Command:     "ls",
		RiskLevel:   "medium",
	}
	if err := repo.Create(req); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if req.RequestedAt == 0 {
		t.Errorf("Create must stamp RequestedAt")
	}

	got, err := repo.GetByID("req-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.TaskID != "task-1" || got.Action != ActionRunShell || got.Title != "Run shell" ||
		got.Description != "ls -la" || got.Command != "ls" || got.RiskLevel != "medium" {
		t.Errorf("fields not preserved: %+v", got)
	}
	if got.Decision != "" {
		t.Errorf("new request must have empty decision, got %q", got.Decision)
	}

	if _, err := repo.GetByID("ghost"); err == nil {
		t.Errorf("expected error for missing request")
	}
}

func TestRepositoryPendingExcludesResolved(t *testing.T) {
	repo := newTestRepo(t)

	for _, id := range []string{"a", "b", "c"} {
		if err := repo.Create(&PermissionRequest{ID: id, TaskID: "task-1", Action: ActionRunShell}); err != nil {
			t.Fatalf("Create %s: %v", id, err)
		}
	}
	if err := repo.UpdateDecision("a", "approved", "ok"); err != nil {
		t.Fatalf("UpdateDecision: %v", err)
	}

	pending, err := repo.GetPendingByTask("task-1")
	if err != nil {
		t.Fatalf("GetPendingByTask: %v", err)
	}
	if len(pending) != 2 {
		t.Fatalf("pending = %d, want 2 (resolved excluded)", len(pending))
	}
	for _, p := range pending {
		if p.ID == "a" {
			t.Errorf("resolved request must not be pending")
		}
	}

	// Resolved request carries decision + reason.
	resolved, err := repo.GetByID("a")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if resolved.Decision != "approved" || resolved.Reason != "ok" {
		t.Errorf("decision not persisted: %+v", resolved)
	}
}

func TestRepositoryGetExpiredBefore(t *testing.T) {
	repo := newTestRepo(t)
	if err := repo.Create(&PermissionRequest{ID: "old", TaskID: "task-1", Action: ActionRunShell}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	// The request was just created, so a cutoff in the past finds nothing and
	// a cutoff in the future finds it.
	expired, err := repo.GetExpiredBefore(time.Now().Add(-time.Hour))
	if err != nil {
		t.Fatalf("GetExpiredBefore: %v", err)
	}
	if len(expired) != 0 {
		t.Errorf("expected no expired requests, got %d", len(expired))
	}

	expired, err = repo.GetExpiredBefore(time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("GetExpiredBefore: %v", err)
	}
	if len(expired) != 1 || expired[0].ID != "old" {
		t.Errorf("expected the unresolved request, got %+v", expired)
	}
}

func TestRepositoryPolicyUpsertAndGet(t *testing.T) {
	repo := newTestRepo(t)

	policy := &PermissionPolicy{
		DefaultLevel: Limited,
		Actions:      map[string]string{string(ActionRunShell): string(FullAccess)},
	}
	if err := repo.Upsert("task-1", policy); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	got, err := repo.GetByTask("task-1")
	if err != nil {
		t.Fatalf("GetByTask: %v", err)
	}
	if got.DefaultLevel != Limited {
		t.Errorf("DefaultLevel = %q, want limited", got.DefaultLevel)
	}
	if got.Actions[string(ActionRunShell)] != string(FullAccess) {
		t.Errorf("actions not preserved: %v", got.Actions)
	}
	if !got.Remembered[string(ActionRunShell)] {
		t.Errorf("full_access action must be marked remembered")
	}

	// Upsert again updates in place (ON CONFLICT).
	policy2 := &PermissionPolicy{DefaultLevel: ReadOnly, Actions: map[string]string{}}
	if err := repo.Upsert("task-1", policy2); err != nil {
		t.Fatalf("second Upsert: %v", err)
	}
	got, err = repo.GetByTask("task-1")
	if err != nil {
		t.Fatalf("GetByTask after upsert: %v", err)
	}
	if got.DefaultLevel != ReadOnly {
		t.Errorf("upsert must update DefaultLevel, got %q", got.DefaultLevel)
	}

	if _, err := repo.GetByTask("ghost"); err == nil {
		t.Errorf("expected error for missing policy")
	}
}

func TestRepositoryPolicyDeleteAndList(t *testing.T) {
	repo := newTestRepo(t)

	if err := repo.Upsert("task-1", &PermissionPolicy{DefaultLevel: Limited, Actions: map[string]string{}}); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	if err := repo.Upsert("task-2", &PermissionPolicy{DefaultLevel: FullAccess, Actions: map[string]string{}}); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	all, err := repo.ListAll()
	if err != nil {
		t.Fatalf("ListAll: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("ListAll = %d entries, want 2", len(all))
	}

	if err := repo.DeleteByTask("task-1"); err != nil {
		t.Fatalf("DeleteByTask: %v", err)
	}
	if err := repo.DeleteByTask("task-1"); err == nil {
		t.Errorf("second delete must error (row gone)")
	}
	all, err = repo.ListAll()
	if err != nil {
		t.Fatalf("ListAll after delete: %v", err)
	}
	if len(all) != 1 || all[0].TaskID != "task-2" {
		t.Errorf("wrong entries after delete: %+v", all)
	}
}

func TestRepositoryDecisionsSaveGetCleanup(t *testing.T) {
	repo := newTestRepo(t)

	// ttlHours > 0 sets a future expiry; GetEffective returns it.
	if err := repo.Save("task-1", ActionRunShell, "approved", "ok", 24); err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, err := repo.GetEffective("task-1", ActionRunShell)
	if err != nil {
		t.Fatalf("GetEffective: %v", err)
	}
	if got.Decision != "approved" || got.Reason != "ok" {
		t.Errorf("decision fields mismatch: %+v", got)
	}
	if got.ExpiresAt.IsZero() {
		t.Errorf("ttlHours>0 must set ExpiresAt")
	}

	// Nothing expired yet.
	count, err := repo.CleanupExpired()
	if err != nil {
		t.Fatalf("CleanupExpired: %v", err)
	}
	if count != 0 {
		t.Errorf("cleanup deleted %d, want 0 (nothing expired)", count)
	}

	// Insert an already-expired decision directly, then clean it up.
	past := time.Now().Add(-time.Hour).Format(time.RFC3339)
	if _, err := repo.db.Exec(`
		INSERT INTO permission_decisions (id, task_id, action, decision, reason, expires_at, created_at)
		VALUES ('expired-1', 'task-2', 'run_shell', 'approved', 'stale', ?, ?)
	`, past, past); err != nil {
		t.Fatalf("insert expired decision: %v", err)
	}
	count, err = repo.CleanupExpired()
	if err != nil {
		t.Fatalf("CleanupExpired: %v", err)
	}
	if count != 1 {
		t.Errorf("cleanup deleted %d, want 1", count)
	}
	if _, err := repo.GetEffective("task-2", ActionRunShell); err == nil {
		t.Errorf("expired decision must be gone")
	}
}

func TestRepositoryGetEffectiveMissing(t *testing.T) {
	repo := newTestRepo(t)
	if _, err := repo.GetEffective("nope", ActionRunShell); err == nil {
		t.Fatalf("expected error for missing decision")
	}
}

// TestEnginePersistsDecisionsViaRepository wires an Engine to a Repository and
// verifies approvals are persisted for restart survival.
func TestEnginePersistsDecisionsViaRepository(t *testing.T) {
	repo := newTestRepo(t)
	e := NewEngine()
	e.WithRepository(repo)
	e.SetPolicy("task-1", &PermissionPolicy{DefaultLevel: Limited, Actions: map[string]string{}})

	e.CreateRequest(&PermissionRequest{ID: "req-1", TaskID: "task-1", Action: ActionRunShell})
	if err := e.ApproveRequest("req-1", "user approved"); err != nil {
		t.Fatalf("ApproveRequest: %v", err)
	}

	stored, err := repo.GetEffective("task-1", ActionRunShell)
	if err != nil {
		t.Fatalf("decision must be persisted: %v", err)
	}
	if stored.Decision != "approved" {
		t.Errorf("stored decision = %q, want approved", stored.Decision)
	}
}
