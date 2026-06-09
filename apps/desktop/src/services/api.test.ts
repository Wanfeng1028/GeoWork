import { describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('api client', () => {
  it('calls V1 endpoint paths', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn((url: string) => {
      calls.push(url)
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    }) as any

    await api.experts()
    await api.tools()
    await api.einoSchema()
    await api.usageRecords()
    await api.environmentChecks()
    await api.saveModel({ provider: 'OpenAI', name: 'OpenAI' })
    await api.saveSettings({ theme: 'dark' })
    await api.createAutomation({ name: 'Nightly', trigger: 'cron', target: 'Research' })
    await api.resolveSecurityDecision('sec_1', { decision: 'approved' })

    expect(calls.some((url) => url.endsWith('/api/experts'))).toBe(true)
    expect(calls.some((url) => url.endsWith('/api/tools'))).toBe(true)
    expect(calls.some((url) => url.endsWith('/api/eino/schema'))).toBe(true)
    expect(calls.some((url) => url.endsWith('/api/usage/records'))).toBe(true)
    expect(calls.some((url) => url.endsWith('/api/environment/checks'))).toBe(true)
    expect(calls.some((url) => url.endsWith('/api/security/decisions/sec_1'))).toBe(true)
  })
})
