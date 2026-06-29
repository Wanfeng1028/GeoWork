// GeoWork - MCP Server List
// Displays configured MCP servers with status, tool count, and management controls

import { useState, useEffect } from 'react'
import { Plus, Trash, Settings } from 'lucide-react'
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
    if (toolCount <= 3) return <Badge >{toolCount} tool{toolCount > 1 ? 's' : ''}</Badge>
    return <Badge >{toolCount} tools</Badge>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 >
          MCP Servers
        </h3>
        <Button
          onClick={() => setAddModalOpen(true)}
        >
          <Plus  />
          Add Server
        </Button>
      </div>

      <div className="flex-col">
        {servers.length === 0 && !isLoading && (
          <div className={styles.empty}>
            <Settings className={styles.emptyIcon} />
            <span >No MCP servers configured. Add one to get started.</span>
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
              <div >
                {getRiskTag(server.tools.length)}
                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => handleToggle(server.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(server.id)
                  }}
                >
                  <Trash  />
                </Button>
              </div>
            </summary>
            <div className={styles.toolsSection}>
              <h4 >
                <Settings className="inline" /> Available Tools
              </h4>
              {server.tools.length === 0 ? (
                <span >No tools available</span>
              ) : (
                <div className={styles.toolsGrid}>
                  {server.tools.map((tool) => (
                    <div key={tool.id} className={styles.toolItem}>
                      <span >{tool.name}</span>
                      {tool.description && (
                        <span >{tool.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {server.env && Object.keys(server.env).length > 0 && (
              <div className={styles.envSection}>
                <h4 >Environment</h4>
                <div className={styles.envGrid}>
                  {Object.entries(server.env).map(([key, value]) => (
                    <div key={key} className={styles.envItem}>
                      <span >{key}</span>
                      <span >{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {server.lastConnected && (
              <span >
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
          <div >
            <div >
              <label >Name</label>
              <Input
                placeholder="My MCP Server"
                value={formValues.name}
                onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div >
              <label >Command</label>
              <Input
                placeholder="node"
                value={formValues.command}
                onChange={(e) => setFormValues((v) => ({ ...v, command: e.target.value }))}
              />
            </div>
            <div >
              <label >Arguments</label>
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
