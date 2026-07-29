import { Card, Tag, Typography } from 'antd'
import { theme } from 'antd'
import type { WorkspaceTemplate } from '../settingsMockData'
import styles from './WorkspaceTemplateCard.module.css'

const { Text } = Typography

interface WorkspaceTemplateCardProps {
  template: WorkspaceTemplate
}

export function WorkspaceTemplateCard({ template }: WorkspaceTemplateCardProps) {
  const { token } = theme.useToken()

  return (
    <Card
      className={styles.root}
      size="small"
      styles={{ body: { padding: 0 } }}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {/* 缩略图占位 */}
      <div
        className={styles.thumbnail}
        style={{
          background: `linear-gradient(135deg, ${template.color}22, ${template.color}44)`,
          color: template.color,
        }}
      >
        {template.title.charAt(0)}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Text className={styles.title}>{template.title}</Text>
        </div>
        <Text type="secondary" className={styles.description}>
          {template.description}
        </Text>
        <div className={styles.footer}>
          <span className={styles.colorDot} style={{ background: template.color }} />
          <Tag variant="filled">内置</Tag>
        </div>
      </div>
    </Card>
  )
}
