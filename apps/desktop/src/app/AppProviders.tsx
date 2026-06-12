// GeoWork App Providers

import { ConfigProvider, theme as antdTheme } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useEffect } from 'react'
import useSettingsStore from '../stores/settingsStore'
import { setGeoWorkTheme, type GeoWorkTheme } from '../design/theme-init'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1
    }
  }
})

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const selectedTheme = useSettingsStore((state) => state.settings.appearance.theme)
  const resolvedTheme = useSettingsStore((state) => state.resolvedTheme)
  const setResolvedTheme = useSettingsStore((state) => state.setResolvedTheme)

  useEffect(() => {
    if (selectedTheme !== 'system') {
      setResolvedTheme(selectedTheme)
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: light)')
    const syncTheme = () => setResolvedTheme(media.matches ? 'light' : 'dark')
    syncTheme()
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [selectedTheme, setResolvedTheme])

  useEffect(() => {
    setGeoWorkTheme(resolvedTheme as GeoWorkTheme)
  }, [resolvedTheme])

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: resolvedTheme === 'dark' ? '#d9ad7c' : '#0f766e',
            borderRadius: 8,
            fontFamily: '"Instrument Sans", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
            colorBgBase: resolvedTheme === 'dark' ? '#0d0b09' : '#f6f3ee',
            colorTextBase: resolvedTheme === 'dark' ? '#f3eee7' : '#1f2522'
          },
          algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
        }}
      >
        <div data-theme={resolvedTheme}>{children}</div>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export { queryClient }
