import { readJSON, writeJSON } from '../../shared/storage'
/**
 * expertStorage.ts
 *
 * 专家套件 localStorage 持久化。
 * 遵循 skillsStorage / mcpStorage 同一模式。
 */

import { mockExpertSuites } from './expertMockData'
import type { ExpertSuite } from './expertMockData'

/* ── 类型 ── */

export interface StoredExpertState {
  installed: boolean
}

export interface ExpertStore {
  states: Record<string, StoredExpertState>
}

/* ── localStorage key ── */

const EXPERT_STORE_KEY = 'geowork.experts.v1'

/* ── 读写 ── */

export function loadExpertStore(): ExpertStore {
  try {
    const parsed: unknown = readJSON<unknown>(EXPERT_STORE_KEY, null)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as ExpertStore).states === 'object'
    ) {
      return parsed as ExpertStore
    }
    return { states: {} }
  } catch {
    return { states: {} }
  }
}

export function saveExpertStore(store: ExpertStore): void {
  writeJSON(EXPERT_STORE_KEY, store)
}

/* ── 操作函数 ── */

export function updateExpertState(
  store: ExpertStore,
  id: string,
  patch: Partial<StoredExpertState>,
): ExpertStore {
  const current = store.states[id] ?? { installed: false }
  const next: ExpertStore = {
    ...store,
    states: {
      ...store.states,
      [id]: { ...current, ...patch },
    },
  }
  saveExpertStore(next)
  return next
}

/**
 * 合并 mock 数据与 storage 状态，返回完整的专家列表。
 */
export function mergeExperts(store: ExpertStore): ExpertSuite[] {
  return mockExpertSuites.map((expert) => {
    const stored = store.states[expert.id]
    if (!stored) return expert
    return {
      ...expert,
      installed: stored.installed,
    }
  })
}
