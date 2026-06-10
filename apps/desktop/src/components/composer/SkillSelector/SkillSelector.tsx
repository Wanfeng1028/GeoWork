// GeoWork - SkillSelector Component
// Select pre-configured skills for the agent

import React from 'react'
import { mockSkills } from '../../../mocks/tasks.mock'
import styles from './SkillSelector.module.scss'

export const SkillSelector: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>技能</span>
        <span className={styles.count}>{mockSkills.length} 已配置</span>
      </div>
      <div className={styles.skills}>
        {mockSkills.map((skill) => (
          <div
            key={skill.id}
            className={`${styles.skill} ${skill.enabled ? styles.enabled : ''}`}
          >
            <span className={styles.icon}>{skill.icon}</span>
            <span className={styles.name}>{skill.name}</span>
            {skill.enabled && (
              <span className={styles.dot} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SkillSelector
