import { useEffect, useState } from 'react'
import { EmptyState, PageSkeleton } from '../../shell/feedback'
import styles from './WorkspacePage.module.css'

export function WorkspacePage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className={styles.root}>
        <PageSkeleton variant="workspace" />
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <EmptyState
        title="尚未选择工作空间"
        description="选择或创建一个工作空间，开始你的地理分析工作流。"
      />
    </div>
  )
}
