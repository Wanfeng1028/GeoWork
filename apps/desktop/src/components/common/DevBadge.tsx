interface DevBadgeProps {
  mode?: 'short' | 'full'
  className?: string
}

export function DevBadge({ mode = 'short', className }: DevBadgeProps) {
  if (mode === 'short') {
    return (
      <span className={`dev-badge dev-badge--short ${className || ''}`}>
        v0.4.x-dev
      </span>
    )
  }

  return (
    <div className={`dev-badge dev-badge--full ${className || ''}`}>
      <span className="dev-badge__version">v0.4.x-dev</span>
      <span className="dev-badge__label">开发中</span>
    </div>
  )
}

export default DevBadge
