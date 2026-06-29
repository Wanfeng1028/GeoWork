// GeoWork - Approval Card Component
// Displays permission requests with approve/deny actions

import React, { useState } from 'react'
import { AlertTriangle, Check, X, Save } from 'lucide-react'
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
    <Card  >
      <CardHeader >
        <div >
          <CardTitle >
            <AlertTriangle  />
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
      <CardContent >
        <div className="border">
          <AlertTriangle className="shrink-0" />
          <div>
            <div >{request.title}</div>
            <div >{request.description}</div>
          </div>
        </div>

        {request.command && (
          <details >
            <summary >
              命令详情
            </summary>
            <pre >
              {request.command}
            </pre>
          </details>
        )}

        <div className="flex-col">
          <textarea
            placeholder="审批理由（可选）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className={styles.textarea}
          />
          <div >
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="remember" >记住此决定</label>
          </div>
          <div >
            <Button
              variant="primary"
              loading={loading}
              onClick={handleApprove}
            >
              <Check  />
              批准
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={handleDeny}
            >
              <X  />
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
              <Save  />
              批准并记住
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ApprovalCard
