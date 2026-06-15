import React from 'react'
import { Plus, Bot } from 'lucide-react'
import styles from './ExpertCard.module.scss'

export interface ExpertSkill {
  id: string
  name: string
  description: string
}

export interface ExpertItem {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  color: string
  skills: ExpertSkill[]
  category: string
}

export interface ExpertCardProps {
  expert: ExpertItem
  onCall?: (expert: ExpertItem) => void
}

export default function ExpertCard({ expert, onCall }: ExpertCardProps) {
  const handleCall = () => {
    onCall?.(expert)
  }

  return (
    <article className={styles.card}>
      <div className={styles.icon}>
        {expert.icon ?? <Bot size={18} />}
      </div>
      <button
        className={styles.plus}
        onClick={(e) => {
          e.stopPropagation()
          handleCall()
        }}
        title="调用专家"
        aria-label="调用专家"
      >
        <Plus size={18} />
      </button>
      <strong className={styles.name}>{expert.name}</strong>
      <em className={styles.category}>{expert.category}</em>
      <span className={styles.desc}>{expert.description}</span>
      <small className={styles.skillCount}>{expert.skills.length} 项技能</small>
    </article>
  )
}
