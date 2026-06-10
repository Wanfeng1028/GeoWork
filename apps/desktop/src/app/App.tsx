// GeoWork App - Root Component

import { AppProviders } from './AppProviders'
import { AppShell } from '../components/layout/AppShell/AppShell'

export function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}
