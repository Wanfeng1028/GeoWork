import { Inbox } from 'lucide-react'
import { cn } from '../../lib/cn'
import { GeoMascot } from '../brand/GeoMascot'

interface EmptyProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
  useMascot?: boolean
}

export function Empty({
  icon,
  title = '暂无内容',
  description,
  action,
  className,
  useMascot = true,
}: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-3 p-8',
        className,
      )}
    >
      <div className="text-[var(--gw-text-disabled)]">
        {icon ?? (useMascot ? <GeoMascot size="lg" state="idle" /> : <Inbox className="h-10 w-10" strokeWidth={1} />)}
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium text-[var(--gw-text-tertiary)]">{title}</p>
        {description && (
          <p className="mt-1 text-[12px] text-[var(--gw-text-disabled)] max-w-[280px]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
