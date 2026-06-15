import {
  Plus,
  Boxes,
  Timer,
  MessageCircle,
  CheckSquare,
  Hash,
  ChevronRight,
  ChevronDown,
  Grid2X2,
  Settings,
  LogOut,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Languages,
  Type,
  Crown,
  BookOpen,
  FileClock,
  Info,
  Check,
  Palette,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import useShellStore from '../../../stores/shellStore'
import useSettingsStore from '../../../stores/settingsStore'
import { runAction } from '../../../services/actionRegistry'
import type { GeoWorkTheme, GeoWorkThemeFamily } from '../../../design/types'
import styles from './LeftSidebar.module.scss'

const THEME_MODES: { value: 'light' | 'dark' | 'auto'; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '亮色', icon: Sun },
  { value: 'dark', label: '暗色', icon: Moon },
  { value: 'auto', label: '自动', icon: Monitor },
]

const THEME_FAMILIES: { value: GeoWorkThemeFamily; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'glass', label: '清透' },
  { value: 'classic', label: '经典' },
  { value: 'parchment', label: '羊皮纸' },
]

function themeModeOf(theme: GeoWorkTheme): 'light' | 'dark' | 'auto' {
  if (theme === 'auto') return 'auto'
  return theme.includes('dark') ? 'dark' : 'light'
}

function themeFamilyOf(theme: GeoWorkTheme): GeoWorkThemeFamily {
  if (theme.includes('glass')) return 'glass'
  if (theme.includes('classic')) return 'classic'
  if (theme.includes('parchment')) return 'parchment'
  return 'default'
}

function composeTheme(mode: 'light' | 'dark' | 'auto', family: GeoWorkThemeFamily): GeoWorkTheme {
  if (mode === 'auto') return 'auto'
  if (family === 'default') return mode
  return `${mode}-${family}` as GeoWorkTheme
}

const TASKS = [
  'NDVI 时序分析 · Sentinel-2',
  '土地覆盖分类训练',
  'Landsat 地表温度反演',
  '城市扩展变化检测',
  'DEM 坡度坡向分析',
  '/gee sentinel-2 合成',
  '水体提取 NDWI · 浙江',
  '论文阅读：遥感综述',
]

export interface LeftSidebarProps {
  collapsed?: boolean
}

