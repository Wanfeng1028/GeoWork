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

  /* 引导 */
  guideVisited: boolean
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
  guideVisited: false,
}

const STORAGE_KEY = 'geowork.settings.v1'

export function loadSettings(): GeoWorkSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: GeoWorkSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* 静默失败：隐私模式或配额满 */
  }
}

/**
 * 局部更新设置项。
 * 读取当前设置 → 合并 patch → 写回 → 返回最新完整设置。
 * 读取失败时回退 DEFAULT_SETTINGS 再合并。
 */
export function updateSettingsPatch(
  patch: Partial<GeoWorkSettings>,
): GeoWorkSettings {
  const current = loadSettings()
  const next = { ...current, ...patch }
  saveSettings(next)
  return next
}
