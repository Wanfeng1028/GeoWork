// GeoWork BottomDock - Complete with all tabs

import { Tabs } from 'antd'
import { useState } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { Terminal } from '../../common/Terminal'
import { RuntimeEvents } from '../../panel/RuntimeEvents/RuntimeEvents'
import { BrowserPanel } from '../../panel/BrowserPanel/BrowserPanel'
import { LogsPanel } from '../../panel/LogsPanel/LogsPanel'
import { ProblemsPanel } from '../../panel/ProblemsPanel/ProblemsPanel'
import { OutputPanel } from '../../panel/OutputPanel/OutputPanel'
import useShellStore from '../../../stores/shellStore'
import styles from './BottomDock.module.scss'

const { TabPane } = Tabs

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
        <CloseOutlined />
      </button>
      <Tabs
        activeKey={activeBottomPanel}
        onChange={(key) => setActiveBottomPanel(key as any)}
        size="small"
        className={styles.tabs}
        tabBarStyle={{ paddingLeft: '4px' }}
      >
        <TabPane tab="终端" key="terminal">
          <Terminal title={`任务终端 — ${activeMode}`} />
        </TabPane>
        <TabPane tab="浏览器" key="browser">
          <BrowserPanel />
        </TabPane>
        <TabPane tab="事件" key="events">
          <RuntimeEvents />
        </TabPane>
        <TabPane tab="日志" key="logs">
          <LogsPanel />
        </TabPane>
        <TabPane tab="问题" key="problems">
          <ProblemsPanel />
        </TabPane>
        <TabPane tab="输出" key="output">
          <OutputPanel />
        </TabPane>
      </Tabs>
    </footer>
  )
}
