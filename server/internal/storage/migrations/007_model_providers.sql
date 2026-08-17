-- 007: modelproxy provider 配置持久化（doc/25 S2）。
-- 此前 provider 配置（含加密 API key）只存在内存 map，服务重启即全部丢失。
-- api_key 存密文（AES-256-GCM，GEOWORK_ENCRYPTION_KEY 未配置时为明文 + 告警）。
CREATE TABLE IF NOT EXISTS model_providers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT '',
    base_url   TEXT NOT NULL DEFAULT '',
    api_key    TEXT NOT NULL DEFAULT '',
    enabled    INTEGER NOT NULL DEFAULT 1,
    fallback   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
