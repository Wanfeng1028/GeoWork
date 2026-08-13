import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Divider,
  Empty,
  InputNumber,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  CompassOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { useAppearanceStore } from '../../shared/stores/appearanceStore'
import type { Appearance } from '../../shared/stores/appearanceStore'
import { SettingsSidebar, type SettingsSectionKey } from './components/SettingsSidebar'
import { SettingsSection, SettingsCard } from './components/SettingsSection'
import { SettingRow } from './components/SettingRow'
import { UpdateModal, UpdateFloatWidget } from './components/UpdateModal'
import { WorkspaceTemplateCard } from './components/WorkspaceTemplateCard'
import { ProviderSettingsPanel } from './components/ProviderSettingsPanel'
import { GitWorktreeSettings } from './components/GitWorktreeSettings'
import { loadSettings, saveSettings, type GeoWorkSettings } from './settingsStorage'
import {
  MOCK_ARCHIVED_TASKS,
  MOCK_WORKSPACE_TEMPLATES,
  MOCK_SHORTCUTS,
  type ArchivedTask,
} from './settingsMockData'
import styles from './SettingsPage.module.css'

const { Title, Text } = Typography

/* ── 常量 ── */

const APPEARANCE_OPTIONS = [
  { value: 'system', label: '跟随系统' },
  { value: 'editorial', label: '亮色' },
  { value: 'editorial-dark', label: '暗色' },
]

const AVATAR_COLORS = ['#2F80ED', '#52C41A', '#FA8C16', '#F5222D', '#722ED1', '#13C2C2']
const EMOJI_OPTIONS = ['🌍', '🗺️', '🛰️', '📊', '🏔️', '🌊', '🌿', '🔬']

/* 设置分区合法 key（用于 URL 直达 /settings?section=xxx 校验） */
const VALID_SECTIONS: SettingsSectionKey[] = [
  'preferences',
  'profile',
  'system',
  'providers',
  'git-worktree',
  'voice',
  'shortcuts',
  'memory',
  'update',
  'archived',
  'workspace',
  'safe-workspace',
  'experimental',
  'guide',
  'about',
]

/* ══════════════ 主页面 ══════════════ */

