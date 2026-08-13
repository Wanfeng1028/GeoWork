import { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  App,
  Button,
  Dropdown,
  Segmented,
  Select,
  Space,
  Spin,
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
  SortAscendingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { EmptyState } from '../../shell/feedback'
import { ScheduledTaskCard } from './components/ScheduledTaskCard'
import { ScheduledTaskModal } from './components/ScheduledTaskModal'
import { apiGet, apiPost, apiDelete, apiPatch } from '../../shared/api/client'
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

/* ── Core Task 对接（/api/db/tasks） ── */

const TASKS_CACHE_KEY = 'geowork.tasks.cache.v1'

/** Core 端 Task 形状（tasks.go Task 的 JSON 投影）。 */
interface CoreTask {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: string // pending | running | completed | failed | cancelled | paused | recovered
  mode: string
  prompt?: string
  plan?: string
  progress: number
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

/** Core Task → 前端 ScheduledTask 映射。 */
function mapCoreTaskToScheduled(t: CoreTask): ScheduledTask {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    schedule: t.mode ? `模式：${t.mode}` : '—',
    prompt: t.prompt ?? '',
    enabled: t.status === 'pending' || t.status === 'running',
  }
}

/** Core Task → 前端 ExecutionRecord 映射（用于"执行记录"标签页）。 */
function mapCoreTaskToExecution(t: CoreTask): ExecutionRecord {
  const statusMap: Record<string, ExecutionStatus> = {
    completed: 'success',
    failed: 'failed',
    running: 'running',
    cancelled: 'cancelled',
    recovered: 'success',
    paused: 'cancelled',
  }
  const status = statusMap[t.status] ?? 'success'
  let duration = '—'
  if (t.startedAt && t.completedAt) {
    const ms = Date.parse(t.completedAt) - Date.parse(t.startedAt)
    if (!Number.isNaN(ms) && ms > 0) {
      const secs = Math.round(ms / 1000)
      duration = secs >= 60 ? `${Math.floor(secs / 60)}分${secs % 60}秒` : `${secs}秒`
    }
  }
  const iso = t.completedAt ?? t.updatedAt ?? t.createdAt
  return {
    id: t.id,
    taskName: t.name,
    executedAt: formatCoreTime(iso),
    status,
    duration,
    summary: t.description || (t.prompt ? t.prompt.slice(0, 60) : '已完成'),
  }
}

function formatCoreTime(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

interface CoreTasksBundle {
  tasks: ScheduledTask[]
  executions: ExecutionRecord[]
}

/** 从 Core 加载任务列表 + 执行记录。 */
async function loadTasksFromCore(): Promise<CoreTasksBundle> {
  const res = await apiGet<{ total: number; tasks: CoreTask[] }>('/api/db/tasks?workspaceId=default')
  const coreTasks = res?.tasks ?? []
  return {
    tasks: coreTasks.map(mapCoreTaskToScheduled),
    executions: coreTasks
      .filter((t) => ['completed', 'failed', 'cancelled', 'running', 'recovered', 'paused'].includes(t.status))
      .map(mapCoreTaskToExecution),
  }
}

/** 读取 localStorage 缓存的任务数据（Core 不可用时的降级数据源）。 */
function loadCachedTasks(): CoreTasksBundle | null {
  try {
    const raw = window.localStorage.getItem(TASKS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CoreTasksBundle
  } catch {
    return null
  }
}

function saveCachedTasks(data: CoreTasksBundle): void {
  try {
    window.localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(data))
  } catch {
    /* 静默忽略 */
  }
}

export function TasksPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [tasks, setTasks] = useState<ScheduledTask[]>(INITIAL_TASKS)
  const [executions, setExecutions] = useState<ExecutionRecord[]>(MOCK_EXECUTIONS)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null)
  const [activeTab, setActiveTab] = useState('tasks')
  const [sortOrder, setSortOrder] = useState('created-desc')
  const [keepAwake, setKeepAwake] = useState(false)
  const [timeRange, setTimeRange] = useState<string>('按天')
  const [filterTask, setFilterTask] = useState<string>('all-tasks')
  const [filterStatus, setFilterStatus] = useState<string>('all-status')

  /* ── 从 Core 加载任务列表（失败降级 localStorage 缓存 → mock） ── */
  const refreshFromCore = useCallback(async () => {
    setLoading(true)
    try {
      const bundle = await loadTasksFromCore()
      setTasks(bundle.tasks)
      setExecutions(bundle.executions)
      saveCachedTasks(bundle)
    } catch {
      /* Core 不可用：尝试 localStorage 缓存，最后保留 mock 初始数据 */
      const cached = loadCachedTasks()
      if (cached) {
        setTasks(cached.tasks)
        setExecutions(cached.executions)
      }
      /* 无缓存则保留 INITIAL_TASKS / MOCK_EXECUTIONS */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshFromCore()
  }, [refreshFromCore])

  /* 任务操作：均先乐观更新本地状态，再尝试 Core 同步，失败降级本地 */
  const handleToggle = async (id: string, enabled: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)))
    try {
      const status = enabled ? 'pending' : 'cancelled'
      await apiPatch<CoreTask>(`/api/db/tasks/${encodeURIComponent(id)}/status`, { status })
      message.info(enabled ? '任务已启用' : '任务已停用')
    } catch {
      message.warning(enabled ? '任务已本地启用（后端同步失败）' : '任务已本地停用（后端同步失败）')
    }
  }

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await apiDelete<{ status: string }>(`/api/db/tasks/${encodeURIComponent(id)}`)
      message.success('定时任务已删除')
      /* 删除后刷新执行记录 */
      refreshFromCore()
    } catch {
      message.warning('已本地删除（后端同步失败）')
    }
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

  const handleSaveTask = async (data: {
    name: string
    description: string
    schedule: string
    prompt: string
  }) => {
    if (editingTask) {
      /* 编辑：Core 暂无通用更新端点（仅 status），本地更新即可 */
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? { ...t, name: data.name, description: data.description, schedule: data.schedule, prompt: data.prompt }
            : t,
        ),
      )
      setModalOpen(false)
      setEditingTask(null)
      message.success('定时任务已保存')
      return
    }

    /* 新建：先用临时 id 乐观插入，再尝试 Core 创建并替换 id */
    const tempId = `temp_${Date.now()}`
    const newTask: ScheduledTask = {
      id: tempId,
      name: data.name,
      description: data.description,
      schedule: data.schedule,
      prompt: data.prompt,
      enabled: false,
    }
    setTasks((prev) => [...prev, newTask])
    setModalOpen(false)
    setEditingTask(null)

    try {
      const coreTask = await apiPost<CoreTask>('/api/db/tasks', {
        workspaceId: 'default',
        name: data.name,
        description: data.description,
        mode: 'Work',
        prompt: data.prompt,
        status: 'pending',
      })
      /* 用 Core 返回的 id 替换临时 id */
      setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: coreTask.id } : t)))
      message.success('定时任务已保存')
      refreshFromCore()
    } catch {
      message.warning('任务已本地保存（后端同步失败）')
    }
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

  /* 筛选执行记录（基于 Core 加载的 executions 状态） */
  const filteredExecutions = executions.filter((record) => {
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
            loading={loading}
            onClick={refreshFromCore}
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
                  {loading && sortedTasks.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                      <Spin />
                    </div>
                  ) : sortedTasks.length === 0 ? (
                    <EmptyState
                      title="暂无定时任务"
                      description="创建定时任务，让 GeoWork 按计划自动执行地理分析"
                      action={<Button type="primary" onClick={handleCreateNew}>创建任务</Button>}
                    />
                  ) : (
                    sortedTasks.map((task) => (
                      <ScheduledTaskCard
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onEdit={handleEdit}
                        onCopyToNew={handleCopyToNew}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
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
                      <EmptyState
                        title="暂无执行记录"
                        description="当定时任务开始执行后，记录将显示在这里。"
                        size="sm"
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
