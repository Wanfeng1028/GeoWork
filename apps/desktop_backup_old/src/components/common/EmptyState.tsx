interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className || ''}`}>
      {icon && <span className="empty-state__icon">{icon}</span>}
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__desc">{description}</p>}
    </div>
  )
}

export default EmptyState
