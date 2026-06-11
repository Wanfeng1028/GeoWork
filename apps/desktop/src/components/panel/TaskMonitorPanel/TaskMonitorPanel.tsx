// GeoWork TaskMonitorPanel - Real data from taskStore

import { List, Tag, Progress, Alert, Spin, Collapse } from 'antd'
import {
  CheckCircleOutlined,
  StopOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import useTaskStore from '../../../stores/taskStore'
import type { TaskStep } from '../../../types/task'
import styles from './TaskMonitorPanel.module.scss'

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'default', label: '待处理', icon: <span className={styles.dot} /> },
  running: { color: 'processing', label: '运行中', icon: <LoadingOutlined /> },
  completed: { color: 'success', label: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', label: '失败', icon: <CloseCircleOutlined /> },
  waiting_approval: { color: 'warning', label: '等待审批', icon: <StopOutlined /> },
  recovered: { color: 'cyan', label: '已恢复', icon: <ReloadOutlined /> },
}

const STEP_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  running: { color: 'blue', label: '运行中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
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
          <Spin tip="加载中..." />
        </div>
      </div>
    )
  }

  if (!currentTask) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <p className={styles.emptyText}>暂无运行中的任务</p>
          <p className={styles.emptyHint}>在任务面板创建新任务</p>
        </div>
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
      {/* Error alert */}
      {currentTask.error && (
        <Alert
          className={styles.errorAlert}
          message={currentTask.error}
          type="error"
          showIcon
          closable
        />
      )}

      {/* Task info header */}
      <div className={styles.taskInfo}>
        <div className={styles.taskHeader}>
          <h3 className={styles.taskTitle}>
            {currentTask.mode || 'Task'} - {currentTask.id}
          </h3>
          <Tag color={statusConfig.color} className={styles.taskStatus}>
            {statusConfig.icon}
            {' '}
            {statusConfig.label}
          </Tag>
        </div>

        <div className={styles.taskMeta}>
          <span className={styles.taskId}>{currentTask.id}</span>
          <span className={styles.taskTime}>
            {new Date(currentTask.createdAt).toLocaleString()}
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          percent={progressPercent}
          size="small"
          status={currentTask.status === 'failed' ? 'exception' : 'normal'}
          className={styles.progress}
        />
      </div>

      {/* Steps list */}
      <div className={styles.stepsSection}>
        <h4 className={styles.sectionTitle}>
          任务步骤 ({completedCount}/{totalCount} 完成)
        </h4>

        <List
          dataSource={allSteps}
          renderItem={(step) => (
            <List.Item className={styles.stepItem}>
              <div className={styles.stepStatus}>
                <Tag color={STEP_STATUS_CONFIG[step.status]?.color || 'default'}>
                  {STEP_STATUS_CONFIG[step.status]?.label || step.status}
                </Tag>
              </div>
              <span className={styles.stepTitle}>{step.title}</span>
              {step.toolName && (
                <span className={styles.stepTool}>{step.toolName}</span>
              )}
              {step.startedAt && (
                <span className={styles.stepTime}>
                  {new Date(step.startedAt).toLocaleTimeString()}
                </span>
              )}
            </List.Item>
          )}
        />
      </div>

      {/* Active steps summary */}
      <div className={styles.summary}>
        {pendingSteps.length > 0 && (
          <Tag className={styles.summaryTag}>待处理: {pendingSteps.length}</Tag>
        )}
        {runningStep && (
          <Tag color="blue" className={styles.summaryTag}>
            运行中: {runningStep.title}
          </Tag>
        )}
        {failedSteps.length > 0 && (
          <Tag color="red" className={styles.summaryTag}>
            失败: {failedSteps.length}
          </Tag>
        )}
      </div>

      {/* Recent events */}
      {events.length > 0 && (
        <div className={styles.eventsSection}>
          <h4 className={styles.sectionTitle}>最近事件</h4>
          <Collapse
            className={styles.eventsCollapse}
            size="small"
            items={events.slice(-10).reverse().map(event => ({
              key: event.id,
              label: (
                <Tag color={event.type.includes('error') ? 'red' : 'blue'}>
                  {event.type}
                </Tag>
              ),
              children: (
                <p className={styles.eventMessage}>{event.message}</p>
              ),
            }))}
          />
        </div>
      )}

      {/* Actions */}
      {currentTask.status === 'running' && (
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            <StopOutlined />
            取消任务
          </button>
        </div>
      )}

      {currentTask.status === 'failed' && (
        <div className={styles.actions}>
          <button className={styles.recoverBtn}>
            <ReloadOutlined />
            恢复任务
          </button>
        </div>
      )}
    </div>
  )
}

export default TaskMonitorPanel
