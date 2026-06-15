import {
  DEFAULT_THEME,
  resolveTheme,
  type GeoWorkTheme,
  type ResolvedTheme,
} from './types'

const THEME_KEY = 'geowork.theme'

/**
 * Initialize the theme on app boot.
 * Priority: localStorage > OS preference > DEFAULT_THEME (dark).
 * Also keeps the `data-resolved-theme` attribute in sync for components that
 * key dark-only styles off it (mirrors QoderWorkCopy's resolved-theme mechanism).
 */
export function initGeoWorkTheme(): GeoWorkTheme {
  const saved = localStorage.getItem(THEME_KEY) as GeoWorkTheme | null
  const theme: GeoWorkTheme = saved ?? DEFAULT_THEME
  applyTheme(theme)
  return theme
}

export function setGeoWorkTheme(theme: GeoWorkTheme) {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function getGeoWorkTheme(): GeoWorkTheme {
  return (document.documentElement.dataset.theme as GeoWorkTheme) ?? DEFAULT_THEME
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Resolve the currently-applied theme to light/dark. */
export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getGeoWorkTheme())
}

function applyTheme(theme: GeoWorkTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.resolvedTheme = resolveTheme(theme)

  // When in `auto`, keep the resolved attribute fresh as the OS changes.
  if (theme === 'auto' && window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      root.dataset.resolvedTheme = media.matches ? 'dark' : 'light'
    }
    media.addEventListener?.('change', sync)
  }
}
