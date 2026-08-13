import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Dropdown,
  Modal,
  Slider,
  Space,
  Switch,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  Check,
  Zap,
  Settings,
} from 'lucide-react'
import styles from './ModelPicker.module.css'
import {
  getEnabledModels,
  type AvailableModelOption,
} from '../../../shared/stores/modelProviderStore'

const { Text } = Typography

interface ModelOption {
  key: string
  name: string
  icon: React.ReactNode
  tag?: string
  tagColor?: string
  rate?: string
}

const MODELS: ModelOption[] = [
  { key: 'auto', name: 'Auto', icon: <Zap />, tag: '推荐', tagColor: 'blue', rate: '0.5x' },
  { key: 'qwen37-max', name: 'Qwen3.7-Max', icon: <Zap />, rate: '0.25x' },
  { key: 'qwen37-plus', name: 'Qwen3.7-Plus', icon: <Zap />, rate: '0.1x' },
  { key: 'qwen36-flash', name: 'Qwen3.6-Flash', icon: <Zap />, rate: '0.1x' },
  { key: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro', icon: <Zap />, rate: '0.5x' },
  { key: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', icon: <Zap />, rate: '0.1x' },
  { key: 'glm-52', name: 'GLM-5.2', icon: <Zap />, rate: '0.6x' },
]

interface ModelPickerProps {
  model: string
  onModelChange: (model: string) => void
}

export function ModelPicker({ model, onModelChange }: ModelPickerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  /* 模型设置状态 */
  const [modelSettings, setModelSettings] = useState<Record<string, { enabled: boolean; contextLen: number }>>({
    'qwen37-max': { enabled: true, contextLen: 32000 },
    'qwen37-plus': { enabled: true, contextLen: 128000 },
    'qwen36-flash': { enabled: true, contextLen: 128000 },
    'deepseek-v4-pro': { enabled: true, contextLen: 64000 },
    'deepseek-v4-flash': { enabled: true, contextLen: 64000 },
    'glm-52': { enabled: true, contextLen: 128000 },
  })

  const handleSettingsSave = () => {
    message.success('模型设置已保存到前端状态，后续将接入持久化')
    setSettingsOpen(false)
  }

  const handleOpenSettings = () => {
    setDropdownOpen(false)
    setSettingsOpen(true)
  }

  /* ── 自定义模型 ── */
  const [customModels, setCustomModels] = useState<AvailableModelOption[]>([])

  const refreshCustomModels = () => {
    setCustomModels(getEnabledModels())
  }

  useEffect(() => {
    refreshCustomModels()
    const handleUpdate = () => refreshCustomModels()
    window.addEventListener('geowork:model-providers-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('geowork:model-providers-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  /* 模型被删/禁用时回退 Auto */
  useEffect(() => {
    if (model === 'Auto') return
    const builtInNames = MODELS.map((m) => m.name)
    const customIds = customModels.map((m) => m.id)
    const allValid = [...builtInNames, ...customIds]
    if (!allValid.includes(model)) {
      onModelChange('Auto')
    }
  }, [model, customModels, onModelChange])

  /** 解析 model value → 显示名 */
  const resolveDisplayName = (value: string): string => {
    if (value === 'Auto') return 'Auto'
    const builtIn = MODELS.find((m) => m.name === value)
    if (builtIn) return builtIn.name
    const custom = customModels.find((m) => m.id === value)
    if (custom) return custom.displayName
    return 'Auto'
  }

  const dropdownContent = (
    <div
      className={styles.pickerContent}
      style={{ background: token.colorBgElevated, boxShadow: token.boxShadowSecondary }}
    >
      <div className={styles.pickerAlert}>
        <Alert
          type="info"
          showIcon
          title="当前为前端模型选择占位，后续接入真实模型网关"
          style={{ fontSize: 12 }}
        />
      </div>

      <div className={styles.modelList}>
        {/* 内置模型 */}
        <div style={{ padding: '4px 12px 2px' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>内置模型</Text>
        </div>
        {MODELS.map((m) => {
          const isSelected = model === m.name
          return (
            <div
              key={m.key}
              className={styles.modelItem}
              style={{
                background: isSelected ? token.colorFillSecondary : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = token.colorFillTertiary
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent'
              }}
              onClick={() => {
                onModelChange(m.name)
                setDropdownOpen(false)
                message.info(`已切换到：${m.name}`)
              }}
            >
              <span className={styles.modelItemIcon} style={{ color: token.colorTextSecondary }}>
                {m.icon}
              </span>
              <span className={styles.modelItemName}>
                <Text style={{ color: token.colorText }}>{m.name}</Text>
              </span>
              <span className={styles.modelItemMeta}>
                <Space size={4}>
                  {m.tag && <Tag color={m.tagColor} style={{ margin: 0, fontSize: 11 }}>{m.tag}</Tag>}
                  {m.rate && <Text type="secondary" style={{ fontSize: 11 }}>{m.rate}</Text>}
                  {isSelected && <Check style={{ color: token.colorPrimary }} />}
                </Space>
              </span>
            </div>
          )
        })}

        {/* 自定义模型 */}
        {customModels.length > 0 && (
          <>
            <div style={{ padding: '8px 12px 2px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <Text type="secondary" style={{ fontSize: 11 }}>自定义模型</Text>
            </div>
            {customModels.map((cm) => {
              const isSelected = model === cm.id
              return (
                <div
                  key={cm.id}
                  className={styles.modelItem}
                  style={{
                    background: isSelected ? token.colorFillSecondary : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = token.colorFillTertiary
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                  onClick={() => {
                    onModelChange(cm.id)
                    setDropdownOpen(false)
                    message.info(`已切换到：${cm.displayName}`)
                  }}
                >
                  <span className={styles.modelItemIcon} style={{ color: token.colorTextSecondary }}>
                    <Zap />
                  </span>
                  <span className={styles.modelItemName}>
                    <Text style={{ color: token.colorText, fontSize: 13 }}>{cm.displayName}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {cm.providerName} · {cm.modelName}
                    </Text>
                  </span>
                  <span className={styles.modelItemMeta}>
                    <Space size={4}>
                      <Tag style={{ margin: 0, fontSize: 11 }}>自定义</Tag>
                      {isSelected && <Check style={{ color: token.colorPrimary }} />}
                    </Space>
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div
        style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        className={styles.pickerFooter}
      >
        <Button
          type="text"
          icon={<Settings />}
          block
          onClick={handleOpenSettings}
        >
          模型设置
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Dropdown
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        popupRender={() => dropdownContent}
        trigger={['click']}
        placement="topRight"
        getPopupContainer={() => document.body}
      >
        <Button color="primary" variant="solid" size="small" shape="round" className={styles.modelButton}>
          <Space size={4}>
            <Zap />
            {resolveDisplayName(model)}
          </Space>
        </Button>
      </Dropdown>

      <Modal
        title="模型设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSettingsSave}>保存</Button>
          </Space>
        }
        width={560}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          设置模型在选择器中的显示与隐藏，以及上下文长度
        </Text>

        {MODELS.filter((m) => m.key !== 'auto').map((m) => {
          const key = m.key
          const setting = modelSettings[key] ?? { enabled: true, contextLen: 64000 }
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <span style={{ width: 20, textAlign: 'center', color: token.colorTextSecondary }}>
                {m.icon}
              </span>
              <Text style={{ flex: '0 0 140px', fontSize: 13 }}>{m.name}</Text>
              <Switch
                size="small"
                checked={setting.enabled}
                onChange={(checked) => {
                  setModelSettings((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], enabled: checked },
                  }))
                }}
              />
              <Slider
                style={{ flex: 1 }}
                min={8000}
                max={1000000}
                step={8000}
                value={setting.contextLen}
                onChange={(val) => {
                  setModelSettings((prev) => ({
                    ...prev,
                    [key]: { ...prev[key], contextLen: val },
                  }))
                }}
                tooltip={{ formatter: (v) => v ? `${Math.round(v / 1000)}K` : '' }}
              />
            </div>
          )
        })}
      </Modal>
    </>
  )
}
