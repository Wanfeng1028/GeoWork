package conversation

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"geowork/core/internal/storage"

	_ "modernc.org/sqlite"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	if err := storage.RunMigrations(db); err != nil {
		t.Fatalf("run migrations: %v", err)
	}
	return db
}

func TestConversationCRUDAndMessages(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	store := NewStore(db)
	ctx := context.Background()

	// Create conversation.
	c := &Conversation{WorkspaceID: "ws-1", Title: "hello", Mode: "Work"}
	if err := store.CreateConversation(ctx, c); err != nil {
		t.Fatalf("create conversation: %v", err)
	}
	if c.ID == "" {
		t.Fatal("expected conversation ID to be set")
	}

	// Get.
	got, err := store.GetConversation(ctx, c.ID)
	if err != nil {
		t.Fatalf("get conversation: %v", err)
	}
	if got.Title != "hello" || got.Mode != "Work" || got.Status != "active" {
		t.Fatalf("unexpected conversation: %+v", got)
	}

	// Append two messages. A short sleep ensures distinct timestamps:
	// Windows time.Now() resolution (~15ms) can otherwise collapse the two
	// appends into the same instant, breaking the cursor pagination check.
	m1 := &Message{ConversationID: c.ID, Role: "user", Content: "hi", TokenCount: 5}
	m2 := &Message{ConversationID: c.ID, Role: "assistant", Content: "hello back", TokenCount: 8}
	if err := store.AppendMessage(ctx, m1); err != nil {
		t.Fatalf("append m1: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
	if err := store.AppendMessage(ctx, m2); err != nil {
		t.Fatalf("append m2: %v", err)
	}

	// List messages (ascending).
	msgs, err := store.ListMessages(ctx, c.ID, time.Time{}, 0)
	if err != nil {
		t.Fatalf("list messages: %v", err)
	}
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}
	if msgs[0].Role != "user" || msgs[1].Role != "assistant" {
		t.Fatalf("unexpected message order: %+v then %+v", msgs[0], msgs[1])
	}

	// Token usage.
	usage, err := store.GetTokenUsage(ctx, c.ID)
	if err != nil {
		t.Fatalf("token usage: %v", err)
	}
	if usage != 13 {
		t.Fatalf("expected token usage 13, got %d", usage)
	}

	// Cursor pagination: messages before m2.CreatedAt should return only m1.
	msgsBefore, err := store.ListMessages(ctx, c.ID, m2.CreatedAt, 0)
	if err != nil {
		t.Fatalf("list messages before: %v", err)
	}
	if len(msgsBefore) != 1 || msgsBefore[0].ID != m1.ID {
		t.Fatalf("expected only m1 before m2, got %+v", msgsBefore)
	}

	// List conversations.
	convs, err := store.ListConversations(ctx, "ws-1", time.Time{}, 0)
	if err != nil {
		t.Fatalf("list conversations: %v", err)
	}
	if len(convs) != 1 || convs[0].ID != c.ID {
		t.Fatalf("expected 1 conversation, got %+v", convs)
	}

	// Delete cascades messages.
	if err := store.DeleteConversation(ctx, c.ID); err != nil {
		t.Fatalf("delete conversation: %v", err)
	}
	msgsAfter, err := store.ListMessages(ctx, c.ID, time.Time{}, 0)
	if err != nil {
		t.Fatalf("list messages after delete: %v", err)
	}
	if len(msgsAfter) != 0 {
		t.Fatalf("expected 0 messages after delete, got %d", len(msgsAfter))
	}
}
