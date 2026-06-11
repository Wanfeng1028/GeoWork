// Package migrations provides SQLite schema migrations for v0.5.0.
package migrations

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"log"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed 001_initial_schema.sql
var initialSchema string

// Run executes all pending migrations on the given database.
func Run(db *sql.DB) error {
	if err := createSchemaTable(db); err != nil {
		return fmt.Errorf("create schema table: %w", err)
	}

	applied, err := getAppliedMigrations(db)
	if err != nil {
		return fmt.Errorf("get applied migrations: %w", err)
	}

	migrations := []*Migration{
		{ID: "001", Name: "initial_schema", SQL: initialSchema},
	}

	for _, m := range migrations {
		if applied[m.ID] {
			continue
		}
		log.Printf("[migration] running %s: %s", m.ID, m.Name)
		if err := executeMigration(db, m); err != nil {
			return fmt.Errorf("migration %s: %w", m.ID, err)
		}
		log.Printf("[migration] applied %s: %s", m.ID, m.Name)
	}

	return nil
}

type Migration struct {
	ID  string
	Name string
	SQL string
}

func createSchemaTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			id       TEXT PRIMARY KEY,
			name     TEXT NOT NULL,
			applied_at INTEGER NOT NULL
		)
	`)
	return err
}

func getAppliedMigrations(db *sql.DB) (map[string]bool, error) {
	rows, err := db.Query("SELECT id FROM _migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

func executeMigration(db *sql.DB, m *Migration) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(m.SQL); err != nil {
		return fmt.Errorf("exec sql: %w", err)
	}

	now := time.Now().Unix()
	if _, err := tx.Exec("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
		m.ID, m.Name, now); err != nil {
		return fmt.Errorf("record migration: %w", err)
	}

	return tx.Commit()
}

// RunInMemory is a convenience wrapper that opens an in-memory SQLite database
// and runs all migrations on it. Useful for testing.
func RunInMemory(ctx context.Context) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		return nil, err
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	if err := Run(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
