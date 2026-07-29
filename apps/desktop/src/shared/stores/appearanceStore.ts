import { create } from 'zustand'

export type Appearance = 'light' | 'dark' | 'system' | 'illustration' | 'glass'
export type ResolvedAppearance = 'light' | 'dark'

interface AppearanceState {
  appearance: Appearance
  resolvedAppearance: ResolvedAppearance
  setAppearance: (appearance: Appearance) => void
  setResolvedAppearance: (resolvedAppearance: ResolvedAppearance) => void
}

const STORAGE_KEY = 'geowork.appearance'

const VALID_APPEARANCES: ReadonlySet<Appearance> = new Set([
  'light',
  'dark',
  'system',
  'illustration',
  'glass',
])

function getSystemAppearance(): ResolvedAppearance {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function resolveAppearance(appearance: Appearance): ResolvedAppearance {
  if (appearance === 'system') return getSystemAppearance()
  if (appearance === 'dark') return 'dark'
  return 'light'
}

function getInitialAppearance(): Appearance {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved && VALID_APPEARANCES.has(saved as Appearance)) return saved as Appearance
  return 'light'
}

const initialAppearance = getInitialAppearance()

export const useAppearanceStore = create<AppearanceState>((set) => ({
  appearance: initialAppearance,
  resolvedAppearance: resolveAppearance(initialAppearance),

  setAppearance: (appearance) => {
    window.localStorage.setItem(STORAGE_KEY, appearance)
    set({
      appearance,
      resolvedAppearance: resolveAppearance(appearance),
    })
  },

  setResolvedAppearance: (resolvedAppearance) => {
    set({ resolvedAppearance })
  },
}))
