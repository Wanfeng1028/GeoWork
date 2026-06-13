// GeoWork - ModeSwitcher Component
// Switch between Work / Code / Paper / PPT modes

import React from 'react'
import useShellStore from '../../../stores/shellStore'
import type { AppMode } from '../../../types/shell'
import styles from './ModeSwitcher.module.scss'

const modes: { key: AppMode; label: string; icon: string; desc: string }[] = [
  { key: 'general', label: '工作', icon: '📋', desc: '通用工作流' },
  { key: 'analysis', label: '分析', icon: '📊', desc: '数据分析' },
  { key: 'research', label: '研究', icon: '📄', desc: '研究论文' },
  { key: 'automation', label: '自动化', icon: '⚙️', desc: '自动化任务' },
]

export const ModeSwitcher: React.FC = () => {
  const { activeMode, setActiveMode } = useShellStore()

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {modes.map((mode) => {
          const isActive = mode.key === activeMode
          return (
            <button
              key={mode.key}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => setActiveMode(mode.key)}
              title={mode.desc}
            >
              <span className={styles.icon}>{mode.icon}</span>
              <span className={styles.label}>{mode.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ModeSwitcher
