import { cn } from '../../lib/cn'

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
    <div className="h-screen w-screen overflow-hidden bg-[var(--gw-bg)] text-[var(--gw-text)]">
      <div className="flex h-full w-full flex-col">
        <header
          className="shrink-0 border-b border-[var(--gw-border-soft)] bg-[var(--gw-bg-shell)]"
          style={{ height: 'var(--gw-titlebar-height)' }}
        >
          {topBar}
        </header>

        <div className="flex min-h-0 flex-1">
          <aside
            className={cn(
              'shrink-0 border-r border-[var(--gw-border-soft)] bg-[var(--gw-bg-sidebar)]',
              'transition-[width] duration-200 ease-[var(--gw-ease-out)]',
            )}
            style={{
              width: sidebarCollapsed
                ? 'var(--gw-sidebar-collapsed-width)'
                : 'var(--gw-sidebar-width)',
            }}
          >
            {leftSidebar}
          </aside>

          <main className="min-w-0 flex-1 bg-[var(--gw-bg-shell)]">
            <div className="h-full p-2">
              <div className="h-full overflow-hidden rounded-[var(--gw-radius-lg)] border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)]">
                {mainWorkspace}
              </div>
            </div>
          </main>

          {rightInspector && (
            <aside
              className={cn(
                'shrink-0 border-l border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)]',
                'transition-[width] duration-200 ease-[var(--gw-ease-out)]',
              )}
              style={{
                width: rightOpen ? 'var(--gw-right-panel-width)' : 'var(--gw-right-rail-width)',
              }}
            >
              {rightInspector}
            </aside>
          )}
        </div>

        {statusBar && (
          <footer
            className="shrink-0 border-t border-[var(--gw-border-soft)] bg-[var(--gw-bg-shell)]"
            style={{ height: 'var(--gw-statusbar-height)' }}
          >
            {statusBar}
          </footer>
        )}
      </div>
    </div>
  )
}
