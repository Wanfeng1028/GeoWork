import type { ReactNode } from 'react'

type StatusBarProps = {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

export function StatusBar({ left, right, className }: StatusBarProps) {
  return (
    <div
      className={`${className ?? ''}`}
    >
      <div >{left}</div>
      <div >{right}</div>
    </div>
  )
}
