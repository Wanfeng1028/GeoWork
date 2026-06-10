// GeoWork - GwBadge Component
// Status indicator badge for counts, alerts, and notifications

import React from 'react'
import classNames from 'classnames'
import styles from './GwBadge.module.scss'

export type GwBadgeColor =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'accent'
  | 'muted'

export interface GwBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count?: number | string
  show?: boolean
  color?: GwBadgeColor
  dot?: boolean
  overflowCount?: number
  offset?: [number, number]
  children?: React.ReactNode
}

const colorMap: Record<GwBadgeColor, string> = {
  default: 'var(--gw-text-tertiary)',
  success: 'var(--gw-accent)',
  warning: 'var(--gw-warning)',
  error: 'var(--gw-danger)',
  info: 'var(--gw-info)',
  accent: 'var(--gw-accent)',
  muted: 'var(--gw-text-disabled)',
}

export const GwBadge: React.FC<GwBadgeProps> = ({
  count,
  show,
  color = 'default',
  dot = false,
  overflowCount = 99,
  offset,
  children,
  className,
  style,
  ...rest
}) => {
  if (count === undefined && !dot) {
    return (
      <span className={className} style={style} {...rest}>
        {children}
      </span>
    )
  }

  const shouldShow = show !== undefined ? show : (count !== undefined && count > 0)

  if (!shouldShow && !dot) {
    return (
      <span className={className} style={style} {...rest}>
        {children}
      </span>
    )
  }

  let displayCount: React.ReactNode = count
  if (typeof count === 'number' && count > overflowCount) {
    displayCount = `${overflowCount}+`
  }

  const badgeStyle: React.CSSProperties = { ...style }
  if (offset) {
    badgeStyle.marginLeft = offset[0]
    badgeStyle.marginTop = offset[1]
  }

  return (
    <span className={styles.container} style={style} {...rest}>
      {children}
      {dot ? (
        <span
          className={classNames(styles.badge, styles.dot, styles[color])}
          style={badgeStyle}
        />
      ) : (
        <span
          className={classNames(styles.badge, styles.count, styles[color])}
          style={badgeStyle}
        >
          {displayCount}
        </span>
      )}
    </span>
  )
}

export default GwBadge
