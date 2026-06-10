// GeoWork - GwCard Component
// Base card container with multiple variants

import React from 'react'
import classNames from 'classnames'
import styles from './GwCard.module.scss'

export type GwCardVariant = 'elevated' | 'outlined' | 'filled' | 'ghost'

export interface GwCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GwCardVariant
  hoverable?: boolean
  bordered?: boolean
  title?: React.ReactNode
  extra?: React.ReactNode
  bodyStyle?: React.CSSProperties
}

const variantClasses: Record<GwCardVariant, string> = {
  elevated: styles.elevated,
  outlined: styles.outlined,
  filled: styles.filled,
  ghost: styles.ghost,
}

export const GwCard: React.FC<GwCardProps> = ({
  variant = 'elevated',
  hoverable = false,
  bordered = true,
  title,
  extra,
  bodyStyle,
  children,
  className,
  style,
  ...rest
}) => {
  const cls = classNames(
    styles.card,
    variantClasses[variant],
    { [styles.hoverable]: hoverable, [styles.bordered]: bordered },
    className
  )

  return (
    <div className={cls} style={style} {...rest}>
      {(title || extra) && (
        <div className={styles.header}>
          {title && <span className={styles.title}>{title}</span>}
          {extra && <span className={styles.extra}>{extra}</span>}
        </div>
      )}
      <div className={styles.body} style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}

export default GwCard
