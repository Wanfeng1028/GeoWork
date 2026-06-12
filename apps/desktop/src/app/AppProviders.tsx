// GeoWork App Providers

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
      <div data-theme={resolvedTheme}>{children}</div>
    </QueryClientProvider>
  )
}

export { queryClient }
