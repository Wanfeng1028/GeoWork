// GeoWork - PermissionApprovalCard
// Displays permission requests with approve/deny actions in chat flow

import React, { useState } from 'react'
import { Check, X, AlertTriangle, Save, Eye } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Textarea } from '../ui/textarea'
import usePermissionStore from '../../stores/permissionStore'
import type { PermissionRequest, RiskLevel } from '../../types/permission'
import styles from './PermissionApprovalCard.module.scss'

const riskConfig: Record<RiskLevel, { color: string; icon: string; label: string }> = {
  low: { color: 'green', icon: '🟢', label: '低风险' },
  medium: { color: 'orange', icon: '🟡', label: '中风险' },
  high: { color: 'red', icon: '🔴', label: '高风险' },
  critical: { color: 'magenta', icon: '💀', label: '极高风险' },
}

const riskVariantMap: Record<RiskLevel, 'success' | 'warning' | 'danger' | 'default'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
}

const actionLabels: Record<string, string> = {
  read_folder: '读取文件夹',
  write_file: '写入文件',
  delete_file: '删除文件',
  run_python: '运行 Python 脚本',
  run_shell: '执行 Shell 命令',
  launch_process: '启动进程',
  network_request: '网络请求',
  browser_control: '浏览器控制',
  system_api: '系统 API 调用',
  long_running: '长时间运行',
  install_plugin: '安装插件',
}

interface PermissionApprovalCardProps {
  request: PermissionRequest
}

export const PermissionApprovalCard: React.FC<PermissionApprovalCardProps> = ({ request }) => {
  const { approveRequest, denyRequest } = usePermissionStore()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const config = riskConfig[request.riskLevel] || riskConfig.medium
  const actionLabel = actionLabels[request.action] || request.action

  const handleApprove = async () => {
    setLoading(true)
    try {
      await approveRequest(request.id, reason || '用户批准')
    } finally {
      setLoading(false)
    }
  }

  const handleDeny = async () => {
    setLoading(true)
    try {
      await denyRequest(request.id, reason || '用户拒绝')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={styles.card}>
      <CardContent className="p-3 px-4">
        {/* Header */}
        <div className={styles.header}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={styles.warningIcon} />
            <span className={styles.title}>权限审批请求</span>
          </div>
          <div className="flex gap-1.5">
            <Badge variant={riskVariantMap[request.riskLevel] || 'warning'}>
              {config.icon} {config.label}
            </Badge>
            <Badge variant="accent">{actionLabel}</Badge>
          </div>
        </div>

        {/* Alert */}
        <div className="my-2 flex items-start gap-2 rounded-[var(--gw-radius-sm)] border border-[var(--gw-warning)] bg-[var(--gw-warning-soft)] p-3 text-[13px] text-[var(--gw-warning)]">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{request.title}</div>
            <div className="mt-1 text-[12px]">{request.description}</div>
          </div>
        </div>

        {/* Details */}
        <div className={styles.details}>
          {request.targetPath && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>目标路径:</span>
              <code className={styles.detailValue}>{request.targetPath}</code>
            </div>
          )}
          {request.command && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>命令:</span>
              <details className={styles.commandCollapse}>
                <summary className="cursor-pointer text-[12px] text-[var(--gw-accent)]">查看命令详情</summary>
                <pre className={styles.commandPre}>{request.command}</pre>
              </details>
            </div>
          )}
          {request.networkHost && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>网络地址:</span>
              <code className={styles.detailValue}>{request.networkHost}</code>
            </div>
          )}
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>为什么需要:</span>
            <span className={styles.detailValue}>
              Agent 在执行任务时需要此权限以完成{' '}
              <Badge variant="info">{actionLabel}</Badge>。
              如果不批准，任务将继续但此操作将被跳过。
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Textarea
            className={styles.reasonInput}
            placeholder="审批理由（可选）"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            rows={2}
          />
          <div className={`${styles.actionButtons} flex flex-wrap gap-2`}>
            <Button
              variant="primary"
              onClick={handleApprove}
              loading={loading}
            >
              <Check className="h-3.5 w-3.5" />
              允许一次
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setLoading(true)
                try {
                  await approveRequest(request.id, reason || '用户批准（永久）')
                } finally {
                  setLoading(false)
                }
              }}
              loading={loading}
            >
              <Save className="h-3.5 w-3.5" />
              始终允许此工作区
            </Button>
            <Button
              variant="danger"
              onClick={handleDeny}
              loading={loading}
            >
              <X className="h-3.5 w-3.5" />
              拒绝
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // Show more details
              }}
              loading={loading}
            >
              <Eye className="h-3.5 w-3.5" />
              查看详情
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default PermissionApprovalCard
