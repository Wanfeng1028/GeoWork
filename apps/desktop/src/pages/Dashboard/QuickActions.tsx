import React from 'react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { toast } from 'sonner'
import {
  Plus,
  Download,
  FlaskConical,
  FileText
} from 'lucide-react'
import { api } from '../../services/api'
import styles from './QuickActions.module.scss'

export interface QuickAction {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  description: string
  action: (values?: Record<string, any>) => Promise<void> | void
}

export interface QuickActionsProps {
  actions?: QuickAction[]
  onAction?: (action: QuickAction) => void
}

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    key: 'new-project',
    label: '新建项目',
    icon: <Plus />,
    color: 'blue',
    description: '创建一个新的 GeoWork 项目',
    action: async (values) => {
      await api.createProject({ name: values?.prompt || 'GeoWork 新项目', mode: 'Research' })
      toast.success('项目已创建')
    }
  },
  {
    key: 'import-data',
    label: '导入数据',
    icon: <Download />,
    color: 'green',
    description: '导入遥感数据或本地文件',
    action: async (values) => {
      await api.registerDataset({
        name: values?.prompt || '本地遥感数据',
        type: 'GeoTIFF',
        path: values?.prompt || 'data/imported-dataset.tif',
      })
      toast.success('数据已登记')
    }
  },
  {
    key: 'ndvi-analysis',
    label: '运行 NDVI 分析',
    icon: <FlaskConical />,
    color: 'orange',
    description: '使用 GEE 运行 NDVI 植被指数分析',
    action: async (values) => {
      const task = await api.createTask({
        prompt: values?.prompt || '运行 NDVI 分析并生成 GEE 脚本、地图预览和实验报告',
        mode: 'Analysis',
      })
      await api.runTask(task.id)
      toast.success('NDVI 任务已启动')
    }
  },
  {
    key: 'view-report',
    label: '查看报告',
    icon: <FileText />,
    color: 'purple',
    description: '查看已生成的实验报告',
    action: async () => {
      const artifacts = await api.artifacts()
      const reports = artifacts.filter((item) => item.type === 'report')
      toast.info(reports.length ? `找到 ${reports.length} 个报告成果` : '暂无报告成果')
    }
  }
]

export default function QuickActions({
  actions = DEFAULT_ACTIONS,
  onAction
}: QuickActionsProps) {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedAction, setSelectedAction] = React.useState<QuickAction | null>(null)
  const [promptValue, setPromptValue] = React.useState('')

  const handleActionClick = (action: QuickAction) => {
    if (onAction) {
      onAction(action)
    } else {
      setSelectedAction(action)
      setModalOpen(true)
    }
  }

  const handleModalConfirm = async () => {
    if (selectedAction) {
      await selectedAction.action({ prompt: promptValue })
      setModalOpen(false)
      setPromptValue('')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>快速操作</h3>
        <span className={styles.subtitle}>开始你的地理遥感分析任务</span>
      </div>
      <div className={styles.grid}>
        {actions.map((action) => (
          <button
            key={action.key}
            className={styles.actionCard}
            onClick={() => handleActionClick(action)}
          >
            <div className={`${styles.iconWrapper} ${styles[`iconColor${action.color}`]}`}>
              {action.icon}
            </div>
            <div className={styles.actionInfo}>
              <span className={styles.actionLabel}>{action.label}</span>
              <span className={styles.actionDesc}>{action.description}</span>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAction?.label}</DialogTitle>
          </DialogHeader>
          {selectedAction && (
            <div className={styles.modalContent}>
              <p className="text-sm text-muted-foreground mb-4">{selectedAction.description}</p>
              <div>
                <label className="text-sm font-medium">任务描述</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  placeholder="请输入任务描述..."
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); setPromptValue('') }}>取消</Button>
            <Button onClick={handleModalConfirm}>确认执行</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
