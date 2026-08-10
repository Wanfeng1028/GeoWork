import { App, Dropdown, theme } from 'antd'
import type { MenuProps } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { useAppearanceStore } from '../shared/stores/appearanceStore'
import type { Appearance } from '../shared/stores/appearanceStore'
import logoStatic from '../assets/brand/geowork-logo-horizontal-gradient.svg'
import styles from './AppMenu.module.css'

type MenuItem = Required<MenuProps>['items'][number]

interface AppMenuProps {
  onToggleSidebar: () => void
  onOpenSearch: () => void
  onOpenModal: (modal: 'usage' | 'shortcuts' | 'feedback') => void
}

/* 菜单项 label：左文字 + 右快捷键 */
function itemLabel(text: string, shortcut?: string): React.ReactNode {
  return (
    <span className={styles.itemRow}>
      <span>{text}</span>
      {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
    </span>
  )
}

/* 主题子项 label：带当前选中 check */
function themeLabel(text: string, checked: boolean): React.ReactNode {
  return (
    <span className={styles.itemRow}>
      <span>{text}</span>
      {checked && <CheckOutlined style={{ fontSize: 12, opacity: 0.85 }} />}
    </span>
  )
}

export function AppMenu({ onToggleSidebar, onOpenSearch, onOpenModal }: AppMenuProps) {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()
  const { appearance, setAppearance } = useAppearanceStore()

  const openFolder = () => {
    window.geowork?.desktop?.chooseFolder?.()
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen?.()
    }
  }

  const handleAbout = () => {
    modal.info({
      title: '关于 GeoWork',
      content: 'GeoWork 是面向 GIS、遥感和空间智能工作流的桌面应用。',
      okText: '关闭',
    })
  }

  /* ── 文件 ── */
  const fileMenu: MenuItem[] = [
    { key: 'new-task', label: itemLabel('新建任务', 'Ctrl+N'), onClick: () => navigate('/new-task') },
    { key: 'open-folder', label: itemLabel('打开工作目录'), onClick: openFolder },
    { type: 'divider' },
    { key: 'settings', label: itemLabel('设置', 'Ctrl+,'), onClick: () => navigate('/settings') },
  ]

  /* ── 编辑 ── */
  const editMenu: MenuItem[] = [
    { key: 'undo', label: itemLabel('撤销', 'Ctrl+Z'), onClick: () => document.execCommand('undo') },
    { key: 'redo', label: itemLabel('重做', 'Ctrl+Y'), onClick: () => document.execCommand('redo') },
    { type: 'divider' },
    { key: 'cut', label: itemLabel('剪切', 'Ctrl+X'), onClick: () => document.execCommand('cut') },
    { key: 'copy', label: itemLabel('复制', 'Ctrl+C'), onClick: () => document.execCommand('copy') },
    { key: 'paste', label: itemLabel('粘贴', 'Ctrl+V'), onClick: () => document.execCommand('paste') },
    { type: 'divider' },
    { key: 'find', label: itemLabel('查找', 'Ctrl+F'), onClick: onOpenSearch },
  ]

  /* ── 视图 ── */
  const themeChildren: MenuItem[] = [
    { key: 'light', label: themeLabel('晴空', appearance === 'light'), onClick: () => setAppearance('light' as Appearance) },
    { key: 'dark', label: themeLabel('暗色', appearance === 'dark'), onClick: () => setAppearance('dark' as Appearance) },
    { key: 'system', label: themeLabel('跟随系统', appearance === 'system'), onClick: () => setAppearance('system' as Appearance) },
    { key: 'illustration', label: themeLabel('插画风格', appearance === 'illustration'), onClick: () => setAppearance('illustration' as Appearance) },
    { key: 'glass', label: themeLabel('玻璃风格', appearance === 'glass'), onClick: () => setAppearance('glass' as Appearance) },
  ]

  const viewMenu: MenuItem[] = [
    { key: 'toggle-sidebar', label: itemLabel('折叠 / 展开侧栏', 'Ctrl+B'), onClick: onToggleSidebar },
    { key: 'search', label: itemLabel('全局搜索', 'Ctrl+Shift+F'), onClick: onOpenSearch },
    { type: 'divider' },
    { key: 'theme', label: '切换主题', children: themeChildren },
    { type: 'divider' },
    { key: 'fullscreen', label: itemLabel('全屏', 'F11'), onClick: toggleFullscreen },
  ]

  /* ── 任务 ── */
  const taskMenu: MenuItem[] = [
    { key: 'new-task', label: itemLabel('新任务'), onClick: () => navigate('/new-task') },
    { key: 'tasks', label: itemLabel('任务队列'), onClick: () => navigate('/tasks') },
    { key: 'mobile', label: itemLabel('移动端控制'), onClick: () => navigate('/mobile-control') },
    { type: 'divider' },
    { key: 'workspace', label: itemLabel('地图工作区'), onClick: () => navigate('/workspace') },
    { key: 'data-center', label: itemLabel('数据资产'), onClick: () => navigate('/data-center') },
    { key: 'agent-studio', label: itemLabel('Agent 编排'), onClick: () => navigate('/agent-studio') },
  ]

  /* ── 扩展 ── */
  const extMenu: MenuItem[] = [
    { key: 'experts', label: '专家', onClick: () => navigate('/extensions/experts') },
    { key: 'skills', label: '技能', onClick: () => navigate('/extensions/skills') },
    { key: 'mcp', label: 'MCP', onClick: () => navigate('/extensions/mcp') },
    { key: 'connectors', label: '连接器', onClick: () => navigate('/extensions/connectors') },
  ]

  /* ── 帮助 ── */
  const helpMenu: MenuItem[] = [
    { key: 'docs', label: '帮助文档', onClick: () => message.info('帮助文档后续接入') },
    { key: 'shortcuts', label: '快捷键指引', onClick: () => onOpenModal('shortcuts') },
    { key: 'feedback', label: '问题反馈', onClick: () => onOpenModal('feedback') },
    { type: 'divider' },
    { key: 'usage', label: '用量', onClick: () => onOpenModal('usage') },
    { type: 'divider' },
    { key: 'about', label: '关于 GeoWork', onClick: handleAbout },
  ]

  const menus: { key: string; label: string; items: MenuItem[] }[] = [
    { key: 'file', label: '文件', items: fileMenu },
    { key: 'edit', label: '编辑', items: editMenu },
    { key: 'view', label: '视图', items: viewMenu },
    { key: 'task', label: '任务', items: taskMenu },
    { key: 'ext', label: '扩展', items: extMenu },
    { key: 'help', label: '帮助', items: helpMenu },
  ]

  return (
    <div
      className={styles.appMenu}
      style={{ '--menu-text': token.colorText, '--menu-hover': token.controlItemBgHover } as React.CSSProperties}
    >
      <img src={logoStatic} className={styles.logo} alt="GeoWork" draggable={false} />
      {menus.map((m) => (
        <Dropdown key={m.key} menu={{ items: m.items }} trigger={['click']} placement="bottomLeft">
          <button type="button" className={styles.menuTrigger}>
            {m.label}
          </button>
        </Dropdown>
      ))}
    </div>
  )
}
