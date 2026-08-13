import { App, Avatar, Button, Dropdown, Space, Switch, Tag, Typography, theme } from 'antd'
import type { MenuProps } from 'antd'
import {
  Pencil,
  Bell,
  Info,
  Unlink,
} from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './MobileChannelCard.module.css'

const { Text, Paragraph } = Typography

export type ChannelStatus = 'unconfigured' | 'connected' | 'failed' | 'local'

export interface MobileChannel {
  key: string
  name: string
  description: string
  icon: ReactNode
  status: ChannelStatus
  errorMessage?: string
  enabled?: boolean
}

interface MobileChannelCardProps {
  channel: MobileChannel
  onConfig: (channel: MobileChannel) => void
  onToggle: (key: string, enabled: boolean) => void
  onRebind: (channel: MobileChannel) => void
  onDisconnect?: (key: string) => void
}

const statusMap: Record<ChannelStatus, { label: string; color: string }> = {
  unconfigured: { label: '未配置', color: 'default' },
  connected: { label: '已连接', color: 'success' },
  failed: { label: '连接失败', color: 'error' },
  local: { label: '本地模式', color: 'processing' },
}

export function MobileChannelCard({ channel, onConfig, onToggle, onRebind, onDisconnect }: MobileChannelCardProps) {
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()

  const statusInfo = (() => {
    if (channel.status === 'connected' && !channel.enabled) {
      return { label: '已停用', color: 'warning' }
    }
    return statusMap[channel.status]
  })()

  const moreMenuItems: MenuProps['items'] = [
    {
      key: 'rebind',
      icon: <Pencil />,
      label: '重新绑定',
      onClick: () => onRebind(channel),
    },
    {
      key: 'test',
      icon: <Bell />,
      label: '测试通知',
      onClick: () => message.info('测试通知后续接入'),
    },
    {
      key: 'help',
      icon: <Info />,
      label: '查看说明',
      onClick: () => message.info('移动端控制说明后续接入'),
    },
    { type: 'divider' },
    {
      key: 'disconnect',
      icon: <Unlink />,
      label: '断开连接',
      danger: true,
      onClick: () => {
        modal.confirm({
          title: '确认断开',
          content: `确定要断开"${channel.name}"的移动端控制连接吗？`,
          okText: '断开',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => onDisconnect?.(channel.key),
        })
      },
    },
  ]

  return (
    <div
      className={styles.cardRow}
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
      }}
    >
      {/* 左侧头像 */}
      <div className={styles.avatarWrap}>
        <Avatar
          size={40}
          style={{
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: 20,
          }}
          icon={channel.icon}
        />
      </div>

      {/* 中间信息 */}
      <div className={styles.infoBlock}>
        <div className={styles.nameRow}>
          <Text strong>{channel.name}</Text>
          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
        </div>
        <Paragraph
          className={styles.description}
          type="secondary"
          ellipsis={{ rows: 1 }}
        >
          {channel.description}
        </Paragraph>
        {channel.status === 'failed' && channel.errorMessage && (
          <div className={styles.errorHint}>
            <Text type="danger" style={{ fontSize: 12 }}>
              {channel.errorMessage}
            </Text>
          </div>
        )}
      </div>

      {/* 右侧操作 */}
      <div className={styles.actions}>
        {channel.status === 'unconfigured' && (
          <Button size="small" onClick={() => onConfig(channel)}>
            配置
          </Button>
        )}
        {(channel.status === 'connected' || channel.status === 'failed') && (
          <Space size={4}>
            <Switch
              size="small"
              checked={channel.enabled}
              onChange={(checked) => onToggle(channel.key, checked)}
            />
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
              <Button type="text" size="small" icon={<MoreDots />} />
            </Dropdown>
          </Space>
        )}
      </div>
    </div>
  )
}

/* 内联 More 图标，避免额外导入 */
function MoreDots() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}