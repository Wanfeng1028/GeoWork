import { useState } from 'react'
import {
  App,
  Avatar,
  Divider,
  Dropdown,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  User,
  Settings,
  ChevronRight,
  Check,
  BookOpen,
  FileText,
  Info,
  LogOut,
  Crown,
  ShoppingCart,
  Palette,
  Globe,
  Type,
  Columns,
  PaintbrushVertical,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useAppearanceStore } from '../shared/stores/appearanceStore'
import type { Appearance } from '../shared/stores/appearanceStore'
import { loadSettings, updateSettingsPatch } from '../pages/Settings/settingsStorage'
import type { GeoWorkSettings } from '../pages/Settings/settingsStorage'
import styles from './UserMenu.module.css'

interface UserMenuProps {
  collapsed: boolean
  onOpenShortcuts: () => void
}

type MenuItem = Required<MenuProps>['items'][number]

/* ── 工具函数：生成带 check 标记的 label ── */
function checkLabel(text: string, checked: boolean): React.ReactNode {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 120 }}>
      <span>{text}</span>
      {checked && <Check style={{ fontSize: 12, opacity: 0.85 }} />}
    </span>
  )
}

function subCheckLabel(text: string, checked: boolean): React.ReactNode {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 100 }}>
      <span>{text}</span>
      {checked && <Check style={{ fontSize: 12, opacity: 0.85 }} />}
    </span>
  )
}

