import { useState } from 'react'
import { App, Button, Space, Typography, theme } from 'antd'
import { ShieldAlert, Check, X, Terminal } from 'lucide-react'
import type { CoreApprovalRequest } from '../../../shared/api/types'
import { CapsuleTag } from '../../../shell/components/CapsuleTag'
import styles from './ApprovalCard.module.css'

const { Text } = Typography

/** riskLevel → 标签色（governor 侧枚举：low/medium/high，未知按 medium 处理）。 */
function riskColor(riskLevel?: string): 'default' | 'warning' | 'error' {
  switch (riskLevel) {
    case 'high':
      return 'error'
    case 'low':
      return 'default'
    case 'medium':
    default:
      return 'warning'
  }
}

function riskLabel(riskLevel?: string): string {
  switch (riskLevel) {
    case 'high':
      return '高风险'
    case 'low':
      return '低风险'
    case 'medium':
    default:
      return '中风险'
  }
}

/** args 紧凑摘要：command 优先完整展示，其余键值对截断。 */
function summarizeArgs(args?: Record<string, unknown>): Array<{ key: string; value: string }> {
  if (!args) return []
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }))
}

export interface ApprovalCardProps {
  approval: CoreApprovalRequest
  onResolve: (approved: boolean, reason?: string) => Promise<void>
}

/**
 * A1 审批卡片（doc/23）：governor 的 approval_request 事件驱动。
 * 批准 → POST /api/agent/approvals/{id}/approve；拒绝 → /reject（携带理由）。
 */
export function ApprovalCard({ approval, onResolve }: ApprovalCardProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)

  const argRows = summarizeArgs(approval.args)
  const command = typeof approval.args?.command === 'string' ? approval.args.command : undefined

  const handleResolve = async (approved: boolean) => {
    setSubmitting(approved ? 'approve' : 'reject')
    try {
      await onResolve(approved)
      if (approved) message.success('已批准执行')
      else message.info('已拒绝该操作')
    } catch {
      message.error('审批回传失败，请重试')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div
      className={styles.card}
      style={{
        background: token.colorWarningBg,
        border: `1px solid ${token.colorWarningBorder}`,
      }}
    >
      <div className={styles.header}>
        <Space size={8}>
          <ShieldAlert size={16} color={token.colorWarning} />
          <Text strong>需要你的确认</Text>
          <CapsuleTag color={riskColor(approval.riskLevel)}>
            {riskLabel(approval.riskLevel)}
          </CapsuleTag>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          GeoWork 想执行以下操作，等待确认（5 分钟内有效）
        </Text>
      </div>

      <div className={styles.body}>
        <Text strong style={{ fontSize: 13 }}>
          {approval.toolName}
        </Text>

        {command && (
          <div
            className={styles.command}
            style={{
              background: token.colorFillQuaternary,
              borderColor: token.colorBorderSecondary,
            }}
          >
            <Terminal size={13} color={token.colorTextSecondary} />
            <code className={styles.commandText}>{command}</code>
          </div>
        )}

        {argRows.length > 0 && (
          <div className={styles.args}>
            {argRows.map((row) => (
              <div key={row.key} className={styles.argRow}>
                <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                  {row.key}
                </Text>
                <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {row.value.length > 160 ? `${row.value.slice(0, 160)}…` : row.value}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button
          type="primary"
          size="small"
          icon={<Check size={14} />}
          loading={submitting === 'approve'}
          disabled={submitting !== null}
          onClick={() => void handleResolve(true)}
        >
          批准执行
        </Button>
        <Button
          size="small"
          danger
          icon={<X size={14} />}
          loading={submitting === 'reject'}
          disabled={submitting !== null}
          onClick={() => void handleResolve(false)}
        >
          拒绝
        </Button>
      </div>
    </div>
  )
}
