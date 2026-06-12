// GeoWork - Tool Call Block Component
// Displays tool call details with expand/collapse

import React, { useState } from 'react'
import {
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  Code,
} from 'lucide-react'
import { Badge } from '../../ui/badge'
import { Spinner } from '../../ui/spinner'
import { Separator } from '../../ui/separator'
import type { RuntimeEvent } from '../../../types/task'

interface ToolCallBlockProps {
  event: RuntimeEvent & {
    tool?: string;
    name?: string;
    input?: any;
    output?: any;
    error?: string;
    log?: string;
    duration_ms?: number;
    status?: string;
  }
}

const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ event }) => {
  const [expanded, setExpanded] = useState(false)

  const statusConfig = {
    started: { icon: <Play className="h-3.5 w-3.5" />, color: '#1890ff', label: '运行中', variant: 'info' as const },
    completed: { icon: <CheckCircle className="h-3.5 w-3.5" />, color: '#52c41a', label: '已完成', variant: 'success' as const },
    failed: { icon: <XCircle className="h-3.5 w-3.5" />, color: '#ff4d4f', label: '失败', variant: 'danger' as const },
    pending: { icon: <Spinner size="xs" />, color: '#faad14', label: '等待中', variant: 'warning' as const },
  }

  const config = statusConfig[event.status as keyof typeof statusConfig] || {
    icon: <Code className="h-3.5 w-3.5" />,
    color: '#d9d9d9',
    label: event.status || '未知',
    variant: 'default' as const,
  }

  const duration = event.duration_ms ? `${event.duration_ms}ms` : ''

  return (
    <details
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
      className="rounded-[var(--gw-radius-md)] border border-[var(--gw-border-soft)] bg-[var(--gw-bg-surface)]"
    >
      <summary className="flex cursor-pointer items-center gap-2 p-2">
        <span style={{ color: config.color }}>{config.icon}</span>
        <span className="text-[13px] font-semibold text-[var(--gw-text-primary)]">{event.tool || event.name || '工具调用'}</span>
        <Badge variant={config.variant}>{config.label}</Badge>
        {duration && <span className="text-[12px] text-[var(--gw-text-tertiary)]">{duration}</span>}
      </summary>
      <div className="px-2 pb-2">
        <Separator className="mb-2" />

        {event.input && (
          <div style={{ marginBottom: 8 }}>
            <span className="text-[12px] text-[var(--gw-text-tertiary)]">输入:</span>
            <pre style={{ background: 'var(--gw-bg-muted, #f5f5f5)', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {typeof event.input === 'string' ? event.input : JSON.stringify(event.input, null, 2)}
            </pre>
          </div>
        )}

        {event.output && (
          <div style={{ marginBottom: 8 }}>
            <span className="text-[12px] text-[var(--gw-text-tertiary)]">输出:</span>
            <pre style={{ background: 'var(--gw-bg-muted, #f5f5f5)', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
            </pre>
          </div>
        )}

        {event.error && (
          <div style={{ marginBottom: 8 }}>
            <span className="text-[12px] text-[var(--gw-danger, #ff4d4f)]">错误:</span>
            <div style={{ background: 'var(--gw-danger-soft, #fff2f0)', padding: 8, borderRadius: 4 }}>
              {event.error}
            </div>
          </div>
        )}

        {event.log && (
          <div>
            <span className="text-[12px] text-[var(--gw-text-tertiary)]">日志:</span>
            <pre style={{ background: 'var(--gw-bg-muted, #fafafa)', padding: 8, borderRadius: 4, overflowX: 'auto', fontSize: 12 }}>
              {event.log}
            </pre>
          </div>
        )}
      </div>
    </details>
  )
}

export default ToolCallBlock
