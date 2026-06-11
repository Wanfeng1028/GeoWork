// GeoWork Model Gateway - Model Provider Form
// Form for adding and editing model providers

import { useState, useEffect } from 'react'
import { Form, Input, Select, Button, message, Space, Tag } from 'antd'
import { LinkOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import modelGatewayClient, { type ModelProvider } from '../modelGatewayClient'
import useModelGatewayStore from '../modelGatewayStore'
import styles from './ModelProviderForm.module.scss'

const PROVIDER_KINDS = [
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'lm_studio', label: 'LM Studio' },
  { value: 'custom', label: 'Custom' },
]

export interface ModelProviderFormProps {
  provider?: ModelProvider | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function ModelProviderForm({ provider, onSuccess, onCancel }: ModelProviderFormProps) {
  const [form] = Form.useForm<Partial<ModelProvider>>()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean } | null>(null)
  const { loadProviders, loadUsage } = useModelGatewayStore()

  useEffect(() => {
    if (provider) {
      form.setFieldsValue(provider)
    } else {
      form.setFieldsValue({ kind: 'openai_compatible', enabled: true })
    }
  }, [provider, form])

  const handleTestConnection = async () => {
    if (!provider?.id) {
      message.warning('请先保存提供商')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await modelGatewayClient.testConnection(provider.id)
      setTestResult({ ok: result.success })
      if (result.success) {
        message.success(`连接成功，发现 ${result.modelCount ?? '?'} 个模型`)
      } else {
        message.error('连接失败')
      }
    } catch {
      setTestResult({ ok: false })
      message.error('连接测试出错')
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (values: Partial<ModelProvider>) => {
    try {
      if (provider?.id) {
        await modelGatewayClient.updateProvider(provider.id, values)
        message.success('已更新')
      } else {
        await modelGatewayClient.addProvider(values)
        message.success('已添加')
      }
      await loadProviders()
      await loadUsage()
      onSuccess?.()
    } catch {
      message.error(provider?.id ? '更新失败' : '添加失败')
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className={styles.form}
    >
      <Form.Item
        label="名称"
        name="name"
        rules={[{ required: true, message: '请输入名称' }]}
      >
        <Input placeholder="例如: OpenAI API, Local Ollama" />
      </Form.Item>

      <Form.Item
        label="类型"
        name="kind"
        rules={[{ required: true, message: '请选择类型' }]}
      >
        <Select options={PROVIDER_KINDS} />
      </Form.Item>

      <Form.Item
        label="Base URL"
        name="baseUrl"
        rules={[{ required: true, message: '请输入 Base URL' }]}
      >
        <Input placeholder="https://api.openai.com" />
      </Form.Item>

      <Form.Item label="API Key" name="apiKeyRef">
        <Input.Password placeholder="sk-... (可选)" />
      </Form.Item>

      <Form.Item label="默认模型" name="defaultModel">
        <Input placeholder="gpt-4, llama3 等 (可选)" />
      </Form.Item>

      {provider?.id && (
        <Form.Item className={styles.testRow}>
          <Button
            icon={<LinkOutlined />}
            loading={testing}
            onClick={handleTestConnection}
            className={styles.testBtn}
          >
            测试连接
          </Button>
          {testResult && (
            <Tag color={testResult.ok ? 'success' : 'error'} className={styles.testTag}>
              {testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              {testResult.ok ? '连接成功' : '连接失败'}
            </Tag>
          )}
        </Form.Item>
      )}

      <Form.Item className={styles.actions}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit">
            {provider?.id ? '保存' : '添加'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default ModelProviderForm
