// GeoWork Go Core - Task Service

package tasks

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Init creates the tasks and task_events tables if they don't exist
func (s *Service) Init() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			workspace_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT DEFAULT '',
			status TEXT DEFAULT 'pending',
			mode TEXT DEFAULT 'Analysis',
			prompt TEXT DEFAULT '',
			plan TEXT DEFAULT '',
			started_at TEXT,
			completed_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS task_events (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			type TEXT NOT NULL,
			payload TEXT DEFAULT '',
			created_at TEXT NOT NULL
		);
	`)
	return err
}

// Create registers a new task in pending state.
func (s *Service) Create(ctx context.Context, t *Task) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	t.Status = StatusPending
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()

	_, err := s.db.Exec(
		"INSERT INTO tasks (id, workspace_id, name, description, status, mode, prompt, plan, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		t.ID, t.WorkspaceID, t.Name, t.Description, string(t.Status), t.Mode, t.Prompt, t.Plan,
		nullTime(t.StartedAt), nullTime(t.CompletedAt), t.CreatedAt.Format(time.RFC3339), t.UpdatedAt.Format(time.RFC3339),
	)
	return err
}

// GetByID returns a single task by its ID.
func (s *Service) GetByID(ctx context.Context, id string) (*Task, error) {
	t := &Task{}
	var startedAt, completedAt, createdAt, updatedAt string
	err := s.db.QueryRowContext(ctx,
		"SELECT id, workspace_id, name, description, status, mode, prompt, plan, started_at, completed_at, created_at, updated_at FROM tasks WHERE id = ?", id).
		Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Description, (*string)(&t.Status), &t.Mode, &t.Prompt, &t.Plan,
			&startedAt, &completedAt, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	t.StartedAt, _ = time.Parse(time.RFC3339, startedAt)
	t.CompletedAt, _ = time.Parse(time.RFC3339, completedAt)
	t.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return t, nil
}

// ListByWorkspace returns all tasks for a workspace, optionally filtered by status.
func (s *Service) ListByWorkspace(ctx context.Context, workspaceID string, status *Status) ([]Task, error) {
	var where string
	var args []interface{}
	if workspaceID != "" {
		where = "workspace_id = ?"
		args = append(args, workspaceID)
	} else {
		where = "1=1"
	}
	if status != nil {
		if len(args) > 0 {
			where += " AND status = ?"
		} else {
			where += " AND status = ?"
		}
		args = append(args, string(*status))
	}
	query := fmt.Sprintf("SELECT id, workspace_id, name, description, status, mode, prompt, plan, started_at, completed_at, created_at, updated_at FROM tasks WHERE %s ORDER BY updated_at DESC", where)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		var startedAt, completedAt, createdAt, updatedAt string
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Description, (*string)(&t.Status), &t.Mode, &t.Prompt, &t.Plan,
			&startedAt, &completedAt, &createdAt, &updatedAt); err != nil {
			continue
		}
		t.StartedAt, _ = time.Parse(time.RFC3339, startedAt)
		t.CompletedAt, _ = time.Parse(time.RFC3339, completedAt)
		t.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

// UpdateStatus transitions a task to a new status and records the timestamp.
func (s *Service) UpdateStatus(ctx context.Context, id string, newStatus Status) error {
	task, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	task.Status = newStatus
	task.UpdatedAt = time.Now().UTC()
	if newStatus == StatusRunning && task.StartedAt.IsZero() {
		task.StartedAt = time.Now().UTC()
	}
	if newStatus == StatusCompleted || newStatus == StatusFailed || newStatus == StatusCancelled {
		task.CompletedAt = time.Now().UTC()
	}

	_, err = s.db.Exec(
		"UPDATE tasks SET status = ?, started_at = ?, completed_at = ?, updated_at = ? WHERE id = ?",
		string(task.Status), nullTime(task.StartedAt), nullTime(task.CompletedAt),
		task.UpdatedAt.Format(time.RFC3339), id,
	)
	return err
}

// EmitEvent records a real-time event for a task (used by SSE streaming).
func (s *Service) EmitEvent(ctx context.Context, event *TaskEvent) error {
	event.ID = uuid.New().String()
	event.CreatedAt = time.Now().UTC()
	_, err := s.db.Exec(
		"INSERT INTO task_events (id, task_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)",
		event.ID, event.TaskID, string(event.Type), event.Payload, event.CreatedAt.Format(time.RFC3339),
	)
	return err
}

// ListEvents returns all events for a task, ordered by creation time.
func (s *Service) ListEvents(ctx context.Context, taskID string) ([]TaskEvent, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, task_id, type, payload, created_at FROM task_events WHERE task_id = ? ORDER BY created_at ASC", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []TaskEvent
	for rows.Next() {
		var e TaskEvent
		var createdAt string
		if err := rows.Scan(&e.ID, &e.TaskID, (*string)(&e.Type), &e.Payload, &createdAt); err != nil {
			continue
		}
		e.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		events = append(events, e)
	}
	return events, rows.Err()
}

// Delete removes a task and its associated events.
func (s *Service) Delete(ctx context.Context, id string) error {
	if _, err := s.db.Exec("DELETE FROM task_events WHERE task_id = ?", id); err != nil {
		return fmt.Errorf("failed to delete task events: %w", err)
	}
	if _, err := s.db.Exec("DELETE FROM tasks WHERE id = ?", id); err != nil {
		return err
	}
	return nil
}

// DeleteTaskEvents removes all events for a task
func (s *Service) DeleteTaskEvents(ctx context.Context, taskID string) error {
	_, err := s.db.Exec("DELETE FROM task_events WHERE task_id = ?", taskID)
	return err
}

// DeleteTask removes a task by ID
func (s *Service) DeleteTask(ctx context.Context, id string) error {
	_, err := s.db.Exec("DELETE FROM tasks WHERE id = ?", id)
	return err
}

// CreateTaskEvent inserts a task event
func (s *Service) CreateTaskEvent(ctx context.Context, event *TaskEvent) error {
	return s.EmitEvent(ctx, event)
}

// CreateTask inserts a task
func (s *Service) CreateTask(ctx context.Context, t *Task) error {
	return s.Create(ctx, t)
}

// UpdateTask updates a task
func (s *Service) UpdateTask(ctx context.Context, t *Task) error {
	_, err := s.db.Exec(
		"UPDATE tasks SET status = ?, started_at = ?, completed_at = ?, updated_at = ? WHERE id = ?",
		string(t.Status), nullTime(t.StartedAt), nullTime(t.CompletedAt),
		t.UpdatedAt.Format(time.RFC3339), t.ID,
	)
	return err
}

// nullTime returns an empty string for zero times (SQLite NULL handling)
func nullTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}
