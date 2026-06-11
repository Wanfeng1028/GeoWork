// GeoWork Go Core - Database Migrations

package storage

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// Migration represents a single database migration.
type Migration struct {
	Version int
	Query   string
	Desc    string
}

// AllMigrations contains all migrations in order.
var AllMigrations = []Migration{
	{
		Version: 1,
		Query: `
			CREATE TABLE IF NOT EXISTS workspaces (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				root_path TEXT NOT NULL,
				storage_mode TEXT DEFAULT 'local',
				branch TEXT DEFAULT 'main',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
		Desc: "Create workspaces table",
	},
	{
		Version: 2,
		Query: `
			CREATE TABLE IF NOT EXISTS tasks (
				id TEXT PRIMARY KEY,
				workspace_id TEXT NOT NULL,
				name TEXT NOT NULL,
				status TEXT DEFAULT 'pending',
				mode TEXT DEFAULT 'work',
				prompt TEXT,
				plan TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
			);
		`,
		Desc: "Create tasks table",
	},
	{
		Version: 3,
		Query: `
			CREATE TABLE IF NOT EXISTS task_events (
				id TEXT PRIMARY KEY,
				task_id TEXT NOT NULL,
				type TEXT NOT NULL,
				data TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
			);
		`,
		Desc: "Create task_events table",
	},
	{
		Version: 4,
		Query: `
			CREATE TABLE IF NOT EXISTS permissions (
				id TEXT PRIMARY KEY,
				task_id TEXT NOT NULL,
				action TEXT NOT NULL,
				level TEXT DEFAULT 'ask_every_time',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
		Desc: "Create permissions table",
	},
	{
		Version: 5,
		Query: `
			CREATE TABLE IF NOT EXISTS artifacts (
				id TEXT PRIMARY KEY,
				task_id TEXT NOT NULL,
				workspace_id TEXT NOT NULL,
				type TEXT NOT NULL,
				name TEXT NOT NULL,
				path TEXT NOT NULL,
				mime_type TEXT,
				preview_path TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (task_id) REFERENCES tasks(id),
				FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
			);
		`,
		Desc: "Create artifacts table",
	},
	{
		Version: 6,
		Query: `
			CREATE TABLE IF NOT EXISTS diffs (
				id TEXT PRIMARY KEY,
				task_id TEXT NOT NULL,
				file_path TEXT NOT NULL,
				old_content TEXT,
				new_content TEXT,
				diff_text TEXT,
				status TEXT DEFAULT 'pending',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (task_id) REFERENCES tasks(id)
			);
		`,
		Desc: "Create diffs table",
	},
	{
		Version: 7,
		Query: `
			CREATE TABLE IF NOT EXISTS knowledge_entries (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				content TEXT,
				source TEXT,
				category TEXT,
				tags TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
		Desc: "Create knowledge_entries table",
	},
	{
		Version: 8,
		Query: `
			CREATE TABLE IF NOT EXISTS mcp_servers (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				command TEXT NOT NULL,
				args TEXT,
				env TEXT,
				enabled INTEGER DEFAULT 1,
				timeout_ms INTEGER DEFAULT 30000,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
		Desc: "Create mcp_servers table",
	},
	{
		Version: 9,
		Query: `
			CREATE TABLE IF NOT EXISTS plugins (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				version TEXT,
				description TEXT,
				permissions TEXT,
				enabled INTEGER DEFAULT 1,
				manifest_path TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`,
		Desc: "Create plugins table",
	},
	{
		Version: 10,
		Query: `
			CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
			CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
			CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id);
			CREATE INDEX IF NOT EXISTS idx_diffs_task ON diffs(task_id);
			CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);
		`,
		Desc: "Create performance indexes",
	},
}

// RunMigrations executes all pending migrations up to the latest version.
func RunMigrations(db *sql.DB) error {
	if err := createSchemaVersionTable(db); err != nil {
		return fmt.Errorf("create schema version table: %w", err)
	}

	currentVersion, err := getSchemaVersion(db)
	if err != nil {
		return err
	}

	for _, m := range AllMigrations {
		if m.Version <= currentVersion {
			continue
		}

		if err := executeMigration(db, m); err != nil {
			return fmt.Errorf("migration %d (%s): %w", m.Version, m.Desc, err)
		}
	}

	return nil
}

// createSchemaVersionTable creates the migration tracking table if it doesn't exist.
func createSchemaVersionTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			key TEXT PRIMARY KEY,
			version INTEGER NOT NULL
		);
	`)
	return err
}

// getSchemaVersion returns the current schema version.
func getSchemaVersion(db *sql.DB) (int, error) {
	var version int
	err := db.QueryRow("SELECT version FROM schema_migrations WHERE key = 'schema_version'").Scan(&version)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return version, err
}

// executeMigration applies a single migration.
func executeMigration(db *sql.DB, m Migration) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	if _, err := tx.Exec(m.Query); err != nil {
		tx.Rollback()
		return fmt.Errorf("exec migration %d: %w", m.Version, err)
	}

	_, err = tx.Exec(
		"INSERT OR REPLACE INTO schema_migrations (key, version) VALUES ('schema_version', ?)",
		m.Version,
	)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("update version: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration %d: %w", m.Version, err)
	}

	return nil
}

// CurrentSchemaVersion returns the current schema version.
func CurrentSchemaVersion(db *sql.DB) (int, error) {
	return getSchemaVersion(db)
}

// LatestMigrationVersion returns the highest migration version number.
func LatestMigrationVersion() int {
	if len(AllMigrations) == 0 {
		return 0
	}
	return AllMigrations[len(AllMigrations)-1].Version
}

// UpgradesNeeded returns the number of pending migrations.
func UpgradesNeeded(db *sql.DB) (int, error) {
	current, err := getSchemaVersion(db)
	if err != nil {
		return 0, err
	}
	needed := 0
	for _, m := range AllMigrations {
		if m.Version > current {
			needed++
		}
	}
	return needed, nil
}
