// GeoWork Cloud API Client
// Connects to the cloud backend running on port 8767

const CLOUD_API_BASE = (window as any).geowork?.cloudUrl ?? 'http://127.0.0.1:8767'

// ─── Auth Types ────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  access_token: string
  refresh_token: string
}

// ─── Account Types ─────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  name: string
  avatar_url: string
  plan: 'free' | 'pro' | 'team'
  created_at: string
  updated_at: string
}

export interface UpdateProfileRequest {
  name?: string
  avatar_url?: string
}

export interface PlanFeatures {
  local_mode: boolean
  cloud_sync: boolean
  team_collab: boolean
  priority_support: boolean
}

export interface SubscriptionResponse {
  plan: string
  credits: number
  features: PlanFeatures
}

// ─── Team Types ────────────────────────────────────────────────────────
export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

export interface InviteMemberRequest {
  user_id: string
  role?: 'admin' | 'member' | 'viewer'
}

// ─── RBAC Types ────────────────────────────────────────────────────────
export interface PermissionCheckResponse {
  allowed: boolean
  permission: string
}

// ─── Usage Types ───────────────────────────────────────────────────────
export interface UsageEventRequest {
  type: string
  amount: number
  model?: string
}

export interface UsageSummary {
  model_tokens: number
  model_requests: number
  tool_calls: number
  browser_usage: number
  speed_multiplier: number
}

export interface ModelUsage {
  model: string
  tokens: number
}

// ─── Billing Types ─────────────────────────────────────────────────────
export interface PlanInfo {
  name: string
  price: number
  currency: string
  credits: number
  features: string[]
  limit_tokens: number
}

// ─── Sync Types ────────────────────────────────────────────────────────
export interface SyncPushRequest {
  object_type: 'settings' | 'workspace' | 'task' | 'artifact' | 'knowledge' | 'plugin' | 'mcp_config' | 'chat_summary'
  object_id: string
  data: string
}

// ─── Marketplace Types ─────────────────────────────────────────────────
export interface MarketplaceItem {
  id: string
  name: string
  type: 'plugin' | 'skill' | 'connector'
  version: string
  description: string
  author: string
  permissions: string[]
  install_count: number
  signature: string
}

// ─── Telemetry Types ───────────────────────────────────────────────────
export interface TelemetryEventRequest {
  type: string
  value: number
  metadata?: Record<string, unknown>
}

// ─── Collaboration Types ───────────────────────────────────────────────
export interface ShareRequest {
  user_id: string
  role: 'viewer' | 'editor' | 'admin'
}

export interface CommentRequest {
  content: string
}

// ─── Cloud API Client ──────────────────────────────────────────────────
class CloudClient {
  private accessToken: string | null = null

  setToken(token: string) {
    this.accessToken = token
  }

  clearToken() {
    this.accessToken = null
  }

  private getHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    }
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }
    return headers
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${CLOUD_API_BASE}${path}`, {
      ...options,
      headers: this.getHeaders(options.headers as Record<string, string>),
    })
    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText)
      throw new Error(`Cloud API ${res.status}: ${error}`)
    }
    return res.json()
  }

  // ── Auth ──
  login = (body: LoginRequest) =>
    this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  logout = () =>
    this.request<{ message: string }>('/api/auth/logout', { method: 'POST' })

  refresh = () =>
    this.request<{ access_token: string }>('/api/auth/refresh', { method: 'POST' })

  me = () => this.request<User>('/api/auth/me')

  // ── Account ──
  getProfile = () => this.request<User>('/api/account/profile')

  updateProfile = (body: UpdateProfileRequest) =>
    this.request<User>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    })

  getSubscription = () =>
    this.request<SubscriptionResponse>('/api/account/subscription')

  // ── Teams ──
  createTeam = (name: string) =>
    this.request<Team>('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })

  listTeams = () => this.request<Team[]>('/api/teams')

  inviteMember = (teamId: string, body: InviteMemberRequest) =>
    this.request<{ message: string }>(`/api/teams/${teamId}/invite`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

  updateMember = (teamId: string, userId: string, role: string) =>
    this.request<Record<string, unknown>>(`/api/teams/${teamId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })

  // ── RBAC ──
  checkPermission = (permission: string, objectId?: string) =>
    this.request<PermissionCheckResponse>('/api/rbac/check', {
      method: 'POST',
      body: JSON.stringify({ permission, object_id: objectId }),
    })

  getRoles = () => this.request<{ roles: string[] }>('/api/rbac/roles')

  // ── Usage ──
  reportUsageEvent = (body: UsageEventRequest) =>
    this.request<{ message: string }>('/api/usage/events', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  getUsageSummary = () => this.request<UsageSummary>('/api/usage/summary')

  getModelUsage = () => this.request<ModelUsage[]>('/api/usage/models')

  // ── Billing ──
  getPlan = () => this.request<PlanInfo>('/api/billing/plan')

  getCredits = () => this.request<{ credits: number; plan: string }>('/api/billing/credits')

  getInvoices = () => this.request<Record<string, unknown>[]>('/api/billing/invoices')

  checkoutSession = (plan: string) =>
    this.request<{ message: string; plan: string }>('/api/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    })

  // ── Sync ──
  syncPush = (body: SyncPushRequest) =>
    this.request<{ message: string; cursor: number }>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  syncPull = (cursor = 0) =>
    this.request<{ records: Record<string, unknown>[]; cursor: number }>(
      `/api/sync/pull?cursor=${cursor}`
    )

  // ── Marketplace ──
  listPlugins = () => this.request<MarketplaceItem[]>('/api/marketplace/plugins')

  listSkills = () => this.request<MarketplaceItem[]>('/api/marketplace/skills')

  listConnectors = () => this.request<MarketplaceItem[]>('/api/marketplace/connectors')

  getMarketplaceItem = (id: string) =>
    this.request<MarketplaceItem>(`/api/marketplace/items/${id}`)

  // ── Telemetry ──
  reportTelemetry = (body: TelemetryEventRequest) =>
    this.request<{ message: string }>('/api/telemetry/events', {
      method: 'POST',
      body: JSON.stringify(body),
    })

  reportTelemetryBatch = (events: TelemetryEventRequest[]) =>
    this.request<{ message: string; count: number }>('/api/telemetry/batch', {
      method: 'POST',
      body: JSON.stringify(events),
    })

  // ── Collaboration ──
  getActivity = (workspaceId: string) =>
    this.request<Record<string, unknown>[]>(`/api/workspaces/${workspaceId}/activity`)

  shareWorkspace = (workspaceId: string, body: ShareRequest) =>
    this.request<{ message: string }>(`/api/workspaces/${workspaceId}/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

  addComment = (taskId: string, body: CommentRequest) =>
    this.request<{ message: string }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

  assignTask = (taskId: string, userId: string) =>
    this.request<{ message: string; assigned_to: string }>(`/api/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    })

  // ── Channels ──
  listChannels = () => this.request<Record<string, unknown>[]>('/api/channels')

  createChannel = (name: string, type: string, teamId?: string) =>
    this.request<{ id: string; name: string; type: string; webhook_url: string }>(
      '/api/channels',
      {
        method: 'POST',
        body: JSON.stringify({ name, type, team_id: teamId }),
      }
    )
}

export const cloudClient = new CloudClient()
