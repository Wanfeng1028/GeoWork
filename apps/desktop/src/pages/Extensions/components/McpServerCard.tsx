import { Avatar, Button, Card, Space, Tag, Typography, theme } from 'antd'
import {
  Plus,
  Check,
  Cable,
} from 'lucide-react'
import type { McpServerItem } from '../mcpMockData'
import styles from './McpServerCard.module.css'

const { Text, Paragraph } = Typography

type McpServerCardProps = {
  server: McpServerItem
  onConnect: (server: McpServerItem) => void
}

export function McpServerCard({ server, onConnect }: McpServerCardProps) {
  const { token } = theme.useToken()

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (server.connected) {
      return
    }
    onConnect(server)
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
            icon={<Cable />}
          />
          <div className={styles.nameBlock}>
            <Text strong className={styles.name}>{server.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{server.slug}</Text>
          </div>
        </div>
        <div className={styles.headerRight}>
          {server.connected ? (
            <Tag icon={<Check />} color="success">已连接</Tag>
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
        {server.description}
      </Paragraph>

      {/* 底部 */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <Tag style={{ margin: 0, fontSize: 11 }}>{server.transport}</Tag>
          <Tag style={{ margin: 0, fontSize: 11 }}>{server.category}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>{server.tools.length} 个工具</Text>
        </div>
        <Space size="small">
          {server.downloads && (
            <Text type="secondary" style={{ fontSize: 11 }}>{server.downloads}</Text>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>{server.version}</Text>
        </Space>
      </div>
    </Card>
  )
}