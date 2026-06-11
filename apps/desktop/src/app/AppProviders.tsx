// GeoWork App Providers

import { ConfigProvider, theme as antdTheme } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import useSettingsStore from '../stores/settingsStore'

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
  const theme = useSettingsStore((state) => state.settings.appearance.theme)

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#4ddc97',
            borderRadius: 10,
            fontFamily: '"Microsoft YaHei", "Segoe UI", system-ui, sans-serif'
          },
          algorithm: theme === 'light-geo' ? undefined : antdTheme.darkAlgorithm
        }}
      >
        <div data-theme={theme}>{children}</div>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export { queryClient }
