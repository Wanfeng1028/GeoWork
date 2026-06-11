// GeoWork Desktop - Agent Step Timeline
// Visual timeline of agent execution steps

import React from 'react'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { GwCard } from '../../../components/foundation/GwCard/GwCard'
import useAgentStore from '../agentStore'
import styles from './AgentStepTimeline.module.scss'

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircleOutlined className={`${styles.icon} ${styles.completed}`} />,
  running: <LoadingOutlined className={`${styles.icon} ${styles.running}`} />,
  failed: <CloseCircleOutlined className={`${styles.icon} ${styles.failed}`} />,
  pending: <ClockCircleOutlined className={`${styles.icon} ${styles.pending}`} />,
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '-'
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const ms = end - start
  if (ms < 1000) return '<1s'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export const AgentStepTimeline: React.FC = () => {
  const steps = useAgentStore((s) => s.currentSteps)
  const isRunning = useAgentStore((s) => s.isRunning)
  const error = useAgentStore((s) => s.error)

  if (!isRunning && steps.length === 0) {
    return (
      <GwCard variant="outlined" bordered title="Execution Timeline" className={styles.timelineCard}>
        <div className={styles.empty}>No steps to display.</div>
      </GwCard>
    )
  }

  const displaySteps = isRunning && steps.length === 0 ? [{
    id: 'waiting',
    title: 'Waiting for agent to start...',
    status: 'pending' as const,
  }] : steps

  return (
    <GwCard variant="outlined" bordered title="Execution Timeline" className={styles.timelineCard}>
      <div className={styles.timeline}>
        {displaySteps.map((step, index) => {
          const isLast = index === displaySteps.length - 1
          const statusColor =
            step.status === 'completed' ? 'var(--gw-accent)'
              : step.status === 'running' ? 'var(--gw-accent-blue)'
              : step.status === 'failed' ? 'var(--gw-danger)'
              : 'var(--gw-text-tertiary)'

          return (
            <React.Fragment key={step.id}>
              <div
                className={`${styles.step} ${step.status === 'running' ? styles.stepRunning : ''} ${step.status === 'failed' ? styles.stepFailed : ''}`}
                style={{ '--step-color': statusColor } as React.CSSProperties}
              >
                <div className={styles.stepNode}>
                  <div className={styles.stepNumber}>{index + 1}</div>
                  <div className={styles.stepDot}>
                    {STATUS_ICONS[step.status] || STATUS_ICONS.pending}
                  </div>
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>
                    {step.title}
                    {step.toolName && <span className={styles.toolName}>{step.toolName}</span>}
                  </div>
                  <div className={styles.stepMeta}>
                    <span className={styles.duration}>{formatDuration(step.startedAt, step.completedAt)}</span>
                    <span className={styles.statusText} style={{ color: statusColor }}>
                      {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              {!isLast && (
                <div className={styles.connector} style={{ borderColor: statusColor }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </GwCard>
  )
}

export default AgentStepTimeline
