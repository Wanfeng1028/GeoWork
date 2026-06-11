// GeoWork - SkillPickerButton Component
// Inline button to pick agent skills for the current task

import React from 'react'
import { Button } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
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
        size="small"
        icon={<ThunderboltOutlined />}
        className={`${styles.trigger} ${isCustom ? styles.custom : ''}`}
        type={isCustom ? 'primary' : 'default'}
        onClick={() => {
          // Toggle visibility of skill list
          const popup = document.getElementById('skill-picker-popup')
          if (popup) {
            popup.style.display = popup.style.display === 'none' ? 'block' : 'none'
          }
        }}
      >
        技能
      </Button>
      {enabledSkills.length > 0 && (
        <span className={styles.badge}>{enabledSkills.length}</span>
      )}

      {/* Skill popup list */}
      <div id="skill-picker-popup" className={styles.popup}>
        {AVAILABLE_SKILLS.map(skill => {
          const isActive = selectedSkillIds.includes(skill.id) || skill.enabled
          return (
            <button
              key={skill.id}
              className={`${styles.skillItem} ${isActive ? styles.active : ''}`}
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
