// GeoWork - ModeSwitcher Component
// Switch between Work / Code / Paper / PPT modes

import React from 'react'
import useShellStore from '../../../stores/shellStore'
import styles from './ModeSwitcher.module.scss'

type AppMode = 'work' | 'code' | 'paper' | 'ppt'

const modes: { key: AppMode; label: string; icon: string; desc: string }[] = [
  { key: 'work', label: '工作', icon: '📋', desc: '通用工作流' },
  { key: 'code', label: '编码', icon: '💻', desc: '代码开发' },
  { key: 'paper', label: '论文', icon: '📄', desc: '研究论文' },
  { key: 'ppt', label: '演示', icon: '🎯', desc: 'PPT 演示' },
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
