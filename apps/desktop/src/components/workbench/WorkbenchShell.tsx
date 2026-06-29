
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
    <div >
      <div className="flex-col">
        <header
          className="shrink-0"
          
        >
          {topBar}
        </header>

        <div className="flex-1">
          <aside
            className={cn(
              'shrink-0 border-r border-[""] bg-[""]',
              'transition-[width] duration-200 ease-[""]',
            )}
            
          >
            {leftSidebar}
          </aside>

          <main className="flex-1">
            <div >
              <div className="border">
                {mainWorkspace}
              </div>
            </div>
          </main>

          {rightInspector && (
            <aside
              className={cn(
                'shrink-0 border-l border-[""] bg-[""]',
                'transition-[width] duration-200 ease-[""]',
              )}
              
            >
              {rightInspector}
            </aside>
          )}
        </div>

        {statusBar && (
          <footer
            className="shrink-0"
            
          >
            {statusBar}
          </footer>
        )}
      </div>
    </div>
  )
}
