// GeoWork - DangerousActionApprovalCard
// Critical security actions require explicit confirmation

import React, { useState } from 'react'
import { AlertCircle, X, Lock, AlertTriangle } from 'lucide-react'
import usePermissionStore from '../../stores/permissionStore'
import type { RiskLevel, DangerousAction } from '../../types/permission'
import styles from './DangerousActionApprovalCard.module.scss'

const riskConfig: Record<RiskLevel, { color: string; icon: string; label: string }> = {
  low: { color: 'green', icon: '🟢', label: '低风险' },
  medium: { color: 'orange', icon: '🟡', label: '中风险' },
  high: { color: 'red', icon: '🔴', label: '高风险' },
  critical: { color: 'magenta', icon: '💀', label: '极高风险' },
}

const dangerousActionLabels: Record<DangerousAction, string> = {
  read_folder: '读取文件夹内容',
  write_file: '写入/修改文件',
  delete_file: '删除文件',
  run_python: '执行 Python 脚本',
  run_shell: '执行 Shell 命令',
  launch_process: '启动外部进程',
  network_request: '网络请求',
  browser_control: '浏览器自动化控制',
  system_api: '系统级 API 调用',
  long_running: '长时间运行任务',
  install_plugin: '安装插件或扩展',
}

interface DangerousActionApprovalCardProps {
  action: DangerousAction
  targetPath?: string
  command?: string
  networkHost?: string
  title: string
  description?: string
  taskId?: string
  onApprove: () => Promise<void>
  onDeny: () => Promise<void>
}

export const DangerousActionApprovalCard: React.FC<DangerousActionApprovalCardProps> = ({
  action,
  targetPath,
  command,
  networkHost,
  title,
  description = '',
  taskId = '',
  onApprove,
  onDeny,
}) => {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const actionLabel = dangerousActionLabels[action] || action
  const isCritical = action === 'delete_file' || action === 'run_shell' || action === 'system_api'
  const isNetwork = action === 'network_request' || action === 'launch_process'

  return (
    <Card className={`${styles.card} ${isCritical ? styles.critical : ''}`}>
      <CardContent >
        {/* Critical warning banner */}
        {isCritical && (
          <div className="border">
            <AlertTriangle className="shrink-0" />
            <div>
              <div >⚠️ 危险操作确认</div>
              <div >此操作可能影响系统安全或数据完整性，请仔细确认后再操作。</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className={styles.header}>
          <div >
            <AlertCircle className={styles.warningIcon} />
            <span className={styles.title}>{title || dangerousActionLabels[action]}</span>
          </div>
          <Badge variant="danger">需要授权</Badge>
        </div>

        {/* Alert */}
        {description && (
          <div className="border">
            <AlertCircle className="shrink-0" />
            <div>
              <div >操作说明</div>
              <div >{description}</div>
            </div>
          </div>
        )}

        {/* Action details */}
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>操作类型:</span>
            <Badge variant="info">{actionLabel}</Badge>
          </div>
          {isCritical && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>风险等级:</span>
              <Badge variant="danger">高 — 需谨慎</Badge>
            </div>
          )}
          {targetPath && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>目标路径:</span>
              <code className={styles.detailValue}>{targetPath}</code>
            </div>
          )}
          {command && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>执行命令:</span>
              <div className={styles.commandBlock}>
                <pre>{command}</pre>
              </div>
            </div>
          )}
          {networkHost && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>网络地址:</span>
              <code className={styles.detailValue}>{networkHost}</code>
            </div>
          )}
          {taskId && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>关联任务:</span>
              <Badge>{taskId.slice(0, 8)}</Badge>
            </div>
          )}
        </div>

        {/* Info: why needed */}
        <div className={styles.whySection}>
          <span className={styles.detailLabel}>为什么需要此操作？</span>
          <p className={styles.whyText}>
            Agent 在执行当前任务时需要此权限。
            {isCritical
              ? ' 这是一个高风险操作，建议仅在你确认其安全性的情况下批准。'
              : ' 批准后将自动执行，你可以在日志中跟踪操作结果。'}
          </p>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Textarea
            className={styles.reasonInput}
            placeholder="备注（可选）"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            rows={2}
          />
          <div className={`${styles.actionButtons} flex-wrap`}>
            <Button
              variant="primary"
              onClick={async () => {
                setLoading(true)
                try {
                  await onApprove()
                } finally {
                  setLoading(false)
                }
              }}
              loading={loading}
              className={isCritical ? 'bg-[""] hover:bg-[""]/80 text-white' : ''}
            >
              <Lock  />
              允许一次
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setLoading(true)
                try {
                  await onDeny()
                } finally {
                  setLoading(false)
                }
              }}
              loading={loading}
            >
              <X  />
              拒绝
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DangerousActionApprovalCard
