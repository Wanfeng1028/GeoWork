import type { ReactNode } from 'react'

type StatusBarProps = {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

export function StatusBar({ left, right, className }: StatusBarProps) {
  return (
    <div
      className={`h-[22px] shrink-0 flex items-center justify-between px-3 bg-[var(--gw-bg-shell)] border-t border-[var(--gw-border-soft)] text-[11px] select-none ${className ?? ''}`}
    >
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-3">{right}</div>
    </div>
  )
}
