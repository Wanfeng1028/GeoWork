import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { SettingsCard } from './SettingsSection'
import type {
  CustomModel,
  ModelCapability,
  ModelProvider,
} from '../../../shared/stores/modelProviderStore'
import { upsertProvider, deleteModel } from '../../../shared/stores/modelProviderStore'
import styles from './ProviderEditor.module.css'

const { Text } = Typography

const ENDPOINT_OPTIONS = [
  { value: '/chat/completions', label: '/chat/completions' },
  { value: '/responses', label: '/responses' },
  { value: '/v1/chat/completions', label: '/v1/chat/completions' },
  { value: '__custom__', label: '自定义' },
]

const CAPABILITY_OPTIONS: { value: ModelCapability; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'vision', label: '视觉' },
  { value: 'tool-calling', label: '工具调用' },
  { value: 'reasoning', label: '推理' },
  { value: 'embedding', label: '向量' },
  { value: 'audio', label: '音频' },
  { value: 'video', label: '视频' },
]

const PROVIDER_ID_REGEX = /^[a-zA-Z0-9_-]+$/

interface ProviderEditorProps {
  provider: ModelProvider
  onChanged: () => void
}

export function ProviderEditor({ provider, onChanged }: ProviderEditorProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  /* ── 基本信息 ── */
  const [name, setName] = useState(provider.name)
  const [providerId, setProviderId] = useState(provider.providerId)
  const [providerIdError, setProviderIdError] = useState('')

  /* ── 连接配置 ── */
  const [apiKey, setApiKey] = useState(provider.apiKey)
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl)
  const [endpointPath, setEndpointPath] = useState(provider.endpointPath)
  const [customEndpoint, setCustomEndpoint] = useState('')

  /* ── Provider 能力 ── */
  const [providerCaps, setProviderCaps] = useState(provider.providerCapabilities)

  /* ── 模型编辑 Modal ── */
  const [modelModalOpen, setModelModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null)
  const [modelForm, setModelForm] = useState<Partial<CustomModel>>({
    name: '',
    displayName: '',
    contextWindow: 32000,
    capabilities: ['text'],
    enabled: true,
  })

  /* 同步 provider 变化 */
  useEffect(() => {
    setName(provider.name)
    setProviderId(provider.providerId)
    setApiKey(provider.apiKey)
    setBaseUrl(provider.baseUrl)
    setEndpointPath(provider.endpointPath)
    setProviderCaps(provider.providerCapabilities)
    setProviderIdError('')
  }, [provider.id, provider.updatedAt])

  /* ── 保存基本信息 ── */
  const saveBasicInfo = useCallback(() => {
    if (!name.trim()) {
      message.warning('显示名称不能为空')
      return
    }
    if (!providerId.trim()) {
      message.warning('供应商 ID 不能为空')
      return
    }
    if (!PROVIDER_ID_REGEX.test(providerId)) {
      setProviderIdError('只允许字母、数字、短横线、下划线')
      message.warning('供应商 ID 格式不正确')
      return
    }
    setProviderIdError('')
    upsertProvider({ ...provider, name, providerId, updatedAt: Date.now() })
    onChanged()
    message.success('基本信息已保存')
  }, [name, providerId, provider, onChanged, message])

  /* ── 保存连接配置 ── */
  const saveConnection = useCallback(() => {
    const ep = endpointPath === '__custom__' ? customEndpoint : endpointPath
    upsertProvider({ ...provider, apiKey, baseUrl, endpointPath: ep, updatedAt: Date.now() })
    onChanged()
    message.success('连接配置已保存')
  }, [apiKey, baseUrl, endpointPath, customEndpoint, provider, onChanged, message])

  /* ── 保存 Provider 能力 ── */
  const saveProviderCaps = useCallback(() => {
    upsertProvider({ ...provider, providerCapabilities: providerCaps, updatedAt: Date.now() })
    onChanged()
    message.success('能力配置已保存')
  }, [providerCaps, provider, onChanged, message])

  /* ── 模型操作 ── */
  const openAddModel = () => {
    setEditingModel(null)
    setModelForm({
      name: '',
      displayName: '',
      contextWindow: 32000,
      capabilities: ['text'],
      enabled: true,
    })
    setModelModalOpen(true)
  }

  const openEditModel = (m: CustomModel) => {
    setEditingModel(m)
    setModelForm({ ...m })
    setModelModalOpen(true)
  }

  const handleSaveModel = () => {
    if (!modelForm.name?.trim()) {
      message.warning('模型名称不能为空')
      return
    }
    if (!modelForm.displayName?.trim()) {
      message.warning('展示名称不能为空')
      return
    }
    const model: CustomModel = {
      id: editingModel?.id ?? `model-${Date.now()}`,
      name: modelForm.name!.trim(),
      displayName: modelForm.displayName!.trim(),
      capabilities: modelForm.capabilities ?? ['text'],
      contextWindow: modelForm.contextWindow,
      enabled: modelForm.enabled ?? true,
    }
    const updatedProvider = {
      ...provider,
      models: editingModel
        ? provider.models.map((m) => (m.id === editingModel.id ? model : m))
        : [...provider.models, model],
      updatedAt: Date.now(),
    }
    upsertProvider(updatedProvider)
    onChanged()
    setModelModalOpen(false)
    message.success(editingModel ? '模型已更新' : '模型已添加')
  }

  const handleDeleteModel = (modelId: string) => {
    deleteModel(provider.id, modelId)
    onChanged()
    message.success('模型已删除')
  }

  const handleToggleModel = (modelId: string, enabled: boolean) => {
    const updatedProvider = {
      ...provider,
      models: provider.models.map((m) => (m.id === modelId ? { ...m, enabled } : m)),
      updatedAt: Date.now(),
    }
    upsertProvider(updatedProvider)
    onChanged()
  }

  /* ── 当前 endpoint 显示值 ── */
  const isCustomEndpoint = !ENDPOINT_OPTIONS.some((o) => o.value === endpointPath)
  const endpointSelectValue = isCustomEndpoint ? '__custom__' : endpointPath

  return (
    <div>
      {/* ── 基本信息 ── */}
      <SettingsCard title="基本信息">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>显示名称</Text>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如 GeoWork Custom API"
              style={{ maxWidth: 360 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>供应商 ID</Text>
            <Input
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value)
                if (PROVIDER_ID_REGEX.test(e.target.value)) setProviderIdError('')
              }}
              placeholder="例如 custom-openai"
              status={providerIdError ? 'error' : undefined}
              style={{ maxWidth: 360 }}
            />
            {providerIdError && (
              <Text type="danger" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>
                {providerIdError}
              </Text>
            )}
          </div>
          <Button type="primary" onClick={saveBasicInfo} style={{ alignSelf: 'flex-start' }}>
            保存基本信息
          </Button>
        </div>
      </SettingsCard>

      {/* ── 连接配置 ── */}
      <SettingsCard title="连接配置">
        <Alert
          className={styles.alertRow}
          type="warning"
          showIcon
          title="本地预览阶段 API Key 仅保存在浏览器 localStorage，后续将迁移到安全存储。"
          style={{ fontSize: 12 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>API Key</Text>
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入 API Key"
              style={{ maxWidth: 460 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Base URL</Text>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              style={{ maxWidth: 460 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>端点路径</Text>
            <Space.Compact style={{ maxWidth: 460 }}>
              <Select
                value={endpointSelectValue}
                onChange={(v) => {
                  if (v === '__custom__') {
                    setEndpointPath('__custom__')
                  } else {
                    setEndpointPath(v)
                  }
                }}
                options={ENDPOINT_OPTIONS}
                style={{ width: 200 }}
              />
              {endpointSelectValue === '__custom__' && (
                <Input
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="/custom/path"
                  style={{ width: 260 }}
                />
              )}
            </Space.Compact>
          </div>
          <Space>
            <Button type="primary" onClick={saveConnection}>
              保存连接配置
            </Button>
            <Button onClick={() => message.info('连接测试功能后续接入')}>
              测试连接
            </Button>
          </Space>
        </div>
      </SettingsCard>

      {/* ── 模型列表 ── */}
      <SettingsCard title="模型列表">
        {provider.models.length === 0 ? (
          <Empty description="暂无模型，点击下方按钮添加" style={{ padding: '16px 0' }} />
        ) : (
          provider.models.map((m) => (
            <div
              key={m.id}
              className={styles.modelCard}
              style={{
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <div className={styles.modelInfo}>
                <Space size={8}>
                  <Text strong style={{ fontSize: 13 }}>{m.displayName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{m.name}</Text>
                  {m.contextWindow && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {Math.round(m.contextWindow / 1000)}K
                    </Text>
                  )}
                </Space>
                <div className={styles.capRow}>
                  {m.capabilities.map((cap) => (
                    <Tag key={cap} style={{ margin: 0, fontSize: 11 }}>
                      {CAPABILITY_OPTIONS.find((o) => o.value === cap)?.label ?? cap}
                    </Tag>
                  ))}
                </div>
              </div>
              <div className={styles.modelActions}>
                <Switch
                  size="small"
                  checked={m.enabled}
                  onChange={(checked) => handleToggleModel(m.id, checked)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditModel(m)}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteModel(m.id)}
                />
              </div>
            </div>
          ))
        )}

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          block
          onClick={openAddModel}
          style={{ marginTop: 8 }}
        >
          添加模型
        </Button>
      </SettingsCard>

      {/* ── 能力开关 ── */}
      <SettingsCard title="能力开关">
        {(Object.keys(providerCaps) as (keyof typeof providerCaps)[]).map((key) => {
          const labels: Record<string, string> = {
            imageGeneration: '图片生成能力',
            speechToText: '语音转文字能力',
            textToSpeech: '语音生成能力',
            musicGeneration: '音乐生成能力',
            videoGeneration: '视频生成能力',
          }
          return (
            <div key={key} className={styles.providerCapItem}>
              <Text style={{ fontSize: 13 }}>{labels[key]}</Text>
              <Switch
                size="small"
                checked={providerCaps[key]}
                onChange={(checked) => setProviderCaps((prev) => ({ ...prev, [key]: checked }))}
              />
            </div>
          )
        })}
        <Button type="primary" onClick={saveProviderCaps} style={{ marginTop: 8 }}>
          保存能力配置
        </Button>
      </SettingsCard>

      {/* ── 模型编辑 Modal ── */}
      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modelModalOpen}
        onCancel={() => setModelModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setModelModalOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSaveModel}>保存</Button>
          </Space>
        }
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>模型名称</Text>
            <Input
              value={modelForm.name}
              onChange={(e) => setModelForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如 gpt-4o-mini / deepseek-chat / qwen-plus"
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>展示名称</Text>
            <Input
              value={modelForm.displayName}
              onChange={(e) => setModelForm((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="例如 Qwen Plus"
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>上下文长度</Text>
            <InputNumber
              value={modelForm.contextWindow}
              onChange={(v) => setModelForm((prev) => ({ ...prev, contextWindow: v ?? undefined }))}
              min={1000}
              max={10000000}
              step={1000}
              style={{ width: '100%' }}
              addonAfter="tokens"
            />
          </div>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>能力</Text>
            <Checkbox.Group
              value={modelForm.capabilities}
              onChange={(vals) => setModelForm((prev) => ({ ...prev, capabilities: vals as ModelCapability[] }))}
              options={CAPABILITY_OPTIONS}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13 }}>启用</Text>
            <Switch
              checked={modelForm.enabled}
              onChange={(checked) => setModelForm((prev) => ({ ...prev, enabled: checked }))}
              size="small"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
