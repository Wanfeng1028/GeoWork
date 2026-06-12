// GeoWork - SkillPickerButton Component

import React from 'react'
import { Zap } from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/cn'
import styles from './SkillPickerButton.module.scss'

interface Skill {
  id: string
  name: string
  icon: string
  enabled: boolean
}

const AVAILABLE_SKILLS: Skill[] = [
  { id: 'python', name: 'Python 分析', icon: '🐍', enabled: true },
  { id: 'geojson', name: 'GeoJSON 处理', icon: '🗺️', enabled: true },
  { id: 'raster', name: '栅格计算', icon: '📐', enabled: false },
  { id: 'network', name: '网络分析', icon: '🌐', enabled: false },
]

interface SkillPickerButtonProps {
  selectedSkillIds?: string[]
  onToggle?: (skillId: string) => void
}

export const SkillPickerButton: React.FC<SkillPickerButtonProps> = ({
  selectedSkillIds = [],
  onToggle,
}) => {
  const enabledSkills = AVAILABLE_SKILLS.filter(s => s.enabled)
  const isCustom = selectedSkillIds.length > 0

  return (
    <div className={styles.container}>
      <Button
        variant={isCustom ? 'primary' : 'secondary'}
        size="sm"
        className={cn(styles.trigger, isCustom && styles.custom)}
        onClick={() => {
          const popup = document.getElementById('skill-picker-popup')
          if (popup) {
            popup.style.display = popup.style.display === 'none' ? 'block' : 'none'
          }
        }}
      >
        <Zap size={14} />
        技能
      </Button>
      {enabledSkills.length > 0 && (
        <span className={styles.badge}>{enabledSkills.length}</span>
      )}

      <div id="skill-picker-popup" className={styles.popup}>
        {AVAILABLE_SKILLS.map(skill => {
          const isActive = selectedSkillIds.includes(skill.id) || skill.enabled
          return (
            <button
              key={skill.id}
              className={cn(styles.skillItem, isActive && styles.active)}
              onClick={() => onToggle?.(skill.id)}
            >
              <span className={styles.skillIcon}>{skill.icon}</span>
              <span className={styles.skillName}>{skill.name}</span>
              {isActive && <span className={styles.check}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SkillPickerButton
