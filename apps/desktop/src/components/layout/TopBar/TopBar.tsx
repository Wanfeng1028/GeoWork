// GeoWork TopBar

import { useEffect } from 'react'
import {
  Bell,
  CheckCircle,
  Menu,
  Search,
  Settings,
  LayoutGrid,
  Info,
} from 'lucide-react'
import useShellStore from '../../../stores/shellStore'
import { commandPaletteActions, runAction } from '../../../services/actionRegistry'
import { Badge } from '../../ui/badge'
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

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={() => runAction('toggleSidebar')} title="折叠侧栏">
          <Menu size={18} />
        </button>
        <span className={styles.title}>GeoWork</span>
      </div>

      <div className={styles.center}>
        <div className={styles.searchInputWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <Input
            placeholder="全局搜索 (Ctrl+P)"
            className={styles.searchInput}
            readOnly
            onFocus={() => runAction('openCommandPalette')}
          />
        </div>
        <div className={styles.modeDivider} />
        <div className={styles.modeTags}>
          {modes.map((mode) => (
            <button
              key={mode}
              className={cn(
                styles.modeTag,
                activeMode === mode.toLowerCase() && styles.activeModeTag,
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
          <span className="relative">
            <Bell size={18} />
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.iconBtn} title="设置">
              <Settings size={18} />
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

        <span className={styles.statusTag}>
          <CheckCircle size={14} className="text-[var(--gw-success)]" />
          Ready
        </span>
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
