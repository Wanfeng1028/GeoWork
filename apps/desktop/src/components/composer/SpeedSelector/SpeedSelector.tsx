// GeoWork - SpeedSelector Component
// Select execution speed (fast, balanced, thorough)

import React from 'react'
import { Radio } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import styles from './SpeedSelector.module.scss'

type SpeedLevel = 'fast' | 'balanced' | 'thorough'

const SPEED_OPTIONS: { value: SpeedLevel; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'fast', label: '快速', icon: <LoadingOutlined style={{ color: '#52c41a' }} />, desc: '最少步骤' },
  { value: 'balanced', label: '均衡', icon: <LoadingOutlined style={{ color: '#1890ff' }} />, desc: '平衡质量' },
  { value: 'thorough', label: '详尽', icon: <LoadingOutlined style={{ color: '#722ed1' }} />, desc: '最大覆盖' },
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
      <Radio.Group
        value={value}
        onChange={(e) => onChange?.(e.target.value as SpeedLevel)}
        optionType="button"
        buttonStyle="solid"
        className={styles.group}
      >
        {SPEED_OPTIONS.map(opt => (
          <Radio.Button key={opt.value} value={opt.value} className={styles.option}>
            {opt.icon}
            <span>{opt.label}</span>
          </Radio.Button>
        ))}
      </Radio.Group>
    </div>
  )
}

export default SpeedSelector
