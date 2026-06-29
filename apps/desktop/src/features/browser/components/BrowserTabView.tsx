// GeoWork Browser Tab View
// URL bar, navigation controls, screenshot preview, and action buttons

import { useState } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Zap, Copy } from 'lucide-react'
import useBrowserStore from '../browserStore'
import styles from './BrowserTabView.module.scss'

interface BrowserTabViewProps {
  className?: string
}

export function BrowserTabView({ className = '' }: BrowserTabViewProps) {
  const {
    session,
    isRunning,
    isLoading,
    navigate,
    takeScreenshot,
    extractText,
  } = useBrowserStore()

  const [urlInput, setUrlInput] = useState(session?.url || '')

  const handleNavigate = () => {
    const url = urlInput.trim()
    if (!url || !isRunning) return
    navigate(url)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleScreenshot = () => {
    if (isRunning) {
      takeScreenshot()
    }
  }

  const handleExtractText = () => {
    if (isRunning) {
      extractText()
    }
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Navigation bar */}
      <div className={styles.navBar}>
        <div >
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning}
          >
            <ArrowLeft  />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning}
          >
            <ArrowRight  />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning || isLoading}
            onClick={handleScreenshot}
          >
            <RefreshCw  />
          </Button>
        </div>

        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
          placeholder="Enter URL and press Enter"
          disabled={!isRunning}
          className={styles.urlInput}
        />
      </div>

      {/* Screenshot preview area */}
      <div className={styles.previewArea}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <Spinner size="lg" />
          </div>
        )}

        {session?.screenshot ? (
          <div className={styles.screenshotContainer}>
            <img
              src={session.screenshot}
              alt="Browser screenshot"
              className={styles.screenshotImage}
            />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <Copy
              
              style={{ opacity: 0.3 }}
            />
            <span >
              {isRunning ? 'Navigate to a page to see preview' : 'Start a browser session'}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={styles.actionBar}>
        <div >
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning}
            onClick={handleScreenshot}
          >
            Screenshot
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning}
            onClick={handleExtractText}
          >
            Extract Text
          </Button>
        </div>
      </div>
    </div>
  )
}
