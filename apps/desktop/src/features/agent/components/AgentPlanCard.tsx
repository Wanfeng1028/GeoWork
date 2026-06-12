// GeoWork Desktop - Agent Plan Card
// Displays the agent's execution plan with collapsible step details

import React, { useMemo } from 'react'
import { Badge } from '../../../components/ui/badge'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { GwCard } from '../../../components/foundation/GwCard/GwCard'
import useAgentStore from '../agentStore'
import styles from './AgentPlanCard.module.scss'

const MODE_CONFIG: Record<string, { color: string; label: string }> = {
  work: { color: '#4ddc97', label: 'Work' },
  code: { color: '#4aa3ff', label: 'Code' },
  paper: { color: '#c77dff', label: 'Paper' },
  ppt: { color: '#f2c94c', label: 'PPT' },
}

const STEP_STATUS_MAP: Record<string, { icon: React.ReactNode; color: string; text: string }> = {
  completed: { icon: <CheckCircle className={styles.iconCompleted} />, color: '#4ddc97', text: 'Completed' },
  running: { icon: <Loader2 className={`${styles.iconRunning} animate-spin`} />, color: '#4aa3ff', text: 'Running' },
  failed: { icon: <XCircle className={styles.iconFailed} />, color: '#ff6b6b', text: 'Failed' },
  pending: { icon: <Clock className={styles.iconPending} />, color: '#6f7b8e', text: 'Pending' },
}

export const AgentPlanCard: React.FC = () => {
  const currentPlan = useAgentStore((s) => s.currentPlan)
  const isRunning = useAgentStore((s) => s.isRunning)
  const error = useAgentStore((s) => s.error)

  const modeInfo = useMemo(() => {
    if (!currentPlan) return null
    const key = currentPlan.mode.toLowerCase()
    return MODE_CONFIG[key] ?? { color: '#6f7b8e', label: currentPlan.mode }
  }, [currentPlan])

  if (!currentPlan) {
    return (
      <GwCard variant="outlined" bordered title="Execution Plan" className={styles.planCard}>
        {error && <div className={styles.error}>{error}</div>}
        {!error && isRunning && <div className={styles.empty}>No plan available yet.</div>}
      </GwCard>
    )
  }

  return (
    <GwCard variant="outlined" bordered title="Execution Plan" className={styles.planCard}>
      {modeInfo && (
        <div className={styles.modeBanner} style={{ borderColor: modeInfo.color, background: `${modeInfo.color}14` }}>
          <Badge className={styles.modeTag} style={{ backgroundColor: `${modeInfo.color}30`, color: modeInfo.color }}>
            {modeInfo.label}
          </Badge>
        </div>
      )}
      <div className="flex flex-col">
        {currentPlan.steps.map((step) => {
          const statusInfo = STEP_STATUS_MAP[step.status] ?? STEP_STATUS_MAP.pending
          const toolTag = step.tool ? (
            <Badge className={styles.toolTag}>{step.tool}</Badge>
          ) : null

          return (
            <details key={step.id} className={styles.stepPanel}>
              <summary className={styles.stepLabel}>
                <span className={styles.stepIcon}>{statusInfo.icon}</span>
                <span
                  className={styles.stepTitle}
                  style={{ color: step.status === 'failed' ? '#ff6b6b' : undefined }}
                >
                  {step.title}
                </span>
                <span className={styles.stepStatus} style={{ color: statusInfo.color }}>
                  {statusInfo.text}
                </span>
              </summary>
              {toolTag && <div className={styles.stepDetail}>{toolTag}</div>}
            </details>
          )
        })}
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </GwCard>
  )
}

export default AgentPlanCard
