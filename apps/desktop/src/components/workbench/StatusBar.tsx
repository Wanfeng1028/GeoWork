import { cn } from '../../lib/cn'

type StatusBarProps = {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function StatusBar({ left, right, className }: StatusBarProps) {
  return (
    <div
      className={cn(
        'flex h-full items-center justify-between px-3',
        'text-[11px] text-[var(--gw-text-tertiary)]',
        className,
      )}
    >
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-3">{right}</div>
    </div>
  )
}

type StatusItemProps = {
  icon?: React.ReactNode
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

const variantColors = {
  default: 'text-[var(--gw-text-tertiary)]',
  success: 'text-[var(--gw-success)]',
  warning: 'text-[var(--gw-warning)]',
  danger: 'text-[var(--gw-danger)]',
}

export function StatusItem({ icon, label, variant = 'default', className }: StatusItemProps) {
  return (
    <span className={cn('flex items-center gap-1', variantColors[variant], className)}>
      {icon}
      {label}
    </span>
  )
}
