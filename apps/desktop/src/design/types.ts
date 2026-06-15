/**
 * GeoWork theme identifiers — 9 variants ported from QoderWorkCopy.
 *
 * Families (×light/dark):
 *   - default    : the base light/dark
 *   - glass      : translucent glassmorphic
 *   - classic    : neutral gray
 *   - parchment  : warm sepia
 * Plus `auto` which follows the OS via prefers-color-scheme.
 */
export type GeoWorkTheme =
  | 'light'
  | 'dark'
  | 'auto'
  | 'light-glass'
  | 'dark-glass'
  | 'classic-light'
  | 'classic-dark'
  | 'light-parchment'
  | 'dark-parchment'

/** Resolved light/dark bucket (glass/classic/parchment all resolve to one of these). */
export type ResolvedTheme = 'light' | 'dark'

export type GeoWorkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type GeoWorkVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'

export type GeoWorkRadius = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

/** Theme family (ignores light/dark). */
export type GeoWorkThemeFamily = 'default' | 'glass' | 'classic' | 'parchment'

/** All available themes for pickers. */
export const GEOWORK_THEMES: GeoWorkTheme[] = [
  'light',
  'dark',
  'auto',
  'light-glass',
  'dark-glass',
  'classic-light',
  'classic-dark',
  'light-parchment',
  'dark-parchment',
]

/** Default theme (GeoWork opens in dark by default). */
export const DEFAULT_THEME: GeoWorkTheme = 'dark'

/** Resolve any theme to its light/dark bucket. `auto` follows the OS. */
export function resolveTheme(theme: GeoWorkTheme): ResolvedTheme {
  if (theme === 'auto') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme.includes('dark') ? 'dark' : 'light'
}

/** Extract the family (default/glass/classic/parchment) from a theme. */
export function themeFamily(theme: GeoWorkTheme): GeoWorkThemeFamily {
  if (theme.includes('glass')) return 'glass'
  if (theme.includes('classic')) return 'classic'
  if (theme.includes('parchment')) return 'parchment'
  return 'default'
}
