package tasks

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	return db
}

// TestInitReconcilesLegacySchema reproduces the production scenario where
// storage.RunMigrations created the tasks table with the v2 schema (no
// description / progress / started_at / completed_at columns). Init must ALTER
// the missing columns in so task CRUD works on upgraded databases.
func TestInitReconcilesLegacySchema(t *testing.T) {
	db := newTestDB(t)

	// Legacy v2 migration schema — predates description/started_at/completed_at.
	if _, err := db.Exec(`
		CREATE TABLE tasks (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			status TEXT DEFAULT 'pending',
			mode TEXT DEFAULT 'work',
			prompt TEXT,
			plan TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`); err != nil {
		t.Fatalf("create legacy table: %v", err)
	}

	svc := NewService(db)
	if err := svc.Init(); err != nil {
		t.Fatalf("Init on legacy schema failed: %v", err)
	}

	// CRUD must now succeed despite the table starting without the new columns.
	task := &Task{WorkspaceID: "ws-1", Name: "legacy upgrade", Mode: "Analysis"}
	if err := svc.Create(context.Background(), task); err != nil {
		t.Fatalf("Create after reconciliation failed: %v", err)
	}
	got, err := svc.GetByID(context.Background(), task.ID)
	if err != nil {
		t.Fatalf("GetByID after reconciliation failed: %v", err)
	}
	if got.Name != "legacy upgrade" || got.Status != StatusPending {
		t.Errorf("task fields mismatch after reconciliation: %+v", got)
	}
}

// TestInitIsIdempotent verifies Init can run repeatedly without error, both on
// a fresh database and on one it already initialized.
func TestInitIsIdempotent(t *testing.T) {
	db := newTestDB(t)
	svc := NewService(db)

	for i := 0; i < 3; i++ {
		if err := svc.Init(); err != nil {
			t.Fatalf("Init run %d failed: %v", i+1, err)
		}
	}
}

func TestTaskCRUDRoundTrip(t *testing.T) {
	db := newTestDB(t)
	svc := NewService(db)
	if err := svc.Init(); err != nil {
		t.Fatalf("Init: %v", err)
	}
	ctx := context.Background()

	task := &Task{
		WorkspaceID: "ws-1",
		Name:        "round trip",
		Description: "desc",
		Mode:        "Research",
		Prompt:      "do it",
	}
	if err := svc.Create(ctx, task); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := svc.GetByID(ctx, task.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Description != "desc" || got.Mode != "Research" || got.Prompt != "do it" {
		t.Errorf("fields not preserved: %+v", got)
	}

	if err := svc.UpdateStatus(ctx, task.ID, StatusRunning); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}
	got, err = svc.GetByID(ctx, task.ID)
	if err != nil {
		t.Fatalf("GetByID after status update: %v", err)
	}
	if got.Status != StatusRunning {
		t.Errorf("status not updated, got %q", got.Status)
	}

	list, err := svc.ListByWorkspace(ctx, "ws-1", nil)
	if err != nil {
		t.Fatalf("ListByWorkspace: %v", err)
	}
	if len(list) != 1 || list[0].ID != task.ID {
		t.Errorf("list mismatch: %+v", list)
	}

	if err := svc.Delete(ctx, task.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := svc.GetByID(ctx, task.ID); err == nil {
		t.Errorf("expected error after delete")
	}
}
