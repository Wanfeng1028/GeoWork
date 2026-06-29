
type MainWorkspaceFrameProps = {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function MainWorkspaceFrame({ children, className, noPadding }: MainWorkspaceFrameProps) {
  return (
    <main className="flex-1">
      <div className={cn('h-full', !noPadding && 'p-2')}>
        <div
          className={cn(
            'h-full overflow-hidden rounded-[""]',
            'border border-[""] bg-[""]',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </main>
  )
}
