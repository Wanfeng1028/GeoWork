import type { ConfigProviderProps } from 'antd'
import { useEditorialTheme } from './editorialTheme'
import { useEditorialDarkTheme } from './editorialDarkTheme'
import type { Appearance, ResolvedAppearance } from '../../shared/stores/appearanceStore'

/*
 * 主题入口收敛：关闭非 editorial 主题入口（illustration/glass/bootstrap/light/dark），
 * 仅暴露 editorial / editorial-dark / system 三种选项。
 * 关闭入口 ≠ 删除代码：其他主题文件保留在仓库中，待后续需要时恢复。
 */

export {
  useEditorialTheme,
  useEditorialDarkTheme,
}

export function useAntdTheme(
  appearance: Appearance,
  resolvedAppearance: ResolvedAppearance,
): ConfigProviderProps {
  const editorialProps = useEditorialTheme()
  const editorialDarkProps = useEditorialDarkTheme()

  if (appearance === 'editorial-dark') return editorialDarkProps
  if (appearance === 'editorial') return editorialProps

  // system → 跟随系统 → 映射到 editorial 旗舰
  // 任何非白名单值（如 localStorage 残留的 glass/illustration 等）→ fallback editorial
  if (appearance === 'system') {
    return resolvedAppearance === 'dark' ? editorialDarkProps : editorialProps
  }

  // Fallback: 非法值统一回退到 editorial，不白屏
  return resolvedAppearance === 'dark' ? editorialDarkProps : editorialProps
}
