
type PanelFrameProps = {
  title?: string
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
  noPadding?: boolean
}

export function PanelFrame({
  title,
  toolbar,
  children,
  className,
  contentClassName,
  noPadding,
}: PanelFrameProps) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      {(title || toolbar) && (
        <div className="shrink-0">
          {title && (
            <span >{title}</span>
          )}
          {toolbar && <div >{toolbar}</div>}
        </div>
      )}
      <div
        className={cn(
          'flex-1 overflow-auto',
          !noPadding && 'p-3',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
