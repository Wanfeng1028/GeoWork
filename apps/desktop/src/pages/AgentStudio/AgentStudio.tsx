import { useState, useCallback, useEffect } from 'react'
import { Layout, Card, Row, Col, Button, Tag, Empty, Space, Typography, Modal, Form, Input, Tabs, List, message, Drawer } from 'antd'
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CodeOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  RobotOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { useAgentStudioStore } from '../../stores/agentStore'
import type { Workflow } from '../../services/agentService'
import styles from './AgentStudio.module.scss'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

// ─── Mode Icons ──────────────────────────────────────────────────────

const MODE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Research: { icon: <RobotOutlined />, color: '#1677ff', label: '研究' },
  Data: { icon: <DatabaseOutlined />, color: '#10b981', label: '数据' },
  GeoCode: { icon: <CodeOutlined />, color: '#f59e0b', label: '编码' },
  Analysis: { icon: <BarChartOutlined />, color: '#8b5cf6', label: '分析' },
  Write: { icon: <FileTextOutlined />, color: '#ec4899', label: '写作' },
}

// ─── Workflow Card ──────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: { id: string; name: string; description: string; status: string; createdAt: string }
  onSelect: (w: any) => void
  onRun: (id: string) => void
  onStop: (id: string) => void
  onDelete: (id: string) => void
}

function WorkflowCard({ workflow, onSelect, onRun, onStop, onDelete }: WorkflowCardProps) {
  const statusColor = workflow.status === 'running' ? 'green' : workflow.status === 'failed' ? 'red' : 'default'
  const statusLabel = workflow.status === 'running' ? '运行中' : workflow.status === 'failed' ? '错误' : '就绪'

  return (
    <Card
      className={styles.workflowCard}
      hoverable
      onClick={() => onSelect(workflow)}
      actions={[
        <span key="run" onClick={(e) => { e.stopPropagation(); onRun(workflow.id) }}>
          <PlayCircleOutlined /> 运行
        </span>,
        <span key="stop" onClick={(e) => { e.stopPropagation(); onStop(workflow.id) }}>
          <PauseCircleOutlined /> 停止
        </span>,
        <span key="del" onClick={(e) => { e.stopPropagation(); onDelete(workflow.id) }}>
          <DeleteOutlined style={{ color: '#ff4d4f' }} /> 删除
        </span>
      ]}
    >
      <Card.Meta
        title={workflow.name}
        description={
          <div className={styles.workflowMeta}>
            <Tag color={statusColor}>{statusLabel}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> {new Date(workflow.createdAt).toLocaleDateString('zh-CN')}
            </Text>
          </div>
        }
      />
      {workflow.description && <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>{workflow.description}</Paragraph>}
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function AgentStudio() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [form] = Form.useForm()
  const { workflows, runs, loading, loadWorkflows, loadRuns, createWorkflow, deleteWorkflow, startRun, stopRun } = useAgentStudioStore()

  useEffect(() => {
    loadWorkflows()
    loadRuns()
  }, [loadWorkflows, loadRuns])

  const handleCreate = useCallback(async () => {
    const values = await form.validateFields()
    await createWorkflow(values.name, values.description || '')
    setModalOpen(false)
    form.resetFields()
    message.success('工作流创建成功')
  }, [form, createWorkflow])

  const handleSelectWorkflow = useCallback((w: any) => {
    setSelectedWorkflow(w)
    setDrawerOpen(true)
  }, [])

  const handleRun = useCallback(async (id: string) => {
    await startRun(id)
    message.success('工作流已启动')
  }, [startRun])

  const handleStop = useCallback(async (id: string) => {
    await stopRun(id)
    message.success('工作流已停止')
  }, [stopRun])

  const handleDelete = useCallback(async (id: string) => {
    await deleteWorkflow(id)
    message.success('工作流已删除')
  }, [deleteWorkflow])

  return (
    <Layout className={styles.agentStudio}>
      <Content className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <Title level={3} style={{ margin: 0 }}>AI Agent 工作室</Title>
            <Text type="secondary">创建和管理 AI Agent 工作流，配置工具链和模型网关</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建工作流
          </Button>
        </div>

        {/* Mode Tabs */}
        <Tabs
          defaultActiveKey="all"
          items={[
            { key: 'all', label: '全部', children: <WorkflowList workflows={workflows} onSelect={handleSelectWorkflow} onRun={handleRun} onStop={handleStop} onDelete={handleDelete} /> },
            ...Object.entries(MODE_CONFIG).map(([mode, config]) => ({
              key: mode,
              label: <span>{config.icon} {config.label}</span>,
              children: <WorkflowList workflows={workflows.filter(w => w.mode === mode)} onSelect={handleSelectWorkflow} onRun={handleRun} onStop={handleStop} onDelete={handleDelete} />
            }))
          ]}
        />

        {/* Recent Runs */}
        <Card title="最近运行记录" size="small" className={styles.runsCard}>
          {runs.length > 0 ? (
            <List
              dataSource={runs.slice(0, 10)}
              renderItem={(run) => (
                <List.Item className={styles.runItem}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text>{run.workflowName || '未命名工作流'}</Text>
                        <Tag color={run.status === 'completed' ? 'green' : run.status === 'running' ? 'blue' : run.status === 'failed' ? 'red' : 'default'}>
                          {run.status === 'completed' ? '完成' : run.status === 'running' ? '运行中' : run.status === 'failed' ? '错误' : '等待中'}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space size="large">
                        <span><ClockCircleOutlined /> {new Date(run.startedAt).toLocaleString('zh-CN')}</span>
                        {run.completedAt && <span>耗时: {new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()}ms</span>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </Content>

      {/* Create Workflow Modal */}
      <Modal
        title="新建工作流"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入工作流名称' }]}>
            <Input placeholder="例如: NDVI 分析工作流" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="描述工作流的用途和步骤" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Workflow Detail Drawer */}
      <Drawer
        title={selectedWorkflow?.name}
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedWorkflow && (
          <div className={styles.workflowDetail}>
            <Typography>
              <Title level={5}>描述</Title>
              <Paragraph>{selectedWorkflow.description || '暂无描述'}</Paragraph>
              <Title level={5}>状态</Title>
              <Tag color={selectedWorkflow.status === 'running' ? 'green' : 'default'}>
                {selectedWorkflow.status === 'running' ? '运行中' : '就绪'}
              </Tag>
              <Title level={5}>创建时间</Title>
              <Text>{new Date(selectedWorkflow.createdAt).toLocaleString('zh-CN')}</Text>
            </Typography>
          </div>
        )}
      </Drawer>
    </Layout>
  )
}

// ─── Workflow List Sub-component ────────────────────────────────────

function WorkflowList({ workflows: wfs, onSelect, onRun, onStop, onDelete }: { workflows: Workflow[]; onSelect: (w: any) => void; onRun: (id: string) => void; onStop: (id: string) => void; onDelete: (id: string) => void }) {
  if (wfs.length === 0) {
    return <Empty description="暂无工作流" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  return (
    <Row gutter={[16, 16]}>
      {wfs.map((w: Workflow) => (
        <Col xs={24} sm={12} lg={8} key={w.id}>
          <WorkflowCard workflow={w} onSelect={onSelect} onRun={onRun} onStop={onStop} onDelete={onDelete} />
        </Col>
      ))}
    </Row>
  )
}
