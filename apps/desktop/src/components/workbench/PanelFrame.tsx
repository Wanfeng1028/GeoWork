
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
    <div className={className}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between h-8 px-3 border-b border-border/40">
          {title && (
            <span className="text-xs font-medium">{title}</span>
          )}
          {toolbar && <div>{toolbar}</div>}
        </div>
      )}
      <div
        className={contentClassName || (noPadding ? '' : 'p-3')}
      >
        {children}
      </div>
    </div>
  )
}
