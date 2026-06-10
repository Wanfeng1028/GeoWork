package permissions

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// PermissionRepository handles CRUD operations for permission entries.
type PermissionRepository struct {
	db  *sql.DB
	log *slog.Logger
}

// PermissionEntry represents a single permission record in the database.
type PermissionEntry struct {
	ID        string                 `json:"id"`
	Resource  string                 `json:"resource"`
	Action    string                 `json:"action"`
	Effect    string                 `json:"effect"`
	Conditions map[string]string   `json:"conditions,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

const permissionTableSQL = `
CREATE TABLE IF NOT EXISTS permissions (
	id TEXT PRIMARY KEY,
	resource TEXT NOT NULL,
	action TEXT NOT NULL,
	effect TEXT NOT NULL DEFAULT 'allow',
	conditions TEXT,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

const permissionIndexSQL = `
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_permissions_effect ON permissions(effect);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
`

// NewPermissionRepository creates a new repository and ensures tables/indexes exist.
func NewPermissionRepository(db *sql.DB) *PermissionRepository {
	return &PermissionRepository{
		db:  db,
		log: slog.Default(),
	}
}

// Init ensures the permissions table and indexes are created.
func (pr *PermissionRepository) Init() error {
	if _, err := pr.db.Exec(permissionTableSQL); err != nil {
		return fmt.Errorf("create permissions table: %w", err)
	}
	if _, err := pr.db.Exec(permissionIndexSQL); err != nil {
		return fmt.Errorf("create permission indexes: %w", err)
	}
	return nil
}

// Create inserts a new permission entry.
func (pr *PermissionRepository) Create(entry PermissionEntry) error {
	if entry.ID == "" {
		entry.ID = generateUUID()
	}
	if entry.Resource == "" || entry.Action == "" {
		return fmt.Errorf("resource and action are required")
	}
	if entry.Effect == "" {
		entry.Effect = "allow"
	}
	now := time.Now().Format(time.RFC3339)
	entry.CreatedAt = time.Now()
	entry.UpdatedAt = now

	conditionsJSON, err := json.Marshal(entry.Conditions)
	if err != nil {
		return fmt.Errorf("marshal conditions: %w", err)
	}

	_, err = pr.db.Exec(`
		INSERT INTO permissions (id, resource, action, effect, conditions, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, entry.ID, entry.Resource, entry.Action, entry.Effect, string(conditionsJSON), now, now)

	if err != nil {
		return fmt.Errorf("create permission: %w", err)
	}

	pr.log.Info("permission created", "id", entry.ID, "resource", entry.Resource, "action", entry.Action)
	return nil
}

// Get retrieves a permission entry by ID.
func (pr *PermissionRepository) Get(id string) (*PermissionEntry, error) {
	row := pr.db.QueryRow(`
		SELECT id, resource, action, effect, conditions, created_at, updated_at
		FROM permissions WHERE id = ?
	`, id)

	return pr.scanEntry(row)
}

// List returns permission entries, optionally filtered by resource and action.
func (pr *PermissionRepository) List(resource string, action string) ([]PermissionEntry, error) {
	query := `SELECT id, resource, action, effect, conditions, created_at, updated_at FROM permissions`
	args := []interface{}{}

	conditions := ""
	if resource != "" && action != "" {
		conditions = " WHERE resource = ? AND action = ?"
		args = append(args, resource, action)
	} else if resource != "" {
		conditions = " WHERE resource = ?"
		args = append(args, resource)
	} else if action != "" {
		conditions = " WHERE action = ?"
		args = append(args, action)
	}

	query += conditions

	rows, err := pr.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	defer rows.Close()

	var entries []PermissionEntry
	for rows.Next() {
		entry, err := pr.scanEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, *entry)
	}
	return entries, rows.Err()
}

// Update replaces an existing permission entry by ID.
func (pr *PermissionRepository) Update(id string, entry PermissionEntry) error {
	if entry.Resource == "" || entry.Action == "" {
		return fmt.Errorf("resource and action are required")
	}

	existing, err := pr.Get(id)
	if err != nil {
		return fmt.Errorf("existing entry not found: %w", err)
	}
	entry.CreatedAt = existing.CreatedAt

	entry.UpdatedAt = time.Now()
	now := entry.UpdatedAt.Format(time.RFC3339)

	conditionsJSON, err := json.Marshal(entry.Conditions)
	if err != nil {
		return fmt.Errorf("marshal conditions: %w", err)
	}

	_, err = pr.db.Exec(`
		UPDATE permissions SET resource = ?, action = ?, effect = ?, conditions = ?, updated_at = ?
		WHERE id = ?
	`, entry.Resource, entry.Action, entry.Effect, string(conditionsJSON), now, id)

	if err != nil {
		return fmt.Errorf("update permission: %w", err)
	}

	pr.log.Info("permission updated", "id", id)
	return nil
}

// Delete removes a permission entry by ID.
func (pr *PermissionRepository) Delete(id string) error {
	result, err := pr.db.Exec("DELETE FROM permissions WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete permission: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("permission not found: %s", id)
	}

	pr.log.Info("permission deleted", "id", id)
	return nil
}

// FindMatching returns all permission entries matching the given resource and action.
func (pr *PermissionRepository) FindMatching(resource, action string) ([]PermissionEntry, error) {
	rows, err := pr.db.Query(`
		SELECT id, resource, action, effect, conditions, created_at, updated_at
		FROM permissions
		WHERE resource = ? OR resource = '*'
		AND action = ? OR action = '*'
	`, resource, action)

	if err != nil {
		return nil, fmt.Errorf("find matching permissions: %w", err)
	}
	defer rows.Close()

	var entries []PermissionEntry
	for rows.Next() {
		entry, err := pr.scanEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, *entry)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate permissions: %w", err)
	}

	return entries, nil
}

// FindByResource returns all permissions for a specific resource.
func (pr *PermissionRepository) FindByResource(resource string) ([]PermissionEntry, error) {
	return pr.List(resource, "")
}

// FindByAction returns all permissions for a specific action.
func (pr *PermissionRepository) FindByAction(action string) ([]PermissionEntry, error) {
	return pr.List("", action)
}

// Count returns the total number of permission entries.
func (pr *PermissionRepository) Count() (int, error) {
	var count int
	err := pr.db.QueryRow("SELECT COUNT(*) FROM permissions").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count permissions: %w", err)
	}
	return count, nil
}

// ClearAll removes all permission entries.
func (pr *PermissionRepository) ClearAll() error {
	_, err := pr.db.Exec("DELETE FROM permissions")
	if err != nil {
		return fmt.Errorf("clear all permissions: %w", err)
	}
	pr.log.Info("all permissions cleared")
	return nil
}

// BatchCreate inserts multiple permission entries.
func (pr *PermissionRepository) BatchCreate(entries []PermissionEntry) error {
	tx, err := pr.db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	stmt, err := tx.Prepare(`
		INSERT INTO permissions (id, resource, action, effect, conditions, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	now := time.Now().Format(time.RFC3339)

	for _, entry := range entries {
		if entry.ID == "" {
			entry.ID = generateUUID()
		}
		if entry.Effect == "" {
			entry.Effect = "allow"
		}
		entry.CreatedAt = time.Now()
		entry.UpdatedAt, _ = time.Parse(time.RFC3339, now)

		conditionsJSON, err := json.Marshal(entry.Conditions)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("marshal conditions for %s: %w", entry.Resource, err)
		}

		if _, err := stmt.Exec(entry.ID, entry.Resource, entry.Action, entry.Effect, string(conditionsJSON), now, now); err != nil {
			tx.Rollback()
			return fmt.Errorf("batch insert %s/%s: %w", entry.Resource, entry.Action, err)
		}
	}

	return tx.Commit()
}

// scanEntry reads a single row into a PermissionEntry.
func (pr *PermissionRepository) scanEntry(row scanner) (*PermissionEntry, error) {
	var id, resource, action, effect string
	var conditionsStr string
	var createdAtStr, updatedAtStr string

	if err := row.Scan(&id, &resource, &action, &effect, &conditionsStr, &createdAtStr, &updatedAtStr); err != nil {
		return nil, fmt.Errorf("scan permission entry: %w", err)
	}

	var conditions map[string]string
	if conditionsStr != "" {
		if err := json.Unmarshal([]byte(conditionsStr), &conditions); err != nil {
			return nil, fmt.Errorf("unmarshal conditions: %w", err)
		}
	}

	createdAt, err := time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		createdAt = time.Time{}
	}

	updatedAt, err := time.Parse(time.RFC3339, updatedAtStr)
	if err != nil {
		updatedAt = time.Time{}
	}

	return &PermissionEntry{
		ID:         id,
		Resource:   resource,
		Action:     action,
		Effect:     effect,
		Conditions: conditions,
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}, nil
}

// generateUUID generates a simple UUID-like identifier.
func generateUUID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
