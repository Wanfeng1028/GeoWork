// GeoWork TopBar - Unified Desktop Title Bar

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
import { Button } from '../../ui/button'
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
import { cn } from '../../../lib/cn'
import styles from './TopBar.module.scss'

const modes = ['Research', 'Data', 'GeoCode', 'Analysis', 'Write']

export function TopBar() {
  const {
    activeMode,
    setActiveMode,
    commandPaletteOpen,
    setCommandPaletteOpen
  } = useShellStore()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        runAction('openCommandPalette')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.geowork?.desktop?.isWindowMaximized) {
        const maximized = await window.geowork.desktop.isWindowMaximized()
        setIsMaximized(maximized)
      }
    }
    checkMaximized()
    const interval = setInterval(checkMaximized, 500)
    return () => clearInterval(interval)
  }, [])

  const handleMinimize = () => {
    window.geowork?.desktop?.minimizeWindow?.()
  }

  const handleMaximize = () => {
    window.geowork?.desktop?.toggleMaximizeWindow?.()
  }

  const handleClose = () => {
    window.geowork?.desktop?.closeWindow?.()
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={() => runAction('toggleSidebar')} title="折叠侧栏">
          <Menu size={16} />
        </button>
        <div className={styles.brand}>
          <span className={styles.brandText}>GeoWork</span>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.searchBox}>
          <Search size={13} className={styles.searchIcon} />
          <Input
            placeholder="搜索命令、文件、任务..."
            className={styles.searchInput}
            readOnly
            onFocus={() => runAction('openCommandPalette')}
          />
          <kbd className={styles.shortcut}>⌘P</kbd>
        </div>

        <div className={styles.modeNav}>
          {modes.map((mode) => (
            <button
              key={mode}
              className={cn(
                styles.modeBtn,
                activeMode === mode.toLowerCase() && styles.activeModeBtn,
              )}
              onClick={() => setActiveMode(mode.toLowerCase() as any)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <button
          className={styles.iconBtn}
          onClick={() => runAction('openRightDock', 'events')}
          title="事件"
        >
          <Bell size={15} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.iconBtn} title="设置">
              <Settings size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => runAction('openSettings')}>
              <Settings size={14} />
              设置
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runAction('switchMainModule', 'workspaces')}>
              <LayoutGrid size={14} />
              工作空间
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runAction('switchMainModule', 'about')}>
              <Info size={14} />
              关于 GeoWork
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className={styles.statusBadge}>
          <CheckCircle size={12} />
          Ready
        </span>

        <div className={styles.windowControls}>
          <button className={styles.winBtn} onClick={handleMinimize} title="最小化">
            <Minus size={14} />
          </button>
          <button className={styles.winBtn} onClick={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
            {isMaximized ? <Square size={12} /> : <Maximize2 size={13} />}
          </button>
          <button className={cn(styles.winBtn, styles.winClose)} onClick={handleClose} title="关闭">
            <X size={14} />
          </button>
        </div>
      </div>

      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>命令面板</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {commandPaletteActions.map((action) => (
              <button
                key={action.id}
                className="flex w-full items-start gap-3 rounded-[var(--gw-radius-sm)] px-3 py-2.5 text-left hover:bg-[var(--gw-bg-hover)] transition-colors"
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
