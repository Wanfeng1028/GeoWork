// GeoWork Browser Control Bar
// Toolbar for screenshot, extract, send-to-agent, close session

import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CameraOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useBrowserStore } from '../browserStore'
import styles from './BrowserControlBar.module.scss'

const { Text } = Typography

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
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Active
          </Tag>
        ) : (
          <Tag color="default" icon={<StopOutlined />}>
            Closed
          </Tag>
        )}
      </div>

      <Space.Compact className={styles.toolbar}>
        <Tooltip title="Screenshot">
          <Button
            size="small"
            disabled={!isRunning || isLoading}
            onClick={handleTakeScreenshot}
            icon={<CameraOutlined />}
          />
        </Tooltip>

        <Tooltip title="Extract Text">
          <Button
            size="small"
            disabled={!isRunning || isLoading}
            onClick={handleExtractText}
            icon={<FileTextOutlined />}
          />
        </Tooltip>

        <Tooltip title="Send to Agent">
          <Button
            size="small"
            disabled={!isRunning || isLoading}
            onClick={handleAddToContext}
            icon={<ThunderboltOutlined />}
          >
            <Text className={styles.toolbarLabel}>Agent</Text>
          </Button>
        </Tooltip>

        <div className={styles.toolbarDivider} />

        <Tooltip title="Close Session">
          <Button
            size="small"
            disabled={!isRunning}
            onClick={handleCloseSession}
            danger
            icon={<CloseOutlined />}
          />
        </Tooltip>
      </Space.Compact>
    </div>
  )
}
