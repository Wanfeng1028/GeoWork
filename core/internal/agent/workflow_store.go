package agent

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// Workflow represents a user-defined agent workflow.
type Workflow struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Nodes       []WorkflowNode         `json:"nodes"`
	Edges       []WorkflowEdge         `json:"edges"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
}

// WorkflowNode is a single node in a workflow.
type WorkflowNode struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"` // start | process | agent | output | condition
	Name   string                 `json:"name"`
	Config map[string]any         `json:"config"`
	X      float64                `json:"x"`
	Y      float64                `json:"y"`
}

// WorkflowEdge connects two nodes in a workflow.
type WorkflowEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

// Run represents a single execution of a workflow.
type Run struct {
	ID            string            `json:"id"`
	WorkflowID    string            `json:"workflowId"`
	WorkflowName  string            `json:"workflowName"`
	Status        string            `json:"status"` // running | waiting | completed | failed
	Progress      float64           `json:"progress"`
	Logs          []string          `json:"logs,omitempty"`
	StartedAt     time.Time         `json:"startedAt"`
	CompletedAt   *time.Time        `json:"completedAt,omitempty"`
	Cancelled     bool              `json:"cancelled"`
}

// Store handles persistence of workflows and runs.
type Store struct {
	db *sql.DB
}

// NewStore creates a new workflow store backed by SQLite.
func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open workflow store: %w", err)
	}

	store := &Store{db: db}
	if err := store.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}
	return store, nil
}

