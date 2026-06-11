// GeoWork - PermissionApprovalCard
// Displays permission requests with approve/deny actions in chat flow

import React, { useState } from 'react'
import { Card, Button, Space, Tag, Input, Alert, Collapse } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  WarningOutlined,
  SaveOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import usePermissionStore from '../../stores/permissionStore'
import type { PermissionRequest, RiskLevel } from '../../types/permission'
import styles from './PermissionApprovalCard.module.scss'

const { TextArea } = Input

const riskConfig: Record<RiskLevel, { color: string; icon: string; label: string }> = {
  low: { color: 'green', icon: '🟢', label: '低风险' },
  medium: { color: 'orange', icon: '🟡', label: '中风险' },
  high: { color: 'red', icon: '🔴', label: '高风险' },
  critical: { color: 'magenta', icon: '💀', label: '极高风险' },
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
    <Card
      className={styles.card}
      size="small"
      type="inner"
      styles={{
        body: { padding: '12px 16px' },
      }}
    >
      {/* Header */}
      <div className={styles.header}>
        <Space align="center">
          <WarningOutlined className={styles.warningIcon} />
          <span className={styles.title}>权限审批请求</span>
        </Space>
        <Space size="small">
          <Tag color={config.color}>
            {config.icon}
            {' '}
            {config.label}
          </Tag>
          <Tag>{actionLabel}</Tag>
        </Space>
      </div>

      {/* Alert */}
      <Alert
        message={request.title}
        description={request.description}
        type="warning"
        showIcon
        className={styles.alert}
      />

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
            <Collapse size="small" ghost className={styles.commandCollapse}>
              <Collapse.Panel header="查看命令详情" key="cmd">
                <pre className={styles.commandPre}>{request.command}</pre>
              </Collapse.Panel>
            </Collapse>
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
            <Tag color="blue">{actionLabel}</Tag>。
            如果不批准，任务将继续但此操作将被跳过。
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <TextArea
          className={styles.reasonInput}
          placeholder="审批理由（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
        <Space className={styles.actionButtons} wrap>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            loading={loading}
          >
            允许一次
          </Button>
          <Button
            icon={<SaveOutlined />}
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
            始终允许此工作区
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={handleDeny}
            loading={loading}
          >
            拒绝
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              // Show more details
            }}
            loading={loading}
          >
            查看详情
          </Button>
        </Space>
      </div>
    </Card>
  )
}

export default PermissionApprovalCard
