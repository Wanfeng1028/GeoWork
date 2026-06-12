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

function UsageRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-[var(--gw-text-tertiary)]">{label}</span>
      <span className={`text-[12px] font-medium ${accent ? 'text-[var(--gw-accent)]' : 'text-[var(--gw-text)]'}`}>{value}</span>
    </div>
  )
}

export function TopBar() {
  const { sidebarCollapsed, commandPaletteOpen, setCommandPaletteOpen } = useShellStore()
  const [isMaximized, setIsMaximized] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState('')

  const handleMinimize = () => window.geowork?.desktop?.minimizeWindow?.()
  const handleMaximize = () => window.geowork?.desktop?.toggleMaximizeWindow?.()
  const handleClose = () => window.geowork?.desktop?.closeWindow?.()

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
    <header
      className="relative h-[36px] shrink-0 w-full flex items-center bg-[var(--gw-bg-shell)] border-b border-[var(--gw-border-soft)] select-none overflow-hidden"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left cluster */}
      <div className="flex items-center gap-1.5 pl-2.5 h-full flex-shrink-0 z-10" style={{ WebkitAppRegion: 'no-drag' }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer" title="菜单">
              <Menu size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start" sideOffset={4} className="w-[150px]">
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
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
          onClick={() => useShellStore.getState().toggleSidebar()}
          title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>

        {sidebarCollapsed && (
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
            onClick={() => runAction('createTask')}
            title="新建任务"
          >
            <Plus size={15} />
          </button>
        )}

        <button
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer"
          onClick={() => runAction('openCommandPalette')}
          title="搜索会话"
        >
          <Search size={15} />
        </button>
      </div>

      {/* Drag region - leaves space for right areas */}
      <div className="flex-1 h-full min-w-0" style={{ marginRight: 340, WebkitAppRegion: 'drag' }} />

      {/* Right actions - absolute, stops at window controls left edge */}
      <div
        className="absolute top-0 h-full flex items-center gap-2 overflow-hidden z-10"
        style={{ right: 132, maxWidth: 'calc(100vw - 132px - 240px)', paddingRight: 8, WebkitAppRegion: 'no-drag' }}
      >
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-[24px] px-2 flex items-center gap-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all flex-shrink-0 max-w-[140px] overflow-hidden bg-[linear-gradient(180deg,rgba(92,184,112,0.24),rgba(92,184,112,0.14))] text-[var(--gw-accent)] border border-[rgba(92,184,112,0.35)] shadow-[0_0_0_1px_rgba(92,184,112,0.08),0_0_20px_rgba(92,184,112,0.14)] hover:bg-[linear-gradient(180deg,rgba(92,184,112,0.32),rgba(92,184,112,0.2))] hover:shadow-[0_0_0_1px_rgba(92,184,112,0.12),0_0_28px_rgba(92,184,112,0.22)]">
              <Star size={12} className="fill-current flex-shrink-0" />
              <span className="hidden min-[980px]:inline whitespace-nowrap overflow-hidden text-ellipsis">给 GitHub 点 Star</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={6} className="w-[340px] p-0">
            <div className="p-5 flex flex-col items-center gap-3 text-center">
              <GeoMascot size="md" state="idle" />
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--gw-text)] mb-1">喜欢 GeoWork？给项目点个 Star</h3>
                <p className="text-[12px] text-[var(--gw-text-secondary)] leading-[1.6]">你的 Star 会帮助项目被更多人看到，也会鼓励后续继续完善桌面端、Agent 工作流和地理分析能力。</p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="primary" size="sm" className="flex-1" onClick={() => window.open('https://github.com/Wanfeng1028/GeoWork', '_blank')}>
                  <ExternalLink size={13} /> 打开 GitHub
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast.info('贡献指南开发中')}>查看项目</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <button
          className="h-7 px-2 flex items-center gap-1.5 rounded-md text-[12px] font-medium text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer flex-shrink-0 max-w-[88px] overflow-hidden"
          onClick={() => setFeedbackOpen(true)}
          title="问题反馈"
        >
          <MessageSquare size={14} className="flex-shrink-0" />
          <span className="hidden min-[1100px]:inline whitespace-nowrap overflow-hidden text-ellipsis">问题反馈</span>
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)] transition-colors cursor-pointer flex-shrink-0" title="用量">
              <Gauge size={15} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" sideOffset={6} className="w-[300px]">
            <div className="flex flex-col gap-3">
              <h4 className="text-[13px] font-semibold text-[var(--gw-text)]">用量概览</h4>
              <div className="flex flex-col gap-1">
                <UsageRow label="本地任务额度" value="无限" />
                <UsageRow label="Agent 调用额度" value="1,280 / 2,000" />
                <UsageRow label="地理分析额度" value="45 / 100" />
                <UsageRow label="今日剩余" value="87 次" accent />
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => toast.info('详情页开发中')}>查看详情</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Window controls - absolute, fixed right:0, 132px */}
      <div
        className="absolute top-0 right-0 h-full z-20"
        style={{
          width: 132,
          display: 'grid',
          gridTemplateColumns: '44px 44px 44px',
          alignItems: 'stretch',
          background: 'var(--gw-bg-shell)',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <button
          className="flex items-center justify-center border-none rounded-none bg-transparent cursor-pointer text-[var(--gw-text-tertiary)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--gw-text-secondary)] transition-colors"
          onClick={handleMinimize}
          title="最小化"
        >
          <Minus size={14} />
        </button>
        <button
          className="flex items-center justify-center border-none rounded-none bg-transparent cursor-pointer text-[var(--gw-text-tertiary)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--gw-text-secondary)] transition-colors"
          onClick={handleMaximize}
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? <Square size={11} /> : <Maximize2 size={12} />}
        </button>
        <button
          className="flex items-center justify-center border-none rounded-none bg-transparent cursor-pointer text-[var(--gw-text-tertiary)] hover:bg-[#e81123] hover:text-white transition-colors"
          onClick={handleClose}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>

      {/* Dialogs */}
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

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader><DialogTitle>问题反馈</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-[12px] text-[var(--gw-text-secondary)] leading-[1.6]">如果您在使用过程中遇到任何问题，请告诉我们</p>
            <div className="flex justify-center py-1"><GeoMascot size="sm" state="thinking" /></div>
            <div className="rounded-[10px] bg-[rgba(0,0,0,0.18)] p-3.5">
              <Textarea placeholder="请输入您的问题或建议..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={5} className="bg-[#151512] border-[rgba(255,255,255,0.08)] rounded-[9px] text-[13px] focus:border-[rgba(92,184,112,0.72)] focus:shadow-[0_0_0_3px_rgba(92,184,112,0.12)]" />
            </div>
            <div className="flex items-center gap-2 h-[96px] px-3 rounded-[10px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] text-[12px] text-[var(--gw-text-disabled)] cursor-pointer hover:border-[var(--gw-border)] transition-colors justify-center">
              <Camera size={14} /><span>支持添加截图（可选）</span>
            </div>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gw-text-disabled)]" />
              <Input placeholder="请输入您的邮箱地址（可选）" value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="pl-9 h-9 bg-[#151512] border-[rgba(255,255,255,0.08)] rounded-[8px] text-[13px] focus:border-[rgba(92,184,112,0.72)] focus:shadow-[0_0_0_3px_rgba(92,184,112,0.12)]" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => setFeedbackOpen(false)} className="text-[var(--gw-text-secondary)]">取消</Button>
            <Button variant="primary" size="sm" className="rounded-full h-8 px-3.5" onClick={() => { toast.info('反馈功能开发中'); setFeedbackOpen(false) }}><Send size={13} /> 提交</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
