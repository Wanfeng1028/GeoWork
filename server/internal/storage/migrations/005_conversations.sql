-- Migration 005: Conversations + Messages tables, and expand sync_records
-- object_type whitelist to include conversation/message (Phase 6: cloud sync).

-- Cloud-side conversation records (one per chat session, owned by a user).
-- Mirrors core/internal/conversation/store.go but adds user_id for multi-device ownership.
CREATE TABLE IF NOT EXISTS conversations (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    workspace_id TEXT NOT NULL DEFAULT '',
    title        TEXT NOT NULL DEFAULT '',
    mode         TEXT NOT NULL DEFAULT 'Work',
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);

-- Messages belonging to a conversation (cursor pagination via created_at).
CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    tool_calls      TEXT NOT NULL DEFAULT '',
    metadata        TEXT NOT NULL DEFAULT '',
    token_count     INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);

-- Recreate sync_records with an expanded object_type CHECK constraint so
-- conversation/message objects can be pushed/pulled via the sync protocol.
-- SQLite cannot ALTER a CHECK constraint in place, so we rebuild the table.
CREATE TABLE IF NOT EXISTS sync_records_new (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    object_type TEXT NOT NULL CHECK(object_type IN (
        'settings', 'workspace', 'task', 'artifact', 'knowledge',
        'plugin', 'mcp_config', 'chat_summary',
        'conversation', 'message'
    )),
    object_id  TEXT NOT NULL,
    data       TEXT NOT NULL,
    cursor     INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, object_type, object_id)
);

INSERT INTO sync_records_new (id, user_id, object_type, object_id, data, cursor, created_at)
SELECT id, user_id, object_type, object_id, data, cursor, created_at FROM sync_records;

DROP TABLE sync_records;
ALTER TABLE sync_records_new RENAME TO sync_records;

-- Recreate indexes dropped with the table.
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_cursor ON sync_records(user_id, cursor);
