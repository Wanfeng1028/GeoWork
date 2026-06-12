// GeoWork Browser Tab View
// URL bar, navigation controls, screenshot preview, and action buttons

import { useState } from 'react'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { Card } from '../../../components/ui/card'
import { ArrowLeft, ArrowRight, RefreshCw, Zap, Copy } from 'lucide-react'
import { useBrowserStore } from '../browserStore'
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
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!isRunning || isLoading}
            onClick={handleScreenshot}
          >
            <RefreshCw className="h-4 w-4" />
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
              className="h-12 w-12"
              style={{ color: 'var(--gw-text-secondary)', opacity: 0.3 }}
            />
            <span className="text-[13px] text-[var(--gw-text-secondary)]">
              {isRunning ? 'Navigate to a page to see preview' : 'Start a browser session'}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={styles.actionBar}>
        <div className="flex gap-2">
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
