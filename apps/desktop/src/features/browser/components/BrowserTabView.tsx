// GeoWork Browser Tab View
// URL bar, navigation controls, screenshot preview, and action buttons

import { useState } from 'react'
import { Input, Button, Space, Spin, Card, Typography } from 'antd'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { useBrowserStore } from '../browserStore'
import styles from './BrowserTabView.module.scss'

const { Text } = Typography

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
        <Space.Compact className={styles.navButtons}>
          <Button
            size="small"
            disabled={!isRunning}
            icon={<ArrowLeftOutlined />}
          />
          <Button
            size="small"
            disabled={!isRunning}
            icon={<ArrowRightOutlined />}
          />
          <Button
            size="small"
            disabled={!isRunning || isLoading}
            onClick={handleScreenshot}
            icon={<ReloadOutlined />}
          />
        </Space.Compact>

        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onPressEnter={handleNavigate}
          placeholder="Enter URL and press Enter"
          disabled={!isRunning}
          className={styles.urlInput}
          prefix={
            <ThunderboltOutlined
              style={{ color: 'var(--gw-accent)', marginRight: 4 }}
            />
          }
        />
      </div>

      {/* Screenshot preview area */}
      <div className={styles.previewArea}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <Spin size="large" />
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
            <CopyOutlined
              style={{ fontSize: 48, color: 'var(--gw-text-secondary)', opacity: 0.3 }}
            />
            <Text type="secondary">
              {isRunning ? 'Navigate to a page to see preview' : 'Start a browser session'}
            </Text>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={styles.actionBar}>
        <Space>
          <Button
            size="small"
            disabled={!isRunning}
            onClick={handleScreenshot}
          >
            Screenshot
          </Button>
          <Button
            size="small"
            disabled={!isRunning}
            onClick={handleExtractText}
          >
            Extract Text
          </Button>
        </Space>
      </div>
    </div>
  )
}
