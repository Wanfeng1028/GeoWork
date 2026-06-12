import { cn } from '../../lib/cn'

type MainWorkspaceFrameProps = {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function MainWorkspaceFrame({ children, className, noPadding }: MainWorkspaceFrameProps) {
  return (
    <main className="min-w-0 flex-1 bg-[var(--gw-bg-shell)]">
      <div className={cn('h-full', !noPadding && 'p-2')}>
        <div
          className={cn(
            'h-full overflow-hidden rounded-[var(--gw-radius-lg)]',
            'border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)]',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </main>
  )
}
