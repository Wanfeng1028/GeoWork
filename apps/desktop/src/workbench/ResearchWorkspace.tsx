// GeoWork Desktop - Research Mode Workspace

import { Layout, Card, Typography, Empty } from 'antd'
import { FileTextOutlined, SearchOutlined, CloudOutlined } from '@ant-design/icons'
import styles from './ResearchWorkspace.module.scss'

const { Content } = Layout
const { Title, Text } = Typography

export default function ResearchWorkspace() {
  return (
    <Layout className={styles.researchWorkspace}>
      <Content className={styles.content}>
        <div className={styles.header}>
          <Title level={4}><FileTextOutlined /> 研究模式</Title>
          <Text type="secondary">文献搜索、知识索引和学术分析</Text>
        </div>

        <div className={styles.panels}>
          <Card title="知识索引" size="small" className={styles.panel}>
            <Empty description="暂无索引数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
          <Card title="论文搜索" size="small" className={styles.panel}>
            <Empty description="搜索论文和学术资源" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
          <Card title="文献矩阵" size="small" className={styles.panel}>
            <Empty description="文献对比矩阵" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </Card>
        </div>
      </Content>
    </Layout>
  )
}
