import { useState } from 'react'
import { App, Button, Input, Modal, Space, Typography } from 'antd'
import { sanitizeJsonInput } from '../connectorsStorage'
import styles from './ConnectorJsonImportModal.module.css'

const { Text } = Typography

const JSON_EXAMPLE = `{
  "name": "自定义地图服务",
  "slug": "custom-map-service",
  "authType": "api-key",
  "category": "地图服务",
  "endpoint": "https://api.example.com",
  "scopes": ["read-map", "read-dataset"]
}`

interface ConnectorJsonImportModalProps {
  open: boolean
  onCancel: () => void
  onImport: (data: {
    name: string
    slug: string
    authType: string
    category: string
    description: string
    endpoint?: string
    scopes: string[]
    hasSecret: boolean
  }) => void
}

export function ConnectorJsonImportModal({
  open,
  onCancel,
  onImport,
}: ConnectorJsonImportModalProps) {
  const { message } = App.useApp()
  const [jsonText, setJsonText] = useState('')

  const handleImport = () => {
    const trimmed = jsonText.trim()
    if (!trimmed) {
      message.warning('请粘贴 JSON 配置')
      return
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      message.error('JSON 格式不正确')
      return
    }

    if (typeof parsed !== 'object' || parsed === null) {
      message.error('JSON 格式不正确')
      return
    }

    if (!parsed.name || typeof parsed.name !== 'string' || !parsed.name.trim()) {
      message.warning('请填写连接器名称')
      return
    }

    /* 过滤敏感字段 */
    const sanitized = sanitizeJsonInput(parsed)
    const hasSecret = Object.keys(parsed).some((k) =>
      ['key', 'token', 'secret', 'password', 'apiKey', 'API_KEY', 'api_key'].includes(k),
    )

    onImport({
      name: (sanitized.name as string).trim(),
      slug: (sanitized.slug as string) ?? `custom-${Date.now()}`,
      authType: (sanitized.authType as string) ?? 'manual',
      category: (sanitized.category as string) ?? '内置能力',
      description: (sanitized.description as string) ?? '',
      endpoint: sanitized.endpoint as string | undefined,
      scopes: Array.isArray(sanitized.scopes) ? (sanitized.scopes as string[]) : [],
      hasSecret,
    })

    setJsonText('')
  }

  const handleCancel = () => {
    setJsonText('')
    onCancel()
  }

  return (
    <Modal
      title="通过 JSON 导入"
      open={open}
      onCancel={handleCancel}
      footer={
        <Space>
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleImport}>导入</Button>
        </Space>
      }
      width={560}
    >
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
        粘贴连接器 JSON 配置，敏感字段（key/token/secret/password/apiKey）不会保存原始值。
      </Text>

      <Input.TextArea
        className={styles.textArea}
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder={JSON_EXAMPLE}
        rows={12}
      />

      <Text type="secondary" className={styles.hint} style={{ fontSize: 12 }}>
        支持字段：name、slug、authType、category、description、endpoint、scopes 等。
      </Text>
    </Modal>
  )
}
