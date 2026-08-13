import { useEffect } from 'react'
import {
  Button,
  Tooltip,
  theme,
} from 'antd'
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Search,
  BarChart3,
  Command,
  MessageSquare,
} from 'lucide-react'
import styles from './TitleBar.module.css'
import { AppMenu } from './AppMenu'
import { useAppearanceStore } from '../shared/stores/appearanceStore'

const isElectron = typeof window !== 'undefined' && !!window.geowork?.desktop

interface TitleBarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenSearch: () => void
  onOpenModal: (modal: 'usage' | 'shortcuts' | 'feedback') => void
}

export function TitleBar({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch,
  onOpenModal,
}: TitleBarProps) {
  const { token } = theme.useToken()
  const resolvedAppearance = useAppearanceStore((s) => s.resolvedAppearance)

  // 原生标题栏（titleBarOverlay）无法用 CSS 控制，需随主题通知主进程切换配色
  useEffect(() => {
    if (!isElectron) return
    window.geowork?.desktop.setTitleBarTheme(resolvedAppearance === 'dark')
  }, [resolvedAppearance])

  if (!isElectron) return null

  return (
    <div className={styles.titleBar} style={{ background: token.colorBgContainer }}>
      <AppMenu
        onToggleSidebar={onToggleSidebar}
        onOpenSearch={onOpenSearch}
        onOpenModal={onOpenModal}
      />
      <div className={styles.dragRegion} />
      <div className={styles.center}>
        <Tooltip title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}>
          <Button
            type="text"
            size="small"
            icon={sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            onClick={onToggleSidebar}
          />
        </Tooltip>
        <Tooltip title="面板">
          <Button type="text" size="small" icon={<LayoutDashboard />} />
        </Tooltip>
        <Tooltip title="搜索">
          <Button type="text" size="small" icon={<Search />} onClick={onOpenSearch} />
        </Tooltip>
        <span className={styles.divider} />
        <Tooltip title="用量反馈">
          <Button type="text" size="small" icon={<BarChart3 />} onClick={() => onOpenModal('usage')} />
        </Tooltip>
        <Tooltip title="快捷键指引">
          <Button type="text" size="small" icon={<Command />} onClick={() => onOpenModal('shortcuts')} />
        </Tooltip>
        <Tooltip title="问题反馈">
          <Button type="text" size="small" icon={<MessageSquare />} onClick={() => onOpenModal('feedback')} />
        </Tooltip>
      </div>
    </div>
  )
}
