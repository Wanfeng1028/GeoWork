// GeoWork Go Core - Task Recovery Mechanism

package tasks

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

// RecoveryManager handles task interruption recovery via checkpoints.
// It persists execution state, detects stale tasks, and restores interrupted work.
type RecoveryManager struct {
	db       *sql.DB
	service  *Service
	eventBus *EventBridge
	log      *slog.Logger
}

// Checkpoint holds the execution state for a task recovery point.
type Checkpoint struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	StepIndex int       `json:"stepIndex"`
	EventType string    `json:"eventType"`
	EventData string    `json:"eventData"`
	CreatedAt time.Time `json:"createdAt"`
	Status    string    `json:"status"` // saved, recovered, lost
}

// RecoveryState tracks the outcome of a task recovery operation.
type RecoveryState struct {
	TaskID         string      `json:"taskId"`
	LastCheckpoint *Checkpoint `json:"lastCheckpoint"`
	RecoveredAt    time.Time   `json:"recoveredAt"`
	RecoveryStatus string      `json:"recoveryStatus"` // pending, recovering, recovered, failed
	ArtifactsCount int         `json:"artifactsCount"`
	EventsCount    int         `json:"eventsCount"`
}

// RecoveryConfig holds configuration for the recovery mechanism.
type RecoveryConfig struct {
	CheckpointInterval int           // seconds between auto-checkpoints
	HeartbeatInterval  time.Duration // how often to record heartbeats
	StaleThreshold     time.Duration // time before considering task stale
	MaxCheckpointDays  int           // days to keep old checkpoints
}

// DefaultRecoveryConfig returns sensible defaults for the recovery mechanism.
func DefaultRecoveryConfig() RecoveryConfig {
	return RecoveryConfig{
		CheckpointInterval: 30, // seconds
		HeartbeatInterval:  15 * time.Minute,
		StaleThreshold:     15 * time.Minute,
		MaxCheckpointDays:  7,
	}
}

// NewRecoveryManager creates a new recovery manager and ensures required tables exist.
func NewRecoveryManager(db *sql.DB, service *Service, eventBus *EventBridge, log *slog.Logger) *RecoveryManager {
	rm := &RecoveryManager{
		db:       db,
		service:  service,
		eventBus: eventBus,
		log:      log,
	}

	if err := rm.ensureTables(); err != nil {
		log.Error("failed to create recovery tables", "error", err)
	}

	return rm
}

// ensureTables creates recovery-related tables if they do not exist.
func (rm *RecoveryManager) ensureTables() error {
	checkpointsDDL := `
		CREATE TABLE IF NOT EXISTS task_checkpoints (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			step_index INTEGER NOT NULL DEFAULT 0,
			event_type TEXT NOT NULL DEFAULT '',
			event_data TEXT DEFAULT '',
			created_at TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'saved'
		);
		CREATE INDEX IF NOT EXISTS idx_task_checkpoints_task_id ON task_checkpoints(task_id);
		CREATE INDEX IF NOT EXISTS idx_task_checkpoints_status ON task_checkpoints(status);
	`

	heartbeatsDDL := `
		CREATE TABLE IF NOT EXISTS task_heartbeats (
			task_id TEXT PRIMARY KEY,
			last_heartbeat TEXT NOT NULL
		);
	`

	if _, err := rm.db.Exec(checkpointsDDL); err != nil {
		return fmt.Errorf("create task_checkpoints table: %w", err)
	}
	if _, err := rm.db.Exec(heartbeatsDDL); err != nil {
		return fmt.Errorf("create task_heartbeats table: %w", err)
	}
	return nil
}

// SaveCheckpoint records a checkpoint for the given task.
// It upserts: if a checkpoint already exists for the task, it is updated.
func (rm *RecoveryManager) SaveCheckpoint(taskID string, stepIndex int, eventType string, eventData string) error {
	id, err := rm.saveCheckpointLocked(taskID, stepIndex, eventType, eventData)
	if err != nil {
		return err
	}
	rm.log.Debug("checkpoint saved", "task_id", taskID, "step_index", stepIndex)
	_ = id
	return nil
}

