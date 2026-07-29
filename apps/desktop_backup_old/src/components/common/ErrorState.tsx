interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title = '出现错误', message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={`error-state ${className || ''}`}>
      <span className="error-state__icon">⚠️</span>
      <p className="error-state__title">{title}</p>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <button className="error-state__retry" onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  )
}

export default ErrorState
