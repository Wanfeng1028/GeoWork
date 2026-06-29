// GeoWork - MCP Tool List
// Displays and manages tools for a specific MCP server

import { useState } from 'react'
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
        <span >No tools available for this server</span>
      </div>
    )
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <span >
            Tools ({tools.length})
          </span>
        </div>

        <div className="flex-col">
          {tools.map((tool) => (
            <details
              key={tool.id}
              className={styles.toolPanel}
              open={expandedTools.has(tool.id)}
              onToggle={() => toggleTool(tool.id)}
            >
              <summary className={styles.toolRow}>
                <span className={styles.toolName}>{tool.name}</span>
                <div >
                  {tool.inputSchema && (
                    <Badge >
                      <Code  /> Schema
                    </Badge>
                  )}
                </div>
              </summary>
              <div className={styles.toolDetail}>
                {tool.description && (
                  <span >{tool.description}</span>
                )}

                <div className={styles.toolActions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopySchema(tool)}
                  >
                    <Copy  />
                    Copy Schema
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleTestClick(tool)}
                  >
                    <Play  />
                    Test Call
                  </Button>
                </div>

                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <div className={styles.schemaSection}>
                    <span >Input Schema</span>
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
        <DialogContent >
          <DialogHeader>
            <DialogTitle>Test: {selectedTool?.name}</DialogTitle>
          </DialogHeader>
          <div >
            <span >
              Enter JSON arguments to pass to the tool:
            </span>
            <textarea
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
              rows={8}
              className={`border ${styles.testInput}`}
              placeholder='{"key": "value"}'
            />
            {testResult && (
              <div className={styles.testResult}>
                <span >Result:</span>
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
