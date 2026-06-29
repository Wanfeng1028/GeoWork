// GeoWork - MCP Permission Panel
// Displays and manages permission requests for MCP tool calls

import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import type { McpPermissionRequest } from '../mcpClient'
import styles from './McpPermissionPanel.module.scss'

// Risk-level metadata for common tool categories
const RISK_RULES: Record<string, { level: 'low' | 'medium' | 'high'; label: string; color: string }> = {
  filesystem: { level: 'high', label: 'Filesystem Access', color: 'red' },
  network: { level: 'high', label: 'Network Access', color: 'red' },
  shell: { level: 'high', label: 'Shell Execution', color: 'red' },
  database: { level: 'medium', label: 'Database Access', color: 'orange' },
  read_only: { level: 'low', label: 'Read-Only', color: 'blue' },
  default: { level: 'medium', label: 'Unknown Risk', color: 'orange' },
}

function classifyRisk(toolName: string, args: Record<string, unknown>): { level: 'low' | 'medium' | 'high'; category: string; color: string } {
  const nameLower = toolName.toLowerCase()

  // Detect risk categories from tool name and args
  const dangerousPatterns = {
    filesystem: ['write', 'delete', 'rename', 'mkdir', 'unlink', 'copy', 'move', 'chmod'],
    network: ['fetch', 'download', 'upload', 'http', 'socket', 'curl', 'wget'],
    shell: ['exec', 'run', 'spawn', 'system', 'sh', 'cmd', 'bash'],
    database: ['query', 'insert', 'update', 'drop', 'alter', 'mysql', 'postgres', 'sqlite'],
  }

  for (const [category, patterns] of Object.entries(dangerousPatterns)) {
    if (patterns.some((p) => nameLower.includes(p))) {
      const rule = RISK_RULES[category]
      return { level: rule.level, category: rule.label, color: rule.color }
    }
  }

  // Check args for dangerous fields
  const argValues = Object.values(args).map(String).join(' ').toLowerCase()
  if (['password', 'secret', 'token', 'key', 'credential'].some((k) => argValues.includes(k))) {
    return { level: 'high', category: 'Sensitive Data', color: 'red' }
  }

  return { level: 'medium', category: 'Standard Tool', color: 'orange' }
}

function getRiskTag(level: 'low' | 'medium' | 'high') {
  const config: Record<string, { className: string; icon: React.ReactNode; text: string }> = {
    low: { className: 'bg-blue-500/20 text-blue-400', icon: <Info  />, text: 'Low Risk' },
    medium: { className: 'bg-orange-500/20 text-orange-400', icon: <AlertTriangle  />, text: 'Medium Risk' },
    high: { className: 'bg-red-500/20 text-red-400', icon: <AlertTriangle  />, text: 'High Risk' },
  }
  const c = config[level]
  return <Badge className={c.className}>{c.icon} {c.text}</Badge>
}

export interface McpPermissionPanelProps {
  request: McpPermissionRequest
  onApprove: (requestId: string, reason: string) => Promise<void>
  onDeny: (requestId: string, reason: string) => Promise<void>
  onDismiss?: (requestId: string) => void
}

export function McpPermissionPanel({ request, onApprove, onDeny }: McpPermissionPanelProps) {
  const [approving, setApproving] = useState(false)
  const [denying, setDenying] = useState(false)
  const [remember, setRemember] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [expanded, setExpanded] = useState(false)

  const risk = classifyRisk(request.toolName, request.args)
  const riskTag = getRiskTag(risk.level)

  const handleApprove = async () => {
    setApproving(true)
    try {
      await onApprove(request.id, remember ? `Approved (remembered: ${risk.category})` : 'User approved')
    } finally {
      setApproving(false)
    }
  }

  const handleDeny = async () => {
    if (!denyReason.trim()) return
    setDenying(true)
    try {
      await onDeny(request.id, denyReason)
    } finally {
      setDenying(false)
    }
  }

  const summarizeArgs = (args: Record<string, unknown>): string => {
    const keys = Object.keys(args)
    if (keys.length === 0) return 'No arguments'
    if (keys.length <= 3) return keys.join(', ')
    return `${keys[0]}, ${keys[1]}, ...+${keys.length - 2}`
  }

  const truncate = (str: string, maxLen: number) =>
    str.length > maxLen ? str.slice(0, maxLen) + '...' : str

  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <div >
          <span className={styles.serverBadge}>{request.serverName}</span>
          {riskTag}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.toolInfo}>
          <span >
            {request.toolName}
          </span>
          <span >
            Args: {summarizeArgs(request.args)}
          </span>
        </div>

        <Button
          variant="link"
          size="sm"
          className={styles.expandBtn}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp  /> : <ChevronDown  />}
          {expanded ? 'Hide details' : 'Show details'}
        </Button>

        {expanded && (
          <div className={styles.detailSection}>
            <pre className={styles.detailArgs}>
              {JSON.stringify(request.args, null, 2)}
            </pre>
          </div>
        )}

        <div className={styles.riskAlert}>
          {risk.level === 'high' ? (
            <AlertTriangle className="shrink-0" />
          ) : (
            <Info className="shrink-0" />
          )}
          <div>
            <span >
              Category: {risk.category}
            </span>
            <span >
              {risk.level === 'high'
                ? 'This tool has access to sensitive system resources. Review carefully before approving.'
                : risk.level === 'medium'
                  ? 'This tool performs operations that may affect system state.'
                  : 'This tool performs read-only or non-destructive operations.'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <label >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded"
          />
          Remember this decision
        </label>

        <div className={styles.actionButtons}>
          <Button
            variant="danger"
            disabled={!denyReason.trim() || denying}
            onClick={handleDeny}
          >
            {denying ? <Spinner  /> : <XCircle  />}
            Deny
          </Button>
          <Input
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="Reason for denial..."
            className={styles.denyInput}
          />
          <Button
            disabled={approving}
            onClick={handleApprove}
          >
            {approving ? <Spinner  /> : <CheckCircle  />}
            Approve
          </Button>
        </div>
      </div>
    </Card>
  )
}
