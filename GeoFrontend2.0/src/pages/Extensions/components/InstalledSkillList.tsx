import { useState } from 'react'
import { App, Avatar, Button, List, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd'
import {
  RadarChartOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { SkillItem } from '../skillsMockData'
import styles from './InstalledSkillList.module.css'

const { Text } = Typography

type InstalledSkillListProps = {
  skills: SkillItem[]
  mode: 'builtin' | 'installed'
  onToggleEnabled: (id: string, enabled: boolean) => void
  onUninstall?: (id: string) => void
  onReset?: (id: string) => void
}

export function InstalledSkillList({
  skills,
  mode,
  onToggleEnabled,
  onUninstall,
  onReset,
}: InstalledSkillListProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <List
      className={styles.list}
      dataSource={skills}
      renderItem={(skill) => {
        const isHovered = hoveredId === skill.id
        const isBuiltin = skill.source === 'built-in'

        return (
          <List.Item
            className={styles.item}
            style={{
              '--hover-bg': token.colorFillQuaternary,
              borderColor: token.colorBorderSecondary,
            } as React.CSSProperties}
            onMouseEnter={() => setHoveredId(skill.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className={styles.itemContent}>
              <div className={styles.itemLeft}>
                <Avatar
                  size={28}
                  style={{ background: token.colorPrimary, flexShrink: 0 }}
                  icon={<RadarChartOutlined />}
                />
                <div className={styles.itemInfo}>
                  <div className={styles.itemNameRow}>
                    <Text strong style={{ fontSize: 13 }}>{skill.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                      {skill.slug}
                    </Text>
                    {isBuiltin && (
                      <Tag style={{ marginLeft: 6, fontSize: 10 }}>内置</Tag>
                    )}
                    {skill.source === 'local' && (
                      <Tag style={{ marginLeft: 6, fontSize: 10 }}>本地</Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {skill.description}
                  </Text>
                </div>
              </div>

              <div className={styles.itemRight}>
                {mode === 'installed' && !isBuiltin && (
                  <Space
                    size={4}
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
                        onClick={() => message.info('技能说明后续接入')}
                      />
                    </Tooltip>
                    <Tooltip title="重置">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => onReset?.(skill.id)}
                      />
                    </Tooltip>
                    <Tooltip title="卸载">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => onUninstall?.(skill.id)}
                      />
                    </Tooltip>
                  </Space>
                )}
                <Switch
                  checked={skill.enabled}
                  size="small"
                  onChange={(checked) => onToggleEnabled(skill.id, checked)}
                />
              </div>
            </div>
          </List.Item>
        )
      }}
    />
  )
}
