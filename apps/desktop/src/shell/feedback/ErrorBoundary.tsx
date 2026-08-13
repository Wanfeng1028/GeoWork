import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, theme } from 'antd'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onRetry?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

function DefaultFallback({
  error,
  onRetry,
}: {
  error: Error | null
  onRetry?: () => void
}) {
  const { token } = theme.useToken()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        width: '100%',
        height: '100%',
        minHeight: 200,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: token.colorErrorBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <AlertTriangle size={56} color={token.colorError} />
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: token.colorTextHeading,
          marginBottom: 8,
        }}
      >
        加载失败
      </div>
      {error && (
        <div
          style={{
            fontSize: 13,
            color: token.colorTextDescription,
            maxWidth: 400,
            wordBreak: 'break-word',
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          {error.message}
        </div>
      )}
      {onRetry && (
        <Button
          type="primary"
          icon={<RefreshCw size={14} />}
          onClick={onRetry}
        >
          重试
        </Button>
      )}
    </div>
  )
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static override getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <DefaultFallback
          error={this.state.error}
          onRetry={this.props.onRetry ? this.handleRetry : undefined}
        />
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary