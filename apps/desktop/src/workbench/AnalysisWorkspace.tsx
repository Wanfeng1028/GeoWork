// GeoWork Desktop - Analysis Mode Workspace

import { Layout, Card, Typography } from 'antd'
import { BarChartOutlined } from '@ant-design/icons'
import styles from './AnalysisWorkspace.module.scss'

const { Content } = Layout
const { Title, Text } = Typography

export default function AnalysisWorkspace() {
  return (
    <Layout className={styles.analysisWorkspace}>
      <Content className={styles.content}>
        <div className={styles.header}>
          <Title level={4}><BarChartOutlined /> 分析模式</Title>
          <Text type="secondary">栅格/矢量分析、NDVI 计算和变化检测</Text>
        </div>

        <div className={styles.panels}>
          <Card title="地图视图" size="small" className={styles.mapPanel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>MapLibre + DeckGL 地图渲染区域</p>
          </Card>
          <Card title="图表分析" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>统计图表和趋势分析。</p>
          </Card>
          <Card title="分析结果" size="small" className={styles.panel}>
            <p style={{ color: '#8c97a1', fontSize: 13 }}>分析结果和指标展示。</p>
          </Card>
        </div>
      </Content>
    </Layout>
  )
}
