// GeoWork - PermissionApprovalCard
// Displays permission requests with approve/deny actions in chat flow

import React, { useState } from 'react'
import { Check, X, AlertTriangle, Save, Eye } from 'lucide-react'
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
    <div className={styles.card}>
      <div >
        {/* Header */}
        <div className={styles.header}>
          <div >
            <AlertTriangle className={styles.warningIcon} />
            <span className={styles.title}>权限审批请求</span>
          </div>
          <div >
            <span>
              {config.icon} {config.label}
            </span>
            <span>{actionLabel}</span>
          </div>
        </div>

        {/* Alert */}
        <div >
          <AlertTriangle  />
          <div>
            <div >{request.title}</div>
            <div >{request.description}</div>
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
                <summary >查看命令详情</summary>
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
              <span>{actionLabel}</span>。
              如果不批准，任务将继续但此操作将被跳过。
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <textarea
            className={styles.reasonInput}
            placeholder="审批理由（可选）"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            rows={2}
          />
          <div className={`${styles.actionButtons}`}>
            <button
              onClick={handleApprove}
              loading={loading}
            >
              <Check  />
              允许一次
            </button>
            <button
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
              <Save  />
              始终允许此工作区
            </button>
            <button
              onClick={handleDeny}
              loading={loading}
            >
              <X  />
              拒绝
            </button>
            <button
              onClick={() => {
                // Show more details
              }}
              loading={loading}
            >
              <Eye  />
              查看详情
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PermissionApprovalCard
