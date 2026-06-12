// GeoWork Desktop - Plugin Install Approval
// Approval card for plugin installation with permission review

import { useState } from 'react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Input } from '../../../components/ui/input'
import { Spinner } from '../../../components/ui/spinner'
import { Check, X, AlertTriangle, Save } from 'lucide-react'
import type { Plugin } from '../../pluginClient'
import styles from './PluginInstallApproval.module.scss'

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

const getBadgeClass = (color: string): string => {
  const map: Record<string, string> = {
    magenta: 'bg-pink-500/20 text-pink-400',
    orange: 'bg-orange-500/20 text-orange-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    default: 'bg-gray-500/20 text-gray-400',
  }
  return map[color] || map.default
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
    <Card className={styles.card}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <span className="font-semibold">插件安装审批</span>
        <Badge className={getBadgeClass(maxRiskColor)}>
          {riskCount > 0 ? '高风险' : medRiskCount > 0 ? '中风险' : '低风险'}
        </Badge>
      </div>

      <div className={`flex items-start gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 ${styles.alert}`}>
        <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-[var(--gw-text)]">{plugin.name}</span>
          <span className="text-[13px] text-[var(--gw-text-secondary)]">
            {plugin.description}
          </span>
          <span className="text-[13px] text-[var(--gw-text-secondary)]">
            版本: v{plugin.version} | 作者: {plugin.author}
          </span>
          {plugin.permissions.length > 0 && (
            <span className="text-[13px] text-[var(--gw-text-secondary)]">
              请求权限: {plugin.permissions.length} 项
            </span>
          )}
        </div>
      </div>

      {/* Permissions list */}
      {plugin.permissions.length > 0 && (
        <div className={styles.permissionsList}>
          <span className="text-[13px] text-[var(--gw-text-secondary)]">
            请求的权限及风险评估：
          </span>
          {permissionsWithRisk.map((perm) => (
            <div key={perm.name} className={styles.permissionRow}>
              <code className={styles.permissionName}>{perm.name}</code>
              <Badge className={getBadgeClass(perm.color)}>
                {perm.level}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Reason input */}
      <div className={styles.reasonSection}>
        <textarea
          placeholder="审批理由（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className={`w-full rounded-md border border-[var(--gw-border)] bg-[var(--gw-bg-secondary)] p-2 text-[13px] ${styles.reasonInput}`}
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
      <div className="flex gap-2">
        <Button
          onClick={handleApprove}
          disabled={loading === 'approve'}
        >
          {loading === 'approve' ? <Spinner className="h-4 w-4 mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          批准
        </Button>
        <Button
          variant="destructive"
          onClick={handleDeny}
          disabled={loading === 'deny'}
        >
          {loading === 'deny' ? <Spinner className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
          拒绝
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setRemember(true)
            handleApprove()
          }}
          disabled={loading === 'approve'}
        >
          {loading === 'approve' ? <Spinner className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          批准并记住
        </Button>
      </div>

      {/* Allow for this task */}
      {hasHighRisk && (
        <div className={styles.warning}>
          <AlertTriangle className="h-4 w-4" />
          <span className="text-[13px] text-[var(--gw-text-secondary)]">
            此插件需要{' '}
            <Badge className="bg-pink-500/20 text-pink-400">
              {riskCount}
            </Badge>
            个高风险权限，请确认权限必要性后再批准
          </span>
        </div>
      )}
    </Card>
  )
}

export default PluginInstallApproval
