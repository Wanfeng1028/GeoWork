-- Add soft-delete support to users table.
ALTER TABLE users ADD COLUMN deleted_at INTEGER NOT NULL DEFAULT 0;
