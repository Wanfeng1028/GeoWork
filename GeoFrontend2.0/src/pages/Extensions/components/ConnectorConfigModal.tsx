import { useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type {
  ConnectorAuthType,
  ConnectorCapability,
  ConnectorItem,
} from '../connectorsMockData'
import { CAPABILITY_LABELS } from '../connectorsMockData'
import styles from './ConnectorConfigModal.module.css'

const { Text } = Typography

const AUTH_TYPE_OPTIONS = [
  { value: 'oauth', label: 'OAuth 模拟' },
  { value: 'api-key', label: 'API Key' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'browser-session', label: '浏览器会话' },
  { value: 'local-bridge', label: '本地桥接' },
  { value: 'internal', label: '内置集成' },
  { value: 'manual', label: '手动配置' },
]

const CAPABILITY_OPTIONS: { value: ConnectorCapability; label: string }[] = [
  { value: 'read-files', label: '读取文件' },
  { value: 'write-files', label: '写入文件' },
  { value: 'read-calendar', label: '读取日历' },
  { value: 'write-calendar', label: '写入日历' },
  { value: 'read-email', label: '读取邮件' },
  { value: 'send-message', label: '发送消息' },
  { value: 'read-map', label: '读取地图' },
  { value: 'write-map', label: '写入地图' },
  { value: 'read-dataset', label: '读取数据集' },
  { value: 'sync-task', label: '同步任务' },
  { value: 'trigger-workflow', label: '触发工作流' },
  { value: 'notification', label: '通知' },
]

const SHOW_ENDPOINT_TYPES: ConnectorAuthType[] = ['api-key', 'webhook', 'manual', 'local-bridge']
const SHOW_SECRET_TYPES: ConnectorAuthType[] = ['api-key', 'webhook', 'manual']

type ConfigModalMode = 'connect' | 'config' | 'manual'

interface ConnectorConfigModalProps {
  open: boolean
  mode: ConfigModalMode
  connector?: ConnectorItem | null
  onCancel: () => void
  onSave: (data: {
    name: string
    authType: ConnectorAuthType
    accountLabel: string
    endpoint: string
    scopes: ConnectorCapability[]
    enabled: boolean
    isManual: boolean
  }) => void
}

export function ConnectorConfigModal({
  open,
  mode,
  connector,
  onCancel,
  onSave,
}: ConnectorConfigModalProps) {
  const { message } = App.useApp()

  const [name, setName] = useState(connector?.name ?? '')
  const [authType, setAuthType] = useState<ConnectorAuthType>(connector?.authType ?? 'oauth')
  const [accountLabel, setAccountLabel] = useState(connector?.accountLabel ?? '')
  const [endpoint, setEndpoint] = useState(connector?.endpoint ?? '')
  const [scopes, setScopes] = useState<ConnectorCapability[]>(connector?.capabilities ?? [])
  const [enabled, setEnabled] = useState(connector?.enabled ?? true)

  const titleMap: Record<ConfigModalMode, string> = {
    connect: '连接连接器',
    config: '配置连接器',
    manual: '手动添加连接器',
  }

  const handleSave = () => {
    if (!name.trim()) {
      message.warning('请填写连接器名称')
      return
    }
    onSave({
      name: name.trim(),
      authType,
      accountLabel: accountLabel.trim(),
      endpoint: endpoint.trim(),
      scopes,
      enabled,
      isManual: mode === 'manual',
    })
  }

  const handleTest = () => {
    message.info('连接测试功能后续接入')
  }

  const showEndpoint = SHOW_ENDPOINT_TYPES.includes(authType)
  const showSecret = SHOW_SECRET_TYPES.includes(authType)

  return (
    <Modal
      title={titleMap[mode]}
      open={open}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button onClick={handleTest}>测试连接</Button>
          <Button type="primary" onClick={handleSave}>保存连接</Button>
        </Space>
      }
      width={560}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
        {/* 名称 */}
        <div className={styles.formSection}>
          <Text className={styles.formLabel}>连接器名称</Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 Google Workspace"
            disabled={mode !== 'manual'}
          />
        </div>

        {/* 连接方式 */}
        <div className={styles.formSection}>
          <Text className={styles.formLabel}>连接方式</Text>
          <Select
            value={authType}
            onChange={setAuthType}
            options={AUTH_TYPE_OPTIONS}
            style={{ width: '100%' }}
            disabled={mode !== 'manual'}
          />
        </div>

        {/* 账号标识 */}
        <div className={styles.formSection}>
          <Text className={styles.formLabel}>账号标识</Text>
          <Input
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            placeholder="例如 user@example.com / workspace-name / project-name"
          />
        </div>

        {/* Endpoint URL */}
        {showEndpoint && (
          <div className={styles.formSection}>
            <Text className={styles.formLabel}>Endpoint URL</Text>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com"
            />
          </div>
        )}

        {/* API Key / Token */}
        {showSecret && (
          <div className={styles.formSection}>
            <Text className={styles.formLabel}>API Key / Token</Text>
            <Input.Password
              placeholder="请输入本地预览 Token"
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              当前为本地预览配置，请勿填写真实密钥。后续将迁移到安全存储。
            </Text>
          </div>
        )}

        {/* 授权范围 */}
        <div className={styles.formSection}>
          <Text className={styles.formLabel}>授权范围</Text>
          <div className={styles.scopesGrid}>
            <Checkbox.Group
              value={scopes}
              onChange={(vals) => setScopes(vals as ConnectorCapability[])}
              options={CAPABILITY_OPTIONS}
            />
          </div>
        </div>

        {/* 启用 */}
        <div className={styles.formSection}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text className={styles.formLabel} style={{ marginBottom: 0 }}>启用</Text>
            <Switch checked={enabled} onChange={setEnabled} size="small" />
          </div>
        </div>

        {/* 能力预览 */}
        {scopes.length > 0 && (
          <div className={styles.formSection}>
            <Text className={styles.formLabel}>能力预览</Text>
            <div className={styles.capPreview}>
              {scopes.map((cap) => (
                <Tag key={cap} style={{ margin: 0, fontSize: 11 }}>
                  {CAPABILITY_LABELS[cap] ?? cap}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
