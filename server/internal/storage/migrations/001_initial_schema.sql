-- Initial schema for GeoWork Cloud API v0.5.0.
-- Covers: accounts, sessions, teams, roles, usage_records, billing_plans,
--         sync_records, marketplace_items, telemetry_events, crash_reports.

-- Users / accounts
CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL DEFAULT '',
    avatar_url   TEXT NOT NULL DEFAULT '',
    plan         TEXT NOT NULL DEFAULT 'free',
    password_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

-- Auth tokens (sessions)
CREATE TABLE IF NOT EXISTS tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('access', 'refresh')),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Team members (composite key)
CREATE TABLE IF NOT EXISTS team_members (
    team_id  TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
    PRIMARY KEY (team_id, user_id)
);

-- Usage events / records
CREATE TABLE IF NOT EXISTS usage_events (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    team_id          TEXT DEFAULT NULL,
    type             TEXT NOT NULL,
    amount           INTEGER NOT NULL DEFAULT 0,
    model            TEXT NOT NULL DEFAULT '',
    timestamp        TEXT NOT NULL,
    speed_multiplier REAL NOT NULL DEFAULT 1.0
);

-- Billing data (per-user credits / plan snapshot)
CREATE TABLE IF NOT EXISTS billing_data (
    user_id    TEXT PRIMARY KEY,
    plan       TEXT NOT NULL DEFAULT 'free',
    credits    REAL NOT NULL DEFAULT 0,
    usage_cost REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- Sync records
CREATE TABLE IF NOT EXISTS sync_records (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    object_type TEXT NOT NULL CHECK(object_type IN (
        'settings', 'workspace', 'task', 'artifact', 'knowledge',
        'plugin', 'mcp_config', 'chat_summary'
    )),
    object_id  TEXT NOT NULL,
    data       TEXT NOT NULL,
    cursor     INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, object_type, object_id)
);

-- Marketplace items
CREATE TABLE IF NOT EXISTS marketplace_items (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    type           TEXT NOT NULL CHECK(type IN ('plugin', 'skill', 'connector')),
    version        TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    author         TEXT NOT NULL DEFAULT '',
    permissions    TEXT NOT NULL DEFAULT '[]',
    install_count  INTEGER NOT NULL DEFAULT 0,
    signature      TEXT NOT NULL DEFAULT ''
);

-- Telemetry events
CREATE TABLE IF NOT EXISTS telemetry_events (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    type       TEXT NOT NULL,
    value      REAL NOT NULL DEFAULT 0,
    metadata   TEXT NOT NULL DEFAULT '{}',
    timestamp  TEXT NOT NULL
);

-- Crash reports
CREATE TABLE IF NOT EXISTS crash_reports (
    id            TEXT PRIMARY KEY,
    app_version   TEXT NOT NULL,
    os            TEXT NOT NULL,
    message       TEXT NOT NULL DEFAULT '',
    stacktrace    TEXT NOT NULL DEFAULT '',
    has_minidump  INTEGER NOT NULL DEFAULT 0,
    has_logs      INTEGER NOT NULL DEFAULT 0,
    timestamp     TEXT NOT NULL
);

-- Collaboration records
CREATE TABLE IF NOT EXISTS collab_records (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type         TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    data         TEXT NOT NULL DEFAULT '{}',
    timestamp    TEXT NOT NULL
);

-- Channel webhooks
CREATE TABLE IF NOT EXISTS channel_webhooks (
    id         TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    url        TEXT NOT NULL,
    team_id    TEXT DEFAULT NULL,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

-- _migrations tracking table
CREATE TABLE IF NOT EXISTS _migrations (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_team ON usage_events(team_id);
CREATE INDEX IF NOT EXISTS idx_usage_type ON usage_events(type);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_cursor ON sync_records(user_id, cursor);
CREATE INDEX IF NOT EXISTS idx_telemetry_user ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_workspace ON collab_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_collab_ts ON collab_records(timestamp);
