import {
  Plug, LayoutGrid, Bell, BookOpen, Calendar, Cloud, Compass,
  FileSearch, FolderOpen, Home, PanelLeftClose, PanelLeftOpen,
  MessageSquare, Plus, Bot, Clock, Settings, Share2, Wrench, User,
} from 'lucide-react'
import useShellStore from '../../../stores/shellStore'
import { runAction } from '../../../services/actionRegistry'

interface LeftSidebarProps {
  collapsed?: boolean
}

const NAV_SECTIONS = [
  {
    label: '主能力',
    items: [
      ['expert', '专家系统', Bot],
      ['assistant', '助理系统', User],
      ['automation', '自动化', Clock],
      ['skills', '技能', Wrench],
      ['extensions', '扩展 / 插件', LayoutGrid],
      ['mcp', 'MCP', Plug],
      ['scheduler', '定时任务', Calendar],
    ],
  },
  {
    label: '知识资料',
    items: [
      ['files', '文件系统', FolderOpen],
      ['papers', '论文检索', FileSearch],
      ['knowledge', '知识库', BookOpen],
    ],
  },
  {
    label: '地理空间',
    items: [
      ['map', '地图与图层', Share2],
      ['gee', 'GEE 平台', Cloud],
    ],
  },
  {
    label: '任务 / 频道',
    items: [
      ['tasks', '任务', Home],
      ['channels', '频道', MessageSquare],
      ['messaging', '消息入口', Bell],
    ],
  },
]

export function LeftSidebar({ collapsed = false }: LeftSidebarProps) {
  const { activeNavKey, toggleSidebar } = useShellStore()
  const openNav = (key: string) => runAction('switchMainModule', key)

  return (
    <aside
      className={`shrink-0 h-full flex flex-col border-r border-[var(--gw-border-soft)] bg-[var(--gw-bg-sidebar)] transition-[width] duration-200 overflow-hidden ${
        collapsed ? 'w-[56px]' : 'w-[240px]'
      }`}
    >
      {/* Brand row */}
      <div className="flex items-center gap-2 h-[40px] px-3 shrink-0">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--gw-accent)] hover:bg-[var(--gw-bg-hover)] transition-colors cursor-pointer"
          onClick={() => openNav('workbench')}
          aria-label="GeoWork"
        >
          <Compass size={18} />
        </button>
        {!collapsed && (
          <span className="text-[13px] font-bold text-[var(--gw-text)] tracking-tight">GeoWork</span>
        )}
        <button
          className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
          onClick={toggleSidebar}
          aria-label={collapsed ? '展开' : '折叠'}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* New task button */}
      <div className="px-2 mb-2 shrink-0">
        <button
          className="w-full h-[34px] flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-all border border-[rgba(92,184,112,0.3)] bg-[rgba(92,184,112,0.12)] text-[var(--gw-accent)] hover:bg-[rgba(92,184,112,0.2)] hover:border-[var(--gw-accent)]"
          onClick={() => openNav('workbench')}
        >
          <Plus size={14} />
          {!collapsed && <span>新建任务</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 min-h-0">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-3">
            {!collapsed && (
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--gw-text-disabled)]">
                {section.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(([key, label, Icon]) => {
                const isActive = activeNavKey === key
                return (
                  <button
                    key={key}
                    title={label}
                    className={`w-full flex items-center gap-2.5 rounded-lg text-[12px] cursor-pointer transition-all ${
                      collapsed ? 'h-[34px] justify-center px-0' : 'h-[32px] px-2.5'
                    } ${
                      isActive
                        ? 'bg-[var(--gw-accent-soft)] text-[var(--gw-accent)] border border-[rgba(92,184,112,0.2)]'
                        : 'text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] border border-transparent'
                    }`}
                    onClick={() => openNav(key)}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--gw-border-soft)] mt-auto shrink-0">
        <div className="w-8 h-8 rounded-full bg-[var(--gw-bg-panel)] border border-[var(--gw-border-soft)] flex items-center justify-center text-[var(--gw-accent)] shrink-0">
          <User size={14} />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-[var(--gw-text)] truncate">GeoWork User</div>
            <div className="text-[10px] text-[var(--gw-text-disabled)]">Free</div>
          </div>
        )}
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-tertiary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
          onClick={() => openNav('settings')}
          title="设置"
        >
          <Settings size={14} />
        </button>
      </div>
    </aside>
  )
}
