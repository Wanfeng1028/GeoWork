import type { ConfigProviderProps } from 'antd'
import { useBootstrapTheme } from './bootstrapTheme'
import { useIllustrationTheme } from './illustrationTheme'
import { useGlassTheme } from './glassTheme'
import { darkTheme } from './darkTheme'
import type { Appearance, ResolvedAppearance } from '../../shared/stores/appearanceStore'

export { useBootstrapTheme, useIllustrationTheme, useGlassTheme, darkTheme }

export function useAntdTheme(
  appearance: Appearance,
  resolvedAppearance: ResolvedAppearance,
): ConfigProviderProps {
  /* 无条件调用所有 hook，保证 React Hooks 顺序稳定 */
  const bootstrapProps = useBootstrapTheme()
  const illustrationProps = useIllustrationTheme()
  const glassProps = useGlassTheme()

  if (resolvedAppearance === 'dark') {
    return { theme: darkTheme }
  }

  switch (appearance) {
    case 'illustration':
      return illustrationProps
    case 'glass':
      return glassProps
    default:
      return bootstrapProps
  }
}
