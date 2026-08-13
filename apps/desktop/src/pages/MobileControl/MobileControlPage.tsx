import { useEffect, useState } from 'react'
import { App, Divider, Typography, theme } from 'antd'
import {
  Smartphone,
  Globe,
  MessageCircle,
  Send,
  Building2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { MobileChannelCard } from './components/MobileChannelCard'
import type { MobileChannel, ChannelStatus } from './components/MobileChannelCard'
import { MobileBindModal } from './components/MobileBindModal'
import {
  loadStoredChannelStates,
  mergeStoredChannels,
  saveChannelStates,
} from './mobileControlStorage'
import styles from './MobileControlPage.module.css'

const { Title, Text, Paragraph } = Typography

/* ── 渠道初始数据 ── */
interface ChannelData {
  key: string
  name: string
  description: string
  icon: ReactNode
  status: ChannelStatus
  errorMessage?: string
  enabled?: boolean
}

const INITIAL_CHANNELS: ChannelData[] = [
  {
    key: 'geowork-mobile',
    name: 'GeoWork Mobile',
    description: '通过 GeoWork 移动端查看任务、地图预览和执行提醒',
    icon: <Smartphone />,
    status: 'unconfigured',
  },
  {
    key: 'mobile-browser',
    name: '手机浏览器',
    description: '通过移动浏览器打开本地控制入口，查看任务状态与工作目录',
    icon: <Globe />,
    status: 'unconfigured',
  },
  {
    key: 'wechat',
    name: '微信',
    description: '通过微信消息接收任务提醒和快速操作链接',
    icon: <MessageCircle />,
    status: 'unconfigured',
  },
  {
    key: 'dingtalk',
    name: '钉钉',
    description: '通过钉钉机器人接收并回复 GeoWork 任务消息',
    icon: <MessageCircle />,
    status: 'unconfigured',
  },
  {
    key: 'feishu',
    name: '飞书',
    description: '通过飞书机器人接收执行提醒与任务摘要',
    icon: <Send />,
    status: 'unconfigured',
  },
  {
    key: 'wechat-work',
    name: '企业微信',
    description: '通过企业微信应用接收团队任务通知',
    icon: <Building2 />,
    status: 'unconfigured',
  },
]

/* ── Hero SVG 占位 ── */
function HeroSvg() {
  const { token } = theme.useToken()

  return (
    <svg
      className={styles.heroSvg}
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 手机轮廓 */}
      <rect
        x="40" y="6" width="40" height="68" rx="6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        style={{ color: token.colorTextSecondary }}
      />
      {/* 屏幕 */}
      <rect
        x="44" y="14" width="32" height="48" rx="2"
        fill={token.colorFillQuaternary}
      />
      {/* Home 圆点 */}
      <circle
        cx="60" cy="68" r="2.5"
        fill="currentColor"
        style={{ color: token.colorTextQuaternary }}
      />
      {/* 地图定位点 */}
      <path
        d="M20 30 C20 22, 28 16, 28 24 C28 32, 20 38, 20 30Z"
        fill={token.colorPrimary}
        opacity={0.7}
      />
      <circle cx="24" cy="24" r="2.5" fill={token.colorBgContainer} />
      {/* 消息气泡 */}
      <rect
        x="86" y="20" width="24" height="16" rx="4"
        fill={token.colorSuccessBg}
        stroke={token.colorSuccessBorder}
        strokeWidth="1"
      />
      <circle cx="93" cy="28" r="1.5" fill={token.colorSuccessText} />
      <circle cx="98" cy="28" r="1.5" fill={token.colorSuccessText} />
      <circle cx="103" cy="28" r="1.5" fill={token.colorSuccessText} />
      {/* 闪电标记 */}
      <path
        d="M14 52 L18 44 L16 44 L20 36 L14 46 L16 46 Z"
        fill={token.colorWarning}
        opacity={0.8}
      />
      {/* 小圆点装饰 */}
      <circle cx="100" cy="52" r="3" fill={token.colorPrimary} opacity={0.3} />
      <circle cx="108" cy="44" r="2" fill={token.colorPrimary} opacity={0.2} />
    </svg>
  )
}

/* ── 页面组件 ── */
export function MobileControlPage() {
  const { message } = App.useApp()

  const [channels, setChannels] = useState<MobileChannel[]>(() =>
    mergeStoredChannels(INITIAL_CHANNELS, loadStoredChannelStates()),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [activeChannel, setActiveChannel] = useState<MobileChannel | null>(null)

  /* channels 变化后自动持久化到 localStorage */
  useEffect(() => {
    saveChannelStates(channels)
  }, [channels])

  /* 打开配置 Modal */
  const handleConfig = (channel: MobileChannel) => {
    setActiveChannel(channel)
    setModalOpen(true)
  }

  /* 重新绑定 = 也打开 Modal */
  const handleRebind = (channel: MobileChannel) => {
    setActiveChannel(channel)
    setModalOpen(true)
  }

  /* Switch 切换 */
  const handleToggle = (key: string, enabled: boolean) => {
    setChannels((prev) =>
      prev.map((c) => (c.key === key ? { ...c, enabled } : c)),
    )
    message.info(enabled ? '移动端通道启用占位' : '移动端通道已关闭')
  }

  /* 完成绑定 → 状态改为已连接 */
  const handleDone = (channelKey: string) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.key === channelKey
          ? { ...c, status: 'connected' as ChannelStatus, enabled: true, errorMessage: undefined }
          : c,
      ),
    )
    message.success('移动端控制已绑定')
  }

  /* 断开连接 → 状态重置为未配置 */
  const handleDisconnect = (key: string) => {
    setChannels((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, status: 'unconfigured' as ChannelStatus, enabled: false, errorMessage: undefined }
          : c,
      ),
    )
    message.success('已断开移动端控制连接')
  }

  return (
    <div className={styles.root}>
      {/* Hero */}
      <div className={styles.hero}>
        <HeroSvg />
        <Title level={3} className={styles.heroTitle}>
          移动端控制
        </Title>
        <Paragraph className={styles.heroSubtitle} type="secondary">
          连接手机、企业通讯工具或移动浏览器，在移动端查看 GeoWork 任务状态、触发常用流程并接收执行提醒。
        </Paragraph>
        <Text className={styles.heroNote} type="secondary">
          移动端绑定信息仅保存在本地浏览器中，后续将接入真实设备授权与消息通道。
        </Text>
      </div>

      <Divider className={styles.divider} />

      {/* 渠道列表 */}
      <div className={styles.channelList}>
        {channels.map((channel) => (
          <MobileChannelCard
            key={channel.key}
            channel={channel}
            onConfig={handleConfig}
            onToggle={handleToggle}
            onRebind={handleRebind}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>

      {/* 配置 Modal */}
      <MobileBindModal
        open={modalOpen}
        channel={activeChannel}
        onClose={() => setModalOpen(false)}
        onDone={handleDone}
      />
    </div>
  )
}