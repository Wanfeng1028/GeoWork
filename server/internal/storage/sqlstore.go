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
		INSERT INTO users (id, email, name, avatar_url, plan, password_hash, created_at, updated_at, deleted_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
		u.ID, u.Email, u.Name, u.AvatarURL, u.Plan, u.PasswordHash, now, now,
	)
	return err
}

func (s *Store) GetUserByEmail(email string) (*User, error) {
	u := &User{}
	var created, updated, deletedAt int64
	err := s.db.QueryRow(`
		SELECT id, email, name, avatar_url, plan, password_hash, created_at, updated_at, deleted_at
		FROM users WHERE email = ?`, email).Scan(
		&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Plan, &u.PasswordHash,
		&created, &updated, &deletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = scanTime(created)
	u.UpdatedAt = scanTime(updated)
	if deletedAt > 0 {
		t := scanTime(deletedAt)
		u.DeletedAt = &t
	}
	return u, nil
}

func (s *Store) GetUserByID(id string) (*User, error) {
	u := &User{}
	var created, updated, deletedAt int64
	err := s.db.QueryRow(`
		SELECT id, email, name, avatar_url, plan, password_hash, created_at, updated_at, deleted_at
		FROM users WHERE id = ?`, id).Scan(
		&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Plan, &u.PasswordHash,
		&created, &updated, &deletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = scanTime(created)
	u.UpdatedAt = scanTime(updated)
	if deletedAt > 0 {
		t := scanTime(deletedAt)
		u.DeletedAt = &t
	}
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

// SoftDeleteUser marks a user as deleted by setting deleted_at.
func (s *Store) SoftDeleteUser(userID string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(`UPDATE users SET deleted_at=?, updated_at=? WHERE id=?`, now, now, userID)
	return err
}

// UpdateUserPassword updates the password hash for a user.
func (s *Store) UpdateUserPassword(userID, passwordHash string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(`UPDATE users SET password_hash=?, updated_at=? WHERE id=?`, passwordHash, now, userID)
	return err
}

// GetUserStats returns aggregated stats for a user.
func (s *Store) GetUserStats(userID string) (map[string]int64, int64, error) {
	summary := make(map[string]int64)
	// Get usage summary
	rows, qerr := s.db.Query(`SELECT type, SUM(amount) FROM usage_events WHERE user_id=? GROUP BY type`, userID)
	if qerr != nil {
		return summary, 0, qerr
	}
	defer rows.Close()
	for rows.Next() {
		var typ string
		var total sql.NullInt64
		if err := rows.Scan(&typ, &total); err == nil {
			summary[typ] = total.Int64
		}
	}
	// Get last active (most recent usage event or telemetry)
	var lastUsage, lastTelemetry sql.NullInt64
	_ = s.db.QueryRow(`SELECT MAX(timestamp) FROM usage_events WHERE user_id=?`, userID).Scan(&lastUsage)
	_ = s.db.QueryRow(`SELECT MAX(timestamp) FROM telemetry_events WHERE user_id=?`, userID).Scan(&lastTelemetry)
	last := lastUsage.Int64
	if lastTelemetry.Int64 > last {
		last = lastTelemetry.Int64
	}
	return summary, last, nil
}

// RemoveTeamMember removes a member from a team.
func (s *Store) RemoveTeamMember(teamID, userID string) error {
	_, err := s.db.Exec(`DELETE FROM team_members WHERE team_id=? AND user_id=?`, teamID, userID)
	return err
}

// ListTeamMembersWithUser returns team members with their user info.
func (s *Store) ListTeamMembersWithUser(teamID string) ([]*TeamMemberInfo, error) {
	rows, err := s.db.Query(`
		SELECT tm.user_id, tm.role, u.name, u.email, u.avatar_url
		FROM team_members tm
		JOIN users u ON u.id = tm.user_id
		WHERE tm.team_id = ? AND u.deleted_at = 0`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var members []*TeamMemberInfo
	for rows.Next() {
		m := &TeamMemberInfo{}
		if err := rows.Scan(&m.UserID, &m.Role, &m.Name, &m.Email, &m.AvatarURL); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

// TeamMemberInfo holds member details including user info.
type TeamMemberInfo struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

// SoftDeleteTeam soft-deletes a team by removing all member associations.
func (s *Store) SoftDeleteTeam(teamID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Remove all team members
	if _, err := tx.Exec(`DELETE FROM team_members WHERE team_id=?`, teamID); err != nil {
		return err
	}
	// Mark team as deleted by setting owner_id to empty (logical deletion)
	if _, err := tx.Exec(`UPDATE teams SET owner_id='__deleted__' WHERE id=?`, teamID); err != nil {
		return err
	}
	return tx.Commit()
}

// TransferTeamOwnership transfers team ownership from one user to another.
func (s *Store) TransferTeamOwnership(teamID, fromUserID, toUserID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Update team owner
	if _, err := tx.Exec(`UPDATE teams SET owner_id=? WHERE id=? AND owner_id=?`, toUserID, teamID, fromUserID); err != nil {
		return err
	}
	// Update old owner role to admin
	if _, err := tx.Exec(`UPDATE team_members SET role='admin' WHERE team_id=? AND user_id=?`, teamID, fromUserID); err != nil {
		return err
	}
	// Update new owner role
	if _, err := tx.Exec(`UPDATE team_members SET role='owner' WHERE team_id=? AND user_id=?`, teamID, toUserID); err != nil {
		return err
	}
	return tx.Commit()
}

// ListTeamWorkspaces returns workspace IDs associated with a team via collab_records.
func (s *Store) ListTeamWorkspaces(teamID string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT cr.workspace_id FROM collab_records cr
		JOIN team_members tm ON tm.user_id = cr.user_id
		WHERE tm.team_id = ?`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
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

func (s *Store) GetSyncRecordsByTypes(userID string, cursor int64, types []string) ([]*SyncRecord, error) {
	if len(types) == 0 {
		return s.GetSyncRecordsAfter(userID, cursor)
	}
	placeholders := make([]string, len(types))
	args := make([]interface{}, 0, len(types)+2)
	args = append(args, userID, cursor)
	for i, t := range types {
		placeholders[i] = "?"
		args = append(args, t)
	}
	query := fmt.Sprintf(`
		SELECT id, user_id, object_type, object_id, data, cursor, created_at
		FROM sync_records WHERE user_id=? AND cursor>? AND object_type IN (%s) ORDER BY cursor ASC`,
		strings.Join(placeholders, ","))
	rows, err := s.db.Query(query, args...)
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

func (s *Store) DeleteSyncRecordsBefore(cutoff int64) (int64, error) {
	result, err := s.db.Exec("DELETE FROM sync_records WHERE created_at < ?", cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (s *Store) GetSyncHistory(userID string, limit int) ([]*SyncRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(`
		SELECT id, user_id, object_type, object_id, data, cursor, created_at
		FROM sync_records WHERE user_id=? ORDER BY cursor DESC LIMIT ?`,
		userID, limit)
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

func (s *Store) GetSyncRecordByObject(userID, objectType, objectID string) (*SyncRecord, error) {
	r := &SyncRecord{}
	var createdAt int64
	err := s.db.QueryRow(`
		SELECT id, user_id, object_type, object_id, data, cursor, created_at
		FROM sync_records WHERE user_id=? AND object_type=? AND object_id=?`,
		userID, objectType, objectID).Scan(
		&r.ID, &r.UserID, &r.ObjectType, &r.ObjectID, &r.Data, &r.Cursor, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt = scanTime(createdAt)
	return r, nil
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
		INSERT INTO channel_webhooks (id, channel_id, url, team_id, active, secret, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		wh.ID, wh.ChannelID, wh.URL, wh.TeamID, active, wh.Secret, now,
	)
	return err
}

func (s *Store) ListChannelWebhooks() ([]*ChannelWebhook, error) {
	rows, err := s.db.Query(`
		SELECT id, channel_id, url, team_id, active, secret, created_at FROM channel_webhooks`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var whs []*ChannelWebhook
	for rows.Next() {
		wh := &ChannelWebhook{}
		var active int
		var createdAt int64
		var secret string
		if err := rows.Scan(&wh.ID, &wh.ChannelID, &wh.URL, &wh.TeamID, &active, &secret, &createdAt); err != nil {
			return nil, err
		}
		wh.Active = active == 1
		wh.Secret = secret
		wh.CreatedAt = scanTime(createdAt)
		whs = append(whs, wh)
	}
	return whs, rows.Err()
}

func (s *Store) GetChannelWebhook(id string) (*ChannelWebhook, error) {
	wh := &ChannelWebhook{}
	var active int
	var createdAt int64
	var secret string
	err := s.db.QueryRow(`
		SELECT id, channel_id, url, team_id, active, secret, created_at
		FROM channel_webhooks WHERE id = ?`, id).Scan(
		&wh.ID, &wh.ChannelID, &wh.URL, &wh.TeamID, &active, &secret, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	wh.Active = active == 1
	wh.Secret = secret
	wh.CreatedAt = scanTime(createdAt)
	return wh, nil
}

func (s *Store) DeleteChannelWebhook(id string) error {
	_, err := s.db.Exec("DELETE FROM channel_webhooks WHERE id = ?", id)
	return err
}

func (s *Store) UpdateChannelWebhookActive(id string, active bool) error {
	activeInt := 0
	if active {
		activeInt = 1
	}
	_, err := s.db.Exec("UPDATE channel_webhooks SET active=? WHERE id=?", activeInt, id)
	return err
}

func (s *Store) UpdateChannelWebhookSecret(id string, secret string) error {
	_, err := s.db.Exec("UPDATE channel_webhooks SET secret=? WHERE id=?", secret, id)
	return err
}

// ===========================
// ChannelEvents repository
// ===========================

func (s *Store) InsertChannelEvent(e *ChannelEvent) error {
	now := time.Now().Unix()
	e.CreatedAt = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO channel_events (id, channel_id, payload_hash, data, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		e.ID, e.ChannelID, e.PayloadHash, e.Data, now,
	)
	return err
}

func (s *Store) GetChannelEvents(channelID string, limit int) ([]*ChannelEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(`
		SELECT id, channel_id, payload_hash, data, created_at
		FROM channel_events WHERE channel_id=? ORDER BY created_at DESC LIMIT ?`,
		channelID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []*ChannelEvent
	for rows.Next() {
		e := &ChannelEvent{}
		var createdAt int64
		if err := rows.Scan(&e.ID, &e.ChannelID, &e.PayloadHash, &e.Data, &createdAt); err != nil {
			return nil, err
		}
		e.CreatedAt = scanTime(createdAt)
		events = append(events, e)
	}
	return events, rows.Err()
}

func (s *Store) CheckDuplicateEvent(channelID, payloadHash string) (bool, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM channel_events WHERE channel_id=? AND payload_hash=?`,
		channelID, payloadHash).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// ===========================
// Marketplace Installs repository
// ===========================

// EnsureNewTables creates additional tables needed for marketplace installs/reviews.
func (s *Store) EnsureNewTables() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS user_marketplace_installs (
			id         TEXT PRIMARY KEY,
			user_id    TEXT NOT NULL,
			item_id    TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			UNIQUE(user_id, item_id)
		)`,
		`CREATE TABLE IF NOT EXISTS marketplace_reviews (
			id         TEXT PRIMARY KEY,
			user_id    TEXT NOT NULL,
			item_id    TEXT NOT NULL,
			rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
			review     TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			UNIQUE(user_id, item_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_mp_installs_user ON user_marketplace_installs(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mp_installs_item ON user_marketplace_installs(item_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mp_reviews_item ON marketplace_reviews(item_id)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) CreateMarketplaceInstall(inst *MarketplaceInstall) error {
	now := time.Now().Unix()
	inst.CreatedAt = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO user_marketplace_installs (id, user_id, item_id, created_at)
		VALUES (?, ?, ?, ?)`,
		inst.ID, inst.UserID, inst.ItemID, now,
	)
	return err
}

func (s *Store) GetMarketplaceInstall(userID, itemID string) (*MarketplaceInstall, error) {
	inst := &MarketplaceInstall{}
	var createdAt int64
	err := s.db.QueryRow(`
		SELECT id, user_id, item_id, created_at FROM user_marketplace_installs
		WHERE user_id=? AND item_id=?`, userID, itemID).Scan(
		&inst.ID, &inst.UserID, &inst.ItemID, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	inst.CreatedAt = scanTime(createdAt)
	return inst, nil
}

func (s *Store) DeleteMarketplaceInstall(userID, itemID string) error {
	_, err := s.db.Exec("DELETE FROM user_marketplace_installs WHERE user_id=? AND item_id=?", userID, itemID)
	return err
}

func (s *Store) IncrementMarketplaceInstallCount(itemID string) error {
	_, err := s.db.Exec("UPDATE marketplace_items SET install_count = install_count + 1 WHERE id=?", itemID)
	return err
}

func (s *Store) DecrementMarketplaceInstallCount(itemID string) error {
	_, err := s.db.Exec("UPDATE marketplace_items SET install_count = MAX(install_count - 1, 0) WHERE id=?", itemID)
	return err
}

// ===========================
// Marketplace Reviews repository
// ===========================

func (s *Store) CreateMarketplaceReview(rev *MarketplaceReview) error {
	now := time.Now().Unix()
	rev.CreatedAt = time.Unix(now, 0)
	rev.UpdatedAt = rev.CreatedAt
	_, err := s.db.Exec(`
		INSERT INTO marketplace_reviews (id, user_id, item_id, rating, review, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		rev.ID, rev.UserID, rev.ItemID, rev.Rating, rev.Review, now, now,
	)
	return err
}

func (s *Store) GetMarketplaceReview(userID, itemID string) (*MarketplaceReview, error) {
	rev := &MarketplaceReview{}
	var createdAt, updatedAt int64
	err := s.db.QueryRow(`
		SELECT id, user_id, item_id, rating, review, created_at, updated_at
		FROM marketplace_reviews WHERE user_id=? AND item_id=?`, userID, itemID).Scan(
		&rev.ID, &rev.UserID, &rev.ItemID, &rev.Rating, &rev.Review, &createdAt, &updatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	rev.CreatedAt = scanTime(createdAt)
	rev.UpdatedAt = scanTime(updatedAt)
	return rev, nil
}

func (s *Store) ListMarketplaceReviews(itemID string, limit, offset int) ([]*MarketplaceReview, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.db.Query(`
		SELECT id, user_id, item_id, rating, review, created_at, updated_at
		FROM marketplace_reviews WHERE item_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		itemID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var revs []*MarketplaceReview
	for rows.Next() {
		r := &MarketplaceReview{}
		var createdAt, updatedAt int64
		if err := rows.Scan(&r.ID, &r.UserID, &r.ItemID, &r.Rating, &r.Review, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		r.CreatedAt = scanTime(createdAt)
		r.UpdatedAt = scanTime(updatedAt)
		revs = append(revs, r)
	}
	return revs, rows.Err()
}

// ===========================
// CollabRecords — comment helpers
// ===========================

// GetCollabRecord returns a single collab record by ID.
func (s *Store) GetCollabRecord(id string) (*CollabRecord, error) {
	r := &CollabRecord{}
	var timestamp int64
	err := s.db.QueryRow(`
		SELECT id, workspace_id, type, user_id, data, timestamp
		FROM collab_records WHERE id=?`, id).Scan(
		&r.ID, &r.WorkspaceID, &r.Type, &r.UserID, &r.Data, &timestamp,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.Timestamp = scanTime(timestamp)
	return r, nil
}

// ListCollabComments returns comment records filtered by workspace_id (from JSON data)
// with pagination. Because comments store task_id in data, we filter by type='comment'
// and scan data to match task_id when provided.
func (s *Store) ListCollabComments(workspaceID string, limit, offset int) ([]*CollabRecord, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.db.Query(`
		SELECT id, workspace_id, type, user_id, data, timestamp
		FROM collab_records WHERE workspace_id=? AND type='comment'
		ORDER BY timestamp DESC LIMIT ? OFFSET ?`, workspaceID, limit, offset)
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

// UpdateCollabRecordData updates the data field and timestamp of a collab record.
func (s *Store) UpdateCollabRecordData(id, data string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec("UPDATE collab_records SET data=?, timestamp=? WHERE id=?", data, now)
	return err
}

// DeleteCollabRecord deletes a collab record by ID.
func (s *Store) DeleteCollabRecord(id string) error {
	_, err := s.db.Exec("DELETE FROM collab_records WHERE id=?", id)
	return err
}

// IsUserOwnerOrAdmin checks if the user is owner or admin of any team.
func (s *Store) IsUserOwnerOrAdmin(userID string) (bool, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM team_members
		WHERE user_id=? AND role IN ('owner','admin')`, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// ===========================
// Invoice repository
// ===========================

func (s *Store) CreateInvoice(inv *Invoice) error {
	now := time.Now().Unix()
	inv.CreatedAt = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO invoices (id, user_id, period_start, period_end, amount, currency, status, line_items, created_at, due_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		inv.ID, inv.UserID, inv.PeriodStart.Unix(), inv.PeriodEnd.Unix(), inv.Amount, inv.Currency, inv.Status, inv.LineItems, now, inv.DueDate.Unix(),
	)
	return err
}

func (s *Store) GetInvoice(id, userID string) (*Invoice, error) {
	inv := &Invoice{}
	var periodStart, periodEnd, createdAt, dueDate int64
	err := s.db.QueryRow(`
		SELECT id, user_id, period_start, period_end, amount, currency, status, line_items, created_at, due_date
		FROM invoices WHERE id=? AND user_id=?`, id, userID).Scan(
		&inv.ID, &inv.UserID, &periodStart, &periodEnd, &inv.Amount, &inv.Currency, &inv.Status, &inv.LineItems, &createdAt, &dueDate,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	inv.PeriodStart = scanTime(periodStart)
	inv.PeriodEnd = scanTime(periodEnd)
	inv.CreatedAt = scanTime(createdAt)
	inv.DueDate = scanTime(dueDate)
	return inv, nil
}

func (s *Store) ListInvoicesByUser(userID string) ([]*Invoice, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, period_start, period_end, amount, currency, status, line_items, created_at, due_date
		FROM invoices WHERE user_id=? ORDER BY period_start DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var invoices []*Invoice
	for rows.Next() {
		inv := &Invoice{}
		var periodStart, periodEnd, createdAt, dueDate int64
		if err := rows.Scan(&inv.ID, &inv.UserID, &periodStart, &periodEnd, &inv.Amount, &inv.Currency, &inv.Status, &inv.LineItems, &createdAt, &dueDate); err != nil {
			return nil, err
		}
		inv.PeriodStart = scanTime(periodStart)
		inv.PeriodEnd = scanTime(periodEnd)
		inv.CreatedAt = scanTime(createdAt)
		inv.DueDate = scanTime(dueDate)
		invoices = append(invoices, inv)
	}
	return invoices, rows.Err()
}

func (s *Store) UpdateInvoiceStatus(id, status string) error {
	_, err := s.db.Exec(`UPDATE invoices SET status=? WHERE id=?`, status, id)
	return err
}

// ===========================
// Conversation repository (Phase 6: cloud sync)
// ===========================

// CreateConversation inserts a new conversation. Timestamps are set here.
func (s *Store) CreateConversation(c *Conversation) error {
	now := time.Now().Unix()
	c.CreatedAt = time.Unix(now, 0)
	c.UpdatedAt = c.CreatedAt
	if c.Status == "" {
		c.Status = "active"
	}
	if c.Mode == "" {
		c.Mode = "Work"
	}
	_, err := s.db.Exec(`
		INSERT INTO conversations (id, user_id, workspace_id, title, mode, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.UserID, c.WorkspaceID, c.Title, c.Mode, c.Status, now, now,
	)
	return err
}

// ListConversationsByUser returns conversations for a user ordered by updated_at desc.
// If before is non-zero, only conversations updated before that time are returned
// (cursor pagination). limit caps the count (<=0 → 50).
func (s *Store) ListConversationsByUser(userID string, before int64, limit int) ([]*Conversation, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	query := `SELECT id, user_id, workspace_id, title, mode, status, created_at, updated_at FROM conversations WHERE user_id = ?`
	args := []interface{}{userID}
	if before > 0 {
		query += ` AND updated_at < ?`
		args = append(args, before)
	}
	query += ` ORDER BY updated_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Conversation
	for rows.Next() {
		c := &Conversation{}
		var createdAt, updatedAt int64
		if err := rows.Scan(&c.ID, &c.UserID, &c.WorkspaceID, &c.Title, &c.Mode, &c.Status, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		c.CreatedAt = scanTime(createdAt)
		c.UpdatedAt = scanTime(updatedAt)
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetConversation returns a single conversation by id. Returns nil, nil if not found.
func (s *Store) GetConversation(id string) (*Conversation, error) {
	c := &Conversation{}
	var createdAt, updatedAt int64
	err := s.db.QueryRow(`
		SELECT id, user_id, workspace_id, title, mode, status, created_at, updated_at
		FROM conversations WHERE id = ?`, id).Scan(
		&c.ID, &c.UserID, &c.WorkspaceID, &c.Title, &c.Mode, &c.Status, &createdAt, &updatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	c.CreatedAt = scanTime(createdAt)
	c.UpdatedAt = scanTime(updatedAt)
	return c, nil
}

// DeleteConversation removes a conversation and its messages (CASCADE).
func (s *Store) DeleteConversation(id string) error {
	_, err := s.db.Exec(`DELETE FROM conversations WHERE id = ?`, id)
	return err
}

// TouchConversationUpdatedAt bumps updated_at to now (e.g. after appending a message).
func (s *Store) TouchConversationUpdatedAt(id string) error {
	_, err := s.db.Exec(`UPDATE conversations SET updated_at = ? WHERE id = ?`, time.Now().Unix(), id)
	return err
}

// ===========================
// Message repository
// ===========================

// AppendMessage inserts a message and touches the parent conversation's updated_at.
func (s *Store) AppendMessage(m *Message) error {
	now := time.Now().Unix()
	m.CreatedAt = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO messages (id, conversation_id, role, content, tool_calls, metadata, token_count, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, m.ConversationID, m.Role, m.Content, m.ToolCalls, m.Metadata, m.TokenCount, now,
	)
	if err != nil {
		return err
	}
	return s.TouchConversationUpdatedAt(m.ConversationID)
}

// ListMessages returns messages for a conversation in ascending created_at order.
// If before is non-zero, only messages created before that time are returned
// (cursor pagination). limit caps the count (<=0 → 100).
func (s *Store) ListMessages(conversationID string, before int64, limit int) ([]*Message, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	query := `SELECT id, conversation_id, role, content, tool_calls, metadata, token_count, created_at FROM messages WHERE conversation_id = ?`
	args := []interface{}{conversationID}
	if before > 0 {
		query += ` AND created_at < ?`
		args = append(args, before)
	}
	query += ` ORDER BY created_at ASC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Message
	for rows.Next() {
		m := &Message{}
		var createdAt int64
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.ToolCalls, &m.Metadata, &m.TokenCount, &createdAt); err != nil {
			return nil, err
		}
		m.CreatedAt = scanTime(createdAt)
		out = append(out, m)
	}
	return out, rows.Err()
}

// GetConversationTokenUsage returns the total token count for a conversation.
func (s *Store) GetConversationTokenUsage(conversationID string) (int, error) {
	var total sql.NullInt64
	err := s.db.QueryRow(`SELECT COALESCE(SUM(token_count), 0) FROM messages WHERE conversation_id = ?`, conversationID).Scan(&total)
	if err != nil {
		return 0, err
	}
	return int(total.Int64), nil
}

// ===========================
// WorkspaceRole repository
// ===========================

func (s *Store) UpsertWorkspaceRole(wr *WorkspaceRole) error {
	now := time.Now().Unix()
	wr.CreatedAt = time.Unix(now, 0)
	_, err := s.db.Exec(`
		INSERT INTO workspace_roles (id, workspace_id, user_id, role, assigned_by, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(workspace_id, user_id) DO UPDATE SET role=?, assigned_by=?`,
		wr.ID, wr.WorkspaceID, wr.UserID, wr.Role, wr.AssignedBy, now,
		wr.Role, wr.AssignedBy,
	)
	return err
}

func (s *Store) GetWorkspaceRole(workspaceID, userID string) (*WorkspaceRole, error) {
	wr := &WorkspaceRole{}
	var createdAt int64
	err := s.db.QueryRow(`
		SELECT id, workspace_id, user_id, role, assigned_by, created_at
		FROM workspace_roles WHERE workspace_id=? AND user_id=?`, workspaceID, userID).Scan(
		&wr.ID, &wr.WorkspaceID, &wr.UserID, &wr.Role, &wr.AssignedBy, &createdAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	wr.CreatedAt = scanTime(createdAt)
	return wr, nil
}

func (s *Store) ListWorkspaceRoles(workspaceID string) ([]*WorkspaceRole, error) {
	rows, err := s.db.Query(`
		SELECT id, workspace_id, user_id, role, assigned_by, created_at
		FROM workspace_roles WHERE workspace_id=?`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []*WorkspaceRole
	for rows.Next() {
		wr := &WorkspaceRole{}
		var createdAt int64
		if err := rows.Scan(&wr.ID, &wr.WorkspaceID, &wr.UserID, &wr.Role, &wr.AssignedBy, &createdAt); err != nil {
			return nil, err
		}
		wr.CreatedAt = scanTime(createdAt)
		roles = append(roles, wr)
	}
	return roles, rows.Err()
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
