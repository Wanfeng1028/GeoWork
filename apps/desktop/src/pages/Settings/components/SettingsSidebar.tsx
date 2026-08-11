import { Button, Divider, Typography } from 'antd'
import {
  SettingOutlined,
  UserOutlined,
  DesktopOutlined,
  AudioOutlined,
  KeyOutlined,
  DatabaseOutlined,
  CloudDownloadOutlined,
  InboxOutlined,
  AppstoreOutlined,
  SafetyOutlined,
  ExperimentOutlined,
  RollbackOutlined,
  CloudServerOutlined,
  BranchesOutlined,
  CompassOutlined,
} from '@ant-design/icons'
import { theme } from 'antd'
import styles from './SettingsSidebar.module.css'

const { Text } = Typography

export type SettingsSectionKey =
  | 'preferences'
  | 'profile'
  | 'system'
  | 'providers'
  | 'git-worktree'
  | 'voice'
  | 'shortcuts'
  | 'memory'
  | 'update'
  | 'archived'
  | 'workspace'
  | 'safe-workspace'
  | 'experimental'
  | 'guide'

interface NavItem {
  key: SettingsSectionKey
  label: string
  icon: React.ReactNode
  badge?: boolean
}

const NAV_GENERAL: NavItem[] = [
  { key: 'preferences', label: '偏好设置', icon: <SettingOutlined /> },
  { key: 'profile', label: '个人资料', icon: <UserOutlined /> },
  { key: 'system', label: '系统设置', icon: <DesktopOutlined /> },
  { key: 'providers', label: '供应商', icon: <CloudServerOutlined /> },
  { key: 'git-worktree', label: 'Git 工作树', icon: <BranchesOutlined /> },
  { key: 'voice', label: '语音输入', icon: <AudioOutlined /> },
  { key: 'shortcuts', label: '快捷键', icon: <KeyOutlined /> },
  { key: 'memory', label: '记忆与上下文', icon: <DatabaseOutlined /> },
  { key: 'update', label: '更新应用', icon: <CloudDownloadOutlined /> },
  { key: 'archived', label: '已归档', icon: <InboxOutlined /> },
]

const NAV_EXTENSIONS: NavItem[] = [
  { key: 'workspace', label: '工作台 Beta', icon: <AppstoreOutlined /> },
]

const NAV_ADVANCED: NavItem[] = [
  { key: 'safe-workspace', label: '安全工作环境', icon: <SafetyOutlined /> },
  { key: 'experimental', label: '实验特性', icon: <ExperimentOutlined /> },
]

interface SettingsSidebarProps {
  activeSection: SettingsSectionKey
  onSectionChange: (section: SettingsSectionKey) => void
  onBack: () => void
  /** 用户是否已进入过引导；为 false 时在"引导"菜单项显示角标 */
  showGuideBadge?: boolean
}

export function SettingsSidebar({ activeSection, onSectionChange, onBack, showGuideBadge }: SettingsSidebarProps) {
  const { token } = theme.useToken()

  const guideItems: NavItem[] = [
    { key: 'guide', label: '引导', icon: <CompassOutlined />, badge: showGuideBadge },
  ]

  const renderNavGroup = (label: string, items: NavItem[]) => (
    <>
      <Text type="secondary" className={styles.groupLabel}>{label}</Text>
      {items.map((item) => {
        const isActive = activeSection === item.key
        return (
          <div
            key={item.key}
            className={styles.navItem}
            style={{
              background: isActive ? token.colorPrimaryBg : 'transparent',
              color: isActive ? token.colorPrimary : token.colorText,
              fontWeight: isActive ? 500 : 400,
            }}
            onClick={() => onSectionChange(item.key)}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = token.colorFillSecondary
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            <span className={styles.navItemIcon}>{item.icon}</span>
            <span className={styles.navItemLabel}>{item.label}</span>
            {item.badge && (
              <span
                className={styles.navBadge}
                style={{ background: token.colorPrimary }}
                title="尚未进入引导"
              />
            )}
          </div>
        )
      })}
    </>
  )

  return (
    <div
      className={styles.root}
      style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
    >
      <Button
        type="text"
        icon={<RollbackOutlined />}
        className={styles.backBtn}
        onClick={onBack}
      >
        返回应用
      </Button>

      <Divider style={{ margin: '4px 0' }} />

      {renderNavGroup('通用', NAV_GENERAL)}

      <Divider className={styles.divider} />

      {renderNavGroup('引导与入门', guideItems)}

      <Divider className={styles.divider} />

      {renderNavGroup('扩展与集成', NAV_EXTENSIONS)}

      <Divider className={styles.divider} />

      {renderNavGroup('高级设置', NAV_ADVANCED)}
    </div>
  )
}
