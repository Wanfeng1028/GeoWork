// GeoWork Desktop - Data Mode Workspace

import { Layout, Card, Typography } from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'
import styles from './DataWorkspace.module.scss'

const { Content } = Layout
const { Title, Text } = Typography

export default function DataWorkspace() {
  return (
    <Layout className={styles.dataWorkspace}>
      <Content className={styles.content}>
        <div className={styles.header}>
          <Title level={4}><DatabaseOutlined /> 数据模式</Title>
          <Text type="secondary">数据集管理、注册和元数据浏览</Text>
        </div>

        <div className={styles.panels}>
          <Card title="数据集列表" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>数据集列表将在此显示。前往数据中心管理数据集。</p>
          </Card>
          <Card title="元数据详情" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>选择数据集查看元数据详情。</p>
          </Card>
          <Card title="数据预览" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>栅格/矢量数据预览区域。</p>
          </Card>
        </div>
      </Content>
    </Layout>
  )
}
