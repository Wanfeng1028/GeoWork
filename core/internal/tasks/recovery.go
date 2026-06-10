package tasks

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// Checkpoint holds the execution state for a task recovery point.
type Checkpoint struct {
	TaskID    string                 `json:"task_id"`
	StepIndex int                    `json:"step_index"`
	Status    string                 `json:"status"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// RecoveryManager handles task interruption recovery via checkpoints.
type RecoveryManager struct {
	db  *sql.DB
	log *slog.Logger
}

const checkpointTableSQL = `
CREATE TABLE IF NOT EXISTS recovery_checkpoints (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	task_id TEXT NOT NULL,
	step_index INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'pending',
	data TEXT,
	timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(task_id)
);
`

// NewRecoveryManager creates a new recovery manager and ensures the checkpoint table exists.
func NewRecoveryManager(db *sql.DB, log *slog.Logger) *RecoveryManager {
	rm := &RecoveryManager{
		db:  db,
		log: log,
	}

	if err := rm.ensureCheckpointTable(); err != nil {
		log.Error("failed to create checkpoint table", "error", err)
	}

	return rm
}

// ensureCheckpointTable creates the recovery checkpoints table if missing.
func (rm *RecoveryManager) ensureCheckpointTable() error {
	_, err := rm.db.Exec(checkpointTableSQL)
	return err
}

// SaveCheckpoint writes or updates a checkpoint for the given task.
func (rm *RecoveryManager) SaveCheckpoint(checkpoint Checkpoint) error {
	checkpoint.Timestamp = time.Now()

	dataBytes, err := json.Marshal(checkpoint.Data)
	if err != nil {
		return fmt.Errorf("marshal checkpoint data: %w", err)
	}

	_, err = rm.db.Exec(`
		INSERT INTO recovery_checkpoints (task_id, step_index, status, data, timestamp)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(task_id) DO UPDATE SET
			step_index = excluded.step_index,
			status = excluded.status,
			data = excluded.data,
			timestamp = excluded.timestamp
	`, checkpoint.TaskID, checkpoint.StepIndex, checkpoint.Status, string(dataBytes), checkpoint.Timestamp)

	if err != nil {
		return fmt.Errorf("save checkpoint: %w", err)
	}

	rm.log.Debug("checkpoint saved",
		"task_id", checkpoint.TaskID,
		"step_index", checkpoint.StepIndex,
		"status", checkpoint.Status,
	)
	return nil
}

// LoadCheckpoint retrieves the latest checkpoint for a specific task.
func (rm *RecoveryManager) LoadCheckpoint(taskID string) (*Checkpoint, error) {
	row := rm.db.QueryRow(`
		SELECT task_id, step_index, status, data, timestamp
		FROM recovery_checkpoints
		WHERE task_id = ?
		ORDER BY timestamp DESC
		LIMIT 1
	`, taskID)

	return rm.scanCheckpoint(row)
}

// ClearCheckpoint removes the checkpoint for a given task.
func (rm *RecoveryManager) ClearCheckpoint(taskID string) error {
	result, err := rm.db.Exec("DELETE FROM recovery_checkpoints WHERE task_id = ?", taskID)
	if err != nil {
		return fmt.Errorf("clear checkpoint: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("checkpoint not found for task %s", taskID)
	}

	rm.log.Debug("checkpoint cleared", "task_id", taskID)
	return nil
}

// RecoverTask loads the most recent checkpoint for a task, returning it for recovery.
func (rm *RecoveryManager) RecoverTask(taskID string) (*Checkpoint, error) {
	cp, err := rm.LoadCheckpoint(taskID)
	if err != nil {
		return nil, fmt.Errorf("recover task: %w", err)
	}

	if cp.Status == "completed" {
		return cp, nil
	}

	rm.log.Info("recovering task",
		"task_id", taskID,
		"step_index", cp.StepIndex,
		"status", cp.Status,
	)
	return cp, nil
}

// ListPendingTasks returns all task IDs that have checkpoints with non-completed status.
func (rm *RecoveryManager) ListPendingTasks() ([]string, error) {
	rows, err := rm.db.Query(`
		SELECT task_id
		FROM recovery_checkpoints
		WHERE status != 'completed'
		ORDER BY timestamp DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list pending tasks: %w", err)
	}
	defer rows.Close()

	var tasks []string
	for rows.Next() {
		var taskID string
		if err := rows.Scan(&taskID); err != nil {
			return nil, fmt.Errorf("scan pending task: %w", err)
		}
		tasks = append(tasks, taskID)
	}
	return tasks, rows.Err()
}

