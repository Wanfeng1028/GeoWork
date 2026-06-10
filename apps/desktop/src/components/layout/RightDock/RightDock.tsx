// GeoWork RightDock

import { Tabs } from 'antd'
import { TaskMonitorPanel } from '../panel/TaskMonitorPanel/TaskMonitorPanel'
import { ArtifactPanel } from '../panel/ArtifactPanel/ArtifactPanel'
import { DiffPanel } from '../panel/DiffPanel/DiffPanel'
import useShellStore from '../../../stores/shellStore'
import styles from './RightDock.module.scss'

const { TabPane } = Tabs

export function RightDock() {
  const { activeRightPanel, setActiveRightPanel } = useShellStore()

  return (
    <aside className={styles.dock}>
      <Tabs
        activeKey={activeRightPanel}
        onChange={(key) => setActiveRightPanel(key as any)}
        size="small"
        className={styles.tabs}
      >
        <TabPane tab="任务" key="task">
          <TaskMonitorPanel />
        </TabPane>
        <TabPane tab="产物" key="artifacts">
          <ArtifactPanel />
        </TabPane>
        <TabPane tab="差异" key="diff">
          <DiffPanel />
        </TabPane>
      </Tabs>
    </aside>
  )
}
