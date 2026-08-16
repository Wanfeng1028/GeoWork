import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadModelProviders,
  saveModelProviders,
  upsertProvider,
  deleteProvider,
  upsertModel,
  deleteModel,
  getEnabledModels,
  resolveCustomModelDisplayName,
  getAllValidModelValues,
  type ModelProvider,
  type ModelProviderData,
} from '../shared/stores/modelProviderStore'

const STORAGE_KEY = 'geowork.modelProviders.v1'
const EVENT_NAME = 'geowork:model-providers-updated'

function makeProvider(overrides: Partial<ModelProvider> = {}): ModelProvider {
  return {
    id: 'p1',
    name: 'Provider One',
    providerId: 'prov-one',
    apiKey: 'sk-test',
    baseUrl: 'http://localhost:11434',
    endpointPath: '/chat/completions',
    enabled: true,
    isDefault: false,
    models: [],
    providerCapabilities: {
      imageGeneration: false,
      speechToText: false,
      textToSpeech: false,
      musicGeneration: false,
      videoGeneration: false,
    },
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

describe('modelProviderStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /** Start from an empty provider list (storage empty loads the built-in default). */
  function seedEmpty() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ providers: [], useProxy: false, proxyUrl: '' }),
    )
  }

  describe('loadModelProviders', () => {
    it('returns default data when storage is empty', () => {
      const data = loadModelProviders()
      expect(data.providers).toHaveLength(1)
      expect(data.providers[0].id).toBe('provider-default')
      expect(data.providers[0].isDefault).toBe(true)
      expect(data.useProxy).toBe(false)
      expect(data.proxyUrl).toBe('')
    })

    it('returns default data when stored JSON is malformed', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json')
      const data = loadModelProviders()
      expect(data.providers[0].id).toBe('provider-default')
    })

    it('returns default data when providers is not an array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ providers: 'nope' }))
      const data = loadModelProviders()
      expect(data.providers[0].id).toBe('provider-default')
    })

    it('returns default data when stored value is null', () => {
      localStorage.setItem(STORAGE_KEY, 'null')
      const data = loadModelProviders()
      expect(data.providers[0].id).toBe('provider-default')
    })

    it('loads valid stored data', () => {
      const stored: ModelProviderData = {
        providers: [makeProvider()],
        useProxy: true,
        proxyUrl: 'http://proxy:8080',
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      const data = loadModelProviders()
      expect(data.providers).toHaveLength(1)
      expect(data.providers[0].providerId).toBe('prov-one')
      expect(data.useProxy).toBe(true)
      expect(data.proxyUrl).toBe('http://proxy:8080')
    })

    it('coerces missing useProxy/proxyUrl to defaults', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ providers: [makeProvider()] }))
      const data = loadModelProviders()
      expect(data.useProxy).toBe(false)
      expect(data.proxyUrl).toBe('')
    })

    it('returns a fresh clone of defaults each call (no shared mutation)', () => {
      const a = loadModelProviders()
      a.providers[0].name = 'mutated'
      const b = loadModelProviders()
      expect(b.providers[0].name).toBe('GeoWork Local')
    })
  })

  describe('saveModelProviders', () => {
    it('persists data and dispatches update event', () => {
      const dispatch = vi.fn()
      window.addEventListener(EVENT_NAME, dispatch)
      const data: ModelProviderData = { providers: [makeProvider()], useProxy: false, proxyUrl: '' }
      saveModelProviders(data)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).providers[0].id).toBe('p1')
      expect(dispatch).toHaveBeenCalledTimes(1)
      window.removeEventListener(EVENT_NAME, dispatch)
    })
  })

  describe('upsertProvider', () => {
    it('appends a new provider', () => {
      upsertProvider(makeProvider({ id: 'new-p' }))
      const data = loadModelProviders()
      expect(data.providers.some((p) => p.id === 'new-p')).toBe(true)
    })

    it('replaces an existing provider by id and bumps updatedAt', () => {
      upsertProvider(makeProvider({ id: 'p1', updatedAt: 1 }))
      upsertProvider(makeProvider({ id: 'p1', name: 'Renamed', updatedAt: 1 }))
      const data = loadModelProviders()
      const match = data.providers.filter((p) => p.id === 'p1')
      expect(match).toHaveLength(1)
      expect(match[0].name).toBe('Renamed')
      expect(match[0].updatedAt).toBeGreaterThan(1)
    })
  })

  describe('deleteProvider', () => {
    it('removes the provider', () => {
      upsertProvider(makeProvider({ id: 'p1' }))
      upsertProvider(makeProvider({ id: 'p2' }))
      deleteProvider('p1')
      const data = loadModelProviders()
      expect(data.providers.some((p) => p.id === 'p1')).toBe(false)
      expect(data.providers.some((p) => p.id === 'p2')).toBe(true)
    })

    it('promotes first remaining provider to default when default is deleted', () => {
      seedEmpty()
      upsertProvider(makeProvider({ id: 'p1', isDefault: true }))
      upsertProvider(makeProvider({ id: 'p2', isDefault: false }))
      deleteProvider('p1')
      const data = loadModelProviders()
      expect(data.providers).toHaveLength(1)
      expect(data.providers[0].isDefault).toBe(true)
    })

    it('leaves empty list when last provider is deleted', () => {
      seedEmpty()
      upsertProvider(makeProvider({ id: 'p1', isDefault: true }))
      deleteProvider('p1')
      const data = loadModelProviders()
      expect(data.providers).toHaveLength(0)
    })
  })

  describe('model CRUD', () => {
    beforeEach(() => {
      seedEmpty()
    })

    it('upsertModel adds a model to the provider', () => {
      upsertProvider(makeProvider({ id: 'p1' }))
      upsertModel('p1', {
        id: 'm1',
        name: 'llama3',
        displayName: 'Llama 3',
        capabilities: ['text'],
        enabled: true,
      })
      const data = loadModelProviders()
      expect(data.providers[0].models).toHaveLength(1)
      expect(data.providers[0].models[0].name).toBe('llama3')
    })

    it('upsertModel replaces an existing model by id', () => {
      upsertProvider(makeProvider({ id: 'p1' }))
      upsertModel('p1', {
        id: 'm1',
        name: 'a',
        displayName: 'A',
        capabilities: ['text'],
        enabled: true,
      })
      upsertModel('p1', {
        id: 'm1',
        name: 'b',
        displayName: 'B',
        capabilities: ['text'],
        enabled: true,
      })
      const data = loadModelProviders()
      expect(data.providers[0].models).toHaveLength(1)
      expect(data.providers[0].models[0].name).toBe('b')
    })

    it('upsertModel is a no-op for unknown provider', () => {
      upsertProvider(makeProvider({ id: 'p1' }))
      upsertModel('missing', {
        id: 'm1',
        name: 'x',
        displayName: 'X',
        capabilities: [],
        enabled: true,
      })
      const data = loadModelProviders()
      expect(data.providers[0].models).toHaveLength(0)
    })

    it('deleteModel removes the model', () => {
      upsertProvider(makeProvider({ id: 'p1' }))
      upsertModel('p1', { id: 'm1', name: 'a', displayName: 'A', capabilities: [], enabled: true })
      deleteModel('p1', 'm1')
      const data = loadModelProviders()
      expect(data.providers[0].models).toHaveLength(0)
    })
  })

  describe('getEnabledModels', () => {
    it('returns only models from enabled providers that are themselves enabled', () => {
      seedEmpty()
      upsertProvider(
        makeProvider({
          id: 'p1',
          providerId: 'prov-one',
          enabled: true,
          models: [
            { id: 'm1', name: 'on', displayName: 'On', capabilities: ['text'], enabled: true },
            { id: 'm2', name: 'off', displayName: 'Off', capabilities: ['text'], enabled: false },
          ],
        }),
      )
      upsertProvider(
        makeProvider({
          id: 'p2',
          providerId: 'prov-two',
          enabled: false,
          models: [
            {
              id: 'm3',
              name: 'hidden',
              displayName: 'Hidden',
              capabilities: ['text'],
              enabled: true,
            },
          ],
        }),
      )

      const models = getEnabledModels()
      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('custom:prov-one/on')
      expect(models[0].source).toBe('custom')
      expect(models[0].providerName).toBe('Provider One')
    })
  })

  describe('resolveCustomModelDisplayName', () => {
    beforeEach(() => {
      upsertProvider(
        makeProvider({
          id: 'p1',
          providerId: 'prov-one',
          enabled: true,
          models: [
            {
              id: 'm1',
              name: 'llama3',
              displayName: 'Llama 3',
              capabilities: ['text'],
              enabled: true,
            },
          ],
        }),
      )
    })

    it('resolves a valid custom model value', () => {
      expect(resolveCustomModelDisplayName('custom:prov-one/llama3')).toBe('Llama 3')
    })

    it('returns null for non-custom values', () => {
      expect(resolveCustomModelDisplayName('gpt-4')).toBeNull()
    })

    it('returns null for malformed custom values', () => {
      expect(resolveCustomModelDisplayName('custom:noslash')).toBeNull()
    })

    it('returns null for unknown provider', () => {
      expect(resolveCustomModelDisplayName('custom:unknown/llama3')).toBeNull()
    })

    it('returns null for disabled model', () => {
      upsertModel('p1', {
        id: 'm2',
        name: 'off',
        displayName: 'Off',
        capabilities: [],
        enabled: false,
      })
      expect(resolveCustomModelDisplayName('custom:prov-one/off')).toBeNull()
    })
  })

  describe('getAllValidModelValues', () => {
    it('combines built-in and enabled custom values', () => {
      upsertProvider(
        makeProvider({
          id: 'p1',
          providerId: 'prov-one',
          enabled: true,
          models: [
            {
              id: 'm1',
              name: 'llama3',
              displayName: 'Llama 3',
              capabilities: ['text'],
              enabled: true,
            },
          ],
        }),
      )
      const values = getAllValidModelValues(['gpt-4', 'claude'])
      expect(values).toContain('gpt-4')
      expect(values).toContain('claude')
      expect(values).toContain('custom:prov-one/llama3')
    })
  })
})
