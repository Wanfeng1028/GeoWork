import { useState } from 'react'
import { App, Button, Tag, Timeline, Typography, theme } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ToolCallLog } from './conversationStorage'
import styles from './ToolCallTimeline.module.css'

const { Text } = Typography

/* ── Tag 颜色映射 ── */
const STATUS_TAG_COLOR: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  success: 'success',
  error: 'error',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '等待',
  running: '执行中',
  success: '成功',
  error: '失败',
}

export interface ToolCallTimelineProps {
  toolCalls: ToolCallLog[]
}

export function ToolCallTimeline({ toolCalls }: ToolCallTimelineProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [expanded, setExpanded] = useState(false)

  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className={styles.root}>
      <Button
        type="link"
        size="small"
        className={styles.toggleBtn}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? '收起工具日志' : '查看工具日志'}
      </Button>

      {expanded && (
        <div
          className={styles.timelineWrapper}
          style={{ borderLeft: `2px solid ${token.colorBorderSecondary}` }}
        >
          <Timeline
            items={toolCalls.map((log) => ({
              color:
                log.status === 'success'
                  ? token.colorSuccess
                  : log.status === 'error'
                    ? token.colorError
                    : log.status === 'running'
                      ? token.colorPrimary
                      : token.colorTextPlaceholder,
              children: (
                <div className={styles.logItem}>
                  <div className={styles.logHeader}>
                    <Text strong style={{ fontSize: 13 }}>
                      {log.name}
                    </Text>
                    <Tag color={STATUS_TAG_COLOR[log.status]}>
                      {STATUS_LABEL[log.status]}
                    </Tag>
                    {log.status === 'error' && (
                      <Button
                        type="link"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() =>
                          message.info('工具重试功能后续接入')
                        }
                      >
                        重试
                      </Button>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {log.inputSummary}
                  </Text>
                  {log.outputSummary && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: token.colorSuccess,
                        display: 'block',
                        marginTop: 2,
                      }}
                    >
                      {log.outputSummary}
                    </Text>
                  )}
                </div>
              ),
            }))}
          />
        </div>
      )}
    </div>
  )
}
