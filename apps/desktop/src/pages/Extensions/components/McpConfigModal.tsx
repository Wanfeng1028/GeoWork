import { useState, useEffect } from 'react'
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import type { McpServerItem, McpTransport } from '../mcpMockData'
import styles from './McpConfigModal.module.css'

const { Text } = Typography

const { TextArea } = Input

type McpConfigModalMode = 'connect' | 'config' | 'import'

type McpConfigModalProps = {
  open: boolean
  mode: McpConfigModalMode
  server?: McpServerItem | null
  onClose: () => void
  onSave: (data: {
    name: string
    transport: McpTransport
    endpoint?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    enabled: boolean
  }) => void
}

const TRANSPORT_OPTIONS = [
  { value: 'stdio', label: 'stdio' },
  { value: 'http', label: 'http' },
  { value: 'sse', label: 'sse' },
  { value: 'websocket', label: 'websocket' },
]

const SENSITIVE_PATTERNS = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'API_KEY']

function isSensitiveKey(key: string): boolean {
  const upper = key.toUpperCase()
  return SENSITIVE_PATTERNS.some((p) => upper.includes(p))
}

function parseEnv(text: string): { env: Record<string, string>; hasSecret: boolean } {
  const env: Record<string, string> = {}
  let hasSecret = false
  const lines = text.split('\n').filter((l) => l.trim())
  for (const line of lines) {
    const eqIndex = line.indexOf('=')
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim()
      const value = line.slice(eqIndex + 1).trim()
      env[key] = value
      if (isSensitiveKey(key)) hasSecret = true
    }
  }
  return { env, hasSecret }
}

function envToText(env: Record<string, string> | undefined): string {
  if (!env) return ''
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

export function McpConfigModal({
  open,
  mode,
  server,
  onClose,
  onSave,
}: McpConfigModalProps) {
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<McpTransport>('stdio')
  const [endpoint, setEndpoint] = useState('')
  const [command, setCommand] = useState('')
  const [argsText, setArgsText] = useState('')
  const [envText, setEnvText] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [hasSecret, setHasSecret] = useState(false)

  /* 初始化表单 */
  useEffect(() => {
    if (!open) return
    if (mode === 'import') {
      setName('')
      setTransport('stdio')
      setEndpoint('')
      setCommand('')
      setArgsText('')
      setEnvText('')
      setEnabled(true)
      setHasSecret(false)
    } else if (server) {
      setName(server.name)
      setTransport(server.transport)
      setEndpoint(server.endpoint ?? '')
      setCommand(server.command ?? '')
      setArgsText((server.args ?? []).join('\n'))
      setEnvText(envToText(server.env))
      setEnabled(server.enabled)
      setHasSecret(false)
    }
  }, [open, mode, server])

  const showEndpoint = transport !== 'stdio'
  const showCommand = transport === 'stdio'

  const handleSave = () => {
    if (!name.trim()) return
    const args = argsText.split('\n').filter((l) => l.trim())
    const { env } = parseEnv(envText)
    onSave({
      name: name.trim(),
      transport,
      endpoint: showEndpoint ? endpoint.trim() : undefined,
      command: showCommand ? command.trim() : undefined,
      args: showCommand ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      enabled,
    })
  }

  const handleTestConnection = () => {
    // 不执行真实连接
  }

  const titleMap: Record<McpConfigModalMode, string> = {
    connect: '连接 MCP',
    config: '配置 MCP',
    import: '导入 MCP 配置',
  }

  return (
    <Modal
      title={titleMap[mode]}
      open={open}
      onCancel={onClose}
      width={560}
      footer={null}
    >
      <div className={styles.modalContent}>
        {/* 服务名称 */}
        <div className={styles.formRow}>
          <Text className={styles.formLabel}>服务名称</Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入 MCP 服务名称"
          />
        </div>

        {/* 连接方式 */}
        <div className={styles.formRow}>
          <Text className={styles.formLabel}>连接方式</Text>
          <Select
            value={transport}
            onChange={(val) => setTransport(val as McpTransport)}
            options={TRANSPORT_OPTIONS}
            style={{ width: '100%' }}
          />
        </div>

        {/* Endpoint URL */}
        {showEndpoint && (
          <div className={styles.formRow}>
            <Text className={styles.formLabel}>Endpoint URL</Text>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/mcp"
            />
          </div>
        )}

        {/* Command */}
        {showCommand && (
          <div className={styles.formRow}>
            <Text className={styles.formLabel}>Command</Text>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npx geowork-mcp-server"
            />
          </div>
        )}

        {/* Args */}
        {showCommand && (
          <div className={styles.formRow}>
            <Text className={styles.formLabel}>Args</Text>
            <TextArea
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              placeholder="一行一个参数"
              rows={3}
            />
          </div>
        )}

        {/* Environment */}
        <div className={styles.formRow}>
          <Text className={styles.formLabel}>Environment</Text>
          <TextArea
            value={envText}
            onChange={(e) => {
              setEnvText(e.target.value)
              const { hasSecret: hs } = parseEnv(e.target.value)
              setHasSecret(hs)
            }}
            placeholder={'POSTGIS_URL=\nGEOSERVER_URL='}
            rows={4}
          />
          {hasSecret && (
            <Alert
              type="warning"
              showIcon
              title="当前为本地预览配置，请勿填写真实密钥；后续将迁移到安全存储。"
              style={{ fontSize: 12 }}
              className={styles.secretNotice}
            />
          )}
        </div>

        {/* 启用 */}
        <div className={styles.formRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text className={styles.formLabel}>启用</Text>
            <Switch checked={enabled} onChange={setEnabled} size="small" />
          </div>
        </div>

        {/* 工具预览 */}
        {server && server.tools.length > 0 && (
          <div className={styles.formRow}>
            <Text className={styles.formLabel}>工具预览</Text>
            <div className={styles.toolsPreview}>
              {server.tools.map((tool) => (
                <Tag key={tool} style={{ fontSize: 11 }}>{tool}</Tag>
              ))}
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        <div className={styles.footerActions}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button onClick={handleTestConnection}>测试连接</Button>
            <Button type="primary" onClick={handleSave}>
              {mode === 'import' ? '保存导入' : '保存连接'}
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  )
}
