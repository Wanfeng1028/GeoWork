import React, { useState, useCallback } from 'react'
import {
  Layout,
  Card,
  Row,
  Col,
  Statistic,
  Timeline,
  Tag,
  Avatar,
  List,
  Empty,
  Spin,
  Alert,
  Space,
  Badge,
  Button
} from 'antd'
import {
  RobotOutlined,
  FolderOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  TeamOutlined,
  ExperimentOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  PlusOutlined
} from '@ant-design/icons'
import UsageChart from '../../components/common/UsageChart'
import QuickActions from './QuickActions'
import ProjectCard, { type ProjectItem } from './ProjectCard'
import styles from './Dashboard.module.scss'

const { Content } = Layout

// ─── Type Definitions ───────────────────────────────────────────────

export interface DashboardTask {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'pending'
  createdAt: string
  updatedAt: string
  description?: string
}

export interface DashboardProject {
  id: string
  name: string
  description: string
  mode: string
  lastModified: string
  status: 'active' | 'paused' | 'completed' | 'error'
  thumbnail?: string
}

export interface DashboardStats {
  totalProjects: number
  activeTasks: number
  monthlyApiCalls: number
  storageUsed: number // in MB
  storageTotal: number // in MB
}

export interface DashboardProps {
  loading?: boolean
  error?: string | null
  stats?: DashboardStats
  projects?: DashboardProject[]
  tasks?: DashboardTask[]
  onProjectClick?: (project: DashboardProject) => void
  onContinueAnalysis?: () => void
  onViewReport?: () => void
  onNewProject?: () => void
}

// ─── Mock Data ──────────────────────────────────────────────────────

const MOCK_PROJECTS: DashboardProject[] = [
  {
    id: 'p1',
    name: 'Sentinel-2 NDVI 实验',
    description: '使用 Sentinel-2 数据运行 NDVI 植被指数分析，生成实验报告',
    mode: 'Analysis',
    lastModified: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'active'
  },
  {
    id: 'p2',
    name: 'Landsat 土地覆盖分类',
    description: '基于 Landsat 8 影像进行土地覆盖分类，使用随机森林算法',
    mode: 'Data',
    lastModified: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'completed'
  },
  {
    id: 'p3',
    name: 'GEE 地表温度反演',
    description: '利用 Google Earth Engine 进行地表温度单窗算法反演',
    mode: 'GeoCode',
    lastModified: new Date(Date.now() - 3 * 86400000).toISOString(),
    status: 'paused'
  },
  {
    id: 'p4',
    name: 'MODIS 植被变化监测',
    description: '基于 MODIS NDVI 时间序列的植被变化趋势分析',
    mode: 'Research',
    lastModified: new Date(Date.now() - 7 * 86400000).toISOString(),
    status: 'active'
  }
]

const MOCK_TASKS: DashboardTask[] = [
  {
    id: 't1',
    name: 'NDVI 计算完成',
    status: 'completed',
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    description: 'Sentinel-2 NDVI 计算完成，生成结果文件'
  },
  {
    id: 't2',
    name: '地图渲染中',
    status: 'running',
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    description: '正在渲染 NDVI 专题地图'
  },
  {
    id: 't3',
    name: '报告生成失败',
    status: 'failed',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000 + 300000).toISOString(),
    description: 'DOCX 报告生成时模板加载失败'
  },
  {
    id: 't4',
    name: '数据预处理',
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    description: '等待数据预处理完成'
  }
]

const MOCK_STATS: DashboardStats = {
  totalProjects: 12,
  activeTasks: 3,
  monthlyApiCalls: 1847,
  storageUsed: 2450,
  storageTotal: 10240
}

// ─── Component ──────────────────────────────────────────────────────

