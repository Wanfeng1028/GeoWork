import { useEffect, useState } from 'react'
import {
  Menu, PanelLeftOpen, PanelLeftClose, Plus, Search,
  Minus, Square, X, Maximize2,
  RefreshCw, MessageSquare, Info, Star, Gauge,
  ExternalLink, Send, Camera, Mail,
} from 'lucide-react'
import useShellStore from '../../../stores/shellStore'
import { runAction, commandPaletteActions } from '../../../services/actionRegistry'
import { GeoMascot } from '../../brand/GeoMascot'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { toast } from 'sonner'
import styles from './TopBar.module.scss'

function getGeoWorkApi() {
  return (window as any).geowork
}

function UsageRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={styles.usageRow}>
      <span>{label}</span>
      <strong className={accent ? styles.green : ''}>{value}</strong>
    </div>
  )
}

export function TopBar() {
  const { sidebarCollapsed, commandPaletteOpen, setCommandPaletteOpen } = useShellStore()
  const [isMaximized, setIsMaximized] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState('')

  const handleMinimize = () => {
    const api = getGeoWorkApi()
    api?.windowControls?.minimize?.()
    api?.desktop?.minimizeWindow?.()
  }

  const handleMaximize = () => {
    const api = getGeoWorkApi()
    api?.windowControls?.maximize?.()
    api?.desktop?.toggleMaximizeWindow?.()
    setIsMaximized((value) => !value)
  }

  const handleClose = () => {
    const api = getGeoWorkApi()
    api?.windowControls?.close?.()
    api?.desktop?.closeWindow?.()
  }

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

  return (
    <header className={styles.topbar}>
      {/* Column 1: Left cluster */}
      <div className={styles.left}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.iconBtn} title="菜单">
              <Menu size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start" sideOffset={4} className={styles.appMenuContent}>
            <DropdownMenuItem onClick={() => toast.info('已是最新版本')}>
              <RefreshCw size={14} /> 检查更新
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
              <MessageSquare size={14} /> 问题反馈
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => runAction('switchMainModule', 'about')}>
              <Info size={14} /> 关于
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className={styles.iconBtn}
          onClick={() => useShellStore.getState().toggleSidebar()}
          title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>

        {sidebarCollapsed && (
          <button className={styles.iconBtn} onClick={() => runAction('createTask')} title="新建任务">
            <Plus size={15} />
          </button>
        )}

        <button className={styles.iconBtn} onClick={() => runAction('openCommandPalette')} title="搜索会话">
          <Search size={15} />
        </button>
      </div>

      {/* Column 2: Drag region */}
      <div className={styles.dragRegion} />

      {/* Column 3: Right actions */}
      <div className={styles.rightActions}>
        {/* GitHub Star */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={styles.starButton} type="button" title="给 GitHub 点 Star">
              <Star size={12} className={styles.fillIcon} />
              <span className={styles.starText}>给 GitHub 点 Star</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={6} className={styles.starPopover}>
            <div className={styles.starPopoverInner}>
              <GeoMascot size="md" state="idle" />
              <div>
                <h3>喜欢 GeoWork？给项目点个 Star</h3>
                <p>你的 Star 会帮助项目被更多人看到，也会鼓励后续继续完善桌面端、Agent 工作流和地理分析能力。</p>
              </div>
              <div className={styles.popoverActions}>
                <Button variant="primary" size="sm" className={styles.popoverMainButton} onClick={() => window.open('https://github.com/Wanfeng1028/GeoWork', '_blank')}>
                  <ExternalLink size={13} /> 打开 GitHub
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast.info('贡献指南开发中')}>查看项目</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Feedback */}
        <button
          className={styles.feedbackButton}
          type="button"
          onClick={() => setFeedbackOpen(true)}
          title="问题反馈"
        >
          <MessageSquare size={14} />
          <span className={styles.feedbackText}>问题反馈</span>
        </button>

        {/* Usage */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={styles.usageButton} type="button" title="用量">
              <Gauge size={15} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={6} className={styles.usagePopover}>
            <div className={styles.usageContent}>
              <h4>用量概览</h4>
              <UsageRow label="本地任务额度" value="无限" />
              <UsageRow label="Agent 调用额度" value="1,280 / 2,000" />
              <UsageRow label="地理分析额度" value="45 / 100" />
              <UsageRow label="今日剩余" value="87 次" accent />
              <Button variant="ghost" size="sm" className={styles.usageDetailButton} onClick={() => toast.info('详情页开发中')}>查看详情</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Column 4: Window controls */}
      <div className={styles.windowControls}>
        <button className={styles.winBtn} onClick={handleMinimize} title="最小化">
          <Minus size={12} />
        </button>
        <button className={styles.winBtn} onClick={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
          {isMaximized ? <Square size={11} /> : <Maximize2 size={12} />}
        </button>
        <button className={`${styles.winBtn} ${styles.winClose}`} onClick={handleClose} title="关闭">
          <X size={12} />
        </button>
      </div>

      {/* Command palette dialog */}
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader><DialogTitle>命令面板</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {commandPaletteActions.map((action) => (
              <button key={action.id} className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--gw-bg-hover)] transition-colors" onClick={() => { setCommandPaletteOpen(false); runAction(action.id, action.id === 'openRightDock' ? 'task' : undefined) }}>
                <div>
                  <div className="text-[13px] text-[var(--gw-text)]">{action.label}</div>
                  <div className="text-[11px] text-[var(--gw-text-tertiary)]">{action.status === 'dev' ? action.fallbackMessage : '可用'}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader><DialogTitle>问题反馈</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-[12px] text-[#b4b4ac] leading-[1.6]">如果您在使用过程中遇到任何问题，请告诉我们</p>
            <div className="flex justify-center py-1"><GeoMascot size="sm" state="thinking" /></div>
            <div className="rounded-[10px] bg-[rgba(0,0,0,0.18)] p-3.5">
              <Textarea placeholder="请输入您的问题或建议..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={5} className="bg-[#151512] border-[rgba(255,255,255,0.08)] rounded-[9px] text-[13px]" />
            </div>
            <div className="flex items-center gap-2 h-[96px] px-3 rounded-[10px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] text-[12px] text-[var(--gw-text-disabled)] cursor-pointer justify-center">
              <Camera size={14} /><span>支持添加截图（可选）</span>
            </div>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gw-text-disabled)]" />
              <Input placeholder="请输入您的邮箱地址（可选）" value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="pl-9 h-9 bg-[#151512] border-[rgba(255,255,255,0.08)] rounded-[8px] text-[13px]" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => setFeedbackOpen(false)}>取消</Button>
            <Button variant="primary" size="sm" className="rounded-full h-8 px-3.5" onClick={() => { toast.info('反馈功能开发中'); setFeedbackOpen(false) }}><Send size={13} /> 提交</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
