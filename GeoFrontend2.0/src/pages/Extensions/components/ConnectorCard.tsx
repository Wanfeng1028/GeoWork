import { Avatar, Button, Card, Tag, Typography, theme } from 'antd'
import {
  PlusOutlined,
  CheckOutlined,
  CloudOutlined,
  ApiOutlined,
  HomeOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  MessageOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import type { ConnectorItem } from '../connectorsMockData'
import { AUTH_TYPE_LABELS } from '../connectorsMockData'
import styles from './ConnectorCard.module.css'

const { Text, Paragraph } = Typography

/* 按 slug 映射图标 */
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

interface ConnectorCardProps {
  connector: ConnectorItem
  onConnect: (id: string) => void
}

export function ConnectorCard({ connector, onConnect }: ConnectorCardProps) {
  const { token } = theme.useToken()

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!connector.connected) {
      onConnect(connector.id)
    } else {
      /* 已连接：提示 */
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
            style={{
              background: connector.connected ? token.colorSuccessBg : token.colorPrimaryBg,
              color: connector.connected ? token.colorSuccess : token.colorPrimary,
            }}
          >
            {ICON_MAP[connector.slug] ?? <LinkOutlined />}
          </Avatar>
          <div className={styles.nameBlock}>
            <Text strong className={styles.name}>{connector.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{connector.slug}</Text>
          </div>
        </div>
        <div className={styles.headerRight}>
          {connector.connected ? (
            <Tag icon={<CheckOutlined />} color="success" style={{ margin: 0 }}>已连接</Tag>
          ) : (
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
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
        style={{ fontSize: 13 }}
      >
        {connector.description}
      </Paragraph>

      {/* 底部 */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <Tag style={{ margin: 0, fontSize: 11 }}>{AUTH_TYPE_LABELS[connector.authType]}</Tag>
          <Tag style={{ margin: 0, fontSize: 11 }}>{connector.category}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {connector.capabilities.length} 项能力
          </Text>
        </div>
        <div className={styles.footerRight}>
          {connector.downloads && (
            <Text type="secondary" style={{ fontSize: 11 }}>{connector.downloads}</Text>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>{connector.version}</Text>
        </div>
      </div>
    </Card>
  )
}
