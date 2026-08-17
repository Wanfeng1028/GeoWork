// doc/25 S2 regression tests: migration 006 must actually be registered and
// its ns→ms cursor normalization must run.
package migrations

import (
	"database/sql"
	"testing"
)

// TestRun_RegistersMigration006And007 pins the doc/25 S2 fix: 006 existed on
// disk but was never embedded/registered, so it never ran on any database.
func TestRun_RegistersMigration006And007(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := Run(db); err != nil {
		t.Fatalf("Run: %v", err)
	}

	for _, id := range []string{"006", "007"} {
		var n int
		if err := db.QueryRow("SELECT COUNT(*) FROM _migrations WHERE id = ?", id).Scan(&n); err != nil {
			t.Fatalf("query _migrations: %v", err)
		}
		if n != 1 {
			t.Errorf("migration %s not recorded in _migrations (n=%d)", id, n)
		}
	}

	// 007 must have created the model_providers table.
	var tbl string
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='model_providers'").Scan(&tbl)
	if err != nil {
		t.Errorf("model_providers table missing after migration 007: %v", err)
	}
}

// TestMigration006_NormalizesNanosecondCursors exercises the 006 SQL against
// a scratch sync_records table: ns-magnitude cursors are divided to ms,
// ms-magnitude cursors are untouched (idempotent).
func TestMigration006_NormalizesNanosecondCursors(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.Exec(`CREATE TABLE sync_records (id TEXT, cursor INTEGER)`); err != nil {
		t.Fatal(err)
	}
	const nsCursor = int64(1_700_000_000_000_000_000) // ns magnitude (> 1e15)
	const msCursor = int64(1_700_000_000_000)         // ms magnitude
	if _, err := db.Exec("INSERT INTO sync_records (id, cursor) VALUES ('ns', ?), ('ms', ?)", nsCursor, msCursor); err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec(cursorMilliseconds); err != nil {
		t.Fatalf("exec 006 sql: %v", err)
	}

	var gotNs, gotMs int64
	if err := db.QueryRow("SELECT cursor FROM sync_records WHERE id='ns'").Scan(&gotNs); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow("SELECT cursor FROM sync_records WHERE id='ms'").Scan(&gotMs); err != nil {
		t.Fatal(err)
	}
	if gotNs != nsCursor/1_000_000 {
		t.Errorf("ns cursor = %d, want %d", gotNs, nsCursor/1_000_000)
	}
	if gotMs != msCursor {
		t.Errorf("ms cursor changed: %d, want %d", gotMs, msCursor)
	}
}
