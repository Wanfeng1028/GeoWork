export type GeoWorkTheme = 'light' | 'dark' | 'dark-glass' | 'light-glass'

const THEME_KEY = 'geowork.theme'

export function initGeoWorkTheme(): GeoWorkTheme {
  const saved = localStorage.getItem(THEME_KEY) as GeoWorkTheme | null
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

  const theme: GeoWorkTheme = saved ?? (systemDark ? 'dark' : 'light')
  document.documentElement.dataset.theme = theme

  return theme
}

export function setGeoWorkTheme(theme: GeoWorkTheme) {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.dataset.theme = theme
}

export function getGeoWorkTheme(): GeoWorkTheme {
  return (document.documentElement.dataset.theme as GeoWorkTheme) ?? 'dark'
}

export function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
