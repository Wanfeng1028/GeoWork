import React, { useState, useCallback } from 'react'
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
      <div >
        <div  />
      </div>
    )
  }

  if (error) {
    return (
      <div >
        <div >
          <AlertTriangle  />
          <span >加载失败</span>
          <button >重试</button>
        </div>
        <p >{error}</p>
      </div>
    )
  }

  const storageValue = storageUnit === 'GB' ? +(stats.storageUsed / 1024).toFixed(1) : stats.storageUsed
  const storageTotal = storageUnit === 'GB' ? +(stats.storageTotal / 1024).toFixed(0) : stats.storageTotal

  return (
    <div className={styles.dashboard}>
      {/* Welcome Section */}
      <div className={styles.welcome}>
        <div  style={{ background: '#1677ff' }}>
          <Bot  />
        </div>
        <div className={styles.welcomeText}>
          <h2 className={styles.greeting}>欢迎回来，GeoWork 用户</h2>
          <p className={styles.subtitle}>
            你目前有 {stats.activeTasks} 个任务正在运行，{stats.totalProjects} 个项目已创建。
          </p>
        </div>
        <div >
          <button onClick={onContinueAnalysis}>
            <Zap  /> 继续分析
          </button>
          <button onClick={onViewReport}>
            <FileText  /> 查看报告
          </button>
          <button onClick={onNewProject}>
            <Plus  /> 新建项目
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />

      {/* Stats Cards */}
      <div >
        <div>
          <div >
            <div >
              <Folder  />
              <div>
                <div >项目总数</div>
                <div >{stats.totalProjects}</div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div >
            <div >
              <RefreshCw  />
              <div>
                <div >进行中任务</div>
                <div >{stats.activeTasks}</div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div >
            <div >
              <Zap  />
              <div>
                <div >本月 API 调用</div>
                <div >{stats.monthlyApiCalls}</div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div >
            <div >
              <AlertTriangle  />
              <div >
                <div >存储空间</div>
                <div >
                  {storageValue}
                  <span  onClick={handleStorageToggle}>
                    {storageUnit}
                  </span>
                </div>
                <div >
                  <div >
                    <div
                      
                      style={{ width: `${(stats.storageUsed / stats.storageTotal) * 100}%` }}
                    />
                  </div>
                  <span >
                    {stats.storageUsed} / {stats.storageTotal} {storageUnit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid: Projects + Tasks */}
      <div className={styles.contentGrid}>
        <div>
          <div>
            <div>
              最近项目
              <span >查看全部</span>
            </div>
          </div>
          <div>
            {projects.length > 0 ? (
              <div >
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} onClick={handleProjectClick} />
                ))}
              </div>
            ) : (
              <div description="暂无项目" />
            )}
          </div>
        </div>

        <div>
          <div>
            <div>
              最近任务
              <span >查看全部</span>
            </div>
          </div>
          <div>
            {tasks.length > 0 ? (
              <div >
                {tasks.map((task) => (
                  <div key={task.id} >
                    <div >
                      {task.status === 'completed' ? (
                        <CheckCircle  />
                      ) : task.status === 'running' ? (
                        <RefreshCw  />
                      ) : task.status === 'failed' ? (
                        <AlertTriangle  />
                      ) : (
                        <Clock  />
                      )}
                    </div>
                    <div >
                      <div >
                        <span >{task.name}</span>
                        <span>
                          {task.status === 'completed' ? '已完成' :
                           task.status === 'running' ? '运行中' :
                           task.status === 'failed' ? '失败' : '等待中'}
                        </span>
                      </div>
                      {task.description && (
                        <div >{task.description}</div>
                      )}
                      <div >
                        {new Date(task.updatedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div description="暂无任务" />
            )}
          </div>
        </div>
      </div>

      {/* Usage Chart */}
      <div>
        <div>
          <div>用量统计</div>
        </div>
        <div>
          <UsageChart />
        </div>
      </div>

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
