import { useState } from 'react'
import { cn } from '../../lib/cn'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

export type InspectorTab = {
  key: string
  label: string
  icon: LucideIcon
  content: React.ReactNode
}

type RightInspectorProps = {
  tabs: InspectorTab[]
  defaultTab?: string
  open: boolean
  onToggle: () => void
  className?: string
}

export function RightInspector({
  tabs,
  defaultTab,
  open,
  onToggle,
  className,
}: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? '')

  if (!open) {
    return (
      <div className={cn('flex h-full flex-col items-center py-2 gap-1', className)}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              title={tab.label}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[var(--gw-radius-sm)] transition-colors',
                isActive
                  ? 'bg-[var(--gw-bg-active)] text-[var(--gw-text)]'
                  : 'text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)]',
              )}
              onClick={() => {
                setActiveTab(tab.key)
                onToggle()
              }}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          className="flex h-7 w-7 items-center justify-center rounded-[var(--gw-radius-xs)] text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors"
          onClick={onToggle}
          title="展开面板"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    )
  }

  const current = tabs.find((t) => t.key === activeTab)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex h-9 items-center border-b border-[var(--gw-border-soft)] px-1 gap-0.5 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              title={tab.label}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-[var(--gw-radius-xs)] px-2 text-[11px] font-medium transition-colors',
                isActive
                  ? 'bg-[var(--gw-bg-active)] text-[var(--gw-text)]'
                  : 'text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text-secondary)]',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          className="flex h-6 w-6 items-center justify-center rounded-[var(--gw-radius-xs)] text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors"
          onClick={onToggle}
          title="折叠面板"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {current?.content}
      </div>
    </div>
  )
}
