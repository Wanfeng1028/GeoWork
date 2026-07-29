import { Card, Space, Typography, Empty } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import styles from './DashboardPage.module.css'

const { Title, Text } = Typography

export function DashboardPage() {
  return (
    <div className={styles.root}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <HomeOutlined style={{ marginRight: 8 }} />
            GeoWork 工作台
          </Title>
          <Text type="secondary">从左侧新任务开始，创建空间智能工作流。</Text>
        </div>

        <Card>
          <Empty description="暂无工作台内容" />
        </Card>
      </Space>
    </div>
  )
}
