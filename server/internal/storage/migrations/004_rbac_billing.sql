-- Migration 004: RBAC workspace roles + Billing invoices.

-- Workspace-level role assignments (separate from team_members for workspace-specific roles)
CREATE TABLE IF NOT EXISTS workspace_roles (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
    assigned_by  TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    UNIQUE(workspace_id, user_id)
);

-- Role permissions cache (seeded from the in-memory matrix on first run)
CREATE TABLE IF NOT EXISTS role_permissions (
    role       TEXT NOT NULL,
    permission TEXT NOT NULL,
    allowed    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (role, permission)
);

-- Invoices for billing
CREATE TABLE IF NOT EXISTS invoices (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end   INTEGER NOT NULL,
    amount       REAL NOT NULL DEFAULT 0,
    currency     TEXT NOT NULL DEFAULT 'USD',
    status       TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'issued', 'paid', 'failed')),
    line_items   TEXT NOT NULL DEFAULT '{}',
    created_at   INTEGER NOT NULL,
    due_date     INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ws_roles_workspace ON workspace_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_roles_user ON workspace_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);
