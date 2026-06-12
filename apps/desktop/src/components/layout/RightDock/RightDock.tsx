// GeoWork RightDock - Complete with all tabs

import { X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { TaskMonitorPanel } from '../../panel/TaskMonitorPanel/TaskMonitorPanel'
import { ArtifactPanel } from '../../panel/ArtifactPanel/ArtifactPanel'
import { DiffPanel } from '../../panel/DiffPanel/DiffPanel'
import { ContextPanel } from '../../panel/ContextPanel/ContextPanel'
import useShellStore from '../../../stores/shellStore'
import styles from './RightDock.module.scss'

export function RightDock() {
  const { activeRightPanel, setActiveRightPanel, closeRightDock } = useShellStore()

  return (
    <aside className={styles.dock}>
      <button className={styles.closeBtn} onClick={closeRightDock} aria-label="关闭右侧面板">
        <X size={14} />
      </button>
      <Tabs
        defaultValue={activeRightPanel}
        onValueChange={(key) => setActiveRightPanel(key as any)}
        className={styles.tabs}
      >
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="task">任务</TabsTrigger>
          <TabsTrigger value="artifacts">产物</TabsTrigger>
          <TabsTrigger value="diff">差异</TabsTrigger>
          <TabsTrigger value="context">上下文</TabsTrigger>
        </TabsList>
        <TabsContent value="task">
          <TaskMonitorPanel />
        </TabsContent>
        <TabsContent value="artifacts">
          <ArtifactPanel />
        </TabsContent>
        <TabsContent value="diff">
          <DiffPanel />
        </TabsContent>
        <TabsContent value="context">
          <ContextPanel />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
