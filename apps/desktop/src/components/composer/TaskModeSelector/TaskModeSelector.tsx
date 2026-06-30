// GeoWork - TaskModeSelector Component

import React from 'react'
import styles from './TaskModeSelector.module.scss'

export type TaskMode = 'Research' | 'Data' | 'GeoCode' | 'Analysis' | 'Write'

const MODES: { value: TaskMode; label: string; icon: string }[] = [
  { value: 'Research', label: 'Research', icon: '🔍' },
  { value: 'Data', label: 'Data', icon: '📊' },
  { value: 'GeoCode', label: 'GeoCode', icon: '📍' },
  { value: 'Analysis', label: 'Analysis', icon: '🧪' },
  { value: 'Write', label: 'Write', icon: '📝' },
]

interface TaskModeSelectorProps {
  value?: TaskMode
  onChange?: (mode: TaskMode) => void
}

export const TaskModeSelector: React.FC<TaskModeSelectorProps> = ({
  value = 'Analysis',
  onChange,
}) => {
  return (
    <div className={styles.container}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value as TaskMode)}
      >
        {MODES.map(m => (
          <option key={m.value}>
            {m.icon} {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default TaskModeSelector
