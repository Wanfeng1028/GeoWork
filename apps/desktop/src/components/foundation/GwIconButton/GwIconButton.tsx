// GeoWork - GwIconButton Component
// Icon-only button with tooltip support

import React from 'react'
import classNames from 'classnames'
import styles from './GwIconButton.module.scss'

export type GwIconButtonVariant = 'ghost' | 'subtle' | 'solid'
export type GwIconButtonSize = 'xs' | 'sm' | 'default' | 'lg'

export interface GwIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GwIconButtonVariant
  size?: GwIconButtonSize
  icon: React.ReactNode
  tooltip?: string
  active?: boolean
  danger?: boolean
}

const variantClasses: Record<GwIconButtonVariant, string> = {
  ghost: styles.ghost,
  subtle: styles.subtle,
  solid: styles.solid,
}

const sizeClasses: Record<GwIconButtonSize, string> = {
  xs: styles.xs,
  sm: styles.sm,
  default: styles.default,
  lg: styles.lg,
}

export const GwIconButton: React.FC<GwIconButtonProps> = ({
  variant = 'ghost',
  size = 'default',
  icon,
  tooltip,
  active = false,
  danger = false,
  className,
  ...rest
}) => {
  const cls = classNames(
    styles.btn,
    variantClasses[variant],
    sizeClasses[size],
    { [styles.active]: active, [styles.danger]: danger },
    className
  )

  const wrapperProps: React.HTMLAttributes<HTMLDivElement> = {}
  if (tooltip) {
    wrapperProps.title = tooltip
  }

  return (
    <div {...wrapperProps}>
      <button className={cls} {...rest}>
        {icon}
      </button>
    </div>
  )
}

export default GwIconButton
