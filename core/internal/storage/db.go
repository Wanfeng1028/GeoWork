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

	// 启用 WAL 模式
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}
	// 优化同步策略
	if _, err := db.Exec("PRAGMA synchronous=NORMAL"); err != nil {
		return nil, fmt.Errorf("set synchronous mode: %w", err)
	}
	// 设置忙等待超时
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		return nil, fmt.Errorf("set busy timeout: %w", err)
	}

	return db, nil
}
