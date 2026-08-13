import { App, Avatar, Button, Switch, Tag, Typography, theme } from 'antd'
import {
  Cloud,
  Cable,
  Home,
  Globe,
  Server,
  Database,
  MessageSquare,
  Link,
  Settings,
  Unlink,
  RotateCw,
  FileText,
} from 'lucide-react'
import type { ConnectorItem, ConnectorStatus } from '../connectorsMockData'
import { AUTH_TYPE_LABELS } from '../connectorsMockData'
import styles from './ConnectorList.module.css'

const { Text } = Typography

const ICON_MAP: Record<string, React.ReactNode> = {
  'google-workspace': <Cloud />,
  'microsoft-365': <Cable />,
  'geowork-internal': <Home />,
  'browser-context': <Globe />,
  'arcgis-online': <Server />,
  geoserver: <Server />,
  'postgis-database': <Database />,
  'google-earth-engine': <Cloud />,
  'amap-open-platform': <Globe />,
  wecom: <MessageSquare />,
  lark: <MessageSquare />,
  dingtalk: <MessageSquare />,
  'geowork-workdir': <Home />,
  'geowork-datacenter': <Database />,
  'geowork-map-context': <Globe />,
  'geowork-task-center': <Link />,
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
                {ICON_MAP[c.slug] ?? <Link />}
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
                      icon={<Settings />}
                      onClick={() => onConfig(c.id)}
                    />
                    {!isBuiltIn && (
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Unlink />}
                        onClick={() => onDisconnect(c.id)}
                      />
                    )}
                    <Button
                      type="text"
                      size="small"
                      icon={<RotateCw />}
                      onClick={() => onReset(c.id)}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<FileText />}
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
                    icon={<FileText />}
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