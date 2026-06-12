// GeoWork AppShell - Agent Workbench Layout

import { TopBar } from '../TopBar/TopBar'
import { LeftSidebar } from '../LeftSidebar/LeftSidebar'
import { MainWorkspace } from '../../workspace/MainWorkspace/MainWorkspace'
import { ConversationMinimap } from '../../chat/ConversationMinimap/ConversationMinimap'
import { RightDock } from '../RightDock/RightDock'
import { StatusBar, StatusItem } from '../../workbench/StatusBar'
import { Circle, GitBranch, Cpu } from 'lucide-react'
import useShellStore from '../../../stores/shellStore'
import styles from './AppShell.module.scss'

export function AppShell() {
  const {
    rightDockVisible,
    sidebarCollapsed,
    conversationMinimapEnabled,
    activeNavKey,
    activeMode,
  } = useShellStore()
  const showMinimap = conversationMinimapEnabled && activeNavKey !== 'workbench'

  return (
    <div className={styles.shell}>
      <TopBar />

      <div className={styles.body}>
        <LeftSidebar collapsed={sidebarCollapsed} />

        <MainWorkspace />

        {showMinimap && <ConversationMinimap />}

        {rightDockVisible && <RightDock />}
      </div>

      <StatusBar
        left={
          <>
            <StatusItem
              icon={<Circle size={8} className="fill-current" />}
              label="就绪"
              variant="success"
            />
            <StatusItem
              icon={<GitBranch size={12} />}
              label="master"
            />
          </>
        }
        right={
          <>
            <StatusItem
              icon={<Cpu size={12} />}
              label={activeMode}
            />
            <StatusItem label="UTF-8" />
            <StatusItem label="GeoWork v0.1.0" />
          </>
        }
      />
    </div>
  )
}
