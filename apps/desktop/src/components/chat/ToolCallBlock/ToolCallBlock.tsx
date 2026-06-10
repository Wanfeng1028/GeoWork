// GeoWork - Tool Call Block Component
// Displays tool call details with expand/collapse

import React, { useState } from 'react'
import { Collapse, Tag, Space, Typography, Spin, Divider } from 'antd'
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import type { RuntimeEvent } from '../../../types/task'

const { Text, Paragraph } = Typography

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
    started: { icon: <PlayCircleOutlined />, color: '#1890ff', label: '运行中' },
    completed: { icon: <CheckCircleOutlined />, color: '#52c41a', label: '已完成' },
    failed: { icon: <CloseCircleOutlined />, color: '#ff4d4f', label: '失败' },
    pending: { icon: <LoadingOutlined />, color: '#faad14', label: '等待中' },
  }

  const config = statusConfig[event.status as keyof typeof statusConfig] || {
    icon: <CodeOutlined />,
    color: '#d9d9d9',
    label: event.status || '未知',
  }

  const duration = event.duration_ms ? `${event.duration_ms}ms` : ''

  return (
    <Collapse
      size="small"
      activeKey={expanded ? 'details' : undefined}
      onChange={() => setExpanded(!expanded)}
    >
      <Collapse.Panel
        header={
          <Space>
            <span style={{ color: config.color }}>{config.icon}</span>
            <Text strong>{event.tool || event.name || '工具调用'}</Text>
            <Tag color={config.color}>{config.label}</Tag>
            {duration && <Text type="secondary">{duration}</Text>}
          </Space>
        }
        key="details"
      >
        <Divider style={{ margin: '8px 0' }} />

        {event.input && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">输入:</Text>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {typeof event.input === 'string' ? event.input : JSON.stringify(event.input, null, 2)}
            </pre>
          </div>
        )}

        {event.output && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">输出:</Text>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
            </pre>
          </div>
        )}

        {event.error && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ color: '#ff4d4f' }}>错误:</Text>
            <Paragraph copyable style={{ background: '#fff2f0', padding: 8, borderRadius: 4 }}>
              {event.error}
            </Paragraph>
          </div>
        )}

        {event.log && (
          <div>
            <Text type="secondary">日志:</Text>
            <pre style={{ background: '#fafafa', padding: 8, borderRadius: 4, overflowX: 'auto', fontSize: 12 }}>
              {event.log}
            </pre>
          </div>
        )}
      </Collapse.Panel>
    </Collapse>
  )
}

export default ToolCallBlock