func (s *Store) initSchema() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS workflows (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT DEFAULT '',
			nodes TEXT NOT NULL,
			edges TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS runs (
			id TEXT PRIMARY KEY,
			workflow_id TEXT NOT NULL,
			workflow_name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'waiting',
			progress REAL NOT NULL DEFAULT 0,
			logs TEXT NOT NULL,
			started_at TEXT NOT NULL,
			completed_at TEXT,
			cancelled INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
		)`,
	}
	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("exec %q: %w", q[:40], err)
		}
	}
	return nil
}

// Close releases the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// ListWorkflows returns all stored workflows.
func (s *Store) ListWorkflows() ([]Workflow, error) {
	rows, err := s.db.Query("SELECT id, name, description, nodes, edges, created_at, updated_at FROM workflows ORDER BY updated_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workflows []Workflow
	for rows.Next() {
		var wf Workflow
		var nodesJSON, edgesJSON string
		if err := rows.Scan(&wf.ID, &wf.Name, &wf.Description, &nodesJSON, &edgesJSON, &wf.CreatedAt, &wf.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(nodesJSON), &wf.Nodes); err != nil {
			return nil, fmt.Errorf("unmarshal nodes: %w", err)
		}
		if err := json.Unmarshal([]byte(edgesJSON), &wf.Edges); err != nil {
			return nil, fmt.Errorf("unmarshal edges: %w", err)
		}
		workflows = append(workflows, wf)
	}
	return workflows, rows.Err()
}

// CreateWorkflow inserts a new workflow.
func (s *Store) CreateWorkflow(wf *Workflow) error {
	nodesJSON, _ := json.Marshal(wf.Nodes)
	edgesJSON, _ := json.Marshal(wf.Edges)
	now := time.Now().UTC()
	wf.CreatedAt = now
	wf.UpdatedAt = now
	_, err := s.db.Exec(
		"INSERT INTO workflows (id, name, description, nodes, edges, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		wf.ID, wf.Name, wf.Description, nodesJSON, edgesJSON, wf.CreatedAt, wf.UpdatedAt,
	)
	return err
}

// GetWorkflow retrieves a single workflow by ID.
func (s *Store) GetWorkflow(id string) (*Workflow, error) {
	var wf Workflow
	var nodesJSON, edgesJSON string
	err := s.db.QueryRow("SELECT id, name, description, nodes, edges, created_at, updated_at FROM workflows WHERE id = ?", id).
		Scan(&wf.ID, &wf.Name, &wf.Description, &nodesJSON, &edgesJSON, &wf.CreatedAt, &wf.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(nodesJSON), &wf.Nodes); err != nil {
		return nil, fmt.Errorf("unmarshal nodes: %w", err)
	}
	if err := json.Unmarshal([]byte(edgesJSON), &wf.Edges); err != nil {
		return nil, fmt.Errorf("unmarshal edges: %w", err)
	}
	return &wf, nil
}

// UpdateWorkflow replaces an existing workflow.
func (s *Store) UpdateWorkflow(wf *Workflow) error {
	nodesJSON, _ := json.Marshal(wf.Nodes)
	edgesJSON, _ := json.Marshal(wf.Edges)
	wf.UpdatedAt = time.Now().UTC()
	_, err := s.db.Exec(
		"UPDATE workflows SET name=?, description=?, nodes=?, edges=?, updated_at=? WHERE id=?",
		wf.Name, wf.Description, nodesJSON, edgesJSON, wf.UpdatedAt, wf.ID,
	)
	return err
}

// DeleteWorkflow removes a workflow and all its runs.
func (s *Store) DeleteWorkflow(id string) error {
	_, err := s.db.Exec("DELETE FROM workflows WHERE id = ?", id)
	return err
}

// CreateRun inserts a new run record.
func (s *Store) CreateRun(run *Run) error {
	logsJSON, _ := json.Marshal(run.Logs)
	now := time.Now().UTC()
	run.StartedAt = now
	_, err := s.db.Exec(
		"INSERT INTO runs (id, workflow_id, workflow_name, status, progress, logs, started_at, completed_at, cancelled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		run.ID, run.WorkflowID, run.WorkflowName, run.Status, run.Progress, logsJSON, run.StartedAt, nil, 0,
	)
	return err
}

// GetRun retrieves a single run by ID.
func (s *Store) GetRun(id string) (*Run, error) {
	var run Run
	var logsJSON string
	var completedAt sql.NullTime
	err := s.db.QueryRow(
		"SELECT id, workflow_id, workflow_name, status, progress, logs, started_at, completed_at, cancelled FROM runs WHERE id = ?", id,
	).Scan(&run.ID, &run.WorkflowID, &run.WorkflowName, &run.Status, &run.Progress, &logsJSON, &run.StartedAt, &completedAt, &run.Cancelled)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(logsJSON), &run.Logs); err != nil {
		return nil, fmt.Errorf("unmarshal logs: %w", err)
	}
	if completedAt.Valid {
		t := completedAt.Time
		run.CompletedAt = &t
	}
	return &run, nil
}

// ListRuns returns all runs, optionally filtered by workflow ID.
func (s *Store) ListRuns(workflowID string) ([]Run, error) {
	var rows *sql.Rows
	var err error
	if workflowID != "" {
		rows, err = s.db.Query("SELECT id, workflow_id, workflow_name, status, progress, logs, started_at, completed_at, cancelled FROM runs WHERE workflow_id = ? ORDER BY started_at DESC", workflowID)
	} else {
		rows, err = s.db.Query("SELECT id, workflow_id, workflow_name, status, progress, logs, started_at, completed_at, cancelled FROM runs ORDER BY started_at DESC")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []Run
	for rows.Next() {
		var run Run
		var logsJSON string
		var completedAt sql.NullTime
		if err := rows.Scan(&run.ID, &run.WorkflowID, &run.WorkflowName, &run.Status, &run.Progress, &logsJSON, &run.StartedAt, &completedAt, &run.Cancelled); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(logsJSON), &run.Logs); err != nil {
			return nil, fmt.Errorf("unmarshal logs: %w", err)
		}
		if completedAt.Valid {
			t := completedAt.Time
			run.CompletedAt = &t
		}
		runs = append(runs, run)
	}
	return runs, rows.Err()
}

// UpdateRunStatus updates the status, progress, and logs of a run.
func (s *Store) UpdateRunStatus(id string, status string, progress float64, logs []string) error {
	logsJSON, _ := json.Marshal(logs)
	_, err := s.db.Exec(
		"UPDATE runs SET status=?, progress=?, logs=? WHERE id=?",
		status, progress, logsJSON, id,
	)
	return err
}

// CompleteRun marks a run as completed with a timestamp.
func (s *Store) CompleteRun(id string, status string) error {
	now := time.Now().UTC()
	_, err := s.db.Exec(
		"UPDATE runs SET status=?, completed_at=? WHERE id=?",
		status, now, id,
	)
	return err
}

// CancelRun marks a run as cancelled.
func (s *Store) CancelRun(id string) error {
	now := time.Now().UTC()
	_, err := s.db.Exec(
		"UPDATE runs SET status='cancelled', completed_at=?, cancelled=1 WHERE id=?",
		now, id,
	)
	return err
}
