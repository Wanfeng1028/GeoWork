import { type ReactNode } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAntdTheme } from './themes'
import { useAppearanceStore } from '../shared/stores/appearanceStore'
import { useSystemAppearance } from '../shared/hooks/useSystemAppearance'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  useSystemAppearance()

  const appearance = useAppearanceStore((s) => s.appearance)
  const resolvedAppearance = useAppearanceStore((s) => s.resolvedAppearance)
  const themeProps = useAntdTheme(appearance, resolvedAppearance)

  return (
    <ConfigProvider locale={zhCN} {...themeProps}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}
