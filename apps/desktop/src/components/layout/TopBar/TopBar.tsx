import { useEffect, useState } from 'react'
import {
  Bell,
  CheckCircle,
  Menu,
  Search,
  Settings,
  LayoutGrid,
  Info,
  Minus,
  Square,
  X,
  Maximize2,
} from 'lucide-react'
import useShellStore from '../../../stores/shellStore'
import { commandPaletteActions, runAction } from '../../../services/actionRegistry'
import { Input } from '../../ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'

const modes = ['Research', 'Data', 'GeoCode', 'Analysis', 'Write']

export function TopBar() {
  const { activeMode, setActiveMode, commandPaletteOpen, setCommandPaletteOpen } = useShellStore()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        runAction('openCommandPalette')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleMinimize = () => window.geowork?.desktop?.minimizeWindow?.()
  const handleMaximize = () => window.geowork?.desktop?.toggleMaximizeWindow?.()
  const handleClose = () => window.geowork?.desktop?.closeWindow?.()

  return (
    <header className="h-[44px] shrink-0 flex items-center bg-[var(--gw-bg-shell)] border-b border-[var(--gw-border-soft)] select-none [-webkit-app-region:drag]">
      {/* Left: menu + brand */}
      <div className="flex items-center gap-2 w-[220px] pl-3 [-webkit-app-region:no-drag]">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
          onClick={() => runAction('toggleSidebar')}
          title="折叠侧栏"
        >
          <Menu size={16} />
        </button>
        <span className="text-[14px] font-bold text-[var(--gw-text)] tracking-tight">GeoWork</span>
      </div>

      {/* Center: search + mode nav */}
      <div className="flex-1 flex items-center justify-center gap-4 [-webkit-app-region:no-drag]">
        <div className="relative w-[280px] h-[30px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gw-text-disabled)] pointer-events-none" />
          <Input
            placeholder="搜索命令、文件、任务..."
            className="w-full h-full pl-8 pr-14 bg-[var(--gw-bg-input)] border-[var(--gw-border-soft)] rounded-lg text-[12px] hover:border-[var(--gw-border)] focus:border-[var(--gw-accent)]"
            readOnly
            onFocus={() => runAction('openCommandPalette')}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-[var(--gw-text-disabled)] bg-[var(--gw-bg-subtle)] border border-[var(--gw-border-soft)] rounded pointer-events-none">⌘P</kbd>
        </div>

        <div className="flex gap-0.5 p-0.5 bg-[var(--gw-bg-subtle)] rounded-lg border border-[var(--gw-border-soft)]">
          {modes.map((mode) => (
            <button
              key={mode}
              className={`h-[26px] px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all whitespace-nowrap ${
                activeMode === mode.toLowerCase()
                  ? 'text-[var(--gw-text)] bg-[var(--gw-bg-panel)] shadow-sm'
                  : 'text-[var(--gw-text-tertiary)] hover:text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)]'
              }`}
              onClick={() => setActiveMode(mode.toLowerCase() as any)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Right: status + window controls */}
      <div className="flex items-center gap-1 w-[280px] justify-end pr-0 [-webkit-app-region:no-drag]">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
          onClick={() => runAction('openRightDock', 'events')}
          title="事件"
        >
          <Bell size={15} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer" title="设置">
              <Settings size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => runAction('openSettings')}>
              <Settings size={14} /> 设置
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runAction('switchMainModule', 'workspaces')}>
              <LayoutGrid size={14} /> 工作空间
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runAction('switchMainModule', 'about')}>
              <Info size={14} /> 关于 GeoWork
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[var(--gw-success)] bg-[var(--gw-success-soft)] rounded-full">
          <CheckCircle size={11} />
          Ready
        </span>

        {/* Window controls */}
        <div className="flex items-center ml-2">
          <button
            className="w-[46px] h-[44px] flex items-center justify-center text-[var(--gw-text-secondary)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
            onClick={handleMinimize}
            title="最小化"
          >
            <Minus size={14} />
          </button>
          <button
            className="w-[46px] h-[44px] flex items-center justify-center text-[var(--gw-text-secondary)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
            onClick={handleMaximize}
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? <Square size={12} /> : <Maximize2 size={13} />}
          </button>
          <button
            className="w-[46px] h-[44px] flex items-center justify-center text-[var(--gw-text-secondary)] hover:bg-[#e81123] hover:text-white transition-colors cursor-pointer"
            onClick={handleClose}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Command palette dialog */}
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>命令面板</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {commandPaletteActions.map((action) => (
              <button
                key={action.id}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--gw-bg-hover)] transition-colors"
                onClick={() => {
                  setCommandPaletteOpen(false)
                  if (action.id === 'openRightDock') {
                    runAction(action.id, 'task')
                  } else {
                    runAction(action.id)
                  }
                }}
              >
                <div>
                  <div className="text-[13px] text-[var(--gw-text)]">{action.label}</div>
                  <div className="text-[11px] text-[var(--gw-text-tertiary)]">
                    {action.status === 'dev' ? action.fallbackMessage : '可用'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
