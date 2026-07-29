// GeoWork - MCP Client
// Model Context Protocol client for managing MCP servers and tool calls

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

async function mcpRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface McpTool {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
  tools: McpTool[]
  lastConnected?: string
}

export interface McpToolCallResult {
  output: string
  error?: string
}

export interface McpPermissionRequest {
  id: string
  serverId: string
  serverName: string
  toolName: string
  args: Record<string, unknown>
  timestamp: string
  riskLevel: 'low' | 'medium' | 'high'
}

class McpClient {
  async listServers(): Promise<McpServer[]> {
    return mcpRequest<McpServer[]>('/api/mcp/servers')
  }

  async addServer(server: Omit<McpServer, 'id' | 'tools' | 'enabled'>): Promise<McpServer> {
    return mcpRequest<McpServer>('/api/mcp/servers', { method: 'POST', body: JSON.stringify(server) })
  }

  async removeServer(serverId: string): Promise<void> {
    await mcpRequest<void>(`/api/mcp/servers/${serverId}`, { method: 'DELETE' })
  }

  async toggleServer(serverId: string, enabled: boolean): Promise<void> {
    await mcpRequest<void>(`/api/mcp/servers/${serverId}/toggle`, { method: 'PUT', body: JSON.stringify({ enabled }) })
  }

  async getTools(serverId: string): Promise<McpTool[]> {
    return mcpRequest<McpTool[]>(`/api/mcp/servers/${serverId}/tools`)
  }

  async callTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    return mcpRequest<McpToolCallResult>(`/api/mcp/servers/${serverId}/tools/${toolName}/call`, {
      method: 'POST',
      body: JSON.stringify({ args }),
    })
  }

  async getPermissionRequests(): Promise<McpPermissionRequest[]> {
    return mcpRequest<McpPermissionRequest[]>('/api/mcp/permissions/requests')
  }

  async approvePermission(requestId: string, reason?: string): Promise<void> {
    await mcpRequest<void>(`/api/mcp/permissions/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async denyPermission(requestId: string, reason?: string): Promise<void> {
    await mcpRequest<void>(`/api/mcp/permissions/${requestId}/deny`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }
}

export default new McpClient()
