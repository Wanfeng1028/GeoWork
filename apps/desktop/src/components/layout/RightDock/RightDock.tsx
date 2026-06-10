// GeoWork RightDock - Complete with all tabs

import { Tabs } from 'antd'
import { TaskMonitorPanel } from '../../panel/TaskMonitorPanel/TaskMonitorPanel'
import { ArtifactPanel } from '../../panel/ArtifactPanel/ArtifactPanel'
import { DiffPanel } from '../../panel/DiffPanel/DiffPanel'
import { ContextPanel } from '../../panel/ContextPanel/ContextPanel'
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
        tabBarStyle={{ paddingLeft: '4px' }}
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
        <TabPane tab="上下文" key="context">
          <ContextPanel />
        </TabPane>
      </Tabs>
    </aside>
  )
}