export function UserMenu({ collapsed, onOpenShortcuts: _onOpenShortcuts }: UserMenuProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { appearance, setAppearance } = useAppearanceStore()

  /* ── 设置状态 ── */
  const [settings, setSettings] = useState<GeoWorkSettings>(() => loadSettings())

  /* ── 偏好更新 ── */
  const updatePreference = (patch: Partial<GeoWorkSettings>) => {
    const next = updateSettingsPatch(patch)
    setSettings(next)
    message.success('偏好设置已更新')
  }

  /* ── 设置跳转 ── */
  const handleSettings = () => {
    if (location.pathname === '/settings') {
      message.info('当前已在设置页面')
    } else {
      navigate('/settings')
    }
  }

  /* ── 关于弹窗 ── */
  const handleAbout = () => {
    modal.info({
      title: '关于 GeoWork',
      content: (
        <div>
          <Typography.Paragraph>
            GeoWork 是面向 GIS、遥感和空间智能工作流的前端应用。
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            技术栈：Vite + React + TypeScript + Ant Design
          </Typography.Paragraph>
        </div>
      ),
      okText: '关闭',
    })
  }

  /* ── 退出登录 ── */
  const handleLogout = () => {
    modal.confirm({
      title: '确认退出登录？',
      content: '退出后需要重新登录。',
      okText: '退出',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        message.info('当前为本地预览账号，暂不需要退出登录')
      },
    })
  }

  /* ══════════════ 构建偏好子菜单 ══════════════ */

  const languageChildren: MenuItem[] = [
    {
      key: 'lang-zh',
      label: subCheckLabel('中文', settings.language === 'zh-CN'),
      onClick: () => updatePreference({ language: 'zh-CN' }),
    },
    {
      key: 'lang-en',
      label: subCheckLabel('English', settings.language === 'en-US'),
      onClick: () => updatePreference({ language: 'en-US' }),
    },
  ]

  const themeChildren: MenuItem[] = [
    {
      key: 'theme-light',
      label: subCheckLabel('晴空', appearance === 'light'),
      onClick: () => setAppearance('light' as Appearance),
    },
    {
      key: 'theme-dark',
      label: subCheckLabel('暗色', appearance === 'dark'),
      onClick: () => setAppearance('dark' as Appearance),
    },
    {
      key: 'theme-system',
      label: subCheckLabel('跟随系统', appearance === 'system'),
      onClick: () => setAppearance('system' as Appearance),
    },
    {
      key: 'theme-illustration',
      label: subCheckLabel('插画风格', appearance === 'illustration'),
      onClick: () => setAppearance('illustration' as Appearance),
    },
    {
      key: 'theme-glass',
      label: subCheckLabel('玻璃风格', appearance === 'glass'),
      onClick: () => setAppearance('glass' as Appearance),
    },
  ]

  const fontChildren: MenuItem[] = [
    {
      key: 'font-system',
      label: subCheckLabel('系统默认', settings.chatFont === 'system'),
      onClick: () => updatePreference({ chatFont: 'system' }),
    },
    {
      key: 'font-serif',
      label: subCheckLabel('衬线字体', settings.chatFont === 'serif'),
      onClick: () => updatePreference({ chatFont: 'serif' }),
    },
    {
      key: 'font-mono',
      label: subCheckLabel('等宽字体', settings.chatFont === 'mono'),
      onClick: () => updatePreference({ chatFont: 'mono' }),
    },
  ]

  const fontSizeChildren: MenuItem[] = [
    {
      key: 'fontsize-small',
      label: subCheckLabel('小', settings.chatFontSize === 'small'),
      onClick: () => updatePreference({ chatFontSize: 'small' }),
    },
    {
      key: 'fontsize-medium',
      label: subCheckLabel('中', settings.chatFontSize === 'medium'),
      onClick: () => updatePreference({ chatFontSize: 'medium' }),
    },
    {
      key: 'fontsize-large',
      label: subCheckLabel('大', settings.chatFontSize === 'large'),
      onClick: () => updatePreference({ chatFontSize: 'large' }),
    },
  ]

  const chatWidthChildren: MenuItem[] = [
    {
      key: 'width-compact',
      label: subCheckLabel('紧凑', settings.chatWidth === 'compact'),
      onClick: () => updatePreference({ chatWidth: 'compact' }),
    },
    {
      key: 'width-default',
      label: subCheckLabel('默认', settings.chatWidth === 'default'),
      onClick: () => updatePreference({ chatWidth: 'default' }),
    },
    {
      key: 'width-wide',
      label: subCheckLabel('宽屏', settings.chatWidth === 'wide'),
      onClick: () => updatePreference({ chatWidth: 'wide' }),
    },
  ]

  const preferencesChildren: MenuItem[] = [
    {
      key: 'pref-language',
      icon: <Globe />,
      label: checkLabel('语言', false),
      children: languageChildren,
    },
    {
      key: 'pref-theme',
      icon: <PaintbrushVertical />,
      label: checkLabel('主题', false),
      children: themeChildren,
    },
    {
      key: 'pref-font',
      icon: <Palette />,
      label: checkLabel('字体设置', false),
      children: fontChildren,
    },
    {
      key: 'pref-fontsize',
      icon: <Type />,
      label: checkLabel('字号大小', false),
      children: fontSizeChildren,
    },
    {
      key: 'pref-chatwidth',
      icon: <Columns />,
      label: checkLabel('对话宽度', false),
      children: chatWidthChildren,
    },
  ]

  /* ══════════════ 主菜单 ══════════════ */

  const menuItems: MenuItem[] = [
    {
      key: 'settings',
      icon: <Settings />,
      label: '设置',
      onClick: handleSettings,
    },
    {
      key: 'preferences',
      icon: <Palette />,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>偏好设置</span>
          <ChevronRight style={{ fontSize: 10, opacity: 0.5 }} />
        </span>
      ),
      children: preferencesChildren,
    },
    {
      key: 'upgrade',
      icon: <Crown />,
      label: '升级订阅',
      onClick: () => message.info('订阅功能后续接入'),
    },
    {
      key: 'buy-resources',
      icon: <ShoppingCart />,
      label: '增购资源包',
      onClick: () => message.info('资源包功能后续接入'),
    },
    { type: 'divider' },
    {
      key: 'help',
      icon: <BookOpen />,
      label: '帮助文档',
      onClick: () => message.info('帮助文档后续接入'),
    },
    {
      key: 'changelog',
      icon: <FileText />,
      label: '更新日志',
      onClick: () => message.info('更新日志后续接入'),
    },
    {
      key: 'about',
      icon: <Info />,
      label: '关于 GeoWork',
      onClick: handleAbout,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogOut />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

  /* ══════════════ 套餐到期 mock 头部 ══════════════ */

  const subscriptionHeader = (
    <div className={styles.subscriptionHeader}>
      <Typography.Text strong style={{ fontSize: 13, display: 'block' }}>
        套餐到期
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        剩余 27 天到期
      </Typography.Text>
    </div>
  )

  /* ══════════════ Trigger ══════════════ */

  const trigger = (
    <div
      className={`${styles.userTrigger} ${collapsed ? styles.userTriggerCollapsed : ''}`}
      style={{
        borderRadius: token.borderRadius,
      }}
    >
      <Avatar size="small" icon={<User />} />
      {!collapsed && (
        <div className={styles.userInfo}>
          <Typography.Text ellipsis style={{ flex: 1, color: token.colorText, fontSize: 13, lineHeight: 1.3 }}>
            用户
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.2 }}>
            Local Preview
          </Typography.Text>
        </div>
      )}
    </div>
  )

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement={collapsed ? 'topRight' : 'topLeft'}
      popupRender={(menu) => (
        <div
          style={{
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            minWidth: 240,
          }}
        >
          {subscriptionHeader}
          <Divider style={{ margin: 0 }} />
          {menu}
        </div>
      )}
    >
      {collapsed ? (
        <Tooltip title="用户菜单" placement="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
    </Dropdown>
  )
}