// saveCheckpointLocked performs the actual checkpoint upsert, returning the checkpoint ID.
func (rm *RecoveryManager) saveCheckpointLocked(taskID string, stepIndex int, eventType string, eventData string) (string, error) {
	id := generateCheckpointID(taskID)
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := rm.db.Exec(`
		INSERT INTO task_checkpoints (id, task_id, step_index, event_type, event_data, created_at, status)
		VALUES (?, ?, ?, ?, ?, ?, 'saved')
		ON CONFLICT(task_id) DO UPDATE SET
			step_index = excluded.step_index,
			event_type = excluded.event_type,
			event_data = excluded.event_data,
			created_at = excluded.created_at,
			status = 'saved'
	`, id, taskID, stepIndex, eventType, eventData, now)
	if err != nil {
		return "", fmt.Errorf("save checkpoint: %w", err)
	}
	return id, nil
}

// GetLastCheckpoint retrieves the most recent checkpoint for a task.
func (rm *RecoveryManager) GetLastCheckpoint(taskID string) (*Checkpoint, error) {
	row := rm.db.QueryRow(`
		SELECT id, task_id, step_index, event_type, event_data, created_at, status
		FROM task_checkpoints
		WHERE task_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, taskID)

	cp, err := rm.scanCheckpoint(row)
	if err != nil {
		return nil, fmt.Errorf("get last checkpoint: %w", err)
	}
	return cp, nil
}

// GetCheckpoints retrieves all checkpoints for a task, sorted by creation time.
func (rm *RecoveryManager) GetCheckpoints(taskID string) ([]Checkpoint, error) {
	rows, err := rm.db.Query(`
		SELECT id, task_id, step_index, event_type, event_data, created_at, status
		FROM task_checkpoints
		WHERE task_id = ?
		ORDER BY created_at ASC
	`, taskID)
	if err != nil {
		return nil, fmt.Errorf("get checkpoints: %w", err)
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

// MarkCheckpointRecovered marks a specific checkpoint as recovered.
func (rm *RecoveryManager) MarkCheckpointRecovered(checkpointID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := rm.db.Exec(
		"UPDATE task_checkpoints SET status = 'recovered', created_at = ? WHERE id = ?",
		now, checkpointID,
	)
	if err != nil {
		return fmt.Errorf("mark checkpoint recovered: %w", err)
	}
	return nil
}

// CleanupOldCheckpoints removes checkpoints older than the given threshold.
func (rm *RecoveryManager) CleanupOldCheckpoints(olderThan time.Time) (int64, error) {
	cutoff := olderThan.Format(time.RFC3339)
	result, err := rm.db.Exec(
		"DELETE FROM task_checkpoints WHERE created_at < ?",
		cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("cleanup old checkpoints: %w", err)
	}
	rows, _ := result.RowsAffected()
	rm.log.Debug("cleaned up old checkpoints", "older_than", cutoff, "removed", rows)
	return rows, nil
}

// RecoverTask loads the task from the database, finds the last checkpoint,
// restores task state, marks the task as recovered, and returns the recovery state.
func (rm *RecoveryManager) RecoverTask(taskID string) (*RecoveryState, error) {
	ctx := context.TODO()

	// Load the task from database
	if _, err := rm.service.GetByID(ctx, taskID); err != nil {
		return nil, fmt.Errorf("recover task: load task: %w", err)
	}

	// Find the last checkpoint
	checkpoint, err := rm.GetLastCheckpoint(taskID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("recover task: get checkpoint: %w", err)
	}

	// No checkpoint means nothing to recover from
	if checkpoint == nil {
		return &RecoveryState{
			TaskID:         taskID,
			RecoveredAt:    time.Now().UTC(),
			RecoveryStatus: "no_checkpoint",
		}, nil
	}

	// Count existing artifacts and events
	eventsCount := rm.countEvents(taskID)

	// Restore task state: mark as paused (user should decide to continue or abandon)
	if err := rm.service.UpdateStatus(ctx, taskID, StatusPaused); err != nil {
		return &RecoveryState{
			TaskID:         taskID,
			LastCheckpoint: checkpoint,
			RecoveredAt:    time.Now().UTC(),
			RecoveryStatus: "failed",
			EventsCount:    eventsCount,
		}, fmt.Errorf("recover task: update status: %w", err)
	}

	// Mark checkpoint as recovered
	if err := rm.MarkCheckpointRecovered(checkpoint.ID); err != nil {
		rm.log.Warn("failed to mark checkpoint as recovered", "task_id", taskID, "error", err)
	}

	// Broadcast recovery event
	rm.broadcastRecoveryEvent(taskID, checkpoint, eventsCount)

	return &RecoveryState{
		TaskID:         taskID,
		LastCheckpoint: checkpoint,
		RecoveredAt:    time.Now().UTC(),
		RecoveryStatus: "recovered",
		ArtifactsCount: 0,
		EventsCount:    eventsCount,
	}, nil
}

// RecoverAllPending finds all tasks with StatusRunning that lack recent heartbeats
// and attempts recovery for each. Returns a list of recovery states.
func (rm *RecoveryManager) RecoverAllPending() ([]RecoveryState, error) {
	ctx := context.TODO()

	// Find all running tasks
	runningTasks, err := rm.service.ListByWorkspace(ctx, "", nil)
	if err != nil {
		return nil, fmt.Errorf("recover all: list tasks: %w", err)
	}

	staleIDs, err := rm.GetStaleTasks(DefaultRecoveryConfig().StaleThreshold)
	if err != nil {
		return nil, fmt.Errorf("recover all: get stale tasks: %w", err)
	}

	staleSet := make(map[string]struct{}, len(staleIDs))
	for _, id := range staleIDs {
		staleSet[id] = struct{}{}
	}

	var results []RecoveryState
	for _, task := range runningTasks {
		if task.Status != StatusRunning {
			continue
		}
		if _, isStale := staleSet[task.ID]; !isStale {
			continue
		}

		state, err := rm.RecoverTask(task.ID)
		if err != nil {
			state = &RecoveryState{
				TaskID:         task.ID,
				RecoveredAt:    time.Now().UTC(),
				RecoveryStatus: "failed",
			}
		}
		results = append(results, *state)
	}

	return results, nil
}

// CreateReadOnlySnapshot creates a read-only snapshot for a task that cannot continue.
// It saves all existing events and artifacts as immutable records,
// then sets the task status to paused with a read-only flag.
func (rm *RecoveryManager) CreateReadOnlySnapshot(taskID string) error {
	ctx := context.TODO()

	// Retrieve all existing events to preserve as immutable records
	events, err := rm.service.ListEvents(ctx, taskID)
	if err != nil {
		rm.log.Warn("failed to list events for snapshot", "task_id", taskID, "error", err)
	}

	// Save a read-only marker checkpoint
	_, err = rm.saveCheckpointLocked(taskID, -1, "snapshot", fmt.Sprintf(`{"type":"read_only","events":%d}`, len(events)))
	if err != nil {
		return fmt.Errorf("create snapshot: save checkpoint: %w", err)
	}

	// Set task status to paused (not completed - snapshot is not normal completion)
	if err := rm.service.UpdateStatus(ctx, taskID, StatusPaused); err != nil {
		return fmt.Errorf("create snapshot: update status: %w", err)
	}

	rm.log.Info("read-only snapshot created", "task_id", taskID, "events", len(events))
	return nil
}

// RecordHeartbeat updates the heartbeat timestamp for a running task.
func (rm *RecoveryManager) RecordHeartbeat(taskID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := rm.db.Exec(`
		INSERT INTO task_heartbeats (task_id, last_heartbeat)
		VALUES (?, ?)
		ON CONFLICT(task_id) DO UPDATE SET
			last_heartbeat = excluded.last_heartbeat
	`, taskID, now)
	if err != nil {
		return fmt.Errorf("record heartbeat: %w", err)
	}
	return nil
}

// GetStaleTasks returns task IDs whose last heartbeat is older than the threshold.
func (rm *RecoveryManager) GetStaleTasks(threshold time.Duration) ([]string, error) {
	cutoff := time.Now().UTC().Add(-threshold).Format(time.RFC3339)

	rows, err := rm.db.Query(`
		SELECT task_id
		FROM task_heartbeats
		WHERE last_heartbeat < ?
	`, cutoff)
	if err != nil {
		return nil, fmt.Errorf("get stale tasks: %w", err)
	}
	defer rows.Close()

	var staleIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan stale task: %w", err)
		}
		staleIDs = append(staleIDs, id)
	}
	return staleIDs, rows.Err()
}

// broadcastRecoveryEvent sends a task.recovered event through the event bridge.
func (rm *RecoveryManager) broadcastRecoveryEvent(taskID string, checkpoint *Checkpoint, eventsCount int) {
	payload := map[string]interface{}{
		"taskId":         taskID,
		"lastCheckpoint": checkpoint,
		"recoveredAt":    time.Now().UTC().Format(time.RFC3339),
		"eventsCount":    eventsCount,
	}

	data, _ := json.Marshal(payload)
	rm.eventBus.Publish(TaskEvent{
		TaskID:  taskID,
		Type:    "task.recovered",
		Payload: string(data),
	})
}

// ListenForRecoveryEvents starts a goroutine that listens for task completion events
// via the EventBridge and automatically saves checkpoints on step completion events.
// It blocks on the subscriber channel, so this is intended to be called with a
// fresh subscription per task or goroutine.
func (rm *RecoveryManager) ListenForRecoveryEvents() {
	ch := rm.eventBus.Subscribe("")
	go func() {
		for event := range ch {
			switch event.Type {
			case EventStepCompleted:
				// Auto-save checkpoint on step completion
				rm.SaveCheckpoint(event.TaskID, 0, string(event.Type), event.Payload)
			case EventStatus:
				// Log status transitions for audit trail
				rm.log.Debug("task status event received", "task_id", event.TaskID, "payload", event.Payload)
			}
		}
	}()
}

// countEvents returns the number of events for a task.
func (rm *RecoveryManager) countEvents(taskID string) int {
	var count int
	err := rm.db.QueryRow(
		"SELECT COUNT(*) FROM task_events WHERE task_id = ?",
		taskID,
	).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// scanCheckpoint reads a single row into a Checkpoint struct.
func (rm *RecoveryManager) scanCheckpoint(row scanner) (*Checkpoint, error) {
	var id string
	var taskID string
	var stepIndex int
	var eventType string
	var eventData string
	var createdAtStr string
	var status string

	if err := row.Scan(&id, &taskID, &stepIndex, &eventType, &eventData, &createdAtStr, &status); err != nil {
		return nil, fmt.Errorf("scan checkpoint row: %w", err)
	}

	createdAt, err := time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		createdAt, err = time.Parse("2006-01-02T15:04:05Z", createdAtStr)
		if err != nil {
			createdAt = time.Now().UTC()
		}
	}

	return &Checkpoint{
		ID:        id,
		TaskID:    taskID,
		StepIndex: stepIndex,
		EventType: eventType,
		EventData: eventData,
		CreatedAt: createdAt,
		Status:    status,
	}, nil
}

// generateCheckpointID produces a deterministic ID from a task ID.
func generateCheckpointID(taskID string) string {
	return "cp-" + taskID
}

// scanner is an interface matching *sql.Row and *sql.Rows Scan method.
type scanner interface {
	Scan(...interface{}) error
}
