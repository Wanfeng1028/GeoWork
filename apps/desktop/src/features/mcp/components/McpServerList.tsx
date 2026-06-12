// GeoWork - MCP Server List
// Displays configured MCP servers with status, tool count, and management controls

import { useState, useEffect } from 'react'
import { Button } from '../../../components/ui/button'
import { Switch } from '../../../components/ui/switch'
import { Card } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Badge } from '../../../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog'
import { Plus, Trash, Tool } from 'lucide-react'
import { toast } from 'sonner'
import useMcpStore from '../mcpStore'
import type { McpServer } from '../mcpClient'
import styles from './McpServerList.module.scss'

export function McpServerList() {
  const { servers, isLoading, loadServers, removeServer, toggleServer } = useMcpStore()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [formValues, setFormValues] = useState({ name: '', command: '', args: '' })

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const toggleExpand = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) {
        next.delete(serverId)
      } else {
        next.add(serverId)
      }
      return next
    })
  }

  const handleAdd = async () => {
    if (!formValues.name.trim() || !formValues.command.trim()) {
      toast.error('Name and command are required')
      return
    }
    try {
      await useMcpStore.getState().addServer({
        name: formValues.name,
        command: formValues.command,
        args: formValues.args ? formValues.args.split(',').map((s) => s.trim()) : [],
      })
      setAddModalOpen(false)
      setFormValues({ name: '', command: '', args: '' })
      toast.success('MCP server added')
    } catch {
      toast.error('Failed to add MCP server')
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeServer(id)
      toast.success('Server removed')
    } catch {
      toast.error('Failed to remove server')
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleServer(id, enabled)
  }

  const getRiskTag = (toolCount: number) => {
    if (toolCount === 0) return <Badge variant="secondary">0 tools</Badge>
    if (toolCount <= 3) return <Badge className="bg-blue-500/20 text-blue-400">{toolCount} tool{toolCount > 1 ? 's' : ''}</Badge>
    return <Badge className="bg-cyan-500/20 text-cyan-400">{toolCount} tools</Badge>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className="text-[15px] font-semibold text-[var(--gw-text)]">
          MCP Servers
        </h3>
        <Button
          onClick={() => setAddModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Server
        </Button>
      </div>

      <div className="flex flex-col">
        {servers.length === 0 && !isLoading && (
          <div className={styles.empty}>
            <Tool className={styles.emptyIcon} />
            <span className="text-[13px] text-[var(--gw-text-secondary)]">No MCP servers configured. Add one to get started.</span>
          </div>
        )}

        {servers.map((server) => (
          <details
            key={server.id}
            className={styles.serverPanel}
            open={expandedServers.has(server.id)}
            onToggle={() => toggleExpand(server.id)}
          >
            <summary className={styles.serverHeader}>
              <div className={styles.serverInfo}>
                <span
                  className={`${styles.statusDot} ${server.enabled ? styles.statusConnected : styles.statusDisconnected}`}
                />
                <span className={styles.serverName}>{server.name}</span>
                <span className={styles.serverCommand}>{server.command}</span>
              </div>
              <div className="flex items-center gap-2">
                {getRiskTag(server.tools.length)}
                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => handleToggle(server.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--gw-danger)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(server.id)
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </summary>
            <div className={styles.toolsSection}>
              <h4 className="text-[13px] font-semibold text-[var(--gw-text)]">
                <Tool className="h-4 w-4 inline mr-1" /> Available Tools
              </h4>
              {server.tools.length === 0 ? (
                <span className="text-[13px] text-[var(--gw-text-secondary)]">No tools available</span>
              ) : (
                <div className={styles.toolsGrid}>
                  {server.tools.map((tool) => (
                    <div key={tool.id} className={styles.toolItem}>
                      <span className="text-[13px] text-[var(--gw-text)]">{tool.name}</span>
                      {tool.description && (
                        <span className="text-[13px] text-[var(--gw-text-secondary)]">{tool.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {server.env && Object.keys(server.env).length > 0 && (
              <div className={styles.envSection}>
                <h4 className="text-[13px] font-semibold text-[var(--gw-text)]">Environment</h4>
                <div className={styles.envGrid}>
                  {Object.entries(server.env).map(([key, value]) => (
                    <div key={key} className={styles.envItem}>
                      <span className="text-[13px] font-semibold text-[var(--gw-text)]">{key}</span>
                      <span className="text-[13px] text-[var(--gw-text-secondary)]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {server.lastConnected && (
              <span className="text-[13px] text-[var(--gw-text-secondary)]">
                Last connected: {server.lastConnected}
              </span>
            )}
          </details>
        ))}
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add MCP Server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[13px] text-[var(--gw-text-secondary)]">Name</label>
              <Input
                placeholder="My MCP Server"
                value={formValues.name}
                onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] text-[var(--gw-text-secondary)]">Command</label>
              <Input
                placeholder="node"
                value={formValues.command}
                onChange={(e) => setFormValues((v) => ({ ...v, command: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] text-[var(--gw-text-secondary)]">Arguments</label>
              <Input
                placeholder="comma-separated args (e.g. server1.js, --port=3000)"
                value={formValues.args}
                onChange={(e) => setFormValues((v) => ({ ...v, args: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAddModalOpen(false); setFormValues({ name: '', command: '', args: '' }) }}>Cancel</Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
