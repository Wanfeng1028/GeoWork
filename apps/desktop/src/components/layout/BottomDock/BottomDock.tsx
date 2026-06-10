// GeoWork BottomDock

import { Tabs } from 'antd'
import { Terminal } from '../../components/common/Terminal'
import { RuntimeEvents } from '../panel/RuntimeEvents/RuntimeEvents'
import useShellStore from '../../../stores/shellStore'
import styles from './BottomDock.module.scss'

const { TabPane } = Tabs

export function BottomDock() {
  const { activeBottomPanel, activeMode } = useShellStore()

  return (
    <footer className={styles.dock}>
      <Tabs
        activeKey={activeBottomPanel}
        onChange={() => {}}
        size="small"
        className={styles.tabs}
      >
        <TabPane tab="终端" key="terminal">
          <Terminal title={`任务终端 — ${activeMode}`} />
        </TabPane>
        <TabPane tab="事件" key="events">
          <RuntimeEvents />
        </TabPane>
      </Tabs>
    </footer>
  )
}
