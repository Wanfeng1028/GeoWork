import { render, screen } from '@testing-library/react'
import { ConfigProvider } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { antdTheme } from '../styles/antd-theme'

globalThis.fetch = vi.fn((url: string) => {
  const data: Record<string, unknown> = url.includes('/api/health') ? { status: 'ok' } :
    url.includes('/api/projects/') && url.includes('/files') ? [] :
    url.includes('/api/projects') ? [] :
    url.includes('/api/artifacts') ? [] :
    url.includes('/api/tasks') ? [] :
    url.includes('/api/skills') ? [{ id: 'ndvi-timeseries-analysis', name: 'NDVI', permissions: {} }] :
    url.includes('/api/plugins') ? [{ id: 'openalex', name: 'OpenAlex', permissions: {}, enabled: true }] :
    url.includes('/api/models') ? [] :
    url.includes('/api/usage/records') ? [] :
    url.includes('/api/usage') ? { tasks: 0, artifacts: 0 } :
    url.includes('/api/settings') ? { workspace: 'test' } :
    url.includes('/api/environment/checks') ? [] :
    url.includes('/api/automations') ? [] :
    url.includes('/api/automation-runs') ? [] :
    url.includes('/api/experts') ? [] :
    url.includes('/api/papers') ? [] :
    url.includes('/api/knowledge') ? [] :
    url.includes('/api/security/decisions') ? [] :
    url.includes('/api/tools') ? [] :
    url.includes('/api/eino/schema') ? {} :
    url.includes('/api/mcp') ? [] :
    {}
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}) as any

describe('App', () => {
  it('renders GeoWork workbench navigation', async () => {
    render(
      <ConfigProvider theme={antdTheme}>
        <App />
      </ConfigProvider>
    )
    expect(await screen.findByText('GeoWork')).toBeInTheDocument()
    expect(screen.getByText('工作台')).toBeInTheDocument()
    expect(screen.getByText('插件市场')).toBeInTheDocument()
    expect(screen.getByText('模型与 API')).toBeInTheDocument()
  })
})
