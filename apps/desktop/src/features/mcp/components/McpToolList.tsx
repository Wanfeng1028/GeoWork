// GeoWork - MCP Tool List
// Displays and manages tools for a specific MCP server

import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Badge } from '../../../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog'
import { Copy, Play, ChevronDown, ChevronUp, Code } from 'lucide-react'
import { toast } from 'sonner'
import type { McpTool } from '../mcpClient'
import styles from './McpToolList.module.scss'

export interface McpToolListProps {
  tools: McpTool[]
  serverId: string
  serverName?: string
  onToolCall?: (serverId: string, toolName: string, args: Record<string, unknown>) => void
}

export function McpToolList({ tools, serverId, serverName, onToolCall }: McpToolListProps) {
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null)
  const [testArgs, setTestArgs] = useState('')
  const [testResult, setTestResult] = useState<string>('')
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  const handleCopySchema = (tool: McpTool) => {
    navigator.clipboard.writeText(JSON.stringify(tool.inputSchema, null, 2))
    toast.success('Schema copied to clipboard')
  }

  const handleTestClick = (tool: McpTool) => {
    setSelectedTool(tool)
    setTestArgs(JSON.stringify(tool.inputSchema, null, 2))
    setTestResult('')
    setTestModalOpen(true)
  }

  const handleRunTest = async () => {
    if (!selectedTool) return
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(testArgs)
    } catch {
      toast.error('Invalid JSON in args input')
      return
    }
    setTestResult('Running...')
    try {
      if (onToolCall) {
        onToolCall(serverId, selectedTool.name, args)
        setTestResult(`Tool "${selectedTool.name}" called with provided args.`)
      } else {
        setTestResult(`Would call ${selectedTool.name} with:\n${JSON.stringify(args, null, 2)}`)
      }
    } catch {
      setTestResult('Failed to call tool.')
    }
  }

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }

  if (tools.length === 0) {
    return (
      <div className={styles.empty}>
        <Code className={styles.emptyIcon} />
        <span className="text-[13px] text-[var(--gw-text-secondary)]">No tools available for this server</span>
      </div>
    )
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className="text-[13px] font-semibold text-[var(--gw-text)]">
            Tools ({tools.length})
          </span>
        </div>

        <div className="flex flex-col">
          {tools.map((tool) => (
            <details
              key={tool.id}
              className={styles.toolPanel}
              open={expandedTools.has(tool.id)}
              onToggle={() => toggleTool(tool.id)}
            >
              <summary className={styles.toolRow}>
                <span className={styles.toolName}>{tool.name}</span>
                <div className="flex items-center gap-1">
                  {tool.inputSchema && (
                    <Badge className="bg-blue-500/20 text-blue-400">
                      <Code className="h-3 w-3" /> Schema
                    </Badge>
                  )}
                </div>
              </summary>
              <div className={styles.toolDetail}>
                {tool.description && (
                  <span className="text-[13px] text-[var(--gw-text-secondary)]">{tool.description}</span>
                )}

                <div className={styles.toolActions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopySchema(tool)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Schema
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleTestClick(tool)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Test Call
                  </Button>
                </div>

                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <div className={styles.schemaSection}>
                    <span className="text-[13px] text-[var(--gw-text-secondary)]">Input Schema</span>
                    <pre className={styles.schemaCode}>
                      {JSON.stringify(tool.inputSchema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>

      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Test: {selectedTool?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <span className="text-[13px] text-[var(--gw-text-secondary)]">
              Enter JSON arguments to pass to the tool:
            </span>
            <textarea
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
              rows={8}
              className={`w-full rounded-md border border-[var(--gw-border)] bg-[var(--gw-bg-secondary)] p-2 text-[13px] font-mono ${styles.testInput}`}
              placeholder='{"key": "value"}'
            />
            {testResult && (
              <div className={styles.testResult}>
                <span className="text-[13px] text-[var(--gw-text-secondary)]">Result:</span>
                <pre className={styles.testResultCode}>{testResult}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRunTest}>Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
