
type MainWorkspaceFrameProps = {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function MainWorkspaceFrame({ children, className, noPadding }: MainWorkspaceFrameProps) {
  return (
    <main className="h-full w-full overflow-auto">
      <div className={noPadding ? 'h-full' : 'h-full p-2'}>
        <div className="h-full">
          {children}
        </div>
      </div>
    </main>
  )
}
