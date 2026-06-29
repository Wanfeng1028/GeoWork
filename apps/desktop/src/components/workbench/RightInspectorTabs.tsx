import * as TabsPrimitive from '@radix-ui/react-tabs'

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
      <TabsPrimitive.List className="shrink-0">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.key}
            value={tab.key}
            className={cn(
              'px-3 py-2 text-[11px] font-medium text-[""]',
              'border-b-2 border-transparent -mb-px',
              'transition-colors',
              'data-[state=active]:border-[""] data-[state=active]:text-[""]',
              'hover:text-[""]',
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
          className="flex-1 focus-visible:outline-none"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
