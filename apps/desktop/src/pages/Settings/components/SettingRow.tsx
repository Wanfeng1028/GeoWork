import type { ReactNode } from 'react'
import { Typography } from 'antd'
import styles from './SettingRow.module.css'

const { Text } = Typography

interface SettingRowProps {
  title: string
  description?: string
  extra?: ReactNode
  danger?: boolean
}

export function SettingRow({ title, description, extra, danger }: SettingRowProps) {
  return (
    <div className={styles.root}>
      <div className={styles.left}>
        <Text
          strong
          className={styles.title}
          style={danger ? { color: 'inherit' } : undefined}
        >
          {title}
        </Text>
        {description && (
          <Text type="secondary" className={styles.description}>
            {description}
          </Text>
        )}
      </div>
      {extra && <div className={styles.right}>{extra}</div>}
    </div>
  )
}
