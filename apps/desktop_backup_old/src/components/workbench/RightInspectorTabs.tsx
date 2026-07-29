
import { useState } from 'react'

type RightInspectorTabsProps = {
  tabs: { key: string; label: string; content: React.ReactNode }[]
  defaultValue?: string
  className?: string
}

export function RightInspectorTabs({ tabs, defaultValue, className }: RightInspectorTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue ?? tabs[0]?.key)

  return (
    <div className={className}>
      <div className="flex gap-1 border-b border-border/40 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-3 py-1.5 text-xs rounded-t ${activeTab === tab.key ? 'bg-accent text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            value={tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          data-value={tab.key}
          className="focus-visible:outline-none"
          hidden={activeTab !== tab.key}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
