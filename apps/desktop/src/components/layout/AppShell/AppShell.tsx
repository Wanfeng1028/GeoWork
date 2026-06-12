import { TopBar } from '../TopBar/TopBar'
import { LeftSidebar } from '../LeftSidebar/LeftSidebar'
import { MainWorkspace } from '../../workspace/MainWorkspace/MainWorkspace'
import { RightDock } from '../RightDock/RightDock'
import { StatusBar } from '../../workbench/StatusBar'
import { Circle, GitBranch, Cpu } from 'lucide-react'
import useShellStore from '../../../stores/shellStore'

export function AppShell() {
  const {
    rightDockVisible,
    sidebarCollapsed,
    activeMode,
  } = useShellStore()

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--gw-bg)] text-[var(--gw-text)]">
      <TopBar />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftSidebar collapsed={sidebarCollapsed} />
        <MainWorkspace />
        {rightDockVisible && <RightDock />}
      </div>

      <StatusBar
        left={
          <>
            <span className="flex items-center gap-1.5 text-[var(--gw-success)]">
              <Circle size={7} className="fill-current" />
              <span>Ready</span>
            </span>
            <span className="flex items-center gap-1 text-[var(--gw-text-tertiary)]">
              <GitBranch size={11} />
              <span>master</span>
            </span>
          </>
        }
        right={
          <>
            <span className="flex items-center gap-1 text-[var(--gw-text-tertiary)]">
              <Cpu size={11} />
              <span>{activeMode}</span>
            </span>
            <span className="text-[var(--gw-text-disabled)]">UTF-8</span>
            <span className="text-[var(--gw-text-disabled)]">GeoWork v0.1.0</span>
          </>
        }
      />
    </div>
  )
}
