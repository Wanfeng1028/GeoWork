// GeoWork AppShell - Five Zone Layout

import { TopBar } from '../TopBar/TopBar'
import { LeftSidebar } from '../LeftSidebar/LeftSidebar'
import { MainWorkspace } from '../../workspace/MainWorkspace/MainWorkspace'
import { ConversationMinimap } from '../../chat/ConversationMinimap/ConversationMinimap'
import { RightDock } from '../RightDock/RightDock'
import { BottomDock } from '../BottomDock/BottomDock'
import useShellStore from '../../../stores/shellStore'
import styles from './AppShell.module.scss'

export function AppShell() {
  const {
    rightDockVisible,
    bottomDockVisible,
    sidebarCollapsed,
    conversationMinimapEnabled,
    activeNavKey
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
      
      {bottomDockVisible && <BottomDock />}
    </div>
  )
}
