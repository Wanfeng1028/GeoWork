// GeoWork - Approval Card Component
// Displays permission requests with approve/deny actions

import React, { useState } from 'react'
import { AlertTriangle, Check, X, Save } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Input } from '../../ui/input'
import usePermissionStore from '../../../stores/permissionStore'
import type { PermissionRequest } from '../../../types/permission'

interface ApprovalCardProps {
  request: PermissionRequest
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({ request }) => {
  const { approveRequest, denyRequest } = usePermissionStore()
  const [reason, setReason] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  const riskColor = {
    low: 'green',
    medium: 'orange',
    high: 'red',
    critical: 'magenta',
  }

  const actionLabels: Record<string, string> = {
    run_shell: '执行 Shell 命令',
    write_file: '写入文件',
    delete_file: '删除文件',
    run_python: '运行 Python 脚本',
    install_package: '安装包',
    network_access: '网络访问',
    read_env: '读取环境变量',
    write_env: '修改环境变量',
    exec_binary: '执行二进制文件',
    modify_system: '修改系统配置',
    access_secrets: '访问密钥',
  }

  const handleApprove = async () => {
    setLoading(true)
    try {
      await approveRequest(request.id, remember ? reason : undefined)
    } finally {
      setLoading(false)
    }
  }

  const handleDeny = async () => {
    setLoading(true)
    try {
      await denyRequest(request.id, reason || 'User denied')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-2" style={{ border: '1px solid #faad14' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <AlertTriangle className="h-4 w-4 text-[#faad14]" />
            <span>权限审批请求</span>
            <Badge
              variant={request.riskLevel === 'critical' ? 'danger' : request.riskLevel === 'high' ? 'danger' : request.riskLevel === 'medium' ? 'warning' : 'success'}
            >
              {request.riskLevel}
            </Badge>
          </CardTitle>
          <Badge variant="default">{actionLabels[request.action] || request.action}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-start gap-2 p-3 rounded-[var(--gw-radius-sm)] bg-[var(--gw-warning-soft)] border border-[var(--gw-warning)]/20 text-[var(--gw-warning)] text-[12px] mb-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{request.title}</div>
            <div className="mt-1 opacity-80">{request.description}</div>
          </div>
        </div>

        {request.command && (
          <details className="mb-3">
            <summary className="text-[12px] cursor-pointer text-[var(--gw-text-secondary)] hover:text-[var(--gw-text)]">
              命令详情
            </summary>
            <pre className="mt-1 bg-[var(--gw-bg-code)] p-2 rounded-[var(--gw-radius-sm)] text-[11px] overflow-x-auto">
              {request.command}
            </pre>
          </details>
        )}

        <div className="flex flex-col gap-2">
          <textarea
            placeholder="审批理由（可选）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="flex w-full rounded-[var(--gw-radius-sm)] border border-[var(--gw-border-soft)] bg-[var(--gw-bg-input)] px-2.5 py-1.5 text-[13px] text-[var(--gw-text)] placeholder:text-[var(--gw-text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gw-accent)]/30"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="remember" className="text-[12px]">记住此决定</label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              loading={loading}
              onClick={handleApprove}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              批准
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={handleDeny}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              拒绝
            </Button>
            <Button
              variant="secondary"
              loading={loading}
              onClick={() => {
                setRemember(true)
                handleApprove()
              }}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              批准并记住
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ApprovalCard
