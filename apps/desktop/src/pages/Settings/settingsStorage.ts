import { readJSON, writeJSON } from '../../shared/storage'
/**
 * GeoWork 设置中心 — localStorage 持久化
 *
 * key: geowork.settings.v1
 * 解析失败回退 DEFAULT_SETTINGS，不抛异常。
 */

export interface GeoWorkSettings {
  /* 偏好设置 — 基础偏好 */
  language: 'zh-CN' | 'en-US'
  interfaceStyle: 'default' | 'compact' | 'spacious'
  meteorEffect: boolean
  chatFont: 'system' | 'serif' | 'mono'
  chatFontSize: 'small' | 'medium' | 'large'
  chatWidth: 'compact' | 'default' | 'wide'

  /* 偏好设置 — 对话行为 */
  previewMode: 'new-window' | 'inline'
  autoSuggest: boolean
  autoExpandTools: boolean
  hideToolDetailsInConversation: boolean
  toolExecutionLimitEnabled: boolean
  toolExecutionLimit: number

  /* 系统设置 */
  autoStart: boolean
  keepAwake: boolean
  desktopNotification: boolean
  soundNotification: boolean
  closeWindowBehavior: 'minimize' | 'exit' | 'ask'
  networkProxy: 'system' | 'none' | 'manual'

  /* 语音输入 */
  voiceInput: boolean
  noiseReduction: boolean

  /* 记忆与上下文 */
  memoryEnabled: boolean
  autoMemory: boolean

  /* 安全工作环境 / 实验特性 */
  safeWorkspace: boolean
  generativeUi: boolean
  floatingWorkspace: boolean
  browserContext: boolean
  /** AI 组件 V2（doc/26）：true 用 Ant Design X 渲染树，false 回退自研组件 */
  aiComponentsV2: boolean

  /* 引导 */
  guideVisited: boolean

  /* 工作目录 — 最近选择（新任务页"最近的目录"菜单数据源） */
  recentWorkDirs: string[]
}

export const DEFAULT_SETTINGS: GeoWorkSettings = {
  language: 'zh-CN',
  interfaceStyle: 'default',
  meteorEffect: true,
  chatFont: 'system',
  chatFontSize: 'medium',
  chatWidth: 'default',
  previewMode: 'new-window',
  autoSuggest: true,
  autoExpandTools: false,
  hideToolDetailsInConversation: false,
  toolExecutionLimitEnabled: false,
  toolExecutionLimit: 100,
  autoStart: false,
  keepAwake: true,
  desktopNotification: true,
  soundNotification: false,
  closeWindowBehavior: 'minimize',
  networkProxy: 'system',
  voiceInput: true,
  noiseReduction: false,
  memoryEnabled: true,
  autoMemory: true,
  safeWorkspace: false,
  generativeUi: false,
  floatingWorkspace: false,
  browserContext: false,
  aiComponentsV2: true,
  guideVisited: false,
  recentWorkDirs: [],
}

const STORAGE_KEY = 'geowork.settings.v1'

export function loadSettings(): GeoWorkSettings {
  const parsed = readJSON<Partial<GeoWorkSettings>>(STORAGE_KEY, {})
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...parsed }
}

export function saveSettings(settings: GeoWorkSettings): void {
  writeJSON(STORAGE_KEY, settings)
}

/**
 * 局部更新设置项。
 * 读取当前设置 → 合并 patch → 写回 → 返回最新完整设置。
 * 读取失败时回退 DEFAULT_SETTINGS 再合并。
 */
export function updateSettingsPatch(patch: Partial<GeoWorkSettings>): GeoWorkSettings {
  const current = loadSettings()
  const next = { ...current, ...patch }
  saveSettings(next)
  return next
}
