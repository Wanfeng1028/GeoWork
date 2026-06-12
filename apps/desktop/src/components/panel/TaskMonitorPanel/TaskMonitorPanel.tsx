// GeoWork TaskMonitorPanel

import {
  CheckCircle,
  Square,
  Loader2,
  XCircle,
  RotateCw,
  MinusCircle,
} from 'lucide-react'
import useTaskStore from '../../../stores/taskStore'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Spinner } from '../../ui/spinner'
import { Empty } from '../../ui/empty'
import { Separator } from '../../ui/separator'
import styles from './TaskMonitorPanel.module.scss'

const STATUS_CONFIG: Record<string, { variant: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info'; label: string; icon: React.ReactNode }> = {
  pending: { variant: 'default', label: '待处理', icon: <span className={styles.dot} /> },
  running: { variant: 'info', label: '运行中', icon: <Loader2 size={12} className="animate-spin" /> },
  completed: { variant: 'success', label: '已完成', icon: <CheckCircle size={12} /> },
  failed: { variant: 'danger', label: '失败', icon: <XCircle size={12} /> },
  cancelled: { variant: 'default', label: '已取消', icon: <MinusCircle size={12} /> },
  waiting_approval: { variant: 'warning', label: '等待审批', icon: <Square size={12} /> },
  recovered: { variant: 'info', label: '已恢复', icon: <RotateCw size={12} /> },
}

const STEP_STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'danger',
}

export function TaskMonitorPanel() {
  const {
    currentTask,
    events,
    pendingSteps,
    runningStep,
    completedSteps,
    failedSteps,
    isLoading,
    error,
    cancelTask,
  } = useTaskStore()

  if (isLoading && !currentTask) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <Spinner size="md" />
          <span className="text-[12px] text-[var(--gw-text-tertiary)] ml-2">加载中...</span>
        </div>
      </div>
    )
  }

  if (!currentTask) {
    return (
      <div className={styles.panel}>
        <Empty title="暂无运行中的任务" description="在任务面板创建新任务" />
      </div>
    )
  }

  const allSteps = currentTask.plan || []
  const completedCount = completedSteps.length
  const totalCount = allSteps.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const statusConfig = STATUS_CONFIG[currentTask.status] || STATUS_CONFIG.pending

  const handleCancel = async () => {
    try {
      await cancelTask(currentTask.id)
    } catch (err) {
      console.error('Failed to cancel task:', err)
    }
  }

  return (
    <div className={styles.panel}>
      {currentTask.error && (
        <div className={styles.errorAlert}>
          <XCircle size={14} className="text-[var(--gw-danger)]" />
          <span>{currentTask.error}</span>
        </div>
      )}

      <div className={styles.taskInfo}>
        <div className={styles.taskHeader}>
          <h3 className={styles.taskTitle}>
            {currentTask.mode || 'Task'} - {currentTask.id}
          </h3>
          <Badge variant={statusConfig.variant}>
            {statusConfig.icon} {statusConfig.label}
          </Badge>
        </div>

        <div className={styles.taskMeta}>
          <span className={styles.taskId}>{currentTask.id}</span>
          <span className={styles.taskTime}>
            {new Date(currentTask.createdAt).toLocaleString()}
          </span>
        </div>

        <div className={styles.progress}>
          <div className="h-1.5 w-full rounded-full bg-[var(--gw-bg-active)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                currentTask.status === 'failed' || currentTask.status === 'cancelled'
                  ? 'bg-[var(--gw-danger)]'
                  : 'bg-[var(--gw-accent)]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className={styles.stepsSection}>
        <h4 className={styles.sectionTitle}>
          任务步骤 ({completedCount}/{totalCount} 完成)
        </h4>

        <div className="flex flex-col gap-1">
          {allSteps.map((step) => (
            <div key={step.id} className={styles.stepItem}>
              <Badge variant={STEP_STATUS_VARIANT[step.status] || 'default'}>
                {step.status === 'running' && <Loader2 size={10} className="animate-spin" />}
                {step.status}
              </Badge>
              <span className={styles.stepTitle}>{step.title}</span>
              {step.toolName && (
                <span className={styles.stepTool}>{step.toolName}</span>
              )}
              {step.startedAt && (
                <span className={styles.stepTime}>
                  {new Date(step.startedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.summary}>
        {pendingSteps.length > 0 && (
          <Badge variant="default">待处理: {pendingSteps.length}</Badge>
        )}
        {runningStep && (
          <Badge variant="info">运行中: {runningStep.title}</Badge>
        )}
        {failedSteps.length > 0 && (
          <Badge variant="danger">失败: {failedSteps.length}</Badge>
        )}
      </div>

      {events.length > 0 && (
        <div className={styles.eventsSection}>
          <h4 className={styles.sectionTitle}>最近事件</h4>
          <div className="flex flex-col gap-1">
            {events.slice(-10).reverse().map(event => (
              <div key={event.id} className="flex items-start gap-2 py-1">
                <Badge variant={event.type.includes('error') ? 'danger' : 'info'}>
                  {event.type}
                </Badge>
                <span className="text-[12px] text-[var(--gw-text-secondary)]">{event.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentTask.status === 'running' && (
        <div className={styles.actions}>
          <Button variant="danger" size="sm" onClick={handleCancel}>
            <Square size={14} />
            取消任务
          </Button>
        </div>
      )}

      {currentTask.status === 'failed' && (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm">
            <RotateCw size={14} />
            恢复任务
          </Button>
        </div>
      )}
    </div>
  )
}

export default TaskMonitorPanel
