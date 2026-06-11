// GeoWork - TaskModeSelector Component
// Select the task mode: Research, Data, GeoCode, Analysis, Write

import React from 'react'
import { Select } from 'antd'
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
      <Select
        value={value}
        onChange={onChange}
        size="small"
        className={styles.modeSelect}
        options={MODES.map(m => ({ label: `${m.icon} ${m.label}`, value: m.value }))}
      />
    </div>
  )
}

export default TaskModeSelector