export function LeftSidebar({ collapsed = false }: LeftSidebarProps) {
  const { activeNavKey } = useShellStore()
  const currentTheme = useSettingsStore((s) => s.settings.appearance.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const openNav = (key: string) => runAction('switchMainModule', key)

  const activeMode = themeModeOf(currentTheme)
  const activeFamily = themeFamilyOf(currentTheme)

  const [railMode, setRailMode] = useState<'tasks' | 'channels'>('tasks')
  const [extensionOpen, setExtensionOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [prefOpen, setPrefOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  if (collapsed) return null

  return (
    <aside className={styles.sidebar} onMouseLeave={() => { setPrefOpen(false); setThemeOpen(false) }}>
      <div className={styles.main}>
        <button className={styles.action} onClick={() => openNav('workbench')}>
          <Plus size={17} />
          <span>新任务</span>
        </button>

        <div className={`${styles.extensionGroup} ${extensionOpen ? styles.open : ''}`}>
          <button
            className={`${styles.action} ${extensionOpen ? styles.active : ''}`}
            onClick={() => setExtensionOpen(!extensionOpen)}
            onMouseEnter={() => setExtensionOpen(true)}
          >
            {extensionOpen ? <ChevronDown size={13} className={styles.chevron} /> : <ChevronRight size={13} className={styles.chevron} />}
            <Grid2X2 size={15} />
            <span>扩展</span>
          </button>
          {extensionOpen && (
            <div className={styles.kitNav} onMouseLeave={() => setExtensionOpen(false)}>
              <button className={activeNavKey === 'expert' ? styles.active : ''} onClick={() => openNav('expert')}>专家面板</button>
              <button className={activeNavKey === 'extensions' ? styles.active : ''} onClick={() => openNav('extensions')}>插件市场</button>
              <button className={activeNavKey === 'mcp' ? styles.active : ''} onClick={() => openNav('mcp')}>连接器</button>
            </div>
          )}
        </div>

        <button className={styles.action} onClick={() => openNav('scheduler')}>
          <Timer size={15} />
          <span>定时任务</span>
        </button>
        <button className={styles.action} onClick={() => openNav('channels')}>
          <MessageCircle size={16} />
          <span>IM 频道</span>
        </button>

        <div className={styles.modeSwitch}>
          <button
            className={`${styles.modeTab} ${railMode === 'tasks' ? styles.active : ''}`}
            onClick={() => setRailMode('tasks')}
          >
            <CheckSquare size={13} />
            <span>任务</span>
          </button>
          <button
            className={`${styles.modeTab} ${railMode === 'channels' ? styles.active : ''}`}
            onClick={() => setRailMode('channels')}
          >
            <MessageCircle size={13} />
            <span>频道</span>
          </button>
        </div>

        {railMode === 'channels' ? (
          <ChannelRail setMode={(k) => openNav(k)} />
        ) : (
          <TaskRail tasks={TASKS} setMode={(k) => openNav(k)} />
        )}
      </div>

      {profileOpen && (
        <div className={styles.profileMenu} onMouseEnter={() => setProfileOpen(true)}>
          <div className={styles.profileMenuSection}>
            <span>套餐到期</span>
            <strong>剩余 20 天到期</strong>
          </div>
          <MenuRow icon={Settings} label="设置" onClick={() => openNav('settings')} />
          <MenuRow
            icon={Palette}
            label="偏好设置"
            arrow
            active={prefOpen}
            onMouseEnter={() => { setPrefOpen(true); setThemeOpen(false) }}
          />
          <MenuRow icon={Crown} label="升级计划" />
          <MenuRow icon={BookOpen} label="帮助文档" />
          <MenuRow icon={FileClock} label="更新日志" />
          <MenuRow icon={Info} label="关于我们" />
          <div className={styles.submenuDivider} />
          <MenuRow icon={LogOut} label="退出登录" danger />
        </div>
      )}

      {profileOpen && prefOpen && (
        <div className={styles.preferenceMenu} onMouseEnter={() => setPrefOpen(true)}>
          <MenuRow icon={Languages} label="语言" arrow />
          <MenuRow
            icon={themeModeOf(currentTheme) === 'dark' ? Moon : Sun}
            label="主题"
            arrow
            active={themeOpen}
            onMouseEnter={() => setThemeOpen(true)}
          />
          <MenuRow icon={Type} label="字体设置" arrow />
          <MenuRow icon={Sparkles} label="字号大小" arrow />
        </div>
      )}

      {profileOpen && prefOpen && themeOpen && (
        <div className={styles.themeMenu} onMouseEnter={() => setThemeOpen(true)}>
          {THEME_MODES.map(({ value, label, icon }) => (
            <ThemeRow
              key={value}
              icon={icon}
              label={label}
              checked={activeMode === value}
              onClick={() => setTheme(composeTheme(value, activeFamily))}
            />
          ))}
          <div className={styles.submenuDivider} />
          {THEME_FAMILIES.map(({ value, label }) => (
            <ThemeRow
              key={value}
              dot
              label={label}
              checked={activeFamily === value}
              onClick={() => setTheme(composeTheme(activeMode, value))}
            />
          ))}
        </div>
      )}

      <button
        className={`${styles.profile} ${profileOpen ? styles.active : ''}`}
        onClick={() => setProfileOpen((value) => !value)}
        onMouseEnter={() => setProfileOpen(true)}
      >
        <div className={styles.avatar}>晚</div>
        <div>
          <span className={styles.profileName}>晚风wanfeng</span>
          <span className={styles.profilePlan}>Pro Plan</span>
        </div>
        <Settings size={15} />
      </button>
    </aside>
  )
}

function MenuRow({
  icon: Icon,
  label,
  arrow,
  active,
  danger,
  onClick,
  onMouseEnter,
}: {
  icon: typeof Settings
  label: string
  arrow?: boolean
  active?: boolean
  danger?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}) {
  return (
    <button
      className={`${styles.menuRow} ${active ? styles.active : ''} ${danger ? styles.danger : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <Icon size={14} />
      <span>{label}</span>
      {arrow && <ChevronRight size={14} />}
    </button>
  )
}

function ThemeRow({
  icon: Icon,
  label,
  checked,
  dot,
  onClick,
}: {
  icon?: typeof Sun
  label: string
  checked?: boolean
  dot?: boolean
  onClick?: () => void
}) {
  return (
    <button className={`${styles.themeRow} ${checked ? styles.checked : ''}`} onClick={onClick}>
      {dot ? <span className={styles.themeDot} /> : Icon ? <Icon size={14} /> : <span />}
      <span>{label}</span>
      {checked && <Check size={13} />}
    </button>
  )
}

function TaskRail({ tasks, setMode }: { tasks: string[]; setMode: (key: string) => void }) {
  return (
    <div className={styles.historyList}>
      {tasks.map((task) => {
        const isCommand = task.startsWith('/')
        return (
          <button key={task} className={styles.historyItem} onClick={() => setMode('workbench')}>
            {isCommand ? (
              <>
                <span className={styles.commandBadge}>
                  <Hash size={11} />
                  {task.slice(1).split(' ')[0]}
                </span>
                <span className={styles.commandRest}>{task.slice(task.indexOf(' ') + 1)}</span>
              </>
            ) : (
              <span>{task}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ChannelRail({ setMode }: { setMode: (key: string) => void }) {
  const channels = [
    ['微信', '我的微信'],
    ['钉钉', '项目提醒'],
    ['飞书', '研发日报'],
  ]
  return (
    <div className={styles.historyList}>
      {channels.map(([name, child]) => (
        <div key={name} className={styles.channelGroup}>
          <button className={styles.wechatRow} onClick={() => setMode('channels')}>
            <span className={styles.wechatDot}>●</span>
            {name}
          </button>
          <button className={`${styles.conversationChip} ${styles.historyItem}`} onClick={() => setMode('channels')}>
            {child}
          </button>
        </div>
      ))}
    </div>
  )
}
