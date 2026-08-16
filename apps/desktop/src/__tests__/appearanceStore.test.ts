import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'geowork.appearance'

/**
 * The store computes its initial value at module load, so every test
 * re-imports it with a fresh module registry after arranging localStorage.
 */
async function loadStore() {
  vi.resetModules()
  const mod = await import('../shared/stores/appearanceStore')
  return mod.useAppearanceStore
}

describe('appearanceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initial value', () => {
    it('defaults to editorial when nothing is saved', async () => {
      const store = await loadStore()
      expect(store.getState().appearance).toBe('editorial')
      expect(store.getState().resolvedAppearance).toBe('light')
    })

    it('restores a valid saved appearance', async () => {
      localStorage.setItem(STORAGE_KEY, 'editorial-dark')
      const store = await loadStore()
      expect(store.getState().appearance).toBe('editorial-dark')
      expect(store.getState().resolvedAppearance).toBe('dark')
    })

    it('restores system mode', async () => {
      localStorage.setItem(STORAGE_KEY, 'system')
      const store = await loadStore()
      expect(store.getState().appearance).toBe('system')
    })

    it('falls back to editorial for values outside the persisted whitelist', async () => {
      // 'dark'/'light' are valid runtime values but not persisted choices.
      localStorage.setItem(STORAGE_KEY, 'dark')
      const store = await loadStore()
      expect(store.getState().appearance).toBe('editorial')
    })

    it('resolves system mode via prefers-color-scheme', async () => {
      localStorage.setItem(STORAGE_KEY, 'system')
      vi.stubGlobal(
        'matchMedia',
        vi
          .fn()
          .mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }),
      )
      const store = await loadStore()
      expect(store.getState().appearance).toBe('system')
      expect(store.getState().resolvedAppearance).toBe('dark')
    })
  })

  describe('setAppearance', () => {
    it('persists the choice and updates resolved appearance', async () => {
      const store = await loadStore()
      store.getState().setAppearance('editorial-dark')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('editorial-dark')
      expect(store.getState().appearance).toBe('editorial-dark')
      expect(store.getState().resolvedAppearance).toBe('dark')
    })

    it('editorial resolves to light', async () => {
      const store = await loadStore()
      store.getState().setAppearance('editorial')
      expect(store.getState().resolvedAppearance).toBe('light')
    })

    it('system resolves through matchMedia', async () => {
      const store = await loadStore()
      vi.stubGlobal(
        'matchMedia',
        vi
          .fn()
          .mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }),
      )
      store.getState().setAppearance('system')
      expect(store.getState().resolvedAppearance).toBe('dark')
    })
  })

  describe('setResolvedAppearance', () => {
    it('overrides resolved value without touching the stored choice', async () => {
      const store = await loadStore()
      store.getState().setResolvedAppearance('dark')
      expect(store.getState().resolvedAppearance).toBe('dark')
      expect(store.getState().appearance).toBe('editorial')
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })
})
