// GeoWork Browser Control Bar
// Toolbar for screenshot, extract, send-to-agent, close session

import { Camera, FileText, Zap, X, CheckCircle, Square } from 'lucide-react'
import useBrowserStore from '../browserStore'
import styles from './BrowserControlBar.module.scss'

interface BrowserControlBarProps {
  className?: string
}

export function BrowserControlBar({ className = '' }: BrowserControlBarProps) {
  const {
    isRunning,
    isLoading,
    takeScreenshot,
    extractText,
    addToContext,
    closeSession,
  } = useBrowserStore()

  const handleTakeScreenshot = () => {
    if (isRunning) {
      takeScreenshot()
    }
  }

  const handleExtractText = () => {
    if (isRunning) {
      extractText()
    }
  }

  const handleAddToContext = () => {
    if (isRunning) {
      addToContext()
    }
  }

  const handleCloseSession = () => {
    closeSession()
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.status}>
        {isRunning ? (
          <Badge variant="default" >
            <CheckCircle  />
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Square  />
            Closed
          </Badge>
        )}
      </div>

      <div >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={!isRunning || isLoading}
              onClick={handleTakeScreenshot}
            >
              <Camera  />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Screenshot</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={!isRunning || isLoading}
              onClick={handleExtractText}
            >
              <FileText  />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Extract Text</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={!isRunning || isLoading}
              onClick={handleAddToContext}
            >
              <Zap  />
              <span className={styles.toolbarLabel}>Agent</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Send to Agent</TooltipContent>
        </Tooltip>

        <div className={styles.toolbarDivider} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="danger"
              disabled={!isRunning}
              onClick={handleCloseSession}
            >
              <X  />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close Session</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
