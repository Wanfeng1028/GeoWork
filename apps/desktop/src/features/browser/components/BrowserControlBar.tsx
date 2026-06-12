// GeoWork Browser Control Bar
// Toolbar for screenshot, extract, send-to-agent, close session

import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip'
import { Camera, FileText, Zap, X, CheckCircle, Square } from 'lucide-react'
import { useBrowserStore } from '../browserStore'
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
          <Badge variant="default" className="bg-green-500/20 text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">
            <Square className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={!isRunning || isLoading}
              onClick={handleTakeScreenshot}
            >
              <Camera className="h-4 w-4" />
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
              <FileText className="h-4 w-4" />
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
              <Zap className="h-4 w-4" />
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
              variant="destructive"
              disabled={!isRunning}
              onClick={handleCloseSession}
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close Session</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
