import { Alert, Card, Space, Typography } from 'antd'
import styles from './DataCenterPage.module.css'

const { Title, Text } = Typography

export function DataCenterPage() {
  return (
    <div className={styles.root}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>DataCenter</Title>
        <Text type="secondary">数据资产、图层管理、文件导入导出</Text>

        <Card title="当前阶段">
          <Text>路由占位 — 等待数据管理功能接入</Text>
        </Card>

        <Alert type="info" showIcon title="此页面为路由占位，尚未接入数据管理。" />
      </Space>
    </div>
  )
}
