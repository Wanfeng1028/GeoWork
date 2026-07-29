import { Button, Switch, Tag, Typography } from 'antd'
import { CloudServerOutlined, DeleteOutlined } from '@ant-design/icons'
import { theme } from 'antd'
import type { ModelProvider } from '../../../shared/stores/modelProviderStore'
import styles from './ProviderCard.module.css'

const { Text } = Typography

interface ProviderCardProps {
  provider: ModelProvider
  isSelected: boolean
  onSelect: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}

export function ProviderCard({ provider, isSelected, onSelect, onToggleEnabled, onDelete }: ProviderCardProps) {
  const { token } = theme.useToken()

  return (
    <div
      className={styles.root}
      style={{
        background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
        borderColor: isSelected ? token.colorPrimaryBorder : token.colorBorderSecondary,
      }}
      onClick={() => onSelect(provider.id)}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = token.colorFillTertiary
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = token.colorBgContainer
      }}
    >
      <div className={styles.header}>
        <span className={styles.name}>
          <CloudServerOutlined style={{ marginRight: 6, color: token.colorTextSecondary }} />
          <Text style={{ fontSize: 13 }}>{provider.name}</Text>
        </span>
        <span className={styles.tags}>
          {provider.isDefault && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>默认</Tag>}
        </span>
      </div>
      <div className={styles.meta}>
        <Text type="secondary" style={{ fontSize: 12 }}>{provider.providerId}</Text>
        <Tag style={{ margin: 0, fontSize: 11 }}>{provider.models.length} 模型</Tag>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {provider.enabled ? '已启用' : '已禁用'}
        </Text>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
            onClick={(e) => { e.stopPropagation(); onDelete(provider.id) }}
            style={{ width: 20, height: 20, minWidth: 20, padding: 0 }}
          />
          <Switch
            size="small"
            checked={provider.enabled}
            onChange={(checked, e) => {
              e.stopPropagation()
              onToggleEnabled(provider.id, checked)
            }}
            onClick={(_, e) => e.stopPropagation()}
          />
        </span>
      </div>
    </div>
  )
}
