import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Dropdown,
  Empty,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd'
import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  SortAscendingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { ScheduledTaskCard } from './components/ScheduledTaskCard'
import { ScheduledTaskModal } from './components/ScheduledTaskModal'
import styles from './TasksPage.module.css'

const { Title, Text } = Typography

export interface ScheduledTask {
  id: string
  name: string
  description: string
  schedule: string
  prompt: string
  enabled: boolean
}

const SCHEDULED_TASK_PROMPT = `我要创建一个定时任务，每【时间间隔】执行【具体任务】。

任务目标：
【请描述你希望 GeoWork 定期完成的事情】

执行要求：
1. 说明触发频率，例如每天 09:00、每周一 10:00、每 6 小时一次。
2. 说明要读取或处理的数据来源。
3. 说明期望输出结果，例如报告、地图、表格或提醒。
4. 如果需要工作目录，请在任务中说明。`

const INITIAL_TASKS: ScheduledTask[] = [
  {
    id: '1',
    name: '午间充电站',
    description:
      '午休时间到了！帮我放松一下：请从以下内容中随机挑 2-3 个给我看：1. 一个近期有趣的开源项目 2. 一条 GIS / 遥感 / 前端相关技术动态 3. 一个轻松的小知识。',
    schedule: '工作日 12:30',
    prompt:
      '午休时间到了！帮我放松一下：请从以下内容中随机挑 2-3 个给我看：1. 一个近期有趣的开源项目 2. 一条 GIS / 遥感 / 前端相关技术动态 3. 一个轻松的小知识。',
    enabled: false,
  },
  {
    id: '2',
    name: '每日下载文件夹清理',
    description:
      '请帮我整理「下载」文件夹：扫描新增文件，按图片、文档、压缩包等类型分类，并生成整理建议。',
    schedule: '每天 18:30',
    prompt:
      '请帮我整理「下载」文件夹：扫描新增文件，按图片、文档、压缩包等类型分类，并生成整理建议。',
    enabled: false,
  },
  {
    id: '3',
    name: '每周竞品动态追踪',
    description:
      '请帮我追踪 GIS、AI 工具和前端工程相关竞品动态，整理为每周摘要。',
    schedule: '每周一 10:00',
    prompt:
      '请帮我追踪 GIS、AI 工具和前端工程相关竞品动态，整理为每周摘要。',
    enabled: false,
  },
  {
    id: '4',
    name: '每日数据报表更新',
    description:
      '请读取工作目录中最新的 Excel / CSV 数据文件，与前一天数据对比，计算关键指标变化并生成摘要。',
    schedule: '每天 09:30',
    prompt:
      '请读取工作目录中最新的 Excel / CSV 数据文件，与前一天数据对比，计算关键指标变化并生成摘要。',
    enabled: false,
  },
]

/* ── 执行记录 ── */
type ExecutionStatus = 'success' | 'failed' | 'running' | 'cancelled'

interface ExecutionRecord {
  id: string
  taskName: string
  executedAt: string
  status: ExecutionStatus
  duration: string
  summary: string
}

const MOCK_EXECUTIONS: ExecutionRecord[] = [
  {
    id: 'e1',
    taskName: '每日下载文件夹清理',
    executedAt: '2026-07-02 18:30',
    status: 'success',
    duration: '1分23秒',
    summary: '扫描 23 个新增文件，已按类型分类并生成整理建议',
  },
  {
    id: 'e2',
    taskName: '每日数据报表更新',
    executedAt: '2026-07-02 09:30',
    status: 'success',
    duration: '3分45秒',
    summary: '读取 sales_2026Q3.csv，环比增长 3.2%，生成摘要报告',
  },
  {
    id: 'e3',
    taskName: '午间充电站',
    executedAt: '2026-07-01 12:30',
    status: 'success',
    duration: '42秒',
    summary: '推送 2 条内容：开源项目 MapLibre v5.0 发布 + GIS 遥感新论文',
  },
  {
    id: 'e4',
    taskName: '每周竞品动态追踪',
    executedAt: '2026-06-30 10:00',
    status: 'failed',
    duration: '5分12秒',
    summary: '执行超时，数据源返回 503 错误',
  },
  {
    id: 'e5',
    taskName: '每日下载文件夹清理',
    executedAt: '2026-07-01 18:30',
    status: 'cancelled',
    duration: '—',
    summary: '用户手动取消执行',
  },
  {
    id: 'e6',
    taskName: '每日数据报表更新',
    executedAt: '2026-06-30 09:30',
    status: 'success',
    duration: '2分58秒',
    summary: '读取 inventory.csv，库存周转率下降 1.5%，已标记预警',
  },
]