export function SettingsPage() {
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()
  const navigate = useNavigate()

  /* ── 设置状态 ── */
  const [settings, setSettings] = useState<GeoWorkSettings>(loadSettings)
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('section')
    return fromUrl && (VALID_SECTIONS as string[]).includes(fromUrl)
      ? (fromUrl as SettingsSectionKey)
      : 'preferences'
  })

  /* ── 主题 store ── */
  const { appearance, setAppearance } = useAppearanceStore()

  /* ── 更新进度（顶层状态） ── */
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateMinimized, setUpdateMinimized] = useState(false)
  const [updateActive, setUpdateActive] = useState(false)
  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── 归档任务 ── */
  const [archivedTasks, setArchivedTasks] = useState<ArchivedTask[]>([...MOCK_ARCHIVED_TASKS])

  /* ── 快捷键选中 ── */
  const [selectedShortcut, setSelectedShortcut] = useState(MOCK_SHORTCUTS[0].id)

  /* ── 个人资料 ── */
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [avatarEmoji, setAvatarEmoji] = useState('🌍')

  /* ── 清理 interval ── */
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) clearInterval(updateTimerRef.current)
    }
  }, [])

  /* ── 分区 ↔ URL 同步（支持 /settings?section=xxx 直达） ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (activeSection === 'preferences') {
      params.delete('section')
    } else {
      params.set('section', activeSection)
    }
    const next = params.toString()
    navigate(next ? `/settings?${next}` : '/settings', { replace: true })
  }, [activeSection, navigate])

  /* ── 更新设置 ── */
  const updateSetting = useCallback(<K extends keyof GeoWorkSettings>(
    key: K,
    value: GeoWorkSettings[K],
    toast?: string,
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      saveSettings(next)
      return next
    })
    if (toast) message.success(toast)
  }, [message])

  /* ── 首次进入引导分区时标记已访问，隐藏侧栏角标 ── */
  useEffect(() => {
    if (activeSection === 'guide' && !settings.guideVisited) {
      updateSetting('guideVisited', true)
    }
  }, [activeSection, settings.guideVisited, updateSetting])

  /* ── 检查更新 ── */
  const handleCheckUpdate = () => {
    setUpdateProgress(0)
    setUpdateModalOpen(true)
    setUpdateMinimized(false)
    setUpdateActive(true)

    if (updateTimerRef.current) clearInterval(updateTimerRef.current)
    updateTimerRef.current = setInterval(() => {
      setUpdateProgress((prev) => {
        if (prev >= 100) {
          if (updateTimerRef.current) clearInterval(updateTimerRef.current)
          updateTimerRef.current = null
          setUpdateActive(false)
          message.success('更新下载完成，安装流程后续接入')
          return 100
        }
        return prev + 2
      })
    }, 200)
  }

  /* ── 最小化更新 ── */
  const handleMinimizeUpdate = () => {
    setUpdateModalOpen(false)
    setUpdateMinimized(true)
  }

  /* ── 返回应用 ── */
  const handleBack = () => navigate('/new-task')

  /* ── 开始引导：跳转到新任务页并打开工作流引导 Tour ── */
  const handleStartGuide = () => {
    if (!settings.guideVisited) updateSetting('guideVisited', true)
    navigate('/new-task?guide=1')
  }

  /* ══════════════ 分区渲染 ══════════════ */

  const renderPreferences = () => (
    <SettingsSection title="偏好设置" subtitle="语言、主题、字体与面板布局等个性化偏好。">
      <SettingsCard title="基础偏好">
        <SettingRow
          title="语言"
          description="选择界面语言"
          extra={
            <Select
              value={settings.language}
              onChange={(v) => updateSetting('language', v)}
              options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="主题外观"
          description="浅色、深色或跟随系统"
          extra={
            <Select
              value={appearance}
              onChange={(v) => { setAppearance(v as Appearance); message.success('主题已切换') }}
              options={APPEARANCE_OPTIONS}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="界面风格"
          description="默认、紧凑、宽松三种布局密度"
          extra={
            <Select
              value={settings.interfaceStyle}
              onChange={(v) => updateSetting('interfaceStyle', v)}
              options={[
                { value: 'default', label: '默认' },
                { value: 'compact', label: '紧凑' },
                { value: 'spacious', label: '宽松' },
              ]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="动效效果"
          description="开启后界面会使用更柔和的过渡效果"
          extra={
            <Switch
              checked={settings.meteorEffect}
              onChange={(v) => updateSetting('meteorEffect', v, v ? '动效已开启' : '动效已关闭')}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="对话字体"
          description="对话内容使用的字体风格"
          extra={
            <Select
              value={settings.chatFont}
              onChange={(v) => updateSetting('chatFont', v)}
              options={[
                { value: 'system', label: '系统默认' },
                { value: 'serif', label: '衬线字体' },
                { value: 'mono', label: '等宽字体' },
              ]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="对话字号"
          description="调整对话中的文字大小"
          extra={
            <Select
              value={settings.chatFontSize}
              onChange={(v) => updateSetting('chatFontSize', v)}
              options={[
                { value: 'small', label: '小' },
                { value: 'medium', label: '中' },
                { value: 'large', label: '大' },
              ]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="对话宽度"
          description="调整对话区与输入框的最大宽度"
          extra={
            <Select
              value={settings.chatWidth}
              onChange={(v) => updateSetting('chatWidth', v)}
              options={[
                { value: 'compact', label: '紧凑' },
                { value: 'default', label: '默认' },
                { value: 'wide', label: '宽屏' },
              ]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
      </SettingsCard>

      <SettingsCard title="对话行为">
        <SettingRow
          title="预览方式"
          description="如何预览生成的文件、图片、Markdown"
          extra={
            <Select
              value={settings.previewMode}
              onChange={(v) => updateSetting('previewMode', v)}
              options={[
                { value: 'new-window', label: '新窗口' },
                { value: 'inline', label: '当前面板' },
              ]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="提示词建议"
          description="开启后，GeoWork 会根据当前任务给出下一步建议"
          extra={
            <Switch
              checked={settings.autoSuggest}
              onChange={(v) => updateSetting('autoSuggest', v)}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="默认展开工具调用"
          description="对话中的工具调用默认展开"
          extra={
            <Switch
              checked={settings.autoExpandTools}
              onChange={(v) => updateSetting('autoExpandTools', v)}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="在对话中隐藏工具调用细节"
          description="开启后，只展示简要结果，不展示完整工具日志"
          extra={
            <Switch
              checked={settings.hideToolDetailsInConversation}
              onChange={(v) => updateSetting('hideToolDetailsInConversation', v)}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="工具执行上限"
          description="限制单次任务中工具调用次数，防止误操作"
          extra={
            <Space size={8}>
              <Switch
                checked={settings.toolExecutionLimitEnabled}
                onChange={(v) => updateSetting('toolExecutionLimitEnabled', v)}
                size="small"
              />
              {settings.toolExecutionLimitEnabled && (
                <InputNumber
                  value={settings.toolExecutionLimit}
                  onChange={(v) => updateSetting('toolExecutionLimit', v ?? 100)}
                  min={1}
                  max={1000}
                  size="small"
                  style={{ width: 80 }}
                />
              )}
            </Space>
          }
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderProfile = () => (
    <SettingsSection title="个人资料" subtitle="头像、账号与订阅信息。">
      <SettingsCard>
        <div className={styles.profileHeader}>
          <Avatar size={56} style={{ background: avatarColor, fontSize: 24 }}>
            {avatarEmoji}
          </Avatar>
          <div className={styles.profileInfo}>
            <Text strong style={{ fontSize: 16 }}>GeoWork 用户</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>本地账号</Text>
            <Tag style={{ marginTop: 4 }}>Free</Tag>
          </div>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        <SettingRow title="头像背景色" description="选择头像背景颜色" />
        <div className={styles.avatarColors}>
          {AVATAR_COLORS.map((c) => (
            <div
              key={c}
              className={styles.avatarColorDot}
              style={{
                background: c,
                borderColor: avatarColor === c ? token.colorPrimary : 'transparent',
              }}
              onClick={() => setAvatarColor(c)}
            />
          ))}
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <SettingRow title="Emoji 头像" description="选择一个表情作为头像" />
        <div className={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((e) => (
            <div
              key={e}
              className={styles.emojiItem}
              style={{
                background: avatarEmoji === e ? token.colorPrimaryBg : 'transparent',
                border: avatarEmoji === e ? `1px solid ${token.colorPrimaryBorder}` : '1px solid transparent',
              }}
              onClick={() => setAvatarEmoji(e)}
            >
              {e}
            </div>
          ))}
        </div>

        <Divider />

        <SettingRow
          title="账号 UID"
          description="GW-LOCAL-000001"
          extra={
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText('GW-LOCAL-000001')
                message.success('已复制账号 UID')
              }}
            >
              复制
            </Button>
          }
        />

        <Divider style={{ margin: '4px 0' }} />

        <SettingRow
          title="订阅"
          description="当前方案：本地预览版"
          extra={
            <Button size="small" onClick={() => message.info('订阅功能后续接入')}>
              查看方案与定价
            </Button>
          }
        />

        <Divider />

        <SettingRow
          title="退出登录"
          description="退出当前 GeoWork 账号"
          extra={
            <Button
              danger
              size="small"
              onClick={() => {
                modal.confirm({
                  title: '确认退出登录？',
                  content: '退出后需要重新登录。',
                  onOk: () => message.info('当前为本地预览账号，暂不需要退出'),
                })
              }}
            >
              退出登录
            </Button>
          }
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderSystem = () => (
    <SettingsSection title="系统设置" subtitle="开机启动、保持唤醒、通知和系统行为选项。">
      <SettingsCard title="系统行为">
        <SettingRow
          title="开机自动启动"
          description="登录电脑时自动启动 GeoWork"
          extra={<Switch checked={settings.autoStart} onChange={(v) => updateSetting('autoStart', v, v ? '已开启开机启动' : '已关闭开机启动')} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="保持系统唤醒"
          description="防止电脑在 Agent 工作时进入睡眠"
          extra={<Switch checked={settings.keepAwake} onChange={(v) => updateSetting('keepAwake', v)} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="桌面通知"
          description="任务完成、失败或需要确认时提醒你"
          extra={<Switch checked={settings.desktopNotification} onChange={(v) => updateSetting('desktopNotification', v)} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="声音通知"
          description="重要事件播放提示音"
          extra={<Switch checked={settings.soundNotification} onChange={(v) => updateSetting('soundNotification', v)} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="关闭窗口行为"
          description="点击关闭按钮时的默认操作"
          extra={
            <Select
              value={settings.closeWindowBehavior}
              onChange={(v) => updateSetting('closeWindowBehavior', v)}
              options={[
                { value: 'minimize', label: '最小化到托盘' },
                { value: 'exit', label: '直接退出' },
                { value: 'ask', label: '每次询问' },
              ]}
              style={{ width: 140 }}
              size="small"
            />
          }
        />
      </SettingsCard>

      <SettingsCard title="网络">
        <SettingRow
          title="网络代理"
          description="配置应用的网络代理方式"
          extra={
            <Select
              value={settings.networkProxy}
              onChange={(v) => updateSetting('networkProxy', v)}
              options={[
                { value: 'system', label: '跟随系统' },
                { value: 'none', label: '不使用代理' },
                { value: 'manual', label: '手动配置' },
              ]}
              style={{ width: 120 }}
              size="small"
            />
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="网络诊断"
          description="检测 GeoWork 服务连接状态"
          extra={<Button size="small" onClick={() => message.info('网络诊断功能后续接入')}>运行诊断</Button>}
        />
      </SettingsCard>

      <SettingsCard title="数据共享">
        <SettingRow
          title="数据共享"
          description="你的提示词、上下文和使用数据将用于产品改进时，需要你的授权"
          extra={
            <Select
              defaultValue="shared"
              options={[
                { value: 'shared', label: '共享改进模式' },
                { value: 'local', label: '仅本地模式' },
                { value: 'ask', label: '每次询问' },
              ]}
              style={{ width: 140 }}
              size="small"
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderVoice = () => (
    <SettingsSection title="语音输入" subtitle="全局语音输入快捷键与转录设置。">
      <SettingsCard>
        <SettingRow
          title="启用语音输入"
          description="启用全局语音输入快捷键"
          extra={<Switch checked={settings.voiceInput} onChange={(v) => updateSetting('voiceInput', v, v ? '语音输入已开启' : '语音输入已关闭')} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="降噪识别"
          description="开启后会优先保留你的声音，降低周围噪声干扰"
          extra={<Switch checked={settings.noiseReduction} onChange={(v) => updateSetting('noiseReduction', v)} size="small" />}
        />
        <Divider />
        <Alert
          type="info"
          showIcon
          title="当前为前端设置占位，后续将接入真实语音输入、权限申请和转录服务。"
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderShortcuts = () => {
    const groups = ['通用', '任务', '会话']
    const currentShortcut = MOCK_SHORTCUTS.find((s) => s.id === selectedShortcut) ?? MOCK_SHORTCUTS[0]

    return (
      <SettingsSection title="快捷键" subtitle="自定义通用、任务与会话操作的快捷键。">
        <SettingsCard>
          <div className={styles.shortcutsLayout}>
            <div className={styles.shortcutsList}>
              {groups.map((group) => (
                <div key={group} className={styles.shortcutGroup}>
                  <Text type="secondary" strong style={{ fontSize: 12, padding: '4px 8px', display: 'block' }}>
                    {group}
                  </Text>
                  {MOCK_SHORTCUTS.filter((s) => s.group === group).map((sc) => {
                    const isActive = selectedShortcut === sc.id
                    return (
                      <div
                        key={sc.id}
                        className={styles.shortcutItem}
                        style={{
                          background: isActive ? token.colorPrimaryBg : 'transparent',
                        }}
                        onClick={() => setSelectedShortcut(sc.id)}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = token.colorFillSecondary
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <Text style={{ fontSize: 13 }}>{sc.title}</Text>
                        <div className={styles.shortcutKeys}>
                          {sc.keys.split(' + ').map((k) => (
                            <span
                              key={k}
                              className={styles.keycap}
                              style={{
                                background: token.colorFillQuaternary,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary,
                              }}
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className={styles.shortcutsPreview}>
              <Card
                size="small"
                style={{
                  borderColor: token.colorBorderSecondary,
                  borderRadius: 10,
                }}
              >
                <div className={styles.previewContent}>
                  <Text strong>{currentShortcut.title}</Text>
                  <div className={styles.previewKeys}>
                    {currentShortcut.keys.split(' + ').map((k) => (
                      <span
                        key={k}
                        className={styles.previewKeycap}
                        style={{
                          background: token.colorFillQuaternary,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          color: token.colorText,
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
                    {currentShortcut.description}
                  </Text>
                </div>
              </Card>
            </div>
          </div>

          <Divider />

          <SettingRow
            title="启用 QuickPick"
            description="启用全局快速任务入口，无需切换到主窗口即可随时提交任务"
            extra={<Switch defaultChecked={false} size="small" />}
          />
        </SettingsCard>
      </SettingsSection>
    )
  }

  const renderMemory = () => (
    <SettingsSection title="记忆与上下文" subtitle="管理 GeoWork 如何保存项目上下文、任务习惯和工作偏好。">
      <SettingsCard title="记忆模式">
        <SettingRow
          title="记忆模式"
          description="启用后，GeoWork 会保存常用工作区、工具偏好和任务习惯"
          extra={<Switch checked={settings.memoryEnabled} onChange={(v) => updateSetting('memoryEnabled', v, v ? '记忆模式已开启' : '记忆模式已关闭')} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="自动记录"
          description="自动记录项目上下文和常用流程，方便下次继续工作"
          extra={<Switch checked={settings.autoMemory} onChange={(v) => updateSetting('autoMemory', v)} size="small" />}
        />
      </SettingsCard>

      <SettingsCard title="进化动态">
        <div className={styles.memoryProgress}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13 }}>记录条数</Text>
            <Tag>14 条</Tag>
          </div>
          <Progress percent={70} showInfo={false} size="small" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13 }}>最近更新时间</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>今天</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13 }}>本地索引</Text>
            <Tag color="success">已建立</Tag>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="记忆信息">
        <SettingRow
          title="存储位置"
          description="所有记忆文件的根目录：.geowork/memory"
          extra={<Button size="small" icon={<FolderOpenOutlined />} onClick={() => message.info('打开文件夹功能后续接入')}>打开所在文件夹</Button>}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="协作风格" description="GeoWork 的沟通和执行方式，可通过个性化选择改变" extra={<Button size="small" type="text">查看</Button>} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="工作手册" description="GeoWork 的工作规范和行为准则" extra={<Button size="small" type="text">查看</Button>} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="用户画像" description="记录你的基本信息、偏好和习惯，由 GeoWork 自动维护" extra={<Button size="small" type="text">查看</Button>} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="长期记忆" description="跨会话保存的重要项目和结论" extra={<Button size="small" type="text">查看</Button>} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="短期记忆" description="本次对话中的上下文摘要" extra={<Button size="small" type="text">查看</Button>} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="索引" description="为本地文档建立检索索引" extra={<Button size="small" icon={<SearchOutlined />}>重建搜索索引</Button>} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="备份与恢复"
          description="导出或导入记忆数据"
          extra={
            <Space size={4}>
              <Button size="small" icon={<ExportOutlined />}>导出</Button>
              <Button size="small" icon={<ImportOutlined />}>导入</Button>
            </Space>
          }
        />
      </SettingsCard>

      <SettingsCard title="危险操作">
        <SettingRow
          title="重置协作风格"
          description="恢复协作风格到默认设置"
          extra={
            <Button
              danger
              size="small"
              onClick={() => modal.confirm({
                title: '确认重置协作风格？',
                content: '此操作不可撤销。',
                onOk: () => message.success('协作风格已重置'),
              })}
            >
              重置协作风格
            </Button>
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="重置工作手册"
          description="恢复工作手册到默认设置"
          extra={
            <Button
              danger
              size="small"
              onClick={() => modal.confirm({
                title: '确认重置工作手册？',
                content: '此操作不可撤销。',
                onOk: () => message.success('工作手册已重置'),
              })}
            >
              重置工作手册
            </Button>
          }
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="清空记忆"
          description="删除所有记忆数据，此操作不可撤销"
          extra={
            <Button
              danger
              size="small"
              onClick={() => modal.confirm({
                title: '确认清空所有记忆？',
                content: '此操作不可撤销，所有记忆数据将被永久删除。',
                okButtonProps: { danger: true },
                onOk: () => message.success('记忆已清空'),
              })}
            >
              清空记忆
            </Button>
          }
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderUpdate = () => (
    <SettingsSection title="更新应用" subtitle="检查并获取 GeoWork 新版本，与菜单栏中的检查更新一致。">
      <SettingsCard title="当前版本">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Text strong style={{ fontSize: 20 }}>0.6.6</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              有新版本时会自动提示下载与安装；当前为前端模拟更新流程。
            </Text>
          </div>
          <Button type="primary" onClick={handleCheckUpdate}>
            检查更新
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  )

  const renderArchived = () => (
    <SettingsSection title="已归档" subtitle="在此管理已归档任务。">
      <SettingsCard>
        <div className={styles.archivedHeader}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            共 {archivedTasks.length} 条归档任务
          </Text>
          <Button
            danger
            size="small"
            disabled={archivedTasks.length === 0}
            onClick={() => modal.confirm({
              title: '确认全部删除？',
              content: '删除后无法恢复。',
              okButtonProps: { danger: true },
              onOk: () => { setArchivedTasks([]); message.success('已清空归档') },
            })}
          >
            全部删除
          </Button>
        </div>

        {archivedTasks.length === 0 ? (
          <Empty description="暂无归档任务" />
        ) : (
          archivedTasks.map((task) => (
            <div key={task.id} className={styles.archivedItem}>
              <div className={styles.archivedItemInfo}>
                <Text style={{ fontSize: 13 }}>{task.title}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{task.archivedAt}</Text>
              </div>
              <div className={styles.archivedItemActions}>
                <Button
                  type="text"
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    setArchivedTasks((prev) => prev.filter((t) => t.id !== task.id))
                    message.success('任务已恢复到任务列表')
                  }}
                >
                  恢复
                </Button>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => modal.confirm({
                    title: '确认删除此归档？',
                    content: task.title,
                    onOk: () => {
                      setArchivedTasks((prev) => prev.filter((t) => t.id !== task.id))
                      message.success('已删除')
                    },
                  })}
                >
                  删除
                </Button>
              </div>
            </div>
          ))
        )}
      </SettingsCard>
    </SettingsSection>
  )

  const renderWorkspace = () => (
    <SettingsSection title="工作台" subtitle="配置工作模式与 GeoWork 创作模板。">
      <SettingsCard title="工作模式">
        <SettingRow title="通用" description="与 AI 助手对话" extra={<Switch defaultChecked size="small" />} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="空间分析" description="使用 GIS 工具进行空间分析" extra={<Switch defaultChecked={false} size="small" />} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="遥感解译" description="使用遥感模型进行影像解译" extra={<Switch defaultChecked={false} size="small" />} />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow title="专题制图" description="生成地图说明、图例和制图方案" extra={<Switch defaultChecked={false} size="small" />} />
      </SettingsCard>

      <SettingsCard title="工作台模板">
        <div className={styles.templateHeader}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            共 {MOCK_WORKSPACE_TEMPLATES.length} 个模板
          </Text>
          <Button size="small" icon={<ImportOutlined />} onClick={() => message.info('导入工作台模板功能后续接入')}>
            导入
          </Button>
        </div>
        <div className={styles.templateGrid}>
          {MOCK_WORKSPACE_TEMPLATES.map((tpl) => (
            <WorkspaceTemplateCard key={tpl.id} template={tpl} />
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  )

  const renderSafeWorkspace = () => (
    <SettingsSection title="安全工作环境" subtitle="在沙盒环境中执行任务，保护工作目录与系统文件。">
      <SettingsCard>
        <SettingRow
          title="启用安全工作环境"
          description="任务会在隔离的工作环境中运行，不影响原始文件"
          extra={<Switch checked={settings.safeWorkspace} onChange={(v) => updateSetting('safeWorkspace', v, v ? '安全工作环境已开启' : '安全工作环境已关闭')} size="small" />}
        />
        <Divider />
        <SettingRow
          title="清理工作环境文件"
          description="清理缓存、临时文件和过期的工作目录，释放磁盘空间"
          extra={
            <Button
              danger
              size="small"
              onClick={() => modal.confirm({
                title: '确认清理工作环境文件？',
                content: '将清理缓存、临时文件和过期的工作目录。',
                onOk: () => message.success('已清理前端模拟工作环境文件'),
              })}
            >
              清理文件
            </Button>
          }
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderExperimental = () => (
    <SettingsSection title="实验特性" subtitle="抢先体验新功能，部分功能仍在打磨中。">
      <SettingsCard>
        <SettingRow
          title="生成式 UI"
          description="允许 AI 在聊天中生成交互式 HTML 组件、图表、仪表盘或表单"
          extra={<Switch checked={settings.generativeUi} onChange={(v) => updateSetting('generativeUi', v, v ? '生成式 UI 已开启' : '生成式 UI 已关闭')} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="弹出式工作台"
          description="将任务弹出为独立窗口运行"
          extra={<Switch checked={settings.floatingWorkspace} onChange={(v) => updateSetting('floatingWorkspace', v)} size="small" />}
        />
        <Divider style={{ margin: '4px 0' }} />
        <SettingRow
          title="浏览器上下文能力"
          description="在聊天输入框中选择已打开的浏览器标签页，让 AI 基于当前网页继续工作"
          extra={<Switch checked={settings.browserContext} onChange={(v) => updateSetting('browserContext', v)} size="small" />}
        />
        <Divider />
        <SettingRow
          title="修复历史消息显示"
          description="如果历史对话显示异常，可尝试修复显示问题"
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => message.info('历史消息检测功能后续接入')}>重新检测</Button>}
        />
      </SettingsCard>
    </SettingsSection>
  )

  const renderProviders = () => <ProviderSettingsPanel />

  const renderGitWorktree = () => <GitWorktreeSettings />

  const renderGuide = () => (
    <SettingsSection title="引导" subtitle="空间分析工作流引导，帮助你快速上手 GeoWork。">
      <SettingsCard>
        <div className={styles.guideBody}>
          <Space size={8}>
            <ExperimentOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>空间分析工作流</Text>
          </Space>

          <Title level={5} style={{ margin: 0, color: token.colorText }}>
            从一个空间问题开始
          </Title>

          <Text type="secondary" style={{ fontSize: 13 }}>
            导入数据、选择工具、运行分析并导出报告。GeoWork 会把每一步记录为可追溯的工作流。
          </Text>

          <div className={styles.guideTags}>
            <Tag color={token.colorPrimary}>Beta</Tag>
            <Tag color="geekblue">
              <CompassOutlined /> GIS Workflow
            </Tag>
          </div>

          <div className={styles.guideActions}>
            <Button type="primary" onClick={handleStartGuide}>
              开始引导
            </Button>
            <Button icon={<ShareAltOutlined />} onClick={() => message.info('分享流程功能后续接入')}>
              分享流程
            </Button>
            <Button icon={<EditOutlined />} onClick={() => message.info('编辑模板功能后续接入')}>
              编辑模板
            </Button>
          </div>
        </div>
      </SettingsCard>
    </SettingsSection>
  )

  const renderAbout = () => {
    return null
  }

  /* ── 分区路由 ── */
  const sectionMap: Record<SettingsSectionKey, () => React.ReactNode> = {
    preferences: renderPreferences,
    profile: renderProfile,
    system: renderSystem,
    providers: renderProviders,
    'git-worktree': renderGitWorktree,
    voice: renderVoice,
    shortcuts: renderShortcuts,
    memory: renderMemory,
    update: renderUpdate,
    archived: renderArchived,
    workspace: renderWorkspace,
    'safe-workspace': renderSafeWorkspace,
    experimental: renderExperimental,
    guide: renderGuide,
    about: renderAbout,
  }

  return (
    <div className={styles.page}>
      <SettingsSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBack={handleBack}
        showGuideBadge={!settings.guideVisited}
      />

      <div className={styles.content}>
        <div className={styles.contentInner}>
          {sectionMap[activeSection]?.()}
        </div>
      </div>

      {/* ── 更新 Modal ── */}
      <UpdateModal
        open={updateModalOpen}
        progress={updateProgress}
        onMinimize={handleMinimizeUpdate}
      />

      {/* ── 左下角更新浮窗 ── */}
      {updateMinimized && updateActive && (
        <UpdateFloatWidget
          progress={updateProgress}
          onViewProgress={() => { setUpdateModalOpen(true); setUpdateMinimized(false) }}
        />
      )}
    </div>
  )
}
