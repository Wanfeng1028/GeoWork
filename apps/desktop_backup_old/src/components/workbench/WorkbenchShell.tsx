
type WorkbenchShellProps = {
  topBar: React.ReactNode
  leftSidebar: React.ReactNode
  mainWorkspace: React.ReactNode
  rightInspector?: React.ReactNode
  statusBar?: React.ReactNode
  sidebarCollapsed?: boolean
  rightOpen?: boolean
}

export function WorkbenchShell({
  topBar,
  leftSidebar,
  mainWorkspace,
  rightInspector,
  statusBar,
  sidebarCollapsed = false,
  rightOpen = false,
}: WorkbenchShellProps) {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="flex flex-col h-full">
        <header
          className="h-9 shrink-0 border-b border-border/40"
        >
          {topBar}
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside
            className={`shrink-0 border-r border-border/40 transition-all duration-200 ${sidebarCollapsed ? 'w-12' : 'w-56'}`}
          >
            {leftSidebar}
          </aside>

          <main className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0">
              <div className="h-full w-full">
                {mainWorkspace}
              </div>
            </div>
          </main>

          {rightInspector && (
            <aside
              className={`shrink-0 border-l border-border/40 transition-all duration-200 ${rightOpen ? 'w-80' : 'w-0'}`}
            >
              {rightInspector}
            </aside>
          )}
        </div>

        {statusBar && (
          <footer
            className="h-6 shrink-0 border-t border-border/40 flex items-center px-3 text-xs text-muted-foreground"
          >
            {statusBar}
          </footer>
        )}
      </div>
    </div>
  )
}
