import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react'
import { geoAgentCharacterAssets } from '../brand'

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
    <div >
      <div >
        <button
          
          onClick={() => onNavigate('workbench')}
          aria-label="GeoWork"
        >
          <img src={geoAgentCharacterAssets.logo.mark} alt="GeoWork"  draggable={false} />
        </button>
        {!collapsed && (
          <span >{brandName}</span>
        )}
        <button
          
          onClick={onToggleCollapse}
          aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {collapsed ? <ChevronRight  /> : <ChevronLeft  />}
        </button>
      </div>

      <button

        onClick={() => onNavigate('workbench')}
      >
        <Plus  />
        {!collapsed && <span>新建任务</span>}
      </button>

      <nav >
        {sections.map((section) => (
          <div key={section.label} >
            {!collapsed && (
              <div >
                {section.label}
              </div>
            )}
            <div >
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = activeKey === item.key
                return (
                  <button
                    key={item.key}
                    title={item.label}

                    onClick={() => onNavigate(item.key)}
                  >
                    <Icon  />
                    {!collapsed && <span >{item.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div >
        <div >
          <div >
            <User  />
          </div>
          {!collapsed && (
            <div >
              <div >GeoWork User</div>
              <div >Free</div>
            </div>
          )}
          <button
            
            onClick={onOpenSettings}
            title="设置"
          >
            <Settings  />
          </button>
        </div>
      </div>
    </div>
  )
}
