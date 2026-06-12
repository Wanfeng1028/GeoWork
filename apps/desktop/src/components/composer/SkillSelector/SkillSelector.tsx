// GeoWork - SkillSelector Component

import React from 'react'
import { Badge } from '../../ui/badge'
import { cn } from '../../../lib/cn'
import styles from './SkillSelector.module.scss'

export interface SkillOption {
  id: string
  name: string
  icon: string
  category: string
  enabled?: boolean
}

export const AVAILABLE_SKILLS: SkillOption[] = [
  { id: 'python', name: 'Python 分析', icon: '🐍', category: '计算' },
  { id: 'geojson', name: 'GeoJSON 处理', icon: '🗺️', category: '地理' },
  { id: 'raster', name: '栅格计算', icon: '📐', category: '计算' },
  { id: 'network', name: '网络分析', icon: '🌐', category: '地理' },
  { id: 'ndvi', name: 'NDVI 植被指数', icon: '🌿', category: '遥感' },
  { id: 'classification', name: '图像分类', icon: '🏷️', category: '遥感' },
  { id: 'shapefile', name: 'Shapefile 处理', icon: '📁', category: '地理' },
  { id: 'report', name: '报告生成', icon: '📄', category: '文档' },
  { id: 'visualization', name: '数据可视化', icon: '📊', category: '文档' },
  { id: 'map_layout', name: '地图排版', icon: '🖼️', category: '制图' },
]

interface SkillSelectorProps {
  selectedSkillIds?: string[]
  onToggle?: (skillId: string) => void
  compact?: boolean
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  selectedSkillIds = [],
  onToggle,
  compact = false,
}) => {
  const enabledSkills = AVAILABLE_SKILLS.filter(s =>
    selectedSkillIds.length === 0 || selectedSkillIds.includes(s.id)
  )

  if (compact) {
    return (
      <div className={styles.container}>
        {enabledSkills.length > 0 ? (
          <>
            {enabledSkills.map(skill => (
              <Badge
                key={skill.id}
                variant={selectedSkillIds.includes(skill.id) ? 'accent' : 'default'}
                className={styles.tag}
              >
                {skill.icon} {skill.name}
              </Badge>
            ))}
          </>
        ) : (
          <Badge variant="default" className={styles.tag}>选择技能以增强能力</Badge>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>技能</span>
        <span className={styles.count}>
          {enabledSkills.length} / {AVAILABLE_SKILLS.length} 已选
        </span>
      </div>
      <div className={styles.skills}>
        {AVAILABLE_SKILLS.map((skill) => {
          const isActive = selectedSkillIds.includes(skill.id)
          return (
            <button
              key={skill.id}
              className={cn(styles.skill, isActive && styles.enabled)}
              onClick={() => onToggle?.(skill.id)}
              title={skill.category}
            >
              <span className={styles.icon}>{skill.icon}</span>
              <span className={styles.name}>{skill.name}</span>
              <span className={styles.category}>{skill.category}</span>
              {isActive && <span className={styles.check}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SkillSelector
