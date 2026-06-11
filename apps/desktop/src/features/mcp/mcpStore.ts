// GeoWork - MCP Zustand Store

import { create } from 'zustand'
import mcpClient, { type McpServer, type McpTool } from './mcpClient'

interface McpState {
  servers: McpServer[]
  isLoading: boolean
  error: string | null
  loadServers: () => Promise<void>
  addServer: (server: Omit<McpServer, 'id' | 'tools' | 'enabled'>) => Promise<void>
  removeServer: (id: string) => Promise<void>
  toggleServer: (id: string, enabled: boolean) => Promise<void>
  refreshTools: (serverId: string) => Promise<void>
}

const useMcpStore = create<McpState>((set) => ({
  servers: [],
  isLoading: false,
  error: null,

  loadServers: async () => {
    set({ isLoading: true, error: null })
    try {
      const servers = await mcpClient.listServers()
      set({ servers, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load MCP servers', isLoading: false })
    }
  },

  addServer: async (server) => {
    set({ isLoading: true, error: null })
    try {
      const created = await mcpClient.addServer(server)
      set((state) => ({ servers: [...state.servers, created], isLoading: false }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add MCP server', isLoading: false })
    }
  },

  removeServer: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await mcpClient.removeServer(id)
      set((state) => ({
        servers: state.servers.filter((s) => s.id !== id),
        isLoading: false,
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to remove MCP server', isLoading: false })
    }
  },

  toggleServer: async (id, enabled) => {
    try {
      await mcpClient.toggleServer(id, enabled)
      set((state) => ({
        servers: state.servers.map((s) => (s.id === id ? { ...s, enabled } : s)),
      }))
    } catch (err) {
      // Silently fail — UI can show error toast separately
    }
  },

  refreshTools: async (serverId) => {
    try {
      const tools = await mcpClient.getTools(serverId)
      set((state) => ({
        servers: state.servers.map((s) => (s.id === serverId ? { ...s, tools } : s)),
      }))
    } catch {
      // Silently fail
    }
  },
}))

export default useMcpStore
