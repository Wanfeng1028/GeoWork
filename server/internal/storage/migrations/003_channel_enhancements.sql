-- Migration 003: Add secret column to channel_webhooks for HMAC verification
-- and channel_events table for event deduplication.

ALTER TABLE channel_webhooks ADD COLUMN secret TEXT NOT NULL DEFAULT '';

-- Channel events for deduplication and history
CREATE TABLE IF NOT EXISTS channel_events (
    id            TEXT PRIMARY KEY,
    channel_id    TEXT NOT NULL,
    payload_hash  TEXT NOT NULL,
    data          TEXT NOT NULL DEFAULT '{}',
    created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_events_channel ON channel_events(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_events_hash ON channel_events(channel_id, payload_hash);
