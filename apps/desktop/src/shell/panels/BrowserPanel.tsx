import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Input, Space, Spin, Tooltip, Typography, theme } from 'antd'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  GlobalOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import styles from './panels.module.css'

const { Text } = Typography

const BROWSER_ID = 'geowork-browser-main'

const BOOKMARKS: { label: string; url: string }[] = [
  { label: 'Google 地球', url: 'https://earth.google.com' },
  { label: 'GEE Code Editor', url: 'https://code.earthengine.google.com' },
  { label: 'GEE 数据集', url: 'https://developers.google.com/earth-engine/datasets/catalog' },
]

interface BrowserPanelProps {
  active: boolean
}

function normalizeUrl(input: string): string {
  const v = input.trim()
  if (!v) return v
  if (/^https?:\/\//i.test(v)) return v
  /* 简单判断:含空格或无点号视为搜索,否则补 https:// */
  if (/\s/.test(v) || !/\./.test(v)) return `https://www.google.com/search?q=${encodeURIComponent(v)}`
  return `https://${v}`
}

export function BrowserPanel({ active }: BrowserPanelProps) {
  const { token } = theme.useToken()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputUrl, setInputUrl] = useState('https://earth.google.com')
  const [currentUrl, setCurrentUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(false)
  const [busy, setBusy] = useState(false)
  const didInitialNav = useRef(false)

  /* 创建视图 + 订阅事件 */
  useEffect(() => {
    let unsubNav: (() => void) | undefined
    let unsubLoading: (() => void) | undefined
    let unsubTitle: (() => void) | undefined
    let cancelled = false

    ;(async () => {
      const res = await window.geowork?.browser?.create(BROWSER_ID)
      if (cancelled) return
      if (res && res.error) return
      setCreated(true)
      unsubNav = window.geowork?.browser?.onDidNavigate(BROWSER_ID, (url: string) => {
        setCurrentUrl(url)
        setInputUrl(url)
      })
      unsubLoading = window.geowork?.browser?.onLoading(BROWSER_ID, (l: boolean) => setLoading(l))
      unsubTitle = window.geowork?.browser?.onTitle(BROWSER_ID, () => {})
    })()

    return () => {
      cancelled = true
      unsubNav?.()
      unsubLoading?.()
      unsubTitle?.()
      /* 卸载时隐藏,保留页面状态 */
      window.geowork?.browser?.setVisible(BROWSER_ID, false)
    }
  }, [])

  /* 同步 bounds 到主进程 */
  const syncBounds = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return
    window.geowork?.browser?.setBounds(BROWSER_ID, {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    })
  }, [])

  /* active 变化:显示/隐藏视图 */
  useEffect(() => {
    if (!created) return
    if (active) {
      syncBounds()
      window.geowork?.browser?.setVisible(BROWSER_ID, true)
      /* 首次激活时自动导航到默认页 */
      if (!didInitialNav.current) {
        didInitialNav.current = true
        window.geowork?.browser?.navigate(BROWSER_ID, normalizeUrl(inputUrl))
      }
    } else {
      window.geowork?.browser?.setVisible(BROWSER_ID, false)
    }
  }, [active, created, syncBounds, inputUrl])

  /* bounds 跟随:ResizeObserver + 窗口 resize/scroll */
  useLayoutEffect(() => {
    if (!active || !created) return
    const el = containerRef.current
    if (!el) return

    syncBounds()
    const ro = new ResizeObserver(() => syncBounds())
    ro.observe(el)

    const onResize = () => syncBounds()
    const onScroll = () => syncBounds()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)

    /* 拖拽分隔条期间持续同步 */
    const interval = window.setInterval(() => {
      if (el.offsetWidth && el.offsetHeight) syncBounds()
    }, 200)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      window.clearInterval(interval)
    }
  }, [active, created, syncBounds])

  const handleNavigate = useCallback(async (raw: string) => {
    const url = normalizeUrl(raw)
    if (!url) return
    setBusy(true)
    setInputUrl(url)
    try {
      await window.geowork?.browser?.navigate(BROWSER_ID, url)
    } finally {
      setBusy(false)
    }
  }, [])

  const handleBack = useCallback(() => window.geowork?.browser?.back(BROWSER_ID), [])
  const handleForward = useCallback(() => window.geowork?.browser?.forward(BROWSER_ID), [])
  const handleReload = useCallback(() => window.geowork?.browser?.reload(BROWSER_ID), [])

  const border = token.colorBorderSecondary

  return (
    <div className={styles.panel} style={{ background: token.colorBgContainer }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tooltip title="后退">
            <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={handleBack} />
          </Tooltip>
          <Tooltip title="前进">
            <Button type="text" size="small" icon={<ArrowRightOutlined />} onClick={handleForward} />
          </Tooltip>
          <Tooltip title="刷新">
            <Button type="text" size="small" icon={loading ? <LoadingOutlined /> : <ReloadOutlined />} onClick={handleReload} />
          </Tooltip>
          <Input
            size="small"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onPressEnter={() => handleNavigate(inputUrl)}
            prefix={<GlobalOutlined style={{ color: token.colorTextTertiary }} />}
            placeholder="输入网址或搜索"
            style={{ flex: 1, fontFamily: "'SF Mono', 'Cascadia Code', monospace", fontSize: 12 }}
          />
        </div>
        <Space size={4} wrap>
          {BOOKMARKS.map((b) => (
            <Tooltip key={b.label} title={b.url}>
              <Button
                size="small"
                type="text"
                style={{ fontSize: 11, padding: '0 8px', height: 22, background: token.colorFillQuaternary, borderRadius: 11 }}
                loading={busy && normalizeUrl(inputUrl) === b.url}
                onClick={() => handleNavigate(b.url)}
              >
                {b.label}
              </Button>
            </Tooltip>
          ))}
        </Space>
      </div>
      {/* WebContentsView 占位区:原生视图覆盖在此 */}
      <div ref={containerRef} className={styles.fill} style={{ background: token.colorBgLayout }}>
        {!created && (
          <div className={styles.placeholder}>
            <Spin size="small" />
          </div>
        )}
      </div>
      {currentUrl && (
        <div style={{ padding: '2px 10px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: 10, fontFamily: "'SF Mono', 'Cascadia Code', monospace", display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentUrl}>
            {currentUrl}
          </Text>
        </div>
      )}
    </div>
  )
}
