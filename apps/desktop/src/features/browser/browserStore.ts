import { create } from 'zustand'
import browserBridgeClient, { type BrowserSession, type PaperSearchResult } from './browserBridgeClient'

interface BrowserState {
  session: BrowserSession | null
  isRunning: boolean
  paperResults: PaperSearchResult[]
  isLoading: boolean
  sessionId: string | null
  error: string | null

  createSession: () => Promise<void>
  navigate: (url: string) => Promise<void>
  takeScreenshot: () => Promise<void>
  extractText: () => Promise<string | null>
  getNetworkLogs: () => Promise<void>
  searchPapers: (query: string) => Promise<void>
  addToContext: () => Promise<void>
  closeSession: () => Promise<void>
  clearError: () => void
}

const useBrowserStore = create<BrowserState>((set, get) => ({
  session: null,
  isRunning: false,
  paperResults: [],
  isLoading: false,
  sessionId: null,
  error: null,

  createSession: async () => {
    set({ isLoading: true, error: null })
    try {
      const { sessionId } = await browserBridgeClient.openSession()
      set({
        sessionId,
        session: {
          id: sessionId,
          url: '',
          title: 'New Session',
          tabs: [{ id: 'main', url: '', title: 'New Tab' }],
          networkLogs: [],
        },
        isRunning: true,
        isLoading: false,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create session'
      set({ error: message, isLoading: false })
    }
  },

  navigate: async (url: string) => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isLoading: true, error: null })
    try {
      await browserBridgeClient.navigate(sessionId, url)
      set((state) => ({
        session: state.session
          ? { ...state.session, url, title: url }
          : null,
        isLoading: false,
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Navigation failed'
      set({ error: message, isLoading: false })
    }
  },

  takeScreenshot: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isLoading: true, error: null })
    try {
      const { data } = await browserBridgeClient.screenshot(sessionId)
      set((state) => ({
        session: state.session
          ? { ...state.session, screenshot: data }
          : null,
        isLoading: false,
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Screenshot failed'
      set({ error: message, isLoading: false })
    }
  },

  extractText: async () => {
    const { sessionId } = get()
    if (!sessionId) return null
    set({ isLoading: true, error: null })
    try {
      const text = await browserBridgeClient.extractText(sessionId)
      set({ isLoading: false })
      return text
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Text extraction failed'
      set({ error: message, isLoading: false })
      return null
    }
  },

  getNetworkLogs: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isLoading: true, error: null })
    try {
      const logs = await browserBridgeClient.getNetworkLogs(sessionId)
      set((state) => ({
        session: state.session
          ? { ...state.session, networkLogs: logs }
          : null,
        isLoading: false,
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch network logs'
      set({ error: message, isLoading: false })
    }
  },

  searchPapers: async (query: string) => {
    set({ isLoading: true, error: null })
    try {
      const results = await browserBridgeClient.searchPapers(query)
      set({ paperResults: results, isLoading: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Paper search failed'
      set({ error: message, isLoading: false })
    }
  },

  addToContext: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isLoading: true, error: null })
    try {
      await browserBridgeClient.addToContext(sessionId)
      set({ isLoading: false })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add to context'
      set({ error: message, isLoading: false })
    }
  },

  closeSession: async () => {
    const { sessionId } = get()
    if (!sessionId) {
      set({
        session: null,
        isRunning: false,
        sessionId: null,
        paperResults: [],
        error: null,
      })
      return
    }
    set({ isLoading: true, error: null })
    try {
      await browserBridgeClient.closeSession(sessionId)
      set({
        session: null,
        isRunning: false,
        sessionId: null,
        paperResults: [],
        isLoading: false,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to close session'
      set({ error: message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))

export default useBrowserStore