// ListAllTasks returns all task IDs that have any checkpoint.
func (rm *RecoveryManager) ListAllTasks() ([]string, error) {
	rows, err := rm.db.Query("SELECT task_id FROM recovery_checkpoints ORDER BY timestamp DESC")
	if err != nil {
		return nil, fmt.Errorf("list all tasks: %w", err)
	}
	defer rows.Close()

	var tasks []string
	for rows.Next() {
		var taskID string
		if err := rows.Scan(&taskID); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, taskID)
	}
	return tasks, rows.Err()
}

// MarkCompleted marks a task's checkpoint as completed.
func (rm *RecoveryManager) MarkCompleted(taskID string) error {
	_, err := rm.db.Exec(`
		UPDATE recovery_checkpoints
		SET status = 'completed', timestamp = ?
		WHERE task_id = ?
	`, time.Now().Format(time.RFC3339), taskID)
	if err != nil {
		return fmt.Errorf("mark completed: %w", err)
	}
	return nil
}

// GetAllCheckpoints returns all checkpoints sorted by timestamp.
func (rm *RecoveryManager) GetAllCheckpoints() ([]Checkpoint, error) {
	rows, err := rm.db.Query(`
		SELECT task_id, step_index, status, data, timestamp
		FROM recovery_checkpoints
		ORDER BY timestamp DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("get all checkpoints: %w", err)
	}
	defer rows.Close()

	var checkpoints []Checkpoint
	for rows.Next() {
		cp, err := rm.scanCheckpoint(rows)
		if err != nil {
			return nil, err
		}
		checkpoints = append(checkpoints, *cp)
	}
	return checkpoints, rows.Err()
}

// scanCheckpoint reads one row into a Checkpoint struct.
func (rm *RecoveryManager) scanCheckpoint(row scanner) (*Checkpoint, error) {
	var taskID string
	var stepIndex int
	var status string
	var dataStr string
	var timestampStr string

	if err := row.Scan(&taskID, &stepIndex, &status, &dataStr, &timestampStr); err != nil {
		return nil, fmt.Errorf("scan checkpoint row: %w", err)
	}

	var data map[string]interface{}
	if dataStr != "" {
		if err := json.Unmarshal([]byte(dataStr), &data); err != nil {
			return nil, fmt.Errorf("unmarshal checkpoint data: %w", err)
		}
	}

	timestamp, err := time.Parse(time.RFC3339, timestampStr)
	if err != nil {
		timestamp, err = time.Parse("2006-01-02T15:04:05Z", timestampStr)
		if err != nil {
			timestamp = time.Now()
		}
	}

	return &Checkpoint{
		TaskID:    taskID,
		StepIndex: stepIndex,
		Status:    status,
		Data:      data,
		Timestamp: timestamp,
	}, nil
}

// ClearAllCheckpoints deletes all checkpoints.
func (rm *RecoveryManager) ClearAllCheckpoints() error {
	_, err := rm.db.Exec("DELETE FROM recovery_checkpoints")
	if err != nil {
		return fmt.Errorf("clear all checkpoints: %w", err)
	}
	rm.log.Info("all checkpoints cleared")
	return nil
}

// GetPendingCount returns the number of tasks with non-completed checkpoints.
func (rm *RecoveryManager) GetPendingCount() (int, error) {
	var count int
	err := rm.db.QueryRow(`
		SELECT COUNT(*)
		FROM recovery_checkpoints
		WHERE status != 'completed'
	`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("get pending count: %w", err)
	}
	return count, nil
}

// scanner is an interface matching *sql.Row and *sql.Rows Scan method.
type scanner interface {
	Scan(...interface{}) error
}
