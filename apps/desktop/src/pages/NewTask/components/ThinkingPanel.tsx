import { useEffect, useState } from 'react'
import { Collapse, Typography, theme } from 'antd'
import { Brain, Loader2 } from 'lucide-react'
import type { ThinkingStep } from './conversationStorage'
import styles from './ThinkingPanel.module.css'

const { Text } = Typography

export interface ThinkingPanelProps {
  thinkingSteps: ThinkingStep[]
  /** 所属消息是否仍在流式（驱动自动展开/收起） */
  streaming?: boolean
}

/**
 * A3 思考面板（doc/23）：折叠展示 state_change 状态迁移与 message 推理流。
 * 流式中自动展开，结束后自动收起；用户可随时手动切换。
 */
export function ThinkingPanel({ thinkingSteps, streaming = false }: ThinkingPanelProps) {
  const { token } = theme.useToken()
  const [open, setOpen] = useState(streaming)

  useEffect(() => {
    setOpen(streaming)
  }, [streaming])

  if (!thinkingSteps || thinkingSteps.length === 0) return null

  const active = streaming && thinkingSteps.at(-1)?.endedAt === undefined

  return (
    <div className={styles.root}>
      <Collapse
        ghost
        size="small"
        activeKey={open ? ['thinking'] : []}
        onChange={(keys) => setOpen(Array.isArray(keys) ? keys.length > 0 : keys === 'thinking')}
        items={[
          {
            key: 'thinking',
            label: (
              <span className={styles.header}>
                <Brain size={14} style={{ color: token.colorTextSecondary }} />
                <Text type="secondary" className={styles.headerText}>
                  思考过程 · {thinkingSteps.length} 步
                </Text>
                {active && (
                  <Loader2
                    size={14}
                    className={styles.spinner}
                    style={{ color: token.colorPrimary }}
                  />
                )}
              </span>
            ),
            children: (
              <div className={styles.stepList}>
                {thinkingSteps.map((step) => (
                  <div key={step.id} className={styles.stepItem}>
                    <div className={styles.stepHeader}>
                      <Text strong className={styles.stepTitle}>
                        {step.title}
                      </Text>
                      {step.kind === 'state' && step.content && (
                        <Text type="secondary" className={styles.stepReason}>
                          {step.content}
                        </Text>
                      )}
                    </div>
                    {step.kind === 'reasoning' && step.content && (
                      <pre
                        className={styles.reasoningContent}
                        style={{
                          color: token.colorTextSecondary,
                          borderLeft: `2px solid ${token.colorBorderSecondary}`,
                        }}
                      >
                        {step.content}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
