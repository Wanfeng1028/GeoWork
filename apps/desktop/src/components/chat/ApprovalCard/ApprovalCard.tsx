// GeoWork - Approval Card Component
// Displays permission requests with approve/deny actions

import React, { useState } from 'react'
import { Card, Button, Space, Tag, Input, Alert, Collapse } from 'antd'
import { CheckOutlined, CloseOutlined, WarningOutlined, SaveOutlined } from '@ant-design/icons'
import usePermissionStore from '../../../stores/permissionStore'
import type { PermissionRequest } from '../../../types/permission'

const { TextArea } = Input

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
    <Card
      size="small"
      type="inner"
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>权限审批请求</span>
          <Tag color={riskColor[request.riskLevel as keyof typeof riskColor] || 'default'}>
            {request.riskLevel}
          </Tag>
        </Space>
      }
      extra={
        <Tag>{actionLabels[request.action] || request.action}</Tag>
      }
      style={{ marginBottom: 8, border: '1px solid #faad14' }}
    >
      <Alert
        message={request.title}
        description={request.description}
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
      />

      {request.command && (
        <Collapse size="small" style={{ marginBottom: 12 }}>
          <Collapse.Panel header="命令详情" key="command">
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflowX: 'auto' }}>
              {request.command}
            </pre>
          </Collapse.Panel>
        </Collapse>
      )}

      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <TextArea
          placeholder="审批理由（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
        <Space>
          <input
            type="checkbox"
            id="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label htmlFor="remember">记住此决定</label>
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            loading={loading}
          >
            批准
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
            icon={<SaveOutlined />}
            onClick={() => {
              // Approve for this task and remember
              setRemember(true)
              handleApprove()
            }}
            loading={loading}
          >
            批准并记住
          </Button>
        </Space>
      </Space>
    </Card>
  )
}

export default ApprovalCard
