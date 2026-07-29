// GeoWork BottomDock - Complete with all tabs

import { useState } from 'react'
import { X } from 'lucide-react'
import { Terminal } from '../../common/Terminal'
import { RuntimeEvents } from '../../panel/RuntimeEvents/RuntimeEvents'
import { BrowserPanel } from '../../panel/BrowserPanel/BrowserPanel'
import { LogsPanel } from '../../panel/LogsPanel/LogsPanel'
import { ProblemsPanel } from '../../panel/ProblemsPanel/ProblemsPanel'
import { OutputPanel } from '../../panel/OutputPanel/OutputPanel'
import useShellStore from '../../../stores/shellStore'
import styles from './BottomDock.module.scss'

export function BottomDock() {
  const { activeMode } = useShellStore()
  const [activeBottomPanel, setActiveBottomPanel] = useState('terminal')
  const [height, setHeight] = useState(260)

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    const maxHeight = Math.round(window.innerHeight * 0.45)
    const onMove = (moveEvent: MouseEvent) => {
      const nextHeight = Math.min(maxHeight, Math.max(180, startHeight + startY - moveEvent.clientY))
      setHeight(nextHeight)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <footer className={styles.dock} style={{ height }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />
      <button className={styles.closeBtn} onClick={() => {}} aria-label="关闭底部面板">
        <X size={14} />
      </button>
      <div
        className={styles.tabs}
      >
        <div className={styles.tabsList}>
          <button>终端</button>
          <button>浏览器</button>
          <button>事件</button>
          <button>日志</button>
          <button>问题</button>
          <button>输出</button>
        </div>
        <div>
          <Terminal title={`任务终端 — ${activeMode}`} />
        </div>
        <div>
          <BrowserPanel />
        </div>
        <div>
          <RuntimeEvents />
        </div>
        <div>
          <LogsPanel />
        </div>
        <div>
          <ProblemsPanel />
        </div>
        <div>
          <OutputPanel />
        </div>
      </div>
    </footer>
  )
}
