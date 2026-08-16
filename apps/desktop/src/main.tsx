import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import './index.css'
import { AppProviders } from './app/AppProviders'
import App from './App.tsx'
import { preloadRuntimeToken } from './shared/api/coreApi'
import { hydrateProviderApiKeys } from './shared/stores/modelProviderStore'

// P0-4: 预热 runtime token 缓存（coreFetch 内部也会按需等待 IPC）
preloadRuntimeToken()
// P1-8: 迁移遗留明文 apiKey 到 safeStorage 并预热缓存
hydrateProviderApiKeys()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
