// GeoWork Go Core - Conversation Store

package conversation

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"geowork/core/internal/idgen"
)

// timeLayoutFixed is a fixed-width RFC3339 variant that always includes 9
// digits of fractional seconds. Unlike timeLayoutFixed (which omits
// trailing zeros and the entire fractional part when zero), this format
// guarantees lexicographic string comparison matches chronological order —
// essential for cursor-pagination queries like `WHERE created_at < ?`.
const timeLayoutFixed = "2006-01-02T15:04:05.000000000Z07:00"

// Conversation represents a chat session.
type Conversation struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	Title       string    `json:"title"`
	Mode        string    `json:"mode"`
	Status      string    `json:"status"`
	ParentID    string    `json:"parentId,omitempty"` // 悬浮辅助对话继承的父对话 id
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Message represents a single message in a conversation.
type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversationId"`
	Role           string    `json:"role"` // user | assistant | system | tool
	Content        string    `json:"content"`
	ToolCalls      string    `json:"toolCalls,omitempty"` // JSON string
	Metadata       string    `json:"metadata,omitempty"`  // JSON string
	TokenCount     int       `json:"tokenCount"`
	CreatedAt      time.Time `json:"createdAt"`
}

// Store provides CRUD access to conversations and messages backed by SQLite.
type Store struct {
	db *sql.DB
}

// NewStore creates a new Store.
func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// CreateConversation inserts a new conversation. ID/timestamps are filled if empty.
func (s *Store) CreateConversation(ctx context.Context, c *Conversation) error {
	if c.ID == "" {
		c.ID = idgen.New()
	}
	if c.Mode == "" {
		c.Mode = "Work"
	}
	if c.Status == "" {
		c.Status = "active"
	}
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO conversations (id, workspace_id, title, mode, status, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		c.ID, c.WorkspaceID, c.Title, c.Mode, c.Status, c.ParentID, c.CreatedAt.Format(timeLayoutFixed), c.UpdatedAt.Format(timeLayoutFixed),
	)
	return err
}

// ListConversations returns conversations for a workspace, ordered by updated_at
// descending. If before is non-zero, only conversations updated before that time
// are returned (cursor pagination). limit caps the result count (<=0 → 50).
func (s *Store) ListConversations(ctx context.Context, workspaceID string, before time.Time, limit int) ([]Conversation, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	query := "SELECT id, workspace_id, title, mode, status, parent_id, created_at, updated_at FROM conversations"
	args := []interface{}{}
	where := ""

	if workspaceID != "" {
		where = "workspace_id = ?"
		args = append(args, workspaceID)
	}
	if !before.IsZero() {
		if where != "" {
			where += " AND "
		}
		where += "updated_at < ?"
		args = append(args, before.Format(timeLayoutFixed))
	}
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY updated_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Conversation
	for rows.Next() {
		var c Conversation
		var createdAt, updatedAt string
		if err := rows.Scan(&c.ID, &c.WorkspaceID, &c.Title, &c.Mode, &c.Status, &c.ParentID, &createdAt, &updatedAt); err != nil {
			continue
		}
		c.CreatedAt, _ = time.Parse(timeLayoutFixed, createdAt)
		c.UpdatedAt, _ = time.Parse(timeLayoutFixed, updatedAt)
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetConversation returns a single conversation by ID.
func (s *Store) GetConversation(ctx context.Context, id string) (*Conversation, error) {
	c := &Conversation{}
	var createdAt, updatedAt string
	err := s.db.QueryRowContext(ctx,
		"SELECT id, workspace_id, title, mode, status, parent_id, created_at, updated_at FROM conversations WHERE id = ?", id).
		Scan(&c.ID, &c.WorkspaceID, &c.Title, &c.Mode, &c.Status, &c.ParentID, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	c.CreatedAt, _ = time.Parse(timeLayoutFixed, createdAt)
	c.UpdatedAt, _ = time.Parse(timeLayoutFixed, updatedAt)
	return c, nil
}

// DeleteConversation removes a conversation and its messages.
func (s *Store) DeleteConversation(ctx context.Context, id string) error {
	if _, err := s.db.ExecContext(ctx, "DELETE FROM messages WHERE conversation_id = ?", id); err != nil {
		return fmt.Errorf("delete messages: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, "DELETE FROM conversations WHERE id = ?", id); err != nil {
		return fmt.Errorf("delete conversation: %w", err)
	}
	return nil
}

// TouchUpdatedAt bumps the conversation's updated_at to now (e.g. after a new message).
func (s *Store) TouchUpdatedAt(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE conversations SET updated_at = ? WHERE id = ?",
		time.Now().UTC().Format(timeLayoutFixed), id,
	)
	return err
}

// AppendMessage inserts a message and touches the parent conversation's updated_at.
func (s *Store) AppendMessage(ctx context.Context, m *Message) error {
	if m.ID == "" {
		m.ID = idgen.New()
	}
	m.CreatedAt = time.Now().UTC()

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO messages (id, conversation_id, role, content, tool_calls, metadata, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		m.ID, m.ConversationID, m.Role, m.Content, m.ToolCalls, m.Metadata, m.TokenCount, m.CreatedAt.Format(timeLayoutFixed),
	)
	if err != nil {
		return err
	}
	return s.TouchUpdatedAt(ctx, m.ConversationID)
}

// ListMessages returns messages for a conversation in ascending created_at order.
// If before is non-zero, only messages created before that time are returned
// (cursor pagination). limit caps the count (<=0 → 100).
func (s *Store) ListMessages(ctx context.Context, conversationID string, before time.Time, limit int) ([]Message, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := "SELECT id, conversation_id, role, content, tool_calls, metadata, token_count, created_at FROM messages WHERE conversation_id = ?"
	args := []interface{}{conversationID}
	if !before.IsZero() {
		query += " AND created_at < ?"
		args = append(args, before.Format(timeLayoutFixed))
	}
	query += " ORDER BY created_at ASC LIMIT ?"
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Message
	for rows.Next() {
		var m Message
		var createdAt string
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.ToolCalls, &m.Metadata, &m.TokenCount, &createdAt); err != nil {
			continue
		}
		m.CreatedAt, _ = time.Parse(timeLayoutFixed, createdAt)
		out = append(out, m)
	}
	return out, rows.Err()
}

// GetTokenUsage returns the total token count for a conversation.
func (s *Store) GetTokenUsage(ctx context.Context, conversationID string) (int, error) {
	var total sql.NullInt64
	err := s.db.QueryRowContext(ctx,
		"SELECT COALESCE(SUM(token_count), 0) FROM messages WHERE conversation_id = ?", conversationID).Scan(&total)
	if err != nil {
		return 0, err
	}
	return int(total.Int64), nil
}
