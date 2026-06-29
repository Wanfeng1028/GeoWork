import { useState } from 'react'
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
                'flex h-8 w-8 items-center justify-center rounded-[""] transition-colors',
                isActive
                  ? 'bg-[""] text-[""]'
                  : 'text-[""] hover:bg-[""] hover:text-[""]',
              )}
              onClick={() => {
                setActiveTab(tab.key)
                onToggle()
              }}
            >
              <Icon  />
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          
          onClick={onToggle}
          title="展开面板"
        >
          <ChevronLeft  />
        </button>
      </div>
    )
  }

  const current = tabs.find((t) => t.key === activeTab)

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              title={tab.label}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-[""] px-2 text-[11px] font-medium transition-colors',
                isActive
                  ? 'bg-[""] text-[""]'
                  : 'text-[""] hover:bg-[""] hover:text-[""]',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon  />
              <span >{tab.label}</span>
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          
          onClick={onToggle}
          title="折叠面板"
        >
          <ChevronRight  />
        </button>
      </div>

      <div className="flex-1">
        {current?.content}
      </div>
    </div>
  )
}
