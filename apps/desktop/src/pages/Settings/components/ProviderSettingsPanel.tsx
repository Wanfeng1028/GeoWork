import { useCallback, useState } from 'react'
import {
  App,
  Button,
  Empty,
  Switch,
  Typography,
  theme,
} from 'antd'
import {
  PlusOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import { SettingsSection } from './SettingsSection'
import { ProviderCard } from './ProviderCard'
import { ProviderEditor } from './ProviderEditor'
import {
  loadModelProviders,
  saveModelProviders,
  upsertProvider,
  deleteProvider,
  type ModelProvider,
} from '../../../shared/stores/modelProviderStore'
import styles from './ProviderSettingsPanel.module.css'

const { Text } = Typography

export function ProviderSettingsPanel() {
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()

  const [data, setData] = useState(() => loadModelProviders())
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.providers[0]?.id ?? null,
  )

  const refresh = useCallback(() => {
    setData(loadModelProviders())
  }, [])

  const selectedProvider = data.providers.find((p) => p.id === selectedId) ?? null

  /* ── 添加供应商 ── */
  const handleAdd = () => {
    const newProvider: ModelProvider = {
      id: `provider-${Date.now()}`,
      name: '自定义供应商',
      providerId: `custom-${Date.now()}`,
      apiKey: '',
      baseUrl: '',
      endpointPath: '/chat/completions',
      enabled: true,
      isDefault: false,
      models: [],
      providerCapabilities: {
        imageGeneration: false,
        speechToText: false,
        textToSpeech: false,
        musicGeneration: false,
        videoGeneration: false,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    upsertProvider(newProvider)
    setSelectedId(newProvider.id)
    refresh()
    message.success('已添加新供应商')
  }

  /* ── 切换启用 ── */
  const handleToggleEnabled = (id: string, enabled: boolean) => {
    const provider = data.providers.find((p) => p.id === id)
    if (!provider) return
    upsertProvider({ ...provider, enabled, updatedAt: Date.now() })
    refresh()
  }

  /* ── 删除供应商 ── */
  const handleDelete = (id: string) => {
    const provider = data.providers.find((p) => p.id === id)
    modal.confirm({
      title: '确认删除供应商？',
      content: provider?.name ?? '',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteProvider(id)
        if (selectedId === id) {
          const remaining = data.providers.filter((p) => p.id !== id)
          setSelectedId(remaining[0]?.id ?? null)
        }
        refresh()
        message.success('供应商已删除')
      },
    })
  }

  /* ── 代理设置 ── */
  const handleProxyToggle = (checked: boolean) => {
    const newData = { ...data, useProxy: checked }
    saveModelProviders(newData)
    setData(newData)
  }

  const handleProxyUrlChange = (url: string) => {
    const newData = { ...data, proxyUrl: url }
    saveModelProviders(newData)
    setData(newData)
  }

  return (
    <SettingsSection title="供应商" subtitle="管理模型供应商、自定义 API、默认模型和 AI 助手能力。">
      {/* ── 模型请求代理 ── */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: data.useProxy ? 8 : 0 }}>
          <Text style={{ fontSize: 13 }}>模型请求使用代理</Text>
          <Switch size="small" checked={data.useProxy} onChange={handleProxyToggle} />
        </div>
        {data.useProxy && (
          <input
            value={data.proxyUrl}
            onChange={(e) => handleProxyUrlChange(e.target.value)}
            placeholder="http://127.0.0.1:7890"
            style={{
              width: '100%',
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${token.colorBorder}`,
              background: token.colorBgContainer,
              color: token.colorText,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* ── 供应商列表 + 编辑器 ── */}
      <div className={styles.root}>
        <div className={styles.providerList}>
          {data.providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isSelected={selectedId === p.id}
              onSelect={setSelectedId}
              onToggleEnabled={handleToggleEnabled}
              onDelete={handleDelete}
            />
          ))}
          <Button
            className={styles.addBtn}
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加供应商
          </Button>
        </div>

        <div className={styles.editorArea}>
          {selectedProvider ? (
            <ProviderEditor provider={selectedProvider} onChanged={refresh} />
          ) : (
            <Empty
              image={<CloudServerOutlined style={{ fontSize: 48, color: token.colorTextQuaternary }} />}
              description="暂无供应商，请添加"
            />
          )}
        </div>
      </div>
    </SettingsSection>
  )
}
