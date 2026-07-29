import {
  Alert,
  Button,
  Card,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  CheckCircleOutlined,
  PauseCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import type { RunStatus, WorkflowStep } from './conversationStorage'
import styles from './WorkflowRunCard.module.css'

const { Title, Text } = Typography

/* ── 状态文案 ── */
const STATUS_LABEL: Record<RunStatus, string> = {
  idle: '空闲',
  thinking: '理解任务',
  planning: '生成计划',
  'waiting-confirmation': '等待确认',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  stopped: '已停止',
}

/* ── Tag 颜色 ── */
const STATUS_TAG_COLOR: Record<RunStatus, string> = {
  idle: 'default',
  thinking: 'processing',
  planning: 'processing',
  'waiting-confirmation': 'warning',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  stopped: 'default',
}

export interface WorkflowRunCardProps {
  workflow: WorkflowStep[]
  runStatus: RunStatus
  onConfirmRun: () => void
  onAdjustPlan: () => void
}

export function WorkflowRunCard({
  workflow,
  runStatus,
  onConfirmRun,
  onAdjustPlan,
}: WorkflowRunCardProps) {
  const { token } = theme.useToken()

  return (
    <Card
      className={styles.card}
      style={{
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {/* Header */}
      <div className={styles.header}>
        <Title level={5} style={{ margin: 0, fontSize: 15 }}>
          GeoWork 工作流计划
        </Title>
        <Tag color={STATUS_TAG_COLOR[runStatus]}>{STATUS_LABEL[runStatus]}</Tag>
      </div>

      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        已根据你的描述生成前端模拟执行计划，确认后将进入真实执行流程。
      </Text>

      {/* Steps */}
      <Steps
        size="small"
        current={workflow.findIndex((s) => s.status === 'process')}
        className={styles.steps}
        items={workflow.map((step) => ({
          title: step.title,
          content: step.description,
          status: step.status,
        }))}
      />

      {/* Status-specific content */}
      <div className={styles.footer}>
        {runStatus === 'waiting-confirmation' && (
          <Space size={8}>
            <Button type="primary" size="small" onClick={onConfirmRun}>
              确认执行
            </Button>
            <Button size="small" onClick={onAdjustPlan}>
              调整计划
            </Button>
          </Space>
        )}

        {runStatus === 'running' && (
          <Space size={6}>
            <Spin size="small" indicator={<LoadingOutlined spin />} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              正在执行工作流，请稍候……
            </Text>
          </Space>
        )}

        {runStatus === 'completed' && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            title="工作流已完成前端模拟执行"
            style={{ fontSize: 12 }}
          />
        )}

        {runStatus === 'stopped' && (
          <Alert
            type="info"
            showIcon
            icon={<PauseCircleOutlined />}
            title="工作流已停止"
            style={{ fontSize: 12 }}
          />
        )}

        {runStatus === 'failed' && (
          <Alert
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            title="工作流执行失败"
            style={{ fontSize: 12 }}
          />
        )}
      </div>
    </Card>
  )
}
