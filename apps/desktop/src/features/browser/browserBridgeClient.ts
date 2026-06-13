import runtimeClient from '../../services/runtimeClient'

export interface BrowserSession {
  id: string
  url: string
  title: string
  screenshot?: string // base64
  tabs: BrowserTab[]
  networkLogs: NetworkLog[]
}

export interface BrowserTab {
  id: string
  url: string
  title: string
}

export interface NetworkLog {
  id: string
  url: string
  method: string
  status: number
  timestamp: string
}

export interface PaperSearchResult {
  title: string
  url: string
  authors: string[]
  year?: number
  snippet?: string
}

class BrowserBridgeClient {
  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const fn = (runtimeClient as any).request
    return fn.call(runtimeClient, {
      method,
      path: `/api/browser-bridge${path}`,
      body,
    }) as Promise<T>
  }

  async openSession(): Promise<{ sessionId: string }> {
    return this.request<{ sessionId: string }>('POST', '/session/open')
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.request<void>('POST', `/session/close/${sessionId}`)
  }

  async navigate(sessionId: string, url: string): Promise<void> {
    await this.request<void>('POST', `/session/${sessionId}/navigate`, { url })
  }

  async screenshot(sessionId: string): Promise<{ data: string }> {
    return this.request<{ data: string }>('POST', `/session/${sessionId}/screenshot`)
  }

  async extractText(sessionId: string): Promise<string> {
    return this.request<string>('POST', `/session/${sessionId}/extract-text`)
  }

  async getNetworkLogs(sessionId: string): Promise<NetworkLog[]> {
    return this.request<NetworkLog[]>('GET', `/session/${sessionId}/network-logs`)
  }

  async searchPapers(query: string): Promise<PaperSearchResult[]> {
    return this.request<PaperSearchResult[]>('GET', `/papers/search`, { query })
  }

  async addToContext(sessionId: string): Promise<{ content: string }> {
    return this.request<{ content: string }>('POST', `/session/${sessionId}/add-to-context`)
  }
}

export default new BrowserBridgeClient()
