// GeoWork SkillPickerButton — Radix Popover picker, ported from QoderWorkCopy picker-popover.

import React from 'react'
import { Zap } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import styles from './SkillPickerButton.module.scss'

interface Skill {
  id: string
  name: string
  icon: string
  description: string
  enabled: boolean
}

const AVAILABLE_SKILLS: Skill[] = [
  { id: 'python', name: 'Python 分析', icon: '🐍', description: '运行 Python 脚本处理地理数据', enabled: true },
  { id: 'geojson', name: 'GeoJSON 处理', icon: '🗺️', description: '矢量数据的读写与转换', enabled: true },
  { id: 'raster', name: '栅格计算', icon: '📐', description: '栅格代数与波段运算', enabled: false },
  { id: 'network', name: '网络分析', icon: '🌐', description: '最短路径与可达性分析', enabled: false },
]

interface SkillPickerButtonProps {
  selectedSkillIds?: string[]
  onToggle?: (skillId: string) => void
}

export const SkillPickerButton: React.FC<SkillPickerButtonProps> = ({
  selectedSkillIds = [],
  onToggle,
}) => {
  const [open, setOpen] = React.useState(false)
  const isCustom = selectedSkillIds.length > 0

  return (
    <div className={styles.container}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${styles.trigger} ${isCustom ? styles.custom : ''}`}
            title="技能"
          >
            <Zap size={16} />
            {isCustom && <span className={styles.badge}>{selectedSkillIds.length}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" sideOffset={8} className={styles.popover}>
          <div className={styles.popoverHead}>
            <span>技能</span>
            <button onClick={() => setOpen(false)}>完成</button>
          </div>
          {AVAILABLE_SKILLS.map((skill) => {
            const isActive = selectedSkillIds.includes(skill.id)
            return (
              <button
                key={skill.id}
                type="button"
                className={`${styles.row} ${isActive ? styles.active : ''}`}
                onClick={() => onToggle?.(skill.id)}
              >
                <span className={styles.rowIcon}>{skill.icon}</span>
                <span className={styles.rowBody}>
                  <strong>{skill.name}</strong>
                  <span>{skill.description}</span>
                </span>
                <span className={`${styles.rowStatus} ${isActive ? '' : styles.off}`}>
                  {isActive ? '已启用' : skill.enabled ? '可用' : '即将上线'}
                </span>
              </button>
            )
          })}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default SkillPickerButton
