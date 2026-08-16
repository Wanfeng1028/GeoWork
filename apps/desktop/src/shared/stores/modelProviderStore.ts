/**
 * GeoWork 模型供应商 Store — localStorage 持久化
 *
 * key: geowork.modelProviders.v1
 * 解析失败回退默认值，不抛异常。
 *
 * P1-8: apiKey 不再以明文存于 localStorage。写入时自动剥离并持久化到
 * Electron safeStorage（OS 级加密）；读取时通过 hydrateProviderApiKeys()
 * 异步回填。非 Electron 环境（测试/纯浏览器）下 secrets API 不存在，
 * apiKey 保持空字符串，功能降级但不报错。
 */

/* ── 类型 ── */

export type ModelCapability =
  'text' | 'vision' | 'embedding' | 'tool-calling' | 'reasoning' | 'audio' | 'video'

export interface CustomModel {
  id: string
  name: string
  displayName: string
  capabilities: ModelCapability[]
  contextWindow?: number
  enabled: boolean
}

export interface ModelProvider {
  id: string
  name: string
  providerId: string
  apiKey: string
  baseUrl: string
  endpointPath: string
  enabled: boolean
  isDefault?: boolean
  models: CustomModel[]
  /** Provider 级能力开关（仅保存配置） */
  providerCapabilities: {
    imageGeneration: boolean
    speechToText: boolean
    textToSpeech: boolean
    musicGeneration: boolean
    videoGeneration: boolean
  }
  createdAt: number
  updatedAt: number
}

export interface ModelProviderData {
  providers: ModelProvider[]
  useProxy: boolean
  proxyUrl: string
}

export interface AvailableModelOption {
  id: string
  providerId: string
  providerName: string
  modelName: string
  displayName: string
  capabilities: ModelCapability[]
  source: 'built-in' | 'custom'
}

/* ── 常量 ── */

import { readJSON, writeJSON } from '../storage'

const STORAGE_KEY = 'geowork.modelProviders.v1'
const EVENT_NAME = 'geowork:model-providers-updated'
const SECRET_KEY_PREFIX = 'geowork.provider.apiKey.'

function secretKeyFor(providerId: string): string {
  return `${SECRET_KEY_PREFIX}${providerId}`
}

/** safeStorage IPC 桥（非 Electron 环境为 undefined） */
function secretsBridge():
  | {
      get: (k: string) => Promise<string | null>
      set: (k: string, v: string) => Promise<unknown>
      delete: (k: string) => Promise<unknown>
    }
  | undefined {
  return (
    window as unknown as {
      geowork?: {
        secrets?: {
          get: (k: string) => Promise<string | null>
          set: (k: string, v: string) => Promise<unknown>
          delete: (k: string) => Promise<unknown>
        }
      }
    }
  ).geowork?.secrets
}

const DEFAULT_PROVIDER_CAPABILITIES: ModelProvider['providerCapabilities'] = {
  imageGeneration: false,
  speechToText: false,
  textToSpeech: false,
  musicGeneration: false,
  videoGeneration: false,
}

const DEFAULT_DATA: ModelProviderData = {
  providers: [
    {
      id: 'provider-default',
      name: 'GeoWork Local',
      providerId: 'geowork-local',
      apiKey: '',
      baseUrl: '',
      endpointPath: '/chat/completions',
      enabled: true,
      isDefault: true,
      models: [
        {
          id: 'model-default-1',
          name: 'geowork-local',
          displayName: 'GeoWork Local',
          capabilities: ['text'],
          contextWindow: 32000,
          enabled: true,
        },
      ],
      providerCapabilities: { ...DEFAULT_PROVIDER_CAPABILITIES },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  useProxy: false,
  proxyUrl: '',
}

/* ── 读写 ── */

/**
 * P1-8: apiKey 内存缓存。safeStorage 是异步 IPC，同步的 loadModelProviders
 * 无法等待，因此用内存 Map 桥接：save 时写入缓存 + safeStorage，
 * load 时从缓存合并。应用启动时 hydrateProviderApiKeys() 预热缓存。
 */
const apiKeyCache = new Map<string, string>()

/** hydrate 是否已完成（防止 hydrate 前保存误删 secret） */
let hydrateDone = false

export function loadModelProviders(): ModelProviderData {
  try {
    const parsed = readJSON<Record<string, unknown>>(STORAGE_KEY, {} as Record<string, unknown>)
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.providers)) {
      return structuredClone(DEFAULT_DATA)
    }
    const data: ModelProviderData = {
      providers: parsed.providers,
      useProxy: !!parsed.useProxy,
      proxyUrl: (parsed.proxyUrl as string | undefined) ?? '',
    }
    // 合并 safeStorage 缓存的 apiKey
    for (const provider of data.providers) {
      const cached = apiKeyCache.get(provider.id)
      if (cached) provider.apiKey = cached
    }
    return data
  } catch {
    return structuredClone(DEFAULT_DATA)
  }
}

