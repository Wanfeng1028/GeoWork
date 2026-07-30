import {
  Button,
  Tooltip,
} from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LayoutOutlined,
  SearchOutlined,
  BarChartOutlined,
  MacCommandOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import styles from './TitleBar.module.css'
import { AppMenu } from './AppMenu'

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
  if (!isElectron) return null

  return (
    <div className={styles.titleBar}>
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
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleSidebar}
          />
        </Tooltip>
        <Tooltip title="面板">
          <Button type="text" size="small" icon={<LayoutOutlined />} />
        </Tooltip>
        <Tooltip title="搜索">
          <Button type="text" size="small" icon={<SearchOutlined />} onClick={onOpenSearch} />
        </Tooltip>
        <span className={styles.divider} />
        <Tooltip title="用量反馈">
          <Button type="text" size="small" icon={<BarChartOutlined />} onClick={() => onOpenModal('usage')} />
        </Tooltip>
        <Tooltip title="快捷键指引">
          <Button type="text" size="small" icon={<MacCommandOutlined />} onClick={() => onOpenModal('shortcuts')} />
        </Tooltip>
        <Tooltip title="问题反馈">
          <Button type="text" size="small" icon={<MessageOutlined />} onClick={() => onOpenModal('feedback')} />
        </Tooltip>
      </div>
    </div>
  )
}
