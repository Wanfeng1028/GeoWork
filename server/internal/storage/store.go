// Package storage provides the in-memory data store for v0.4.0.
// Planned migration to SQLite in v0.5.0.
package storage

import (
	"sync"
	"time"
)

// Store is the central in-memory data store.
type Store struct {
	Mu               sync.RWMutex
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
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TeamID    string    `json:"team_id"`
	Type      string    `json:"type"` // model_tokens | model_requests | tool_calls | browser_usage | sync_storage
	Amount    int64     `json:"amount"`
	Model     string    `json:"model"`
	Timestamp time.Time `json:"timestamp"`
}

// BillingData tracks credits and plans.
type BillingData struct {
	UserID    string  `json:"user_id"`
	Plan      string  `json:"plan"`
	Credits   float64 `json:"credits"`
	UsageCost float64 `json:"usage_cost"`
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

// NewStore creates a new in-memory store.
func NewStore() *Store {
	return &Store{
		Users:       make(map[string]*User),
		Tokens:      make(map[string]*Token),
		Teams:       make(map[string]*Team),
		TeamMembers: make(map[string]*TeamMember),
		SyncRecords: make(map[string]*SyncRecord),
	}
}