export function saveModelProviders(data: ModelProviderData): void {
  try {
    const bridge = secretsBridge()
    const stripped = structuredClone(data)
    for (const provider of stripped.providers) {
      if (provider.apiKey) {
        // 写入内存缓存 + safeStorage（fire-and-forget）
        apiKeyCache.set(provider.id, provider.apiKey)
        bridge?.set(secretKeyFor(provider.id), provider.apiKey).catch(() => {})
      } else if (hydrateDone) {
        // apiKey 被清空且 hydrate 已完成 → 用户显式清除，删除 secret
        apiKeyCache.delete(provider.id)
        bridge?.delete(secretKeyFor(provider.id)).catch(() => {})
      }
      // hydrate 未完成时 apiKey 为空属于"尚未回填"，保留已有 secret
      provider.apiKey = '' // 剥离明文，不写入 localStorage
    }
    writeJSON(STORAGE_KEY, stripped)
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    /* 静默失败 */
  }
}

/**
 * P1-8: 应用启动时调用。
 * 1. 迁移遗留明文 apiKey（localStorage → safeStorage）
 * 2. 从 safeStorage 预热 apiKeyCache
 * 3. 触发 EVENT_NAME 通知 UI 刷新
 */
export async function hydrateProviderApiKeys(): Promise<void> {
  const bridge = secretsBridge()
  if (!bridge) {
    hydrateDone = true
    return
  }
  try {
    const parsed = readJSON<Record<string, unknown>>(STORAGE_KEY, {} as Record<string, unknown>)
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.providers)) return
    let needsRewrite = false
    for (const provider of parsed.providers as ModelProvider[]) {
      // 遗留明文迁移
      if (provider.apiKey) {
        await bridge.set(secretKeyFor(provider.id), provider.apiKey)
        provider.apiKey = ''
        needsRewrite = true
      }
      // 预热缓存
      const secret = await bridge.get(secretKeyFor(provider.id))
      if (secret) apiKeyCache.set(provider.id, secret)
    }
    if (needsRewrite) {
      writeJSON(STORAGE_KEY, parsed)
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    /* 静默失败 */
  } finally {
    hydrateDone = true
  }
}

/* ── Provider CRUD ── */

export function upsertProvider(provider: ModelProvider): void {
  const data = loadModelProviders()
  const idx = data.providers.findIndex((p) => p.id === provider.id)
  provider.updatedAt = Date.now()
  if (idx >= 0) {
    data.providers[idx] = provider
  } else {
    data.providers.push(provider)
  }
  saveModelProviders(data)
}

export function deleteProvider(id: string): void {
  const data = loadModelProviders()
  data.providers = data.providers.filter((p) => p.id !== id)
  /* 确保至少有一个 default（如果删光了就不设） */
  if (data.providers.length > 0 && !data.providers.some((p) => p.isDefault)) {
    data.providers[0].isDefault = true
  }
  // P1-8: 清理该 provider 的加密 apiKey
  apiKeyCache.delete(id)
  secretsBridge()
    ?.delete(secretKeyFor(id))
    .catch(() => {})
  saveModelProviders(data)
}

/* ── Model CRUD ── */

export function upsertModel(providerId: string, model: CustomModel): void {
  const data = loadModelProviders()
  const provider = data.providers.find((p) => p.id === providerId)
  if (!provider) return
  const idx = provider.models.findIndex((m) => m.id === model.id)
  if (idx >= 0) {
    provider.models[idx] = model
  } else {
    provider.models.push(model)
  }
  provider.updatedAt = Date.now()
  saveModelProviders(data)
}

export function deleteModel(providerId: string, modelId: string): void {
  const data = loadModelProviders()
  const provider = data.providers.find((p) => p.id === providerId)
  if (!provider) return
  provider.models = provider.models.filter((m) => m.id !== modelId)
  provider.updatedAt = Date.now()
  saveModelProviders(data)
}

/* ── 查询 ── */

export function getEnabledModels(): AvailableModelOption[] {
  const data = loadModelProviders()
  const result: AvailableModelOption[] = []
  for (const provider of data.providers) {
    if (!provider.enabled) continue
    for (const model of provider.models) {
      if (!model.enabled) continue
      result.push({
        id: `custom:${provider.providerId}/${model.name}`,
        providerId: provider.providerId,
        providerName: provider.name,
        modelName: model.name,
        displayName: model.displayName,
        capabilities: model.capabilities,
        source: 'custom',
      })
    }
  }
  return result
}

/** 根据 model value 查找自定义模型显示名 */
export function resolveCustomModelDisplayName(value: string): string | null {
  if (!value.startsWith('custom:')) return null
  const data = loadModelProviders()
  const path = value.slice('custom:'.length)
  const slashIdx = path.indexOf('/')
  if (slashIdx < 0) return null
  const providerId = path.slice(0, slashIdx)
  const modelName = path.slice(slashIdx + 1)
  for (const provider of data.providers) {
    if (provider.providerId === providerId) {
      for (const model of provider.models) {
        if (model.name === modelName && model.enabled && provider.enabled) {
          return model.displayName
        }
      }
    }
  }
  return null
}

/** 获取所有有效 model value（内置 + 自定义） */
export function getAllValidModelValues(builtInValues: string[]): string[] {
  const customValues = getEnabledModels().map((m) => m.id)
  return [...builtInValues, ...customValues]
}
