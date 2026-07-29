import { App, Button, Card, Space, Tag, Typography, theme } from 'antd'
import {
  ExperimentOutlined,
  ShareAltOutlined,
  EditOutlined,
  CompassOutlined,
} from '@ant-design/icons'
import styles from './WorkflowGuideCard.module.css'

interface Props {
  onStartTour: () => void
}

export function WorkflowGuideCard({ onStartTour }: Props) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  return (
    <Card
      className={styles.card}
      style={{
        background: `linear-gradient(180deg, ${token.colorPrimaryBgHover}, ${token.colorFillTertiary})`,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      {/* Header */}
      <div className={styles.header}>
        <Space size={8}>
          <ExperimentOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
          <Typography.Text strong style={{ fontSize: 15 }}>
            空间分析工作流
          </Typography.Text>
        </Space>
        <Typography.Link style={{ fontSize: 12 }}>更多</Typography.Link>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <Typography.Title
          level={5}
          style={{ margin: 0, color: token.colorText }}
        >
          从一个空间问题开始
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          导入数据、选择工具、运行分析并导出报告。GeoWork 会把每一步记录为可追溯的工作流。
        </Typography.Text>
        <div className={styles.tags}>
          <Tag color={token.colorPrimary}>Beta</Tag>
          <Tag color="geekblue">
            <CompassOutlined /> GIS Workflow
          </Tag>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button type="primary" size="small" shape="round" onClick={onStartTour}>
          开始引导
        </Button>
        <Button
          type="text"
          size="small"
          shape="round"
          icon={<ShareAltOutlined />}
          onClick={() => message.info('分享流程功能后续接入')}
        >
          分享流程
        </Button>
        <Button
          type="primary"
          size="small"
          shape="round"
          icon={<EditOutlined />}
          onClick={() => message.info('编辑模板功能后续接入')}
        >
          编辑模板
        </Button>
      </div>
    </Card>
  )
}
