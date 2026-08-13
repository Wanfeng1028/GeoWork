import { useEffect, useRef } from 'react'
import { Button, Modal, Progress, Typography } from 'antd'
import { CloudDownload } from 'lucide-react'
import { theme } from 'antd'
import styles from './UpdateModal.module.css'

const { Text } = Typography

interface UpdateModalProps {
  open: boolean
  progress: number
  onMinimize: () => void
}

export function UpdateModal({ open, progress, onMinimize }: UpdateModalProps) {
  const prevOpenRef = useRef(false)

  /* 当 Modal 关闭时清理（interval 由 SettingsPage 管理） */
  useEffect(() => {
    prevOpenRef.current = open
  }, [open])

  const downloaded = ((progress / 100) * 86.4).toFixed(1)
  const total = '86.4'
  const speed = progress > 0 && progress < 100 ? '2.3 MB/s' : '--'
  const remaining = progress > 0 && progress < 100
    ? `${Math.ceil((100 - progress) / 5)}s`
    : '--'

  return (
    <Modal
      title="正在下载更新"
      open={open}
      footer={null}
      onCancel={onMinimize}
      width={480}
      mask={{ closable: false }}
    >
      <div className={styles.root}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          版本 0.9.9
        </Text>

        <Progress percent={Math.round(progress)} status={progress >= 100 ? 'success' : 'active'} />

        <div className={styles.progressInfo}>
          <div className={styles.progressDetail}>
            <Text style={{ fontSize: 12 }}>
              已下载 {downloaded} MB / {total} MB
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              下载速度：{speed} · 剩余时间：{remaining}
            </Text>
          </div>
        </div>

        <Text type="secondary" style={{ fontSize: 12 }}>
          下载完成后将自动安装更新。您可以继续使用应用程序。
        </Text>

        <div className={styles.footer}>
          <Button onClick={onMinimize}>最小化</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ── 左下角更新浮窗 ── */

interface UpdateFloatWidgetProps {
  progress: number
  onViewProgress: () => void
}

export function UpdateFloatWidget({ progress, onViewProgress }: UpdateFloatWidgetProps) {
  const { token } = theme.useToken()

  return (
    <div
      className={styles.floatWidget}
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <div className={styles.floatHeader}>
        <CloudDownload className={styles.floatIcon} style={{ color: token.colorPrimary }} />
        <Text className={styles.floatTitle}>更新中...</Text>
      </div>
      <Progress percent={Math.round(progress)} size="small" status={progress >= 100 ? 'success' : 'active'} />
      <Button
        type="link"
        size="small"
        className={styles.floatViewBtn}
        onClick={onViewProgress}
        style={{ padding: 0 }}
      >
        查看进度
      </Button>
    </div>
  )
}
