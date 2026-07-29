/**
 * GeoWork MCP 服务状态 — localStorage 持久化
 *
 * key: geowork.mcpServers.v1
 *
 * 结构：
 * {
 *   states: Record<string, StoredMcpState>,
 *   localServers: McpServerItem[]
 * }
 */

import type { McpServerItem, McpStatus } from './mcpMockData'

const STORAGE_KEY = 'geowork.mcpServers.v1'

const SENSITIVE_PATTERNS = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'API_KEY']

export type StoredMcpState = {
  connected: boolean
  enabled: boolean
  status: McpStatus
  endpoint?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export type McpStore = {
  states: Record<string, StoredMcpState>
  localServers: McpServerItem[]
}

const DEFAULT_STORE: McpStore = {
  states: {},
  localServers: [],
}

/* ── 敏感字段检测 ── */

function isSensitiveKey(key: string): boolean {
  const upper = key.toUpperCase()
  return SENSITIVE_PATTERNS.some((p) => upper.includes(p))
}

/** 将 env 中敏感字段的 value 替换为掩码 */
export function sanitizeEnv(env: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!env) return undefined
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    sanitized[key] = isSensitiveKey(key) ? '••••••' : value
  }
  return sanitized
}

/* ── CRUD ── */

export function loadMcpStore(): McpStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STORE }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_STORE }
    return {
      states: typeof parsed.states === 'object' && parsed.states !== null ? parsed.states : {},
      localServers: Array.isArray(parsed.localServers) ? parsed.localServers : [],
    }
  } catch {
    return { ...DEFAULT_STORE }
  }
}

export function saveMcpStore(store: McpStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.dispatchEvent(new CustomEvent('geowork:mcp-updated'))
  } catch {
    /* 静默失败 */
  }
}

/** 合并 mock 基础数据与 localStorage 状态 */
export function mergeMcpServers(
  baseServers: McpServerItem[],
  store: McpStore,
): McpServerItem[] {
  return baseServers.map((server) => {
    const state = store.states[server.id]
    if (!state) return server
    return {
      ...server,
      connected: state.connected,
      enabled: state.enabled,
      status: state.status,
      endpoint: state.endpoint ?? server.endpoint,
      command: state.command ?? server.command,
      args: state.args ?? server.args,
      env: state.env ?? server.env,
    }
  })
}

/** 更新某个 MCP 的状态 */
export function updateMcpState(
  store: McpStore,
  id: string,
  patch: Partial<StoredMcpState>,
): McpStore {
  const current = store.states[id] ?? {
    connected: false,
    enabled: false,
    status: 'not-connected' as McpStatus,
  }
  const next: McpStore = {
    ...store,
    states: {
      ...store.states,
      [id]: { ...current, ...patch },
    },
  }
  saveMcpStore(next)
  return next
}

/** 添加本地导入 MCP（完整元数据） */
export function addLocalMcpServer(store: McpStore, server: McpServerItem): McpStore {
  const next: McpStore = {
    ...store,
    localServers: [...store.localServers, server],
    states: {
      ...store.states,
      [server.id]: {
        connected: server.connected,
        enabled: server.enabled,
        status: server.status,
        endpoint: server.endpoint,
        command: server.command,
        args: server.args,
        env: sanitizeEnv(server.env),
      },
    },
  }
  saveMcpStore(next)
  return next
}

/** 移除本地 MCP */
export function removeLocalMcpServer(store: McpStore, id: string): McpStore {
  const next: McpStore = {
    ...store,
    localServers: store.localServers.filter((s) => s.id !== id),
    states: {
      ...store.states,
      [id]: { connected: false, enabled: false, status: 'not-connected' },
    },
  }
  saveMcpStore(next)
  return next
}

/** 重置为默认状态 */
export function resetMcpState(
  store: McpStore,
  id: string,
  defaults: { connected: boolean; enabled: boolean; status: McpStatus },
): McpStore {
  const next: McpStore = {
    ...store,
    states: {
      ...store.states,
      [id]: {
        connected: defaults.connected,
        enabled: defaults.enabled,
        status: defaults.status,
      },
    },
  }
  saveMcpStore(next)
  return next
}
