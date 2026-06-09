import { AutomationRule, CronJob, AutomationRun } from '../pages/Automation/store'

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const automationService = {
  // ── Automation Rules ─────────────────────────────────────────────────────

  getAutomationRules: (): Promise<AutomationRule[]> =>
    request<AutomationRule[]>('/api/automations'),

  createAutomationRule: (rule: Partial<AutomationRule>): Promise<AutomationRule> =>
    request<AutomationRule>('/api/automations', {
      method: 'POST',
      body: JSON.stringify(rule)
    }),

  updateAutomationRule: (rule: AutomationRule): Promise<void> =>
    request<void>(`/api/automations/${rule.id}`, {
      method: 'PUT',
      body: JSON.stringify(rule)
    }),

  deleteAutomationRule: (id: string): Promise<void> =>
    request<void>(`/api/automations/${id}`, {
      method: 'DELETE'
    }),

  triggerAutomationRule: (id: string): Promise<void> =>
    request<void>(`/api/automations/${id}/trigger`, {
      method: 'POST'
    }),

  // ── Cron Jobs ────────────────────────────────────────────────────────────

  getCronJobs: (): Promise<CronJob[]> =>
    request<CronJob[]>('/api/cron-jobs'),

  createCronJob: (job: Partial<CronJob>): Promise<CronJob> =>
    request<CronJob>('/api/cron-jobs', {
      method: 'POST',
      body: JSON.stringify(job)
    }),

  updateCronJob: (job: CronJob): Promise<void> =>
    request<void>(`/api/cron-jobs/${job.id}`, {
      method: 'PUT',
      body: JSON.stringify(job)
    }),

  deleteCronJob: (id: string): Promise<void> =>
    request<void>(`/api/cron-jobs/${id}`, {
      method: 'DELETE'
    }),

  triggerCronJob: (id: string): Promise<void> =>
    request<void>(`/api/cron-jobs/${id}/trigger`, {
      method: 'POST'
    }),

  // ── Runs ─────────────────────────────────────────────────────────────────

  getAutomationRuns: (): Promise<AutomationRun[]> =>
    request<AutomationRun[]>('/api/automation-runs')
}
