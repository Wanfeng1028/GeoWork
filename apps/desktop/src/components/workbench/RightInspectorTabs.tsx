import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

type RightInspectorTabsProps = {
  tabs: { key: string; label: string; content: React.ReactNode }[]
  defaultValue?: string
  className?: string
}

export function RightInspectorTabs({ tabs, defaultValue, className }: RightInspectorTabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? tabs[0]?.key}
      className={cn('flex h-full flex-col', className)}
    >
      <TabsPrimitive.List className="flex shrink-0 border-b border-[var(--gw-border-soft)] px-2">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            className={cn(
              'px-3 py-2 text-[11px] font-medium text-[var(--gw-text-tertiary)]',
              'border-b-2 border-transparent -mb-px',
              'transition-colors',
              'data-[state=active]:border-[var(--gw-accent)] data-[state=active]:text-[var(--gw-text)]',
              'hover:text-[var(--gw-text-secondary)]',
            )}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.key}
          value={tab.key}
          className="flex-1 overflow-hidden focus-visible:outline-none"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
