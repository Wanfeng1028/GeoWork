/**
 * GeoWork 连接器状态 — localStorage 持久化
 *
 * key: geowork.connectors.v1
 *
 * 结构：
 * {
 *   states: Record<string, StoredConnectorState>,
 *   localConnectors: ConnectorItem[]
 * }
 *
 * 市场 / 内置连接器基础数据来自 connectorsMockData，states 覆盖 connected/enabled/status 等。
 * 本地添加 / JSON 导入的连接器完整存入 localConnectors。
 */

import type {
  ConnectorAuthType,
  ConnectorItem,
  ConnectorStatus,
} from './connectorsMockData'

const STORAGE_KEY = 'geowork.connectors.v1'
const EVENT_NAME = 'geowork:connectors-updated'

export type StoredConnectorState = {
  connected: boolean
  enabled: boolean
  status: ConnectorStatus
  authType?: ConnectorAuthType
  endpoint?: string
  accountLabel?: string
  scopes?: string[]
  hasSecret?: boolean
}

export type ConnectorStore = {
  states: Record<string, StoredConnectorState>
  localConnectors: ConnectorItem[]
}

const DEFAULT_STORE: ConnectorStore = {
  states: {},
  localConnectors: [],
}

export function loadConnectorStore(): ConnectorStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_STORE)
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return structuredClone(DEFAULT_STORE)
    return {
      states: typeof parsed.states === 'object' && parsed.states !== null ? parsed.states : {},
      localConnectors: Array.isArray(parsed.localConnectors) ? parsed.localConnectors : [],
    }
  } catch {
    return structuredClone(DEFAULT_STORE)
  }
}

export function saveConnectorStore(store: ConnectorStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    /* 静默失败 */
  }
}

/** 合并 mock 数据与 localStorage 状态 */
export function mergeConnectors(
  baseConnectors: ConnectorItem[],
  store: ConnectorStore,
): ConnectorItem[] {
  return baseConnectors.map((item) => {
    const state = store.states[item.id]
    if (!state) return item
    return {
      ...item,
      connected: state.connected,
      enabled: state.enabled,
      status: state.status,
      accountLabel: state.accountLabel ?? item.accountLabel,
      endpoint: state.endpoint ?? item.endpoint,
      scopes: state.scopes ?? item.scopes,
    }
  })
}

/** 更新某个连接器的状态 */
export function updateConnectorState(
  store: ConnectorStore,
  id: string,
  patch: Partial<StoredConnectorState>,
): ConnectorStore {
  const current = store.states[id] ?? {
    connected: false,
    enabled: false,
    status: 'not-connected' as ConnectorStatus,
  }
  const next: ConnectorStore = {
    ...store,
    states: {
      ...store.states,
      [id]: { ...current, ...patch },
    },
  }
  saveConnectorStore(next)
  return next
}

/** 添加本地连接器 */
export function addLocalConnector(
  store: ConnectorStore,
  connector: ConnectorItem,
): ConnectorStore {
  const next: ConnectorStore = {
    ...store,
    localConnectors: [...store.localConnectors, connector],
    states: {
      ...store.states,
      [connector.id]: {
        connected: true,
        enabled: true,
        status: 'connected',
        authType: connector.authType,
        scopes: connector.scopes,
      },
    },
  }
  saveConnectorStore(next)
  return next
}

/** 移除本地连接器 */
export function removeLocalConnector(
  store: ConnectorStore,
  id: string,
): ConnectorStore {
  const next: ConnectorStore = {
    ...store,
    localConnectors: store.localConnectors.filter((c) => c.id !== id),
    states: {
      ...store.states,
      [id]: {
        connected: false,
        enabled: false,
        status: 'not-connected',
      },
    },
  }
  saveConnectorStore(next)
  return next
}

/** 重置连接器状态到默认 */
export function resetConnectorState(
  store: ConnectorStore,
  id: string,
): ConnectorStore {
  const next: ConnectorStore = {
    ...store,
    states: { ...store.states },
  }
  delete next.states[id]
  saveConnectorStore(next)
  return next
}

/** 过滤 JSON 中的敏感字段 */
const SECRET_KEYS = ['key', 'token', 'secret', 'password', 'apiKey', 'API_KEY', 'api_key']

export function sanitizeJsonInput(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj }
  for (const key of SECRET_KEYS) {
    if (key in result) {
      delete result[key]
    }
  }
  return result
}
