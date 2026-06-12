// GeoWork BottomDock - Complete with all tabs

import { useState } from 'react'
import { X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Terminal } from '../../common/Terminal'
import { RuntimeEvents } from '../../panel/RuntimeEvents/RuntimeEvents'
import { BrowserPanel } from '../../panel/BrowserPanel/BrowserPanel'
import { LogsPanel } from '../../panel/LogsPanel/LogsPanel'
import { ProblemsPanel } from '../../panel/ProblemsPanel/ProblemsPanel'
import { OutputPanel } from '../../panel/OutputPanel/OutputPanel'
import useShellStore from '../../../stores/shellStore'
import styles from './BottomDock.module.scss'

export function BottomDock() {
  const { activeBottomPanel, setActiveBottomPanel, activeMode, closeBottomDock } = useShellStore()
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
      <button className={styles.closeBtn} onClick={closeBottomDock} aria-label="关闭底部面板">
        <X size={14} />
      </button>
      <Tabs
        defaultValue={activeBottomPanel}
        onValueChange={(key) => setActiveBottomPanel(key as any)}
        className={styles.tabs}
      >
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="terminal">终端</TabsTrigger>
          <TabsTrigger value="browser">浏览器</TabsTrigger>
          <TabsTrigger value="events">事件</TabsTrigger>
          <TabsTrigger value="logs">日志</TabsTrigger>
          <TabsTrigger value="problems">问题</TabsTrigger>
          <TabsTrigger value="output">输出</TabsTrigger>
        </TabsList>
        <TabsContent value="terminal">
          <Terminal title={`任务终端 — ${activeMode}`} />
        </TabsContent>
        <TabsContent value="browser">
          <BrowserPanel />
        </TabsContent>
        <TabsContent value="events">
          <RuntimeEvents />
        </TabsContent>
        <TabsContent value="logs">
          <LogsPanel />
        </TabsContent>
        <TabsContent value="problems">
          <ProblemsPanel />
        </TabsContent>
        <TabsContent value="output">
          <OutputPanel />
        </TabsContent>
      </Tabs>
    </footer>
  )
}
