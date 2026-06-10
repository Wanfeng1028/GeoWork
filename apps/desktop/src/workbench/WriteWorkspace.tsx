// GeoWork Desktop - Write Mode Workspace

import { Layout, Card, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import styles from './WriteWorkspace.module.scss'

const { Content } = Layout
const { Title, Text } = Typography

export default function WriteWorkspace() {
  return (
    <Layout className={styles.writeWorkspace}>
      <Content className={styles.content}>
        <div className={styles.header}>
          <Title level={4}><FileTextOutlined /> 写作模式</Title>
          <Text type="secondary">报告生成、文档编辑和结果导出</Text>
        </div>

        <div className={styles.panels}>
          <Card title="文档编辑器" size="small" className={styles.panel}>
            <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}># Markdown 编辑器</pre>
          </Card>
          <Card title="工件预览" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>生成的报告和工件预览。</p>
          </Card>
          <Card title="导出选项" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>DOCX、PPTX、PDF、COG 导出。</p>
          </Card>
        </div>
      </Content>
    </Layout>
  )
}
