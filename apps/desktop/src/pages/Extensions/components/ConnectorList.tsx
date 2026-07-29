import { App, Avatar, Button, Switch, Tag, Typography, theme } from 'antd'
import {
  CloudOutlined,
  ApiOutlined,
  HomeOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  MessageOutlined,
  LinkOutlined,
  SettingOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import type { ConnectorItem, ConnectorStatus } from '../connectorsMockData'
import { AUTH_TYPE_LABELS } from '../connectorsMockData'
import styles from './ConnectorList.module.css'

const { Text } = Typography

const ICON_MAP: Record<string, React.ReactNode> = {
  'google-workspace': <CloudOutlined />,
  'microsoft-365': <ApiOutlined />,
  'geowork-internal': <HomeOutlined />,
  'browser-context': <GlobalOutlined />,
  'arcgis-online': <CloudServerOutlined />,
  geoserver: <CloudServerOutlined />,
  'postgis-database': <DatabaseOutlined />,
  'google-earth-engine': <CloudOutlined />,
  'amap-open-platform': <GlobalOutlined />,
  wecom: <MessageOutlined />,
  lark: <MessageOutlined />,
  dingtalk: <MessageOutlined />,
  'geowork-workdir': <HomeOutlined />,
  'geowork-datacenter': <DatabaseOutlined />,
  'geowork-map-context': <GlobalOutlined />,
  'geowork-task-center': <LinkOutlined />,
}

const STATUS_MAP: Record<ConnectorStatus, { label: string; color: string }> = {
  connected: { label: '已连接', color: 'success' },
  'not-connected': { label: '未连接', color: 'default' },
  disabled: { label: '已禁用', color: 'default' },
  expired: { label: '已过期', color: 'warning' },
  error: { label: '错误', color: 'error' },
}

type ConnectorListMode = 'connected' | 'builtin'

interface ConnectorListProps {
  connectors: ConnectorItem[]
  mode: ConnectorListMode
  onConfig: (id: string) => void
  onDisconnect: (id: string) => void
  onReset: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

export function ConnectorList({
  connectors,
  mode,
  onConfig,
  onDisconnect,
  onReset,
  onToggleEnabled,
}: ConnectorListProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  if (connectors.length === 0) {
    return null
  }

  return (
    <>
      {connectors.map((c) => {
        const isBuiltIn = c.source === 'built-in' || c.id === 'geowork-internal'
        const statusInfo = STATUS_MAP[c.status]
        return (
          <div
            key={c.id}
            className={styles.row}
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div className={styles.rowLeft}>
              <Avatar
                size={32}
                style={{
                  background: c.connected ? token.colorSuccessBg : token.colorFillSecondary,
                  color: c.connected ? token.colorSuccess : token.colorTextSecondary,
                }}
              >
                {ICON_MAP[c.slug] ?? <LinkOutlined />}
              </Avatar>
              <div className={styles.rowInfo}>
                <Text strong className={styles.rowName}>{c.name}</Text>
                <Text type="secondary" className={styles.rowDesc}>{c.description}</Text>
              </div>
            </div>

            <div className={styles.rowRight}>
              <Tag color={statusInfo.color} style={{ margin: 0, fontSize: 11 }}>
                {statusInfo.label}
              </Tag>
              <Tag style={{ margin: 0, fontSize: 11 }}>
                {AUTH_TYPE_LABELS[c.authType]}
              </Tag>

              {mode === 'connected' && (
                <>
                  <Switch
                    size="small"
                    checked={c.enabled}
                    onChange={(checked, e) => {
                      e.stopPropagation()
                      onToggleEnabled(c.id, checked)
                    }}
                    onClick={(_, e) => e.stopPropagation()}
                  />
                  <div className={styles.rowActions}>
                    <Button
                      type="text"
                      size="small"
                      icon={<SettingOutlined />}
                      onClick={() => onConfig(c.id)}
                    />
                    {!isBuiltIn && (
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DisconnectOutlined />}
                        onClick={() => onDisconnect(c.id)}
                      />
                    )}
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => onReset(c.id)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => message.info(`${c.name} 说明功能后续接入`)}
                    />
                  </div>
                </>
              )}

              {mode === 'builtin' && (
                <>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {c.capabilities.length} 项能力
                  </Text>
                  <Tag style={{ margin: 0, fontSize: 11 }}>
                    {AUTH_TYPE_LABELS[c.authType]}
                  </Tag>
                  <Switch
                    size="small"
                    checked={c.enabled}
                    onChange={(checked, e) => {
                      e.stopPropagation()
                      onToggleEnabled(c.id, checked)
                    }}
                    onClick={(_, e) => e.stopPropagation()}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => message.info(`${c.name} 说明功能后续接入`)}
                  />
                </>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
