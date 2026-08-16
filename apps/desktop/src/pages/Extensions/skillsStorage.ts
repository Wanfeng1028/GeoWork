import { readJSON, writeJSON } from '../../shared/storage'
/**
 * GeoWork 技能状态 — localStorage 持久化
 *
 * key: geowork.skills.v1
 *
 * 结构：
 * {
 *   states: Record<string, { installed: boolean; enabled: boolean }>,
 *   localSkills: SkillItem[]   // 本地上传的技能完整元数据
 * }
 *
 * 市场 / 内置技能基础数据来自 skillsMockData，states 覆盖 installed / enabled。
 * 本地上传技能完整存入 localSkills。
 */

import type { SkillItem } from './skillsMockData'

const STORAGE_KEY = 'geowork.skills.v1'

export type StoredSkillState = {
  installed: boolean
  enabled: boolean
}

export type SkillsStore = {
  states: Record<string, StoredSkillState>
  localSkills: SkillItem[]
}

const DEFAULT_STORE: SkillsStore = {
  states: {},
  localSkills: [],
}

export function loadSkillsStore(): SkillsStore {
  try {
    const parsed = readJSON<Record<string, unknown>>(STORAGE_KEY, {})
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_STORE, states: {}, localSkills: [] }
    }
    return {
      states:
        typeof parsed.states === 'object' && parsed.states !== null
          ? (parsed.states as Record<string, StoredSkillState>)
          : {},
      localSkills: Array.isArray(parsed.localSkills) ? parsed.localSkills : [],
    }
  } catch {
    return { ...DEFAULT_STORE, states: {}, localSkills: [] }
  }
}

export function saveSkillsStore(store: SkillsStore): void {
  writeJSON(STORAGE_KEY, store)
}

/** 更新某个技能的状态（安装/启用） */
export function updateSkillState(
  store: SkillsStore,
  id: string,
  patch: Partial<StoredSkillState>,
): SkillsStore {
  const current = store.states[id] ?? { installed: false, enabled: false }
  const next: SkillsStore = {
    ...store,
    states: {
      ...store.states,
      [id]: { ...current, ...patch },
    },
  }
  saveSkillsStore(next)
  return next
}

/** 添加本地上传技能 */
export function addLocalSkill(store: SkillsStore, skill: SkillItem): SkillsStore {
  const next: SkillsStore = {
    ...store,
    localSkills: [...store.localSkills, skill],
    states: {
      ...store.states,
      [skill.id]: { installed: true, enabled: true },
    },
  }
  saveSkillsStore(next)
  return next
}

/** 移除本地上传技能 */
export function removeLocalSkill(store: SkillsStore, id: string): SkillsStore {
  const next: SkillsStore = {
    ...store,
    localSkills: store.localSkills.filter((s) => s.id !== id),
    states: {
      ...store.states,
      [id]: { installed: false, enabled: false },
    },
  }
  saveSkillsStore(next)
  return next
}
