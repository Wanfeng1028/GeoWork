// GeoWork Go Core - Permission Repository

package permissions

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// Repository handles persistent storage for permission requests, policies, and decisions.
type Repository struct {
	db  *sql.DB
	log *slog.Logger
}

// PermissionPolicyEntry is a lightweight struct for returning policy summaries.
type PermissionPolicyEntry struct {
	TaskID       string            `json:"taskId"`
	DefaultLevel PermissionLevel   `json:"defaultLevel"`
	Actions      map[string]string `json:"actions"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

// StoredDecision represents a stored decision record with optional TTL.
type StoredDecision struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	Action    string    `json:"action"`
	Decision  string    `json:"decision"`
	Reason    string    `json:"reason"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

const (
	permissionRequestsSQL = `
CREATE TABLE IF NOT EXISTS permission_requests (
	id TEXT PRIMARY KEY,
	task_id TEXT NOT NULL,
	action TEXT NOT NULL,
	title TEXT NOT NULL,
	description TEXT,
	command TEXT,
	risk_level TEXT NOT NULL DEFAULT 'medium',
	requested_at TIMESTAMP NOT NULL,
	resolved_at TIMESTAMP,
	decision TEXT,
	reason TEXT
);`

	permissionRequestsIndexSQL = `
CREATE INDEX IF NOT EXISTS idx_permission_requests_task ON permission_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_task_pending ON permission_requests(task_id, decision);
`

	permissionPoliciesSQL = `
CREATE TABLE IF NOT EXISTS permission_policies (
	task_id TEXT PRIMARY KEY,
	default_level TEXT NOT NULL,
	actions TEXT,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);`

	permissionDecisionsSQL = `
CREATE TABLE IF NOT EXISTS permission_decisions (
	id TEXT PRIMARY KEY,
	task_id TEXT NOT NULL,
	action TEXT NOT NULL,
	decision TEXT NOT NULL,
	reason TEXT,
	expires_at TIMESTAMP,
	created_at TIMESTAMP NOT NULL
);`

	permissionDecisionsIndexSQL = `
CREATE INDEX IF NOT EXISTS idx_permission_decisions_task_action ON permission_decisions(task_id, action);
CREATE INDEX IF NOT EXISTS idx_permission_decisions_expires ON permission_decisions(expires_at);
`
)

// scanner is a minimal interface matching *sql.Row and *sql.Rows Scan capability.
type scanner interface {
	Scan(dest ...interface{}) error
}

// NewRepository initializes the repository and creates tables if they don't exist.
func NewRepository(db *sql.DB) (*Repository, error) {
	repo := &Repository{
		db:  db,
		log: slog.Default(),
	}

	if err := repo.init(); err != nil {
		return nil, fmt.Errorf("initialize repository: %w", err)
	}

	return repo, nil
}

// init creates the database tables and indexes.
func (r *Repository) init() error {
	for _, stmt := range []string{
		permissionRequestsSQL,
		permissionRequestsIndexSQL,
		permissionPoliciesSQL,
		permissionDecisionsSQL,
		permissionDecisionsIndexSQL,
	} {
		if _, err := r.db.Exec(stmt); err != nil {
			return fmt.Errorf("exec schema: %w", err)
		}
	}
	r.log.Info("permission repository initialized")
	return nil
}

// ---------- PermissionRequest CRUD ----------

// Create inserts a new permission request.
func (r *Repository) Create(req *PermissionRequest) error {
	now := time.Now()
	req.RequestedAt = now.UnixMilli()

	_, err := r.db.Exec(`
		INSERT INTO permission_requests (id, task_id, action, title, description, command, risk_level, requested_at, resolved_at, decision, reason)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.ID, req.TaskID, string(req.Action), req.Title, req.Description, req.Command, req.RiskLevel, now.Format(time.RFC3339), nil, nil, nil)

	if err != nil {
		return fmt.Errorf("create permission request: %w", err)
	}
	r.log.Info("permission request created", "id", req.ID, "task_id", req.TaskID)
	return nil
}

// GetByID retrieves a permission request by its ID.
func (r *Repository) GetByID(id string) (*PermissionRequest, error) {
	row := r.db.QueryRow(`
		SELECT id, task_id, action, title, description, command, risk_level, requested_at, resolved_at, decision, reason
		FROM permission_requests WHERE id = ?
	`, id)

	return r.scanRequest(row)
}

// GetPendingByTask returns all unresolved permission requests for a task.
func (r *Repository) GetPendingByTask(taskID string) ([]*PermissionRequest, error) {
	rows, err := r.db.Query(`
		SELECT id, task_id, action, title, description, command, risk_level, requested_at, resolved_at, decision, reason
		FROM permission_requests WHERE task_id = ? AND (decision IS NULL OR decision = '')
	`, taskID)
	if err != nil {
		return nil, fmt.Errorf("get pending requests: %w", err)
	}
	defer rows.Close()

	var results []*PermissionRequest
	for rows.Next() {
		req, err := r.scanRequest(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, req)
	}
	return results, rows.Err()
}

// UpdateDecision marks a permission request as resolved with the given decision and reason.
func (r *Repository) UpdateDecision(id, decision, reason string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := r.db.Exec(`
		UPDATE permission_requests SET decision = ?, reason = ?, resolved_at = ? WHERE id = ?
	`, decision, reason, now, id)
	if err != nil {
		return fmt.Errorf("update request decision: %w", err)
	}
	r.log.Info("permission request decision updated", "id", id, "decision", decision)
	return nil
}

// GetExpiredBefore returns all permission requests whose requested_at is before the given time and are still unresolved.
func (r *Repository) GetExpiredBefore(before time.Time) ([]*PermissionRequest, error) {
	rows, err := r.db.Query(`
		SELECT id, task_id, action, title, description, command, risk_level, requested_at, resolved_at, decision, reason
		FROM permission_requests WHERE requested_at < ? AND (decision IS NULL OR decision = '')
	`, before.Format(time.RFC3339))
	if err != nil {
		return nil, fmt.Errorf("get expired requests: %w", err)
	}
	defer rows.Close()

	var results []*PermissionRequest
	for rows.Next() {
		req, err := r.scanRequest(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, req)
	}
	return results, rows.Err()
}

// scanRequest reads a row into a PermissionRequest.
func (r *Repository) scanRequest(s scanner) (*PermissionRequest, error) {
	var req PermissionRequest
	var requestedAt, resolvedAt, decision, reason sql.NullString
	var taskID, actionStr, title, desc, command, riskLevel sql.NullString

	err := s.Scan(&req.ID, &taskID, &actionStr, &title, &desc, &command, &riskLevel, &requestedAt, &resolvedAt, &decision, &reason)
	if err != nil {
		return nil, fmt.Errorf("scan request: %w", err)
	}

	if taskID.Valid {
		req.TaskID = taskID.String
	}
	if actionStr.Valid {
		req.Action = DangerousAction(actionStr.String)
	}
	req.Title = title.String
	req.Description = desc.String
	req.Command = command.String
	req.RiskLevel = riskLevel.String

	if requestedAt.Valid {
		t, err := time.Parse(time.RFC3339, requestedAt.String)
		if err == nil {
			req.RequestedAt = t.UnixMilli()
		}
	}
	if resolvedAt.Valid {
		t, err := time.Parse(time.RFC3339, resolvedAt.String)
		if err == nil {
			req.ResolvedAt = t.UnixMilli()
		}
	}
	req.Decision = decision.String
	req.Reason = reason.String

	return &req, nil
}

// ---------- PermissionPolicy CRUD ----------

// Upsert inserts or replaces a permission policy for a task.
func (r *Repository) Upsert(taskID string, policy *PermissionPolicy) error {
	now := time.Now().Format(time.RFC3339)

	actionsJSON, err := json.Marshal(policy.Actions)
	if err != nil {
		return fmt.Errorf("marshal policy actions: %w", err)
	}

	_, err = r.db.Exec(`
		INSERT INTO permission_policies (task_id, default_level, actions, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(task_id) DO UPDATE SET
			default_level = excluded.default_level,
			actions = excluded.actions,
			updated_at = excluded.updated_at
	`, taskID, string(policy.DefaultLevel), string(actionsJSON), now, now)
	if err != nil {
		return fmt.Errorf("upsert policy: %w", err)
	}
	r.log.Info("permission policy upserted", "task_id", taskID)
	return nil
}

// GetByTask retrieves the permission policy for a task.
func (r *Repository) GetByTask(taskID string) (*PermissionPolicy, error) {
	row := r.db.QueryRow(`
		SELECT task_id, default_level, actions, created_at, updated_at
		FROM permission_policies WHERE task_id = ?
	`, taskID)

	var entry PermissionPolicyEntry
	var actionsStr sql.NullString
	var createdAtStr, updatedAtStr string

	err := row.Scan(&entry.TaskID, &entry.DefaultLevel, &actionsStr, &createdAtStr, &updatedAtStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("policy not found for task %s", taskID)
		}
		return nil, fmt.Errorf("scan policy: %w", err)
	}

	if actionsStr.Valid {
		if err := json.Unmarshal([]byte(actionsStr.String), &entry.Actions); err != nil {
			return nil, fmt.Errorf("unmarshal policy actions: %w", err)
		}
	} else {
		entry.Actions = make(map[string]string)
	}

	policy := &PermissionPolicy{
		DefaultLevel: entry.DefaultLevel,
		Actions:      entry.Actions,
		Remembered:   make(map[string]bool),
	}

	// Populate remembered from actions map — actions that are set override default
	for action, level := range policy.Actions {
		if level == string(FullAccess) || level == string(ReadOnly) {
			policy.Remembered[action] = true
		}
	}

	return policy, nil
}

// DeleteByTask removes the permission policy for a task.
func (r *Repository) DeleteByTask(taskID string) error {
	result, err := r.db.Exec("DELETE FROM permission_policies WHERE task_id = ?", taskID)
	if err != nil {
		return fmt.Errorf("delete policy: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("policy not found for task %s", taskID)
	}
	r.log.Info("permission policy deleted", "task_id", taskID)
	return nil
}

// ListAll returns all permission policies stored in the database.
func (r *Repository) ListAll() ([]PermissionPolicyEntry, error) {
	rows, err := r.db.Query(`
		SELECT task_id, default_level, actions, created_at, updated_at
		FROM permission_policies
	`)
	if err != nil {
		return nil, fmt.Errorf("list policies: %w", err)
	}
	defer rows.Close()

	var results []PermissionPolicyEntry
	for rows.Next() {
		var entry PermissionPolicyEntry
		var actionsStr sql.NullString
		var createdAtStr, updatedAtStr string

		err := rows.Scan(&entry.TaskID, &entry.DefaultLevel, &actionsStr, &createdAtStr, &updatedAtStr)
		if err != nil {
			return nil, fmt.Errorf("scan policy entry: %w", err)
		}

		if actionsStr.Valid {
			if err := json.Unmarshal([]byte(actionsStr.String), &entry.Actions); err != nil {
				return nil, fmt.Errorf("unmarshal actions: %w", err)
			}
		} else {
			entry.Actions = make(map[string]string)
		}

		if createdAtStr != "" {
			t, err := time.Parse(time.RFC3339, createdAtStr)
			if err == nil {
				entry.CreatedAt = t
			}
		}
		if updatedAtStr != "" {
			t, err := time.Parse(time.RFC3339, updatedAtStr)
			if err == nil {
				entry.UpdatedAt = t
			}
		}

		results = append(results, entry)
	}
	return results, rows.Err()
}

// ---------- Decision storage ----------

// Save stores a permission decision with optional TTL.
func (r *Repository) Save(taskID string, action DangerousAction, decision string, reason string, ttlHours int) error {
	now := time.Now()
	dec := &StoredDecision{
		ID:        fmt.Sprintf("%d", now.UnixNano()),
		TaskID:    taskID,
		Action:    string(action),
		Decision:  decision,
		Reason:    reason,
		CreatedAt: now,
	}

	if ttlHours > 0 {
		dec.ExpiresAt = now.Add(time.Duration(ttlHours) * time.Hour)
	}

	_, err := r.db.Exec(`
		INSERT INTO permission_decisions (id, task_id, action, decision, reason, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, dec.ID, taskID, dec.Action, dec.Decision, dec.Reason,
		dec.ExpiresAt.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("save decision: %w", err)
	}
	return nil
}

// GetEffective retrieves the most recent effective decision for a task+action.
func (r *Repository) GetEffective(taskID string, action DangerousAction) (*StoredDecision, error) {
	row := r.db.QueryRow(`
		SELECT id, task_id, action, decision, reason, expires_at, created_at
		FROM permission_decisions
		WHERE task_id = ? AND action = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, taskID, string(action))

	return r.scanStoredDecision(row)
}

// CleanupExpired removes all decisions whose expires_at is before now and returns the count deleted.
func (r *Repository) CleanupExpired() (int64, error) {
	now := time.Now().Format(time.RFC3339)
	result, err := r.db.Exec(`
		DELETE FROM permission_decisions WHERE expires_at IS NOT NULL AND expires_at < ?
	`, now)
	if err != nil {
		return 0, fmt.Errorf("cleanup expired decisions: %w", err)
	}

	count, _ := result.RowsAffected()
	r.log.Info("cleaned up expired decisions", "count", count)
	return count, nil
}

// scanStoredDecision reads a row into a StoredDecision.
func (r *Repository) scanStoredDecision(s scanner) (*StoredDecision, error) {
	var dec StoredDecision
	var expiresAtStr, createdAtStr sql.NullString
	var reason sql.NullString

	err := s.Scan(&dec.ID, &dec.TaskID, &dec.Action, &dec.Decision, &reason, &expiresAtStr, &createdAtStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("decision not found for %s/%s", dec.TaskID, dec.Action)
		}
		return nil, fmt.Errorf("scan decision: %w", err)
	}

	dec.Reason = reason.String

	if expiresAtStr.Valid && expiresAtStr.String != "" {
		t, err := time.Parse(time.RFC3339, expiresAtStr.String)
		if err == nil {
			dec.ExpiresAt = t
		}
	}
	if createdAtStr.Valid && createdAtStr.String != "" {
		t, err := time.Parse(time.RFC3339, createdAtStr.String)
		if err == nil {
			dec.CreatedAt = t
		}
	}

	return &dec, nil
}
