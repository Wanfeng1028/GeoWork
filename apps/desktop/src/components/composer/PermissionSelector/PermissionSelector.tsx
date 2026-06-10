// GeoWork - PermissionSelector Component
// Select permission level for agent operations

import React from 'react'
import usePermissionStore from '../../../stores/permissionStore'
import styles from './PermissionSelector.module.scss'

type PermissionLevel = 'read_only' | 'ask_every_time' | 'limited' | 'full_access'

const levels: { key: PermissionLevel; label: string; icon: string; desc: string; risk: 'low' | 'medium' | 'high' | 'critical' }[] = [
  { key: 'read_only', label: '只读', icon: '🔒', desc: '只读取选定上下文', risk: 'low' },
  { key: 'ask_every_time', label: '每次询问', icon: '⚠️', desc: '危险操作全部审批', risk: 'medium' },
  { key: 'limited', label: '受限访问', icon: '🛡️', desc: '工作区内允许读写', risk: 'low' },
  { key: 'full_access', label: '完全访问', icon: '⚡', desc: '工作区自动执行', risk: 'high' },
]

const riskColors: Record<string, string> = {
  low: 'var(--gw-accent)',
  medium: 'var(--gw-warning)',
  high: 'var(--gw-danger)',
  critical: '#ff4d4f',
}

export const PermissionSelector: React.FC = () => {
  const { defaultLevel, setDefaultLevel } = usePermissionStore()

  return (
    <div className={styles.container}>
      <div className={styles.label}>
        <span className={styles.labelText}>权限级别</span>
        <span className={styles.currentLevel}>
          {levels.find(l => l.key === defaultLevel)?.icon}
          {' '}
          {levels.find(l => l.key === defaultLevel)?.label}
        </span>
      </div>
      <div className={styles.options}>
        {levels.map((level) => {
          const isActive = level.key === defaultLevel
          return (
            <button
              key={level.key}
              className={`${styles.option} ${isActive ? styles.active : ''}`}
              onClick={() => setDefaultLevel(level.key)}
              title={level.desc}
            >
              <span className={styles.icon}>{level.icon}</span>
              <span className={styles.label}>{level.label}</span>
              <span
                className={styles.risk}
                style={{ background: riskColors[level.risk] }}
              >
                {level.risk === 'low' ? '低' : level.risk === 'medium' ? '中' : level.risk === 'high' ? '高' : '危'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default PermissionSelector
