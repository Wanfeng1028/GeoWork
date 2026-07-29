import type { ReactNode } from 'react'
import { Card, Typography } from 'antd'
import styles from './SettingsSection.module.css'

const { Title, Text } = Typography

interface SettingsSectionProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function SettingsSection({ title, subtitle, children }: SettingsSectionProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title level={4} className={styles.title}>{title}</Title>
        {subtitle && (
          <Text type="secondary" className={styles.subtitle}>{subtitle}</Text>
        )}
      </div>
      {children}
    </div>
  )
}

interface SettingsCardProps {
  title?: string
  children?: ReactNode
  style?: React.CSSProperties
}

export function SettingsCard({ title, children, style }: SettingsCardProps) {
  return (
    <Card
      className={styles.card}
      title={title ? <Title level={5} className={styles.cardTitle}>{title}</Title> : undefined}
      size="small"
      style={style}
    >
      {children}
    </Card>
  )
}
