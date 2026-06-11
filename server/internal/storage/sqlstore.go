// Package storage — SQLite repository methods.
// All CRUD operations for v0.5.0 go through this file.
package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// scanTime converts an int64 unix timestamp to time.Time, returning the zero time on error.
func scanTime(val interface{}) time.Time {
	if v, ok := val.(int64); ok {
		return time.Unix(v, 0)
	}
	return time.Time{}
}

// ===========================
// User repository
// ===========================

func (s *Store) CreateUser(u *User) error {
	now := time.Now().Unix()
	u.CreatedAt = time.Unix(now, 0)
	u.UpdatedAt = u.CreatedAt
	_, err := s.db.Exec(`
		INSERT INTO users (id, email, name, avatar_url, plan, password_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Email, u.Name, u.AvatarURL, u.Plan, u.PasswordHash, now, now,
	)
	return err
}

func (s *Store) GetUserByEmail(email string) (*User, error) {
	u := &User{}
	var created, updated int64
	err := s.db.QueryRow(`
		SELECT id, email, name, avatar_url, plan, password_hash, created_at, updated_at
		FROM users WHERE email = ?`, email).Scan(
		&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Plan, &u.PasswordHash,
		&created, &updated,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = scanTime(created)
	u.UpdatedAt = scanTime(updated)
	return u, nil
}

func (s *Store) GetUserByID(id string) (*User, error) {
	u := &User{}
	var created, updated int64
	err := s.db.QueryRow(`
		SELECT id, email, name, avatar_url, plan, password_hash, created_at, updated_at
		FROM users WHERE id = ?`, id).Scan(
		&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Plan, &u.PasswordHash,
		&created, &updated,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = scanTime(created)
	u.UpdatedAt = scanTime(updated)
	return u, nil
}

func (s *Store) UpdateUser(u *User) error {
	u.UpdatedAt = time.Now()
	_, err := s.db.Exec(`
		UPDATE users SET name=?, avatar_url=?, plan=?, updated_at=? WHERE id=?`,
		u.Name, u.AvatarURL, u.Plan, u.UpdatedAt.Unix(), u.ID,
	)
	return err
}

// ===========================
// Token / Session repository
// ===========================

func (s *Store) CreateToken(t *Token) error {
	_, err := s.db.Exec(`
		INSERT INTO tokens (id, user_id, type, expires_at, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		t.ID, t.UserID, t.Type, t.ExpiresAt.Unix(), t.CreatedAt.Unix(),
	)
	return err
}

func (s *Store) GetToken(id string) (*Token, error) {
	t := &Token{}
	var expiresAt, createdAt int64
	err := s.db.QueryRow(`
		SELECT id, user_id, type, expires_at, created_at FROM tokens WHERE id = ?`, id).Scan(
		&t.ID, &t.UserID, &t.Type, &expiresAt, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t.ExpiresAt = scanTime(expiresAt)
	t.CreatedAt = scanTime(createdAt)
	return t, nil
}

func (s *Store) DeleteToken(id string) error {
	_, err := s.db.Exec("DELETE FROM tokens WHERE id = ?", id)
	return err
}

func (s *Store) InvalidateUserTokens(userID string) error {
	_, err := s.db.Exec("DELETE FROM tokens WHERE user_id = ?", userID)
	return err
}

// ===========================
// Team repository
// ===========================

func (s *Store) CreateTeam(t *Team) error {
	_, err := s.db.Exec(`INSERT INTO teams (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)`,
		t.ID, t.Name, t.OwnerID, t.CreatedAt.Unix(),
	)
	return err
}

func (s *Store) GetTeam(id string) (*Team, error) {
	t := &Team{}
	var createdAt int64
	err := s.db.QueryRow(`SELECT id, name, owner_id, created_at FROM teams WHERE id = ?`, id).Scan(
		&t.ID, &t.Name, &t.OwnerID, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t.CreatedAt = scanTime(createdAt)
	return t, nil
}

func (s *Store) ListTeamsByUser(userID string) ([]*Team, error) {
	rows, err := s.db.Query(`
		SELECT t.id, t.name, t.owner_id, t.created_at FROM teams t
		JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var teams []*Team
	for rows.Next() {
		t := &Team{}
		var createdAt int64
		if err := rows.Scan(&t.ID, &t.Name, &t.OwnerID, &createdAt); err != nil {
			return nil, err
		}
		t.CreatedAt = scanTime(createdAt)
		teams = append(teams, t)
	}
	return teams, rows.Err()
}

func (s *Store) AddTeamMember(tm *TeamMember) error {
	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)`,
		tm.TeamID, tm.UserID, tm.Role,
	)
	return err
}

func (s *Store) GetTeamMember(teamID, userID string) (*TeamMember, error) {
	tm := &TeamMember{}
	err := s.db.QueryRow(`SELECT team_id, user_id, role FROM team_members WHERE team_id=? AND user_id=?`,
		teamID, userID).Scan(&tm.TeamID, &tm.UserID, &tm.Role)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return tm, err
}

func (s *Store) UpdateTeamMemberRole(teamID, userID, role string) error {
	_, err := s.db.Exec(`UPDATE team_members SET role=? WHERE team_id=? AND user_id=?`, role, teamID, userID)
	return err
}

// ===========================
// UsageEvents repository
// ===========================

func (s *Store) AppendUsageEvent(e *UsageEvent) error {
	now := time.Now().Unix()
	e.Timestamp = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO usage_events (id, user_id, team_id, type, amount, model, timestamp, speed_multiplier)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID, e.UserID, e.TeamID, e.Type, e.Amount, e.Model, now, e.SpeedMultiplier,
	)
	return err
}

func (s *Store) GetUsageByUser(userID string) ([]*UsageEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, team_id, type, amount, model, timestamp, speed_multiplier
		FROM usage_events WHERE user_id=? ORDER BY timestamp DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []*UsageEvent
	for rows.Next() {
		e := &UsageEvent{}
		var timestamp int64
		if err := rows.Scan(&e.ID, &e.UserID, &e.TeamID, &e.Type, &e.Amount, &e.Model, &timestamp, &e.SpeedMultiplier); err != nil {
			return nil, err
		}
		e.Timestamp = scanTime(timestamp)
		events = append(events, e)
	}
	return events, rows.Err()
}

func (s *Store) GetUsageSummary(userID string) (map[string]int64, error) {
	sum := make(map[string]int64)
	// Sum amount grouped by type for this user
	rows, err := s.db.Query(`
		SELECT type, sum(amount) FROM usage_events WHERE user_id=? GROUP BY type`, userID)
	if err != nil {
		return sum, err
	}
	defer rows.Close()
	for rows.Next() {
		var typ string
		var total sql.NullInt64
		if err := rows.Scan(&typ, &total); err != nil {
			continue
		}
		sum[typ] = int64(total.Int64)
	}
	return sum, rows.Err()
}

func (s *Store) GetUsageByModel(userID string) (map[string]int64, error) {
	m := make(map[string]int64)
	rows, err := s.db.Query(`
		SELECT model, sum(amount) FROM usage_events WHERE user_id=? AND model!='' GROUP BY model`, userID)
	if err != nil {
		return m, err
	}
	defer rows.Close()
	for rows.Next() {
		var model string
		var total sql.NullInt64
		if err := rows.Scan(&model, &total); err != nil {
			continue
		}
		m[model] = int64(total.Int64)
	}
	return m, rows.Err()
}

// ===========================
// BillingData repository
// ===========================

func (s *Store) GetBillingData(userID string) (*BillingData, error) {
	b := &BillingData{}
	var updatedAt int64
	err := s.db.QueryRow(`
		SELECT user_id, plan, credits, usage_cost, updated_at FROM billing_data WHERE user_id=?`, userID).Scan(
		&b.UserID, &b.Plan, &b.Credits, &b.UsageCost, &updatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	b.UpdatedAt = scanTime(updatedAt)
	return b, nil
}

func (s *Store) UpsertBillingData(b *BillingData) error {
	now := time.Now()
	b.UpdatedAt = now
	_, err := s.db.Exec(`
		INSERT INTO billing_data (user_id, plan, credits, usage_cost, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET plan=?, credits=?, usage_cost=?, updated_at=?`,
		b.UserID, b.Plan, b.Credits, b.UsageCost, now.Unix(),
		b.Plan, b.Credits, b.UsageCost, now.Unix(),
	)
	return err
}

// ===========================
// SyncRecords repository
// ===========================

func (s *Store) UpsertSyncRecord(r *SyncRecord) error {
	now := time.Now().Unix()
	r.CreatedAt = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO sync_records (id, user_id, object_type, object_id, data, cursor, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, object_type, object_id) DO UPDATE SET data=?, cursor=?, created_at=?`,
		r.ID, r.UserID, r.ObjectType, r.ObjectID, r.Data, r.Cursor, now,
		r.Data, r.Cursor, now,
	)
	return err
}

func (s *Store) GetSyncRecordsAfter(userID string, cursor int64) ([]*SyncRecord, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, object_type, object_id, data, cursor, created_at
		FROM sync_records WHERE user_id=? AND cursor>? ORDER BY cursor ASC`, userID, cursor)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var recs []*SyncRecord
	for rows.Next() {
		r := &SyncRecord{}
		var createdAt int64
		if err := rows.Scan(&r.ID, &r.UserID, &r.ObjectType, &r.ObjectID, &r.Data, &r.Cursor, &createdAt); err != nil {
			return nil, err
		}
		r.CreatedAt = scanTime(createdAt)
		recs = append(recs, r)
	}
	return recs, rows.Err()
}

func (s *Store) GetSyncState(userID string) (int64, error) {
	var maxCursor sql.NullInt64
	err := s.db.QueryRow(`SELECT MAX(cursor) FROM sync_records WHERE user_id=?`, userID).Scan(&maxCursor)
	if err != nil {
		return 0, err
	}
	if !maxCursor.Valid {
		return 0, nil
	}
	return maxCursor.Int64, nil
}

// ===========================
// TelemetryEvents repository
// ===========================

func (s *Store) AppendTelemetryEvent(e *TelemetryEvent) error {
	now := time.Now().Unix()
	e.Timestamp = time.Unix(now, 0)
	meta, _ := json.Marshal(e.Metadata)
	_, err := s.db.Exec(`
		INSERT INTO telemetry_events (id, user_id, type, value, metadata, timestamp)
		VALUES (?, ?, ?, ?, ?, ?)`,
		e.ID, e.UserID, e.Type, e.Value, string(meta), now,
	)
	return err
}

// ===========================
// CrashReports repository
// ===========================

func (s *Store) AppendCrashReport(r *CrashReport) error {
	now := time.Now().Unix()
	r.Timestamp = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO crash_reports (id, app_version, os, message, stacktrace, has_minidump, has_logs, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.AppVersion, r.OS, r.Message, r.Stacktrace, r.HasMinidump, r.HasLogs, now,
	)
	return err
}

// ===========================
// Marketplace repository
// ===========================

func (s *Store) ListMarketplaceItems() ([]*MarketplaceItem, error) {
	rows, err := s.db.Query(`
		SELECT id, name, type, version, description, author, permissions, install_count, signature
		FROM marketplace_items`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []*MarketplaceItem
	for rows.Next() {
		it := &MarketplaceItem{}
		var permsRaw string
		if err := rows.Scan(&it.ID, &it.Name, &it.Type, &it.Version, &it.Description, &it.Author, &permsRaw, &it.InstallCount, &it.Signature); err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(permsRaw), &it.Permissions)
		items = append(items, it)
	}
	return items, rows.Err()
}

func (s *Store) GetMarketplaceItem(id string) (*MarketplaceItem, error) {
	it := &MarketplaceItem{}
	var permsRaw string
	err := s.db.QueryRow(`
		SELECT id, name, type, version, description, author, permissions, install_count, signature
		FROM marketplace_items WHERE id=?`, id).Scan(
		&it.ID, &it.Name, &it.Type, &it.Version, &it.Description, &it.Author, &permsRaw,
		&it.InstallCount, &it.Signature,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	json.Unmarshal([]byte(permsRaw), &it.Permissions)
	return it, err
}

// ===========================
// CollabRecords repository
// ===========================

func (s *Store) AppendCollabRecord(r *CollabRecord) error {
	now := time.Now().Unix()
	r.Timestamp = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO collab_records (id, workspace_id, type, user_id, data, timestamp)
		VALUES (?, ?, ?, ?, ?, ?)`,
		r.ID, r.WorkspaceID, r.Type, r.UserID, r.Data, now,
	)
	return err
}

func (s *Store) GetCollabRecordsByWorkspace(workspaceID string) ([]*CollabRecord, error) {
	rows, err := s.db.Query(`
		SELECT id, workspace_id, type, user_id, data, timestamp
		FROM collab_records WHERE workspace_id=? ORDER BY timestamp DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var recs []*CollabRecord
	for rows.Next() {
		r := &CollabRecord{}
		var timestamp int64
		if err := rows.Scan(&r.ID, &r.WorkspaceID, &r.Type, &r.UserID, &r.Data, &timestamp); err != nil {
			return nil, err
		}
		r.Timestamp = scanTime(timestamp)
		recs = append(recs, r)
	}
	return recs, rows.Err()
}

// ===========================
// ChannelWebhooks repository
// ===========================

func (s *Store) AppendChannelWebhook(wh *ChannelWebhook) error {
	now := time.Now().Unix()
	wh.CreatedAt = time.Unix(now, 0)
	active := 0
	if wh.Active {
		active = 1
	}
	_, err := s.db.Exec(`
		INSERT INTO channel_webhooks (id, channel_id, url, team_id, active, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		wh.ID, wh.ChannelID, wh.URL, wh.TeamID, active, now,
	)
	return err
}

func (s *Store) ListChannelWebhooks() ([]*ChannelWebhook, error) {
	rows, err := s.db.Query(`
		SELECT id, channel_id, url, team_id, active, created_at FROM channel_webhooks`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var whs []*ChannelWebhook
	for rows.Next() {
		wh := &ChannelWebhook{}
		var active int
		var createdAt int64
		if err := rows.Scan(&wh.ID, &wh.ChannelID, &wh.URL, &wh.TeamID, &active, &createdAt); err != nil {
			return nil, err
		}
		wh.Active = active == 1
		wh.CreatedAt = scanTime(createdAt)
		whs = append(whs, wh)
	}
	return whs, rows.Err()
}

// ===========================
// Helpers
// ===========================

// extractObjectID is the old helper kept for backwards compatibility.
func extractObjectID(id string, prefix string) string {
	return strings.TrimPrefix(id, prefix+"/")
}

// Ensure non-empty time values.
var _ = fmt.Sprintf // keep import
var _ = time.Now   // keep import
