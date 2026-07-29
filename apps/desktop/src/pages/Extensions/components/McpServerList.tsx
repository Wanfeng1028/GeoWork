import { useState } from 'react'
import { App, Avatar, Button, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd'
import {
  ApiOutlined,
  SettingOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { McpServerItem } from '../mcpMockData'
import styles from './McpServerList.module.css'

const { Text } = Typography

type McpServerListProps = {
  servers: McpServerItem[]
  mode: 'builtin' | 'connected'
  onToggleEnabled: (id: string, enabled: boolean) => void
  onConfigure?: (server: McpServerItem) => void
  onDisconnect?: (id: string) => void
  onReset?: (id: string) => void
}

const statusColorMap: Record<string, string> = {
  connected: 'success',
  disabled: 'default',
  error: 'error',
  'not-connected': 'warning',
}

export function McpServerList({
  servers,
  mode,
  onToggleEnabled,
  onConfigure,
  onDisconnect,
  onReset,
}: McpServerListProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div>
      {servers.map((server) => {
        const isHovered = hoveredId === server.id
        const isBuiltin = server.source === 'built-in'

        return (
          <div
            key={server.id}
            className={styles.listItem}
            style={{
              '--hover-bg': token.colorFillQuaternary,
              borderColor: token.colorBorderSecondary,
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredId(server.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className={styles.itemContent}>
              <div className={styles.itemLeft}>
                <Avatar
                  size={28}
                  style={{ background: token.colorPrimary, flexShrink: 0 }}
                  icon={<ApiOutlined />}
                />
                <div className={styles.itemInfo}>
                  <div className={styles.itemNameRow}>
                    <Text strong style={{ fontSize: 13 }}>{server.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {server.slug}
                    </Text>
                    {isBuiltin && (
                      <Tag style={{ fontSize: 10 }}>内置</Tag>
                    )}
                    {server.source === 'local' && (
                      <Tag style={{ fontSize: 10 }}>本地</Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {server.description}
                  </Text>
                </div>
              </div>

              <div className={styles.itemRight}>
                {mode === 'connected' && (
                  <>
                    <Tag color={statusColorMap[server.status] ?? 'default'} style={{ fontSize: 11 }}>
                      {server.status === 'connected' ? '已连接' : server.status === 'disabled' ? '已禁用' : server.status === 'error' ? '错误' : '未连接'}
                    </Tag>
                    <Tag style={{ fontSize: 11 }}>{server.transport}</Tag>
                  </>
                )}
                {mode === 'builtin' && (
                  <Tag style={{ fontSize: 11 }}>{server.transport}</Tag>
                )}

                {mode === 'connected' && !isBuiltin && (
                  <Space
                    size={4}
                    style={{
                      opacity: isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <Tooltip title="配置">
                      <Button
                        type="text"
                        size="small"
                        icon={<SettingOutlined />}
                        onClick={() => onConfigure?.(server)}
                      />
                    </Tooltip>
                    <Tooltip title="断开连接">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DisconnectOutlined />}
                        onClick={() => onDisconnect?.(server.id)}
                      />
                    </Tooltip>
                    <Tooltip title="重置">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => onReset?.(server.id)}
                      />
                    </Tooltip>
                    <Tooltip title="查看说明">
                      <Button
                        type="text"
                        size="small"
                        icon={<InfoCircleOutlined />}
                        onClick={() => message.info('MCP 说明后续接入')}
                      />
                    </Tooltip>
                  </Space>
                )}
                {mode === 'builtin' && (
                  <span
                    style={{
                      opacity: isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <Tooltip title="查看说明">
                      <Button
                        type="text"
                        size="small"
                        icon={<InfoCircleOutlined />}
                        onClick={() => message.info('MCP 说明后续接入')}
                      />
                    </Tooltip>
                  </span>
                )}
                <Switch
                  checked={server.enabled}
                  size="small"
                  onChange={(checked) => onToggleEnabled(server.id, checked)}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