export default function Dashboard({
  loading = false,
  error = null,
  stats = MOCK_STATS,
  projects = MOCK_PROJECTS,
  tasks = MOCK_TASKS,
  onProjectClick,
  onContinueAnalysis,
  onViewReport,
  onNewProject
}: DashboardProps) {
  const [storageUnit, setStorageUnit] = useState<'MB' | 'GB'>('MB')

  const handleStorageToggle = useCallback(() => {
    setStorageUnit((prev) => (prev === 'MB' ? 'GB' : 'MB'))
  }, [])

  const handleProjectClick = useCallback(
    (project: DashboardProject) => {
      if (onProjectClick) {
        onProjectClick(project)
      }
    },
    [onProjectClick]
  )

  const handleQuickAction = useCallback(
    (action: { key: string }) => {
      switch (action.key) {
        case 'new-project':
          if (onNewProject) onNewProject()
          break
        case 'ndvi-analysis':
          if (onContinueAnalysis) onContinueAnalysis()
          break
        case 'view-report':
          if (onViewReport) onViewReport()
          break
      }
    },
    [onNewProject, onContinueAnalysis, onViewReport]
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
        action={
          <Tag icon={<SyncOutlined spin />} color="processing">
            重试
          </Tag>
        }
      />
    )
  }

  const storageValue = storageUnit === 'GB' ? +(stats.storageUsed / 1024).toFixed(1) : stats.storageUsed
  const storageTotal = storageUnit === 'GB' ? +(stats.storageTotal / 1024).toFixed(0) : stats.storageTotal

  return (
    <Content className={styles.dashboard}>
      {/* Welcome Section */}
      <div className={styles.welcome}>
        <Avatar size={56} icon={<RobotOutlined />} style={{ background: '#1677ff' }} />
        <div className={styles.welcomeText}>
          <h2 className={styles.greeting}>欢迎回来，GeoWork 用户</h2>
          <p className={styles.subtitle}>
            你目前有 {stats.activeTasks} 个任务正在运行，{stats.totalProjects} 个项目已创建。
          </p>
        </div>
        <Space>
          <Badge count={stats.activeTasks} offset={[5, -2]}>
            <Button icon={<ThunderboltOutlined />} onClick={onContinueAnalysis}>
              继续分析
            </Button>
          </Badge>
          <Button icon={<FileTextOutlined />} onClick={onViewReport}>
            查看报告
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onNewProject}>
            新建项目
          </Button>
        </Space>
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className={styles.statsCard}>
            <Statistic
              title="项目总数"
              value={stats.totalProjects}
              prefix={<FolderOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className={styles.statsCard}>
            <Statistic
              title="进行中任务"
              value={stats.activeTasks}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className={styles.statsCard}>
            <Statistic
              title="本月 API 调用"
              value={stats.monthlyApiCalls}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#fa8c16' }}
              suffix={<Tag color="blue" style={{ marginLeft: 8, fontSize: 12 }}>次</Tag>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className={styles.statsCard}>
            <Statistic
              title="存储空间"
              value={storageValue}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix={
                <span
                  style={{ cursor: 'pointer', fontSize: 12, color: '#1677ff' }}
                  onClick={handleStorageToggle}
                >
                  {storageUnit}
                </span>
              }
            />
            <div style={{ marginTop: 4 }}>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(stats.storageUsed / stats.storageTotal) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #1677ff, #722ed1)',
                    borderRadius: 2
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: '#8c97a1' }}>
                {stats.storageUsed} / {stats.storageTotal} {storageUnit}
              </span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Content Grid: Projects + Tasks */}
      <div className={styles.contentGrid}>
        {/* Recent Projects */}
        <Card
          title={
            <span className={styles.sectionTitle}>
              最近项目
              <span className={styles.viewAll}>查看全部</span>
            </span>
          }
          size="small"
        >
          {projects.length > 0 ? (
            <List
              grid={{ gutter: 12, column: 1 }}
              dataSource={projects}
              renderItem={(project) => (
                <List.Item>
                  <ProjectCard project={project} onClick={handleProjectClick} />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {/* Task Timeline */}
        <Card
          title={
            <span className={styles.sectionTitle}>
              最近任务
              <span className={styles.viewAll}>查看全部</span>
            </span>
          }
          size="small"
          className={styles.timelineSection}
        >
          {tasks.length > 0 ? (
            <Timeline
              items={tasks.map((task) => ({
                key: task.id,
                color:
                  task.status === 'completed'
                    ? 'green'
                    : task.status === 'running'
                      ? 'blue'
                      : task.status === 'failed'
                        ? 'red'
                        : 'gray',
                dot:
                  task.status === 'completed' ? (
                    <CheckCircleOutlined />
                  ) : task.status === 'running' ? (
                    <SyncOutlined spin />
                  ) : task.status === 'failed' ? (
                    <WarningOutlined />
                  ) : (
                    <ClockCircleOutlined />
                  ),
                children: (
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {task.name}
                      <Tag
                        color={
                          task.status === 'completed'
                            ? 'green'
                            : task.status === 'running'
                              ? 'blue'
                              : task.status === 'failed'
                                ? 'red'
                                : 'default'
                        }
                        style={{ marginLeft: 8 }}
                      >
                        {task.status === 'completed'
                          ? '已完成'
                          : task.status === 'running'
                            ? '运行中'
                            : task.status === 'failed'
                              ? '失败'
                              : '等待中'}
                      </Tag>
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: '#60717f' }}>{task.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#8c97a1', marginTop: 4 }}>
                      {new Date(task.updatedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                )
              }))}
            />
          ) : (
            <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </div>

      {/* Usage Chart */}
      <Card title="用量统计" size="small">
        <UsageChart />
      </Card>

      {/* Quick Links */}
      <div>
        <h3 className={styles.sectionTitle}>快捷入口</h3>
        <div className={styles.quickLinks}>
          <div
            className={styles.linkCard}
            onClick={() => {
              // Navigate to expert panel
            }}
          >
            <TeamOutlined className={styles.linkIcon} />
            <span className={styles.linkLabel}>专家面板</span>
            <span className={styles.linkDesc}>12 位内置专家可用</span>
          </div>
          <div
            className={styles.linkCard}
            onClick={() => {
              // Navigate to skill marketplace
            }}
          >
            <ExperimentOutlined className={styles.linkIcon} />
            <span className={styles.linkLabel}>技能市场</span>
            <span className={styles.linkDesc}>探索更多遥感技能</span>
          </div>
          <div
            className={styles.linkCard}
            onClick={() => {
              // Navigate to automation
            }}
          >
            <ToolOutlined className={styles.linkIcon} />
            <span className={styles.linkLabel}>自动化任务</span>
            <span className={styles.linkDesc}>设置定时和触发任务</span>
          </div>
        </div>
      </div>
    </Content>
  )
}
