// GeoWork - StrengthSelector Component

import React from 'react'
import { Zap, Flame } from 'lucide-react'
import { cn } from '../../../lib/cn'
import styles from './StrengthSelector.module.scss'

type StrengthLevel = 'low' | 'normal' | 'high'

const STRENGTH_OPTIONS: { value: StrengthLevel; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'low', label: '轻量', icon: <Zap size={12} />, desc: '快速执行' },
  { value: 'normal', label: '标准', icon: <Flame size={12} />, desc: '平衡模式' },
  { value: 'high', label: '全力', icon: <Flame size={12} />, desc: '最大资源' },
]

export type { StrengthLevel }

interface StrengthSelectorProps {
  value?: StrengthLevel
  onChange?: (strength: StrengthLevel) => void
}

export const StrengthSelector: React.FC<StrengthSelectorProps> = ({
  value = 'normal',
  onChange,
}) => {
  return (
    <div className={styles.container}>
      <span className={styles.label}>强度</span>
      <div className={styles.group}>
        {STRENGTH_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={cn(styles.option, value === opt.value && styles.active)}
            onClick={() => onChange?.(opt.value)}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default StrengthSelector
