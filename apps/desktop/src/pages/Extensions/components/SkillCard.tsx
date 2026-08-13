import { Avatar, Button, Card, Space, Tag, Typography, theme } from 'antd'
import {
  Plus,
  Check,
  Network,
} from 'lucide-react'
import type { SkillItem } from '../skillsMockData'
import styles from './SkillCard.module.css'

const { Text, Paragraph } = Typography

type SkillCardProps = {
  skill: SkillItem
  onInstall: (id: string) => void
}

export function SkillCard({ skill, onInstall }: SkillCardProps) {
  const { token } = theme.useToken()

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!skill.installed) {
      onInstall(skill.id)
    }
  }

  return (
    <Card
      hoverable
      className={styles.card}
      style={{
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      }}
    >
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Avatar
            size={32}
            style={{ background: token.colorPrimary }}
            icon={<Network />}
          />
          <div className={styles.nameBlock}>
            <Text strong className={styles.name}>{skill.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{skill.slug}</Text>
          </div>
        </div>
        <div className={styles.headerRight}>
          {skill.installed ? (
            <Tag icon={<Check />} color="success">已安装</Tag>
          ) : (
            <Button
              type="text"
              size="small"
              icon={<Plus />}
              onClick={handleAction}
            />
          )}
        </div>
      </div>

      {/* 描述 */}
      <Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        className={styles.description}
      >
        {skill.description}
      </Paragraph>

      {/* 底部 */}
      <div className={styles.footer}>
        <Space size="small">
          {skill.downloads && (
            <Text type="secondary" style={{ fontSize: 11 }}>{skill.downloads}</Text>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>{skill.version}</Text>
        </Space>
        <Tag style={{ margin: 0, fontSize: 11 }}>{skill.category}</Tag>
      </div>
    </Card>
  )
}