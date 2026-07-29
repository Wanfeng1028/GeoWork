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
      <div className={`flex flex-col border-l border-border/40 w-12 ${className || ''}`}>
        <div className="flex flex-col py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                title={tab.label}
                className="h-8 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={() => {
                  setActiveTab(tab.key)
                  onToggle()
                }}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
          <div className="h-px mx-2 my-1 bg-border/40" />
          <button
            className="h-8 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={onToggle}
            title="展开面板"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const current = tabs.find((t) => t.key === activeTab)

  return (
    <div className={`flex flex-col border-l border-border/40 w-80 ${className || ''}`}>
      <div className="flex items-center h-9 px-3 border-b border-border/40 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              title={tab.label}
              className={`h-7 px-2 flex items-center gap-1.5 text-xs rounded ${isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}
        <div className="h-px mx-2 bg-border/40" />
        <button
          className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded"
          onClick={onToggle}
          title="折叠面板"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {current?.content}
      </div>
    </div>
  )
}
