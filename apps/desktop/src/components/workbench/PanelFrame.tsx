import { cn } from '../../lib/cn'

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
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--gw-border-soft)] px-3">
          {title && (
            <span className="text-[12px] font-medium text-[var(--gw-text)]">{title}</span>
          )}
          {toolbar && <div className="flex items-center gap-1">{toolbar}</div>}
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
