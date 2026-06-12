import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

globalThis.fetch = vi.fn((url: string) => {
  const data: any = url.includes('/api/health') ? { status: 'ok' } :
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
    {} as Record<string, unknown>
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
}) as any

describe('App', () => {
  it('renders GeoWork workbench navigation', async () => {
    render(<App />)
    expect((await screen.findAllByRole('heading', { name: 'GeoWork' })).length).toBeGreaterThan(0)
    expect(screen.getByText('主能力')).toBeInTheDocument()
    expect(screen.getByText('专家系统')).toBeInTheDocument()
    expect(screen.getByText('知识资料')).toBeInTheDocument()
    expect(screen.getByText('地理空间')).toBeInTheDocument()
    expect(screen.queryByText('任务终端')).not.toBeInTheDocument()
  })
})
