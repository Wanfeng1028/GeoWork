import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { theme } from 'antd'
import styles from './panels.module.css'

const TERM_ID = 'geowork-term-main'
const MONO_FONT = "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace"

interface TerminalPanelProps {
  active: boolean
}

export function TerminalPanel({ active }: TerminalPanelProps) {
  const { token } = theme.useToken()
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const initedRef = useRef(false)

  /* 初始化终端(仅一次) */
  useEffect(() => {
    const el = containerRef.current
    if (!el || initedRef.current) return
    initedRef.current = true

    const term = new Terminal({
      fontSize: 12,
      fontFamily: MONO_FONT,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: token.colorBgLayout,
        foreground: token.colorText,
        cursor: token.colorPrimary,
        selectionBackground: token.colorPrimaryBg,
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    try { fit.fit() } catch { /* container not ready */ }
    termRef.current = term
    fitRef.current = fit

    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined

    term.onData((data) => {
      window.geowork?.terminal?.write(TERM_ID, data)
    })
    term.onResize(({ cols, rows }) => {
      window.geowork?.terminal?.resize(TERM_ID, cols, rows)
    })

    ;(async () => {
      const res = await window.geowork?.terminal?.create({
        id: TERM_ID,
        cols: term.cols,
        rows: term.rows,
      })
      if (res?.error) {
        term.writeln(`\x1b[31m${res.error}\x1b[0m`)
        return
      }
      unsubData = window.geowork?.terminal?.onData(TERM_ID, (data: string) => {
        term.write(data)
      })
      unsubExit = window.geowork?.terminal?.onExit(TERM_ID, (code: number) => {
        term.writeln(`\r\n\x1b[33m[进程已退出,退出码 ${code}]\x1b[0m`)
      })
    })()

    const ro = new ResizeObserver(() => {
      const t = termRef.current
      const f = fitRef.current
      if (!t || !f) return
      try {
        f.fit()
      } catch { /* ignore */ }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      unsubData?.()
      unsubExit?.()
      window.geowork?.terminal?.kill(TERM_ID)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 切回终端 tab 时重新 fit(隐藏期间尺寸可能变化) */
  useEffect(() => {
    if (!active) return
    const f = fitRef.current
    const t = termRef.current
    if (!f || !t) return
    const timer = setTimeout(() => {
      try {
        f.fit()
        window.geowork?.terminal?.resize(TERM_ID, t.cols, t.rows)
      } catch { /* ignore */ }
    }, 50)
    return () => clearTimeout(timer)
  }, [active])

  return (
    <div className={styles.panel} style={{ background: token.colorBgLayout }}>
      <div
        ref={containerRef}
        className={styles.fill}
        style={{ padding: 4, boxSizing: 'border-box' }}
      />
    </div>
  )
}
