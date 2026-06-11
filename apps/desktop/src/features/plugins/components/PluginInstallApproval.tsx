// GeoWork Desktop - Plugin Install Approval
// Approval card for plugin installation with permission review

import { useState } from 'react'
import { Card, Button, Space, Tag, Input, Typography, Alert } from 'antd'
import { CheckOutlined, CloseOutlined, WarningOutlined, SaveOutlined } from '@ant-design/icons'
import type { Plugin } from '../../pluginClient'
import styles from './PluginInstallApproval.module.scss'

const { TextArea } = Input
const { Text, Title } = Typography

interface PluginInstallApprovalProps {
  plugin: Plugin
  onApprove: () => Promise<void>
  onDeny: () => Promise<void>
}

interface PermissionRisk {
  level: string
  color: string
  description: string
}

const PERMISSION_RISK: Record<string, PermissionRisk> = {
  install_package: {
    level: '高风险',
    color: 'magenta',
    description: '允许安装第三方包，可能引入恶意依赖',
  },
  run_shell: {
    level: '高风险',
    color: 'magenta',
    description: '允许执行系统 Shell 命令，可直接操作文件系统',
  },
  run_python: {
    level: '高风险',
    color: 'magenta',
    description: '允许执行 Python 脚本，可能修改文件或执行任意代码',
  },
  network_access: {
    level: '高风险',
    color: 'magenta',
    description: '允许网络请求，可能泄露数据或下载恶意内容',
  },
  write_file: {
    level: '中等风险',
    color: 'orange',
    description: '允许写入文件，可能修改或覆盖现有文件',
  },
  delete_file: {
    level: '中等风险',
    color: 'orange',
    description: '允许删除文件，可能导致数据丢失',
  },
  read_folder: {
    level: '中等风险',
    color: 'orange',
    description: '允许读取文件夹内容，可能访问敏感文件列表',
  },
  system_api: {
    level: '高风险',
    color: 'magenta',
    description: '允许访问系统 API，影响系统稳定性',
  },
  launch_process: {
    level: '中等风险',
    color: 'orange',
    description: '允许启动外部进程，可能执行未知程序',
  },
  long_running: {
    level: '中等风险',
    color: 'orange',
    description: '允许长时间运行，可能占用大量系统资源',
  },
  default: {
    level: '低风险',
    color: 'blue',
    description: '常规权限，通常用于功能基础操作',
  },
}

const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const getRiskColor = (level: string): string => {
  const colors: Record<string, string> = { low: 'green', medium: 'orange', high: 'red', critical: 'magenta' }
  return colors[level] || 'default'
}

export function PluginInstallApproval({ plugin, onApprove, onDeny }: PluginInstallApprovalProps) {
  const [reason, setReason] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)

  const permissionsWithRisk = plugin.permissions.map((perm) => ({
    name: perm,
    ...PERMISSION_RISK[perm],
  }))

  const hasHighRisk = permissionsWithRisk.some(
    (p) => p.level === '高风险'
  )
  const riskCount = permissionsWithRisk.filter((p) => p.level === '高风险').length
  const medRiskCount = permissionsWithRisk.filter((p) => p.level === '中等风险').length

  const maxRisk = riskCount > 0 ? 'high' : medRiskCount > 0 ? 'medium' : 'low'
  const maxRiskColor = getRiskColor(maxRisk)

  const handleApprove = async () => {
    setLoading('approve')
    try {
      await onApprove()
    } finally {
      setLoading(null)
    }
  }

  const handleDeny = async () => {
    setLoading('deny')
    try {
      await onDeny()
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>插件安装审批</span>
          <Tag color={maxRiskColor}>
            {riskCount > 0 ? '高风险' : medRiskCount > 0 ? '中风险' : '低风险'}
          </Tag>
        </Space>
      }
      className={styles.card}
    >
      <Alert
        message={plugin.name}
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {plugin.description}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              版本: v{plugin.version} | 作者: {plugin.author}
            </Text>
            {plugin.permissions.length > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                请求权限: {plugin.permissions.length} 项
              </Text>
            )}
          </Space>
        }
        type="warning"
        showIcon
        className={styles.alert}
      />

      {/* Permissions list */}
      {plugin.permissions.length > 0 && (
        <div className={styles.permissionsList}>
          <Text type="secondary" className={styles.permissionsTitle}>
            请求的权限及风险评估：
          </Text>
          {permissionsWithRisk.map((perm) => (
            <div key={perm.name} className={styles.permissionRow}>
              <code className={styles.permissionName}>{perm.name}</code>
              <Tag color={perm.color} className={styles.riskTag}>
                {perm.level}
              </Tag>
            </div>
          ))}
        </div>
      )}

      {/* Reason input */}
      <div className={styles.reasonSection}>
        <TextArea
          placeholder="审批理由（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className={styles.reasonInput}
        />
        <div className={styles.rememberRow}>
          <input
            type="checkbox"
            id="install-remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label htmlFor="install-remember">记住此决定</label>
        </div>
      </div>

      {/* Action buttons */}
      <Space className={styles.actions}>
        <Button
          type="primary"
          icon={<CheckOutlined />}
          onClick={handleApprove}
          loading={loading === 'approve'}
        >
          批准
        </Button>
        <Button
          danger
          icon={<CloseOutlined />}
          onClick={handleDeny}
          loading={loading === 'deny'}
        >
          拒绝
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={() => {
            setRemember(true)
            handleApprove()
          }}
          loading={loading === 'approve'}
        >
          批准并记住
        </Button>
      </Space>

      {/* Allow for this task */}
      {hasHighRisk && (
        <div className={styles.warning}>
          <WarningOutlined />
          <Text type="secondary" style={{ fontSize: 12 }}>
            此插件需要{' '}
            <Tag color="magenta" style={{ margin: '0 2px' }}>
              {riskCount}
            </Tag>
            个高风险权限，请确认权限必要性后再批准
          </Text>
        </div>
      )}
    </Card>
  )
}

export default PluginInstallApproval
