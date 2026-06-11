// GeoWork Desktop - Agent Client
// API client for agent task, plan, step, and recovery operations

import runtimeClient from '../../services/runtimeClient'

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

export interface AgentPlan {
  mode: string
  steps: Array<{
    id: string
    title: string
    tool?: string
    status: string
  }>
}

export interface AgentStep {
  id: string
  title: string
  toolName?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
}

export interface RecoveryState {
  canContinue: boolean
  lastCheckpoint?: string
  status: 'recoverable' | 'read-only' | 'failed'
}

export interface RecoverResult {
  success: boolean
  state?: Record<string, unknown>
}

class AgentClient {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async createTask(
    workspaceId: string,
    prompt: string,
    options?: {
      mode?: string
      model?: string
      permissionLevel?: string
    },
  ): Promise<{ taskId: string }> {
    return runtimeClient.geowork.runtime.createTask({
      workspaceId,
      prompt,
      ...options,
    })
  }

  async getTask(taskId: string): Promise<Record<string, unknown>> {
    return runtimeClient.geowork.runtime.getTask(taskId)
  }

  async getPlan(taskId: string): Promise<AgentPlan> {
    return this.request<AgentPlan>(`/api/agent/plans/${taskId}`)
  }

  async cancelTask(taskId: string): Promise<void> {
    return runtimeClient.geowork.runtime.cancelTask(taskId)
  }

  async getSteps(taskId: string): Promise<AgentStep[]> {
    return this.request<AgentStep[]>(`/api/agent/steps/${taskId}`)
  }

  async getRecoveryState(taskId: string): Promise<RecoveryState> {
    return this.request<RecoveryState>(`/api/agent/recovery/${taskId}`)
  }

  async recoverTask(taskId: string): Promise<RecoverResult> {
    return this.request<RecoverResult>(`/api/agent/recovery/${taskId}/restore`, {
      method: 'POST',
    })
  }
}

export default new AgentClient()
