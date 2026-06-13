// GeoWork - GwButton Component
// Primary interactive button with multiple variants

import React from 'react'
import styles from './GwButton.module.scss'

export type GwButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'ghost'
export type GwButtonSize = 'small' | 'default' | 'large'

export interface GwButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GwButtonVariant
  size?: GwButtonSize
  icon?: React.ReactNode
  loading?: boolean
  disabled?: boolean
}

const variantClasses: Record<GwButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  text: styles.text,
  danger: styles.danger,
  ghost: styles.ghost,
}

const sizeClasses: Record<GwButtonSize, string> = {
  small: styles.small,
  default: styles.default,
  large: styles.large,
}

export const GwButton: React.FC<GwButtonProps> = ({
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  children,
  className,
  ...rest
}) => {
  const cls = [
    styles.btn,
    variantClasses[variant],
    sizeClasses[size],
    loading && styles.loading,
    disabled && styles.disabled,
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className={styles.spinner} />}
      {icon && <span className={styles.icon}>{icon}</span>}
      {children && <span className={styles.label}>{children}</span>}
    </button>
  )
}

export default GwButton
