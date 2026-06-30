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
          <span >
            <CheckCircle  />
            Active
          </span>
        ) : (
          <span>
            <Square  />
            Closed
          </span>
        )}
      </div>

      <div >
        <div>
          <span asChild>
            <button
              onClick={handleTakeScreenshot}
            >
              <Camera  />
            </button>
          </span>
          <div>Screenshot</div>
        </div>

        <div>
          <span asChild>
            <button
              onClick={handleExtractText}
            >
              <FileText  />
            </button>
          </span>
          <div>Extract Text</div>
        </div>

        <div>
          <span asChild>
            <button
              onClick={handleAddToContext}
            >
              <Zap  />
              <span className={styles.toolbarLabel}>Agent</span>
            </button>
          </span>
          <div>Send to Agent</div>
        </div>

        <div className={styles.toolbarDivider} />

        <div>
          <span asChild>
            <button
              onClick={handleCloseSession}
            >
              <X  />
            </button>
          </span>
          <div>Close Session</div>
        </div>
      </div>
    </div>
  )
}
