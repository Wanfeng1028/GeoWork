// Package storage provides the persistent data store (SQLite) for v0.5.0.
//
// The Store struct holds a *sql.DB connection and all model definitions.
// CRUD operations are implemented in sqlstore.go via repository methods.
// In-memory map fields (Users, Tokens, etc.) are kept for backwards
// compatibility with service code — they are populated on-demand from SQLite.
package storage

import (
	"database/sql"
	"sync"
	"time"

	_ "modernc.org/sqlite"
	"server/internal/storage/migrations"
)

// Store is the central data store backed by SQLite in v0.5.0.
type Store struct {
	Mu    sync.RWMutex
	db    *sql.DB
	dbErr error // non-nil if DB is unavailable

	// Legacy in-memory maps kept for compatibility.
	// Populate via repository methods; never write directly to them.
	Users            map[string]*User
	Tokens           map[string]*Token
	Teams            map[string]*Team
	TeamMembers      map[string]*TeamMember
	UsageEvents      []*UsageEvent
	BillingData      *BillingData
	MarketplaceItems []*MarketplaceItem
	TelemetryEvents  []*TelemetryEvent
	CrashReports     []*CrashReport
	SyncRecords      map[string]*SyncRecord
	CollabRecords    []*CollabRecord
	ChannelWebhooks  []*ChannelWebhook
}

// User represents a registered user.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	AvatarURL    string    `json:"avatar_url"`
	Plan         string    `json:"plan"` // free | pro | team
	PasswordHash string    `json:"-"`    // hashed password, not exposed in JSON
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Token represents an auth token.
type Token struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"` // access | refresh
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// Team represents a team workspace.
type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OwnerID   string    `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
}

// TeamMember represents a team membership.
type TeamMember struct {
	TeamID string `json:"team_id"`
	UserID string `json:"user_id"`
	Role   string `json:"role"` // owner | admin | member | viewer
}

// UsageEvent tracks resource usage.
type UsageEvent struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	TeamID           string    `json:"team_id"`
	Type             string    `json:"type"` // model_tokens | model_requests | tool_calls | browser_usage | sync_storage
	Amount           int64     `json:"amount"`
	Model            string    `json:"model"`
	Timestamp        time.Time `json:"timestamp"`
	SpeedMultiplier  float64   `json:"speed_multiplier"` // 2x rate weighting for paid plans
}

// BillingData tracks credits and plans.
type BillingData struct {
	UserID    string    `json:"user_id"`
	Plan      string    `json:"plan"`
	Credits   float64   `json:"credits"`
	UsageCost float64   `json:"usage_cost"`
	UpdatedAt time.Time `json:"updated_at"`
}

// MarketplaceItem represents a plugin/skill in the marketplace.
type MarketplaceItem struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Type         string   `json:"type"` // plugin | skill | connector
	Version      string   `json:"version"`
	Description  string   `json:"description"`
	Author       string   `json:"author"`
	Permissions  []string `json:"permissions"`
	InstallCount int      `json:"install_count"`
	Signature    string   `json:"signature"`
}

// TelemetryEvent tracks performance metrics.
type TelemetryEvent struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Type      string                 `json:"type"` // fps | task_duration | tool_duration | model_latency | memory | cpu
	Value     float64                `json:"value"`
	Metadata  map[string]interface{} `json:"metadata"`
	Timestamp time.Time              `json:"timestamp"`
}

// CrashReport represents a crash report.
type CrashReport struct {
	ID          string    `json:"id"`
	AppVersion  string    `json:"app_version"`
	OS          string    `json:"os"`
	Message     string    `json:"message"`
	Stacktrace  string    `json:"stacktrace"`
	HasMinidump bool      `json:"has_minidump"`
	HasLogs     bool      `json:"has_logs"`
	Timestamp   time.Time `json:"timestamp"`
}

// SyncRecord represents a sync operation.
type SyncRecord struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	ObjectType string    `json:"object_type"` // settings | workspace | task | artifact | knowledge
	ObjectID   string    `json:"object_id"`
	Data       string    `json:"data"` // JSON
	Cursor     int64     `json:"cursor"`
	CreatedAt  time.Time `json:"created_at"`
}

// CollabRecord represents collaboration data.
type CollabRecord struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Type        string    `json:"type"` // activity | comment | assign | share
	UserID      string    `json:"user_id"`
	Data        string    `json:"data"`
	Timestamp   time.Time `json:"timestamp"`
}

// ChannelWebhook represents a webhook endpoint.
type ChannelWebhook struct {
	ID        string    `json:"id"`
	ChannelID string    `json:"channel_id"`
	URL       string    `json:"url"`
	TeamID    string    `json:"team_id"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}

