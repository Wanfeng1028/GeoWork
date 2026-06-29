// GeoWork App Providers

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useEffect } from 'react'
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
  const selectedTheme = useSettingsStore((state) => state.settings.appearance.theme)
  const resolvedTheme = useSettingsStore((state) => state.resolvedTheme)
  const setResolvedTheme = useSettingsStore((state) => state.setResolvedTheme)

  // Keep the resolved light/dark bucket in sync with the selected theme.
  // For `auto`, follow the OS preference and stay subscribed to changes.
  useEffect(() => {
    if (selectedTheme !== 'auto') {
      setResolvedTheme(resolveTheme(selectedTheme))
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => setResolvedTheme(media.matches ? 'dark' : 'light')
    syncTheme()
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [selectedTheme, setResolvedTheme])

  // Apply the full theme id (e.g. 'dark-parchment') to <html data-theme>,
  // so the 9-variant CSS in themes.css takes effect.
  useEffect(() => {
    setGeoWorkTheme(selectedTheme)
  }, [selectedTheme])

  return (
    <QueryClientProvider client={queryClient}>
      <div data-theme={selectedTheme} data-resolved-theme={resolvedTheme}>
        {children}
      </div>
    </QueryClientProvider>
  )
}

export { queryClient }
