// GeoWork Desktop - Agent Recovery Banner
// Banner shown when task needs recovery

import React from 'react'
import { Button } from '../../../components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import useAgentStore from '../agentStore'
import styles from './AgentRecoveryBanner.module.scss'

type StateType = 'recoverable' | 'read-only' | 'failed'

export const AgentRecoveryBanner: React.FC<{ taskId: string }> = ({ taskId }) => {
  const recoveryState = useAgentStore((s) => s.recoveryState)
  const isRecovering = useAgentStore((s) => s.isRecovering)
  const recoverTask = useAgentStore((s) => s.recoverTask)

  if (!recoveryState || !recoveryState.canContinue) {
    return null
  }

  const stateType = recoveryState.status
  const config = STATE_CONFIG[stateType]

  return (
    <div className={`${styles.banner} ${styles[stateType]}`}>
      <div className={styles.content}>
        <AlertTriangle className={styles.warningIcon} style={{ color: config.color }} />
        <div className={styles.text}>
          <span className={styles.title}>{config.title}</span>
          <span className={styles.description}>{config.description}</span>
        </div>
      </div>
      <div className={styles.actions}>
        {stateType !== 'failed' && (
          <Button
            onClick={() => recoverTask(taskId)}
            className={styles.recoverBtn}
            disabled={isRecovering}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRecovering ? 'animate-spin' : ''}`} />
            恢复任务
          </Button>
        )}
        <Button variant="ghost" onClick={() => console.log('查看只读快照', recoveryState)}>
          查看只读快照
        </Button>
      </div>
    </div>
  )
}

interface ConfigItem {
  color: string
  title: string
  description: string
}

const STATE_CONFIG: Record<StateType, ConfigItem> = {
  recoverable: {
    color: '#f2c94c',
    title: '任务可恢复',
    description: '任务已暂停，可以从最近检查点恢复继续执行。',
  },
  'read-only': {
    color: '#ff6b6b',
    title: '只读模式',
    description: '任务无法恢复，只能查看只读快照。',
  },
  failed: {
    color: '#ff6b6b',
    title: '任务失败',
    description: '任务执行失败，无法恢复。',
  },
}

export default AgentRecoveryBanner