// NewStore creates a new SQLite-backed store.
// The path argument is the path to the SQLite database file.
// Pass an empty string for an in-memory database (testing only).
// Automatically runs migrations on first open.
func NewStore(path string) *Store {
	s := &Store{
		Users:            make(map[string]*User),
		Tokens:           make(map[string]*Token),
		Teams:            make(map[string]*Team),
		TeamMembers:      make(map[string]*TeamMember),
		SyncRecords:      make(map[string]*SyncRecord),
		MarketplaceItems: make([]*MarketplaceItem, 0),
	}

	if path == "" {
		path = ":memory:"
	}

	dsn := path
	if path != ":memory:" {
		dsn = path + "?_journal_mode=WAL&_busy_timeout=5000"
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		s.dbErr = err
		return s
	}
	// PRAGMAs for better concurrency and durability
	for _, prag := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA foreign_keys=ON",
	} {
		if _, err := db.Exec(prag); err != nil {
			s.dbErr = err
			return s
		}
	}
	s.db = db

	// Run migrations automatically
	if err := migrations.Run(db); err != nil {
		s.dbErr = err
		return s
	}

	return s
}

// DB returns the underlying *sql.DB. Callers should not close it.
func (s *Store) DB() *sql.DB {
	return s.db
}

// Close shuts down the store and releases resources.
func (s *Store) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return s.dbErr
}

// DBReady returns true if the underlying database is available.
func (s *Store) DBReady() bool {
	return s.db != nil && s.dbErr == nil
}

// DBErr returns the error that occurred during DB open, or nil.
func (s *Store) DBErr() error {
	return s.dbErr
}

// EnsureDefaults seeds the database with default billing plans and
// marketplace items on first run, mirroring the old in-memory seeds.
func (s *Store) EnsureDefaults() error {
	if !s.DBReady() {
		return s.dbErr
	}

	// Seed billing plans — only insert if none exist yet.
	count := 0
	if err := s.db.QueryRow("SELECT count(*) FROM billing_data").Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		now := time.Now().Unix()
		plans := []struct {
			userID, plan  string
			credits       float64
		}{
			{"system_default", "free", 10.0},
			{"system_default", "pro", 100.0},
			{"system_default", "team", 500.0},
		}
		for _, p := range plans {
			_, err := s.db.Exec(
				`INSERT OR IGNORE INTO billing_data (user_id, plan, credits, usage_cost, updated_at) VALUES (?, ?, ?, 0, ?)`,
				p.userID, p.plan, p.credits, now,
			)
			if err != nil {
				return err
			}
		}
	}

	// Seed marketplace items if none exist.
	mcount := 0
	if err := s.db.QueryRow("SELECT count(*) FROM marketplace_items").Scan(&mcount); err != nil {
		return err
	}
	if mcount == 0 {
		items := []struct {
			id, name, typ, version, desc, author, sig string
			perms                                      string
			installs                                   int
		}{
			{"plugin-openalex", "OpenAlex Plugin", "plugin", "1.0.0", "Search and import papers from OpenAlex database", "GeoWork Team", "sha256:abc123", `["network","file_write"]`, 1250},
			{"plugin-zotero", "Zotero Plugin", "plugin", "1.2.0", "Import papers and notes from Zotero library", "GeoWork Team", "sha256:def456", `["network","file_read"]`, 890},
			{"skill-ndvi", "NDVI Analysis Skill", "skill", "2.0.0", "Automated NDVI time series analysis with GEE", "GeoWork Team", "sha256:ghi789", `["python","network","file_write"]`, 3400},
			{"skill-map-export", "Map Export Skill", "skill", "1.1.0", "Generate publication-quality maps with QGIS", "GeoWork Team", "sha256:jkl012", `["shell","file_write"]`, 2100},
			{"connector-feishu", "Feishu Connector", "connector", "1.0.0", "Create tasks from Feishu messages", "GeoWork Team", "sha256:mno345", `["webhook"]`, 340},
		}
		for _, it := range items {
			_, err := s.db.Exec(
				`INSERT OR IGNORE INTO marketplace_items (id, name, type, version, description, author, permissions, install_count, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				it.id, it.name, it.typ, it.version, it.desc, it.author, it.perms, it.installs, it.sig,
			)
			if err != nil {
				return err
			}
		}
	}

	return nil
}
