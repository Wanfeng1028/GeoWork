import { cn } from '../../lib/cn'
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Plus,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  key: string
  label: string
  icon: LucideIcon
}

export type NavSection = {
  label: string
  items: NavItem[]
}

type LeftNavProps = {
  sections: NavSection[]
  activeKey: string
  collapsed: boolean
  onNavigate: (key: string) => void
  onToggleCollapse: () => void
  onOpenSettings?: () => void
  brandName?: string
}

export function LeftNav({
  sections,
  activeKey,
  collapsed,
  onNavigate,
  onToggleCollapse,
  onOpenSettings,
  brandName = 'GeoWork',
}: LeftNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[var(--gw-titlebar-height)] items-center gap-2 px-3">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-[var(--gw-radius-sm)] text-[var(--gw-accent)] hover:bg-[var(--gw-bg-hover)] transition-colors"
          onClick={() => onNavigate('workbench')}
          aria-label="GeoWork"
        >
          <Compass className="h-5 w-5" />
        </button>
        {!collapsed && (
          <span className="text-[14px] font-semibold text-[var(--gw-text)]">{brandName}</span>
        )}
        <button
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-[var(--gw-radius-xs)] text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors"
          onClick={onToggleCollapse}
          aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <button
        className={cn(
          'mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-[var(--gw-radius-sm)]',
          'bg-[var(--gw-accent)] text-[var(--gw-bg)] text-[12px] font-medium',
          'hover:bg-[var(--gw-accent-hover)] active:bg-[var(--gw-accent-active)]',
          'transition-colors h-8',
        )}
        onClick={() => onNavigate('workbench')}
      >
        <Plus className="h-3.5 w-3.5" />
        {!collapsed && <span>新建任务</span>}
      </button>

      <nav className="flex-1 overflow-y-auto px-1.5">
        {sections.map((section) => (
          <div key={section.label} className="mb-3">
            {!collapsed && (
              <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--gw-text-disabled)]">
                {section.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = activeKey === item.key
                return (
                  <button
                    key={item.key}
                    title={item.label}
                    className={cn(
                      'flex items-center gap-2 rounded-[var(--gw-radius-sm)] px-2 py-1.5',
                      'text-[12px] transition-colors',
                      isActive
                        ? 'bg-[var(--gw-bg-active)] text-[var(--gw-text)]'
                        : 'text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)]',
                    )}
                    onClick={() => onNavigate(item.key)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--gw-border-soft)] p-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gw-bg-active)] text-[var(--gw-text-tertiary)]">
            <User className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[var(--gw-text)] truncate">GeoWork User</div>
              <div className="text-[10px] text-[var(--gw-text-tertiary)]">Free</div>
            </div>
          )}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-[var(--gw-radius-xs)] text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors"
            onClick={onOpenSettings}
            title="设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
