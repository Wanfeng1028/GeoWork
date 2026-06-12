// GeoWork - SpeedSelector Component

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../../lib/cn'
import styles from './SpeedSelector.module.scss'

type SpeedLevel = 'fast' | 'balanced' | 'thorough'

const SPEED_OPTIONS: { value: SpeedLevel; label: string; color: string; desc: string }[] = [
  { value: 'fast', label: '快速', color: 'var(--gw-success)', desc: '最少步骤' },
  { value: 'balanced', label: '均衡', color: 'var(--gw-info)', desc: '平衡质量' },
  { value: 'thorough', label: '详尽', color: '#722ed1', desc: '最大覆盖' },
]

export type { SpeedLevel }

interface SpeedSelectorProps {
  value?: SpeedLevel
  onChange?: (speed: SpeedLevel) => void
}

export const SpeedSelector: React.FC<SpeedSelectorProps> = ({
  value = 'balanced',
  onChange,
}) => {
  return (
    <div className={styles.container}>
      <span className={styles.label}>速率</span>
      <div className={styles.group}>
        {SPEED_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={cn(styles.option, value === opt.value && styles.active)}
            onClick={() => onChange?.(opt.value)}
          >
            <Loader2 size={12} style={{ color: opt.color }} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default SpeedSelector
