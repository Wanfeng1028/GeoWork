// GeoWork - TaskModeSelector Component

import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
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
      <Select value={value} onValueChange={onChange as (v: string) => void}>
        <SelectTrigger className={styles.modeSelect}>
          <SelectValue placeholder="选择模式" />
        </SelectTrigger>
        <SelectContent>
          {MODES.map(m => (
            <SelectItem key={m.value} value={m.value}>
              {m.icon} {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default TaskModeSelector
