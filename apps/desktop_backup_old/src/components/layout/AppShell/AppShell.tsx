import { TopBar } from '../TopBar/TopBar'
import { LeftSidebar } from '../LeftSidebar/LeftSidebar'
import { MainWorkspace } from '../../workspace/MainWorkspace/MainWorkspace'
import { RightDock } from '../RightDock/RightDock'
import useShellStore from '../../../stores/shellStore'

export function AppShell() {
  const { rightDockVisible, sidebarCollapsed } = useShellStore()

  return (
    <div >
      <TopBar />

      <div >
        <LeftSidebar collapsed={sidebarCollapsed} />
        <MainWorkspace />
        {rightDockVisible && <RightDock />}
      </div>
    </div>
  )
}
