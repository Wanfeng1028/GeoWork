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
    started: { icon: <Play  />, color: '', label: '运行中', variant: 'info' as const },
    completed: { icon: <CheckCircle  />, color: '', label: '已完成', variant: 'success' as const },
    failed: { icon: <XCircle  />, color: '', label: '失败', variant: 'danger' as const },
    pending: { icon: <Spinner size="xs" />, color: '', label: '等待中', variant: 'warning' as const },
  }

  const config = statusConfig[event.status as keyof typeof statusConfig] || {
    icon: <Code  />,
    color: '',
    label: event.status || '未知',
    variant: 'default' as const,
  }

  const duration = event.duration_ms ? `${event.duration_ms}ms` : ''

  return (
    <details
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
      className="border"
    >
      <summary >
        <span style={{ color: config.color }}>{config.icon}</span>
        <span >{event.tool || event.name || '工具调用'}</span>
        <Badge variant={config.variant}>{config.label}</Badge>
        {duration && <span >{duration}</span>}
      </summary>
      <div >
        <Separator  />

        {event.input && (
          <div style={{ marginBottom: 8 }}>
            <span >输入:</span>
            <pre style={{ padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {typeof event.input === 'string' ? event.input : JSON.stringify(event.input, null, 2)}
            </pre>
          </div>
        )}

        {event.output && (
          <div style={{ marginBottom: 8 }}>
            <span >输出:</span>
            <pre style={{ padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
            </pre>
          </div>
        )}

        {event.error && (
          <div style={{ marginBottom: 8 }}>
            <span >错误:</span>
            <div style={{ padding: 8, borderRadius: 4 }}>
              {event.error}
            </div>
          </div>
        )}

        {event.log && (
          <div>
            <span >日志:</span>
            <pre style={{ padding: 8, borderRadius: 4, overflowX: 'auto', fontSize: 12 }}>
              {event.log}
            </pre>
          </div>
        )}
      </div>
    </details>
  )
}

export default ToolCallBlock