const statusConfig: Record<ExecutionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  success: { label: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { label: '失败', color: 'error', icon: <CloseCircleOutlined /> },
  running: { label: '运行中', color: 'processing', icon: <SyncOutlined spin /> },
  cancelled: { label: '已取消', color: 'default', icon: <StopOutlined /> },
}

export function TasksPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [tasks, setTasks] = useState<ScheduledTask[]>(INITIAL_TASKS)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null)
  const [activeTab, setActiveTab] = useState('tasks')
  const [sortOrder, setSortOrder] = useState('created-desc')
  const [keepAwake, setKeepAwake] = useState(false)
  const [timeRange, setTimeRange] = useState<string>('按天')
  const [filterTask, setFilterTask] = useState<string>('all-tasks')
  const [filterStatus, setFilterStatus] = useState<string>('all-status')

  /* 任务操作 */
  const handleToggle = (id: string, enabled: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled } : t)),
    )
    message.info(enabled ? '任务已启用' : '任务已停用')
  }

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    message.success('定时任务已删除')
  }

  const handleEdit = (task: ScheduledTask) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleCopyToNew = (task: ScheduledTask) => {
    navigate('/new-task', { state: { initialPrompt: task.prompt } })
  }

  const handleCreateNew = () => {
    setEditingTask(null)
    setModalOpen(true)
  }

  const handleSaveTask = (data: {
    name: string
    description: string
    schedule: string
    prompt: string
  }) => {
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? { ...t, name: data.name, description: data.description, schedule: data.schedule, prompt: data.prompt }
            : t,
        ),
      )
    } else {
      const newTask: ScheduledTask = {
        id: Date.now().toString(),
        name: data.name,
        description: data.description,
        schedule: data.schedule,
        prompt: data.prompt,
        enabled: false,
      }
      setTasks((prev) => [...prev, newTask])
    }
    setModalOpen(false)
    setEditingTask(null)
    message.success('定时任务已保存')
  }

  const handleCreateViaGeoWork = () => {
    navigate('/new-task', { state: { initialPrompt: SCHEDULED_TASK_PROMPT } })
  }

  /* 排序 */
  const sortMenu: MenuProps['items'] = [
    { key: 'created-desc', label: '按创建时间倒序' },
    { key: 'created-asc', label: '按创建时间正序' },
    { key: 'next-run', label: '按下次执行时间' },
  ]

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortOrder === 'created-desc') return Number(b.id) - Number(a.id)
    if (sortOrder === 'created-asc') return Number(a.id) - Number(b.id)
    return a.schedule.localeCompare(b.schedule)
  })

  /* 执行记录列定义 */
  const executionColumns: ColumnsType<ExecutionRecord> = [
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '执行时间',
      dataIndex: 'executedAt',
      key: 'executedAt',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ExecutionStatus) => {
        const cfg = statusConfig[status]
        return <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
    },
    {
      title: '结果摘要',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
    },
  ]

  /* 筛选执行记录 */
  const filteredExecutions = MOCK_EXECUTIONS.filter((record) => {
    if (filterTask !== 'all-tasks') {
      const task = tasks.find((t) => t.id === filterTask)
      if (task && record.taskName !== task.name) return false
    }
    if (filterStatus !== 'all-status' && record.status !== filterStatus) return false
    return true
  })

  /* 任务筛选选项 */
  const taskFilterOptions = [
    { label: '全部任务', value: 'all-tasks' },
    ...tasks.map((t) => ({ label: t.name, value: t.id })),
  ]

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <Title level={3} style={{ margin: 0 }}>定时任务</Title>
          <Text type="secondary">
            按计划自动执行任务，也可随时手动触发。在任意对话中描述你想定期做的事，即可快速创建。
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => message.info('定时任务列表已刷新')}
          />
          <Button color="primary" variant="filled" onClick={handleCreateViaGeoWork}>
            通过 GeoWork 创建
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
            新建定时任务
          </Button>
        </Space>
      </div>

      {/* Alert */}
      <div
        className={styles.alertBar}
        style={{
          background: token.colorInfoBg,
          border: `1px solid ${token.colorInfoBgHover}`,
        }}
      >
        <Alert
          type="info"
          showIcon
          title="定时任务仅在电脑保持唤醒时运行"
          style={{ flex: 1, background: 'transparent', border: 'none' }}
        />
        <Space>
          <Text type="secondary" style={{ fontSize: 13 }}>保持系统唤醒</Text>
          <Switch
            size="small"
            checked={keepAwake}
            onChange={(checked) => {
              setKeepAwake(checked)
              message.info(
                checked
                  ? '保持系统唤醒功能后续接入'
                  : '已关闭保持系统唤醒占位开关',
              )
            }}
          />
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className={styles.tabs}
        items={[
          {
            key: 'tasks',
            label: '我的定时任务',
            children: (
              <>
                <div className={styles.toolbar}>
                  <Dropdown
                    menu={{
                      items: sortMenu,
                      selectedKeys: [sortOrder],
                      onClick: ({ key }) => setSortOrder(key),
                    }}
                    trigger={['click']}
                  >
                    <Button icon={<SortAscendingOutlined />} size="small">
                      排序
                    </Button>
                  </Dropdown>
                </div>
                <div className={styles.cardGrid}>
                  {sortedTasks.map((task) => (
                    <ScheduledTaskCard
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                      onCopyToNew={handleCopyToNew}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </>
            ),
          },
          {
            key: 'history',
            label: '执行记录',
            children: (
              <div className={styles.historyTab}>
                <Space className={styles.historyFilters}>
                  <Segmented
                    options={['按天', '按周', '按月']}
                    size="small"
                    value={timeRange}
                    onChange={(v) => setTimeRange(v as string)}
                  />
                  <Select
                    value={filterTask}
                    onChange={setFilterTask}
                    size="small"
                    style={{ width: 140 }}
                    options={taskFilterOptions}
                  />
                  <Select
                    value={filterStatus}
                    onChange={setFilterStatus}
                    size="small"
                    style={{ width: 120 }}
                    options={[
                      { label: '全部状态', value: 'all-status' },
                      { label: '成功', value: 'success' },
                      { label: '失败', value: 'failed' },
                      { label: '运行中', value: 'running' },
                      { label: '已取消', value: 'cancelled' },
                    ]}
                  />
                </Space>
                <Table<ExecutionRecord>
                  columns={executionColumns}
                  dataSource={filteredExecutions}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={<ClockCircleOutlined style={{ fontSize: 48, opacity: 0.3 }} />}
                        description={
                          <Space direction="vertical" size={4}>
                            <Text>暂无执行记录</Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              当定时任务开始执行后，记录将显示在这里。
                            </Text>
                          </Space>
                        }
                      />
                    ),
                  }}
                />
              </div>
            ),
          },
        ]}
      />

      {/* Modal */}
      <ScheduledTaskModal
        open={modalOpen}
        task={editingTask}
        onClose={() => {
          setModalOpen(false)
          setEditingTask(null)
        }}
        onSave={handleSaveTask}
      />
    </div>
  )
}
