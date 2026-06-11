// GeoWork Go Core - Storage DB

package storage

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

func OpenDB() (*sql.DB, error) {
	path := GetDBPath()
	if err := EnsureDirs(); err != nil {
		return nil, fmt.Errorf("failed to ensure dirs: %w", err)
	}

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping db: %w", err)
	}

	db.SetMaxOpenConns(1)
	return db, nil
}
