import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Empty, Spin, Tag, Tooltip, Typography, theme } from 'antd'
import {
  RotateCw,
  Check,
  X,
  ArrowLeft,
  CheckCircle2,
  Diff,
} from 'lucide-react'
import styles from './panels.module.css'

const { Text } = Typography

interface DiffItem {
  id: string
  path: string
  oldContent?: string
  newContent: string
  status: string // pending | approved | rejected
  toolCallId?: string
  createdAt?: string
  approvedAt?: string
  unified?: string
}

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  pending: { color: 'processing', text: '待审查' },
  approved: { color: 'success', text: '已应用' },
  rejected: { color: 'default', text: '已回滚' },
}

/** 渲染单行 unified diff。 */
function DiffLine({ line }: { line: string }) {
  const { token } = theme.useToken()
  let className = styles.diffLine
  let color = token.colorText
  if (line.startsWith('+++') || line.startsWith('---')) {
    color = token.colorTextSecondary
  } else if (line.startsWith('@@')) {
    className = `${styles.diffLine} ${styles.lineHunk}`
    color = token.colorTextTertiary
  } else if (line.startsWith('+')) {
    className = `${styles.diffLine} ${styles.lineAdd}`
    color = token.colorSuccess
  } else if (line.startsWith('-')) {
    className = `${styles.diffLine} ${styles.lineDel}`
    color = token.colorError
  }
  return <div className={className} style={{ color }}>{line || ' '}</div>
}

export function ReviewPanel() {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [diffs, setDiffs] = useState<DiffItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<DiffItem | null>(null)
  const [acting, setActing] = useState(false)

  const loadDiffs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.geowork?.runtime?.listDiffs()
      if (res && res.error) throw new Error(res.error)
      setDiffs(Array.isArray(res) ? (res as DiffItem[]) : [])
    } catch (e: any) {
      message.error(e?.message || '加载改动列表失败')
      setDiffs([])
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    loadDiffs()
  }, [loadDiffs])

  const pendingCount = useMemo(() => diffs.filter((d) => d.status === 'pending').length, [diffs])

  const handleApprove = useCallback(async (id: string) => {
    setActing(true)
    try {
      const res = await window.geowork?.runtime?.approveDiff(id)
      if (res && res.error) throw new Error(res.error)
      message.success('已应用改动')
      await loadDiffs()
      setSelected(null)
    } catch (e: any) {
      message.error(e?.message || '应用失败')
    } finally {
      setActing(false)
    }
  }, [message, loadDiffs])

  const handleReject = useCallback(async (id: string) => {
    setActing(true)
    try {
      const res = await window.geowork?.runtime?.rejectDiff(id)
      if (res && res.error) throw new Error(res.error)
      message.success('已回滚改动')
      await loadDiffs()
      setSelected(null)
    } catch (e: any) {
      message.error(e?.message || '回滚失败')
    } finally {
      setActing(false)
    }
  }, [message, loadDiffs])

  const handleApplyAll = useCallback(async () => {
    setActing(true)
    try {
      const res = await window.geowork?.runtime?.applyAllDiffs()
      if (res && res.error) throw new Error(res.error)
      message.success('已应用全部待审查改动')
      await loadDiffs()
    } catch (e: any) {
      message.error(e?.message || '批量应用失败')
    } finally {
      setActing(false)
    }
  }, [message, loadDiffs])

  const border = token.colorBorderSecondary

  /* 详情视图 */
  if (selected) {
    const lines = (selected.unified || '').split('\n')
    return (
      <div className={styles.panel} style={{ background: token.colorBgContainer }}>
        <div className={styles.previewHeader} style={{ borderBottom: `1px solid ${border}` }}>
          <Tooltip title="返回列表">
            <Button type="text" size="small" icon={<ArrowLeft />} onClick={() => setSelected(null)} />
          </Tooltip>
          <Text style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'SF Mono', 'Cascadia Code', monospace" }} title={selected.path}>
            {selected.path}
          </Text>
          {STATUS_TAG[selected.status] && (
            <Tag color={STATUS_TAG[selected.status].color} style={{ fontSize: 11, margin: 0 }}>{STATUS_TAG[selected.status].text}</Tag>
          )}
        </div>
        <div className={styles.diffView} style={{ background: token.colorBgLayout, padding: '4px 0' }}>
          {lines.map((l, i) => <DiffLine key={i} line={l} />)}
        </div>
        {selected.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
            <Button type="primary" size="small" icon={<Check />} loading={acting} onClick={() => handleApprove(selected.id)} style={{ flex: 1 }}>
              应用
            </Button>
            <Button size="small" icon={<X />} loading={acting} onClick={() => handleReject(selected.id)} style={{ flex: 1 }}>
              回滚
            </Button>
          </div>
        )}
      </div>
    )
  }

  /* 列表视图 */
  return (
    <div className={styles.panel} style={{ background: token.colorBgContainer }}>
      <div className={styles.toolbar} style={{ borderBottom: `1px solid ${border}` }}>
        <Diff style={{ fontSize: 12, color: token.colorTextTertiary }} />
        <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
          改动审查 {pendingCount > 0 && <Tag color="processing" style={{ fontSize: 11, marginLeft: 4 }}>{pendingCount} 待审</Tag>}
        </Text>
        <Tooltip title="刷新">
          <Button type="text" size="small" icon={<RotateCw />} onClick={loadDiffs} />
        </Tooltip>
        <Tooltip title="应用全部待审查">
          <Button type="text" size="small" icon={<CheckCircle2 />} disabled={pendingCount === 0} loading={acting} onClick={handleApplyAll} />
        </Tooltip>
      </div>
      <div className={styles.content}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>
        ) : diffs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" style={{ fontSize: 12 }}>暂无改动,Agent 修改文件后会在此展示</Text>}
          />
        ) : (
          <div className={styles.diffList}>
            {diffs.map((d) => {
              const tag = STATUS_TAG[d.status] || STATUS_TAG.pending
              return (
                <div
                  key={d.id}
                  className={styles.diffItem}
                  style={{ background: token.colorFillQuaternary }}
                  onClick={() => setSelected(d)}
                >
                  <Tag color={tag.color} style={{ fontSize: 11, margin: 0, lineHeight: '18px', padding: '0 4px' }}>{tag.text}</Tag>
                  <span className={styles.diffPath} title={d.path}>{d.path}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
