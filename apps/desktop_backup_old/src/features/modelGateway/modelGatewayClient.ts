import runtimeClient from '../../services/runtimeClient'

export interface ModelProvider {
  id: string
  name: string
  kind: 'openai_compatible' | 'ollama' | 'lm_studio' | 'custom'
  baseUrl: string
  apiKeyRef?: string
  defaultModel?: string
  enabled: boolean
}

export interface SpeedProfile {
  id: string
  name: string
  maxParallelRequests: number
  tokenBudgetMultiplier: number
  rateLimitMultiplier: number
}

export interface UsageSummary {
  totalTokens: number
  totalRequests: number
  modelUsage: Record<string, { tokens: number; requests: number }>
  speedUsage: Record<string, number>
}

class ModelGatewayClient {
  private request<T>(method: string, path: string, data?: unknown): Promise<T> {
    const fn = (runtimeClient as any).request
    return fn.call(runtimeClient, {
      method,
      path: `/api/model-gateway${path}`,
      body: data,
    }) as Promise<T>
  }

  async listProviders(): Promise<ModelProvider[]> {
    return this.request<ModelProvider[]>('GET', '/providers')
  }

  async addProvider(provider: Partial<ModelProvider>): Promise<ModelProvider> {
    return this.request<ModelProvider>('POST', '/providers', provider)
  }

  async updateProvider(providerId: string, provider: Partial<ModelProvider>): Promise<ModelProvider> {
    return this.request<ModelProvider>('PUT', `/providers/${providerId}`, provider)
  }

  async removeProvider(providerId: string): Promise<void> {
    await this.request<void>('DELETE', `/providers/${providerId}`)
  }

  async testConnection(providerId: string): Promise<{ success: boolean; modelCount?: number }> {
    return this.request<{ success: boolean; modelCount?: number }>('POST', `/providers/${providerId}/test`)
  }

  async getSpeedProfiles(): Promise<SpeedProfile[]> {
    return this.request<SpeedProfile[]>('GET', '/speed-profiles')
  }

  async getUsageSummary(): Promise<UsageSummary> {
    return this.request<UsageSummary>('GET', '/usage')
  }

  async chat(messages: unknown[], options?: { providerId?: string; model?: string; speedProfile?: string }): Promise<unknown> {
    return this.request<unknown>('POST', '/chat', { messages, options })
  }

  async streamChat(messages: unknown[], options?: { providerId?: string; model?: string; speedProfile?: string }): Promise<AsyncIterable<string>> {
    const response = await fetch(`/api/model-gateway/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, options }),
    })

    if (!response.body) {
      throw new Error('Stream not supported')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            yield decoder.decode(value, { stream: true })
          }
        } finally {
          reader.releaseLock()
        }
      },
    }
  }
}

export default new ModelGatewayClient()
