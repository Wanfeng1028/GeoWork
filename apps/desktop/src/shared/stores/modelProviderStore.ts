/**
 * GeoWork 模型供应商 Store — localStorage 持久化
 *
 * key: geowork.modelProviders.v1
 * 解析失败回退默认值，不抛异常。
 */

/* ── 类型 ── */

export type ModelCapability =
  | 'text'
  | 'vision'
  | 'embedding'
  | 'tool-calling'
  | 'reasoning'
  | 'audio'
  | 'video'

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

const STORAGE_KEY = 'geowork.modelProviders.v1'
const EVENT_NAME = 'geowork:model-providers-updated'

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

export function loadModelProviders(): ModelProviderData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_DATA)
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.providers)) {
      return structuredClone(DEFAULT_DATA)
    }
    return {
      providers: parsed.providers,
      useProxy: !!parsed.useProxy,
      proxyUrl: parsed.proxyUrl ?? '',
    }
  } catch {
    return structuredClone(DEFAULT_DATA)
  }
}

export function saveModelProviders(data: ModelProviderData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    /* 静默失败 */
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
