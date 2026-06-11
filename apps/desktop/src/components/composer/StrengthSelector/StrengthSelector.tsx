// GeoWork - StrengthSelector Component
// Select computation strength (low, normal, high)

import React from 'react'
import { Radio } from 'antd'
import { ThunderboltOutlined, FireOutlined } from '@ant-design/icons'
import styles from './StrengthSelector.module.scss'

type StrengthLevel = 'low' | 'normal' | 'high'

const STRENGTH_OPTIONS: { value: StrengthLevel; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'low', label: '轻量', icon: <ThunderboltOutlined />, desc: '快速执行' },
  { value: 'normal', label: '标准', icon: <FireOutlined />, desc: '平衡模式' },
  { value: 'high', label: '全力', icon: <FireOutlined />, desc: '最大资源' },
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
      <Radio.Group
        value={value}
        onChange={(e) => onChange?.(e.target.value as StrengthLevel)}
        optionType="button"
        buttonStyle="solid"
        className={styles.group}
      >
        {STRENGTH_OPTIONS.map(opt => (
          <Radio.Button key={opt.value} value={opt.value} className={styles.option}>
            {opt.icon}
            <span>{opt.label}</span>
          </Radio.Button>
        ))}
      </Radio.Group>
    </div>
  )
}

export default StrengthSelector
