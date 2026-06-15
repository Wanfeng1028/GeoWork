import { TopBar } from '../TopBar/TopBar'
import { LeftSidebar } from '../LeftSidebar/LeftSidebar'
import { MainWorkspace } from '../../workspace/MainWorkspace/MainWorkspace'
import { RightDock } from '../RightDock/RightDock'
import useShellStore from '../../../stores/shellStore'

export function AppShell() {
  const { rightDockVisible, sidebarCollapsed } = useShellStore()

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--gw-bg)] text-[var(--gw-text)]">
      <TopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftSidebar collapsed={sidebarCollapsed} />
        <MainWorkspace />
        {rightDockVisible && <RightDock />}
      </div>
    </div>
  )
}
