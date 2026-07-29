import { Alert, Card, Space, Typography } from 'antd'
import styles from './WorkspacePage.module.css'

const { Title, Text } = Typography

export function WorkspacePage() {
  return (
    <div className={styles.root}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Workspace</Title>
        <Text type="secondary">地图工作台、图层树、空间分析</Text>

        <Card title="当前阶段">
          <Text>路由占位 — 等待 MapLibre / deck.gl 接入</Text>
        </Card>

        <Alert type="info" showIcon title="此页面为路由占位，尚未接入地图能力。" />
      </Space>
    </div>
  )
}
