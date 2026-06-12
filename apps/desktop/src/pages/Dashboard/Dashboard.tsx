import React, { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Spinner } from '../../components/ui/spinner'
import { Empty } from '../../components/ui/empty'
import {
  Bot,
  Folder,
  Zap,
  FileText,
  Users,
  FlaskConical,
  Wrench,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Plus
} from 'lucide-react'
import UsageChart from '../../components/common/UsageChart'
import QuickActions from './QuickActions'
import ProjectCard, { type ProjectItem } from './ProjectCard'
import styles from './Dashboard.module.scss'

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
  storageUsed: number
  storageTotal: number
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
      if (onProjectClick) onProjectClick(project)
    },
    [onProjectClick]
  )

  const handleQuickAction = useCallback(
    (action: { key: string }) => {
      switch (action.key) {
        case 'new-project': if (onNewProject) onNewProject(); break
        case 'ndvi-analysis': if (onContinueAnalysis) onContinueAnalysis(); break
        case 'view-report': if (onViewReport) onViewReport(); break
      }
    },
    [onNewProject, onContinueAnalysis, onViewReport]
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive p-4 bg-destructive/10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <span className="font-semibold">加载失败</span>
          <Button size="sm" variant="outline" className="ml-auto">重试</Button>
        </div>
        <p className="text-sm mt-2">{error}</p>
      </div>
    )
  }

  const storageValue = storageUnit === 'GB' ? +(stats.storageUsed / 1024).toFixed(1) : stats.storageUsed
  const storageTotal = storageUnit === 'GB' ? +(stats.storageTotal / 1024).toFixed(0) : stats.storageTotal

  return (
    <div className={styles.dashboard}>
      {/* Welcome Section */}
      <div className={styles.welcome}>
        <div className="flex items-center justify-center rounded-full w-14 h-14" style={{ background: '#1677ff' }}>
          <Bot className="text-white w-7 h-7" />
        </div>
        <div className={styles.welcomeText}>
          <h2 className={styles.greeting}>欢迎回来，GeoWork 用户</h2>
          <p className={styles.subtitle}>
            你目前有 {stats.activeTasks} 个任务正在运行，{stats.totalProjects} 个项目已创建。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onContinueAnalysis}>
            <Zap className="w-4 h-4 mr-1" /> 继续分析
          </Button>
          <Button variant="outline" onClick={onViewReport}>
            <FileText className="w-4 h-4 mr-1" /> 查看报告
          </Button>
          <Button onClick={onNewProject}>
            <Plus className="w-4 h-4 mr-1" /> 新建项目
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-sm text-muted-foreground">项目总数</div>
                <div className="text-2xl font-bold">{stats.totalProjects}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-sm text-muted-foreground">进行中任务</div>
                <div className="text-2xl font-bold">{stats.activeTasks}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-orange-500" />
              <div>
                <div className="text-sm text-muted-foreground">本月 API 调用</div>
                <div className="text-2xl font-bold">{stats.monthlyApiCalls}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-purple-500" />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">存储空间</div>
                <div className="text-2xl font-bold">
                  {storageValue}
                  <span className="text-sm font-normal cursor-pointer text-blue-500 ml-1" onClick={handleStorageToggle}>
                    {storageUnit}
                  </span>
                </div>
                <div className="mt-1">
                  <div className="h-1 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded"
                      style={{ width: `${(stats.storageUsed / stats.storageTotal) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {stats.storageUsed} / {stats.storageTotal} {storageUnit}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid: Projects + Tasks */}
      <div className={styles.contentGrid}>
        <Card>
          <CardHeader>
            <CardTitle>
              最近项目
              <span className="text-sm font-normal text-muted-foreground ml-2 cursor-pointer">查看全部</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length > 0 ? (
              <div className="flex flex-col gap-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} onClick={handleProjectClick} />
                ))}
              </div>
            ) : (
              <Empty description="暂无项目" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              最近任务
              <span className="text-sm font-normal text-muted-foreground ml-2 cursor-pointer">查看全部</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div key={task.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {task.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : task.status === 'running' ? (
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                      ) : task.status === 'failed' ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.name}</span>
                        <Badge variant={
                          task.status === 'completed' ? 'default' :
                          task.status === 'running' ? 'secondary' :
                          task.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {task.status === 'completed' ? '已完成' :
                           task.status === 'running' ? '运行中' :
                           task.status === 'failed' ? '失败' : '等待中'}
                        </Badge>
                      </div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(task.updatedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无任务" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>用量统计</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageChart />
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div>
        <h3 className={styles.sectionTitle}>快捷入口</h3>
        <div className={styles.quickLinks}>
          <div className={styles.linkCard}>
            <Users className={styles.linkIcon} />
            <span className={styles.linkLabel}>专家面板</span>
            <span className={styles.linkDesc}>12 位内置专家可用</span>
          </div>
          <div className={styles.linkCard}>
            <FlaskConical className={styles.linkIcon} />
            <span className={styles.linkLabel}>技能市场</span>
            <span className={styles.linkDesc}>探索更多遥感技能</span>
          </div>
          <div className={styles.linkCard}>
            <Wrench className={styles.linkIcon} />
            <span className={styles.linkLabel}>自动化任务</span>
            <span className={styles.linkDesc}>设置定时和触发任务</span>
          </div>
        </div>
      </div>
    </div>
  )
}
