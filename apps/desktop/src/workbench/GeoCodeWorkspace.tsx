// GeoWork Desktop - GeoCode Mode Workspace

import { Layout, Card, Typography } from 'antd'
import { CodeOutlined } from '@ant-design/icons'
import styles from './GeoCodeWorkspace.module.scss'

const { Content } = Layout
const { Title, Text } = Typography

export default function GeoCodeWorkspace() {
  return (
    <Layout className={styles.geocodeWorkspace}>
      <Content className={styles.content}>
        <div className={styles.header}>
          <Title level={4}><CodeOutlined /> 编码模式</Title>
          <Text type="secondary">地理编码、脚本生成和 GEE 集成</Text>
        </div>

        <div className={styles.panels}>
          <Card title="脚本编辑器" size="small" className={styles.panel}>
            <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}># Python 脚本编辑器</pre>
          </Card>
          <Card title="GEE 集成" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>Google Earth Engine 配置和数据集选择。</p>
          </Card>
          <Card title="终端" size="small" className={styles.panel}>
            <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}>$ 终端输出区域</pre>
          </Card>
        </div>
      </Content>
    </Layout>
  )
}
