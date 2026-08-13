import { useState } from 'react'
import { Modal, Progress, Typography, theme } from 'antd'
import {
  Link,
  RotateCw,
  FolderKanban,
  MessageSquare,
  User,
  Crown,
  Gift,
} from 'lucide-react'
import { useLocation } from 'react-router'
import { CapsuleTabs } from './components/CapsuleTabs'
import styles from './UsageModal.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

type ModelType = 'platform' | 'custom'

interface UsageData {
  used: number
  total: number
  inputTokens: number
  outputTokens: number
  refreshDate?: string
}

/* ── Mock 数据 ── */
const mockProjectUsage: UsageData = {
  used: 12_450,
  total: 100_000,
  inputTokens: 8_200,
  outputTokens: 4_250,
}

const mockConversationUsage: UsageData = {
  used: 3_280,
  total: 50_000,
  inputTokens: 2_100,
  outputTokens: 1_180,
}

const mockTotalUsage: UsageData = {
  used: 585_000,
  total: 2_000_000,
  inputTokens: 380_000,
  outputTokens: 205_000,
}

const mockPlanUsage: UsageData = {
  used: 585,
  total: 2_000,
  inputTokens: 0,
  outputTokens: 0,
  refreshDate: '2026年7月3日',
}

const mockExtraUsage: UsageData = {
  used: 0,
  total: 4_600,
  inputTokens: 0,
  outputTokens: 0,
}

function formatNum(n: number) {
  return n.toLocaleString('zh-CN')
}

function pct(used: number, total: number) {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

/* ── 单个用量区块 ── */
function UsageCard({
  icon,
  title,
  data,
  showTokens,
  colorPrimary,
  colorBorder,
}: {
  icon: React.ReactNode
  title: string
  data: UsageData
  showTokens: boolean
  colorPrimary: string
  colorBorder: string
}) {
  const percent = pct(data.used, data.total)
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          {icon}
          {title}
        </span>
        {data.refreshDate && (
          <span className={styles.refresh}>
            <RotateCw /> 将于 {data.refreshDate} 刷新
          </span>
        )}
      </div>
      <Progress
        percent={percent}
        showInfo={false}
        strokeColor={colorPrimary}
        railColor={colorBorder}
        size="small"
      />
      <div className={styles.cardStats}>
        <span>
          {formatNum(data.used)} / {formatNum(data.total)}（已使用 {percent}%）
        </span>
        <span>剩余 {formatNum(data.total - data.used)}</span>
      </div>
      {showTokens && (
        <div className={styles.tokenBreakdown}>
          <span>输入 Tokens：{formatNum(data.inputTokens)}</span>
          <span>输出 Tokens：{formatNum(data.outputTokens)}</span>
        </div>
      )}
    </div>
  )
}

export function UsageModal({ open, onClose }: Props) {
  const { token } = theme.useToken()
  const location = useLocation()
  const [modelType, setModelType] = useState<ModelType>('platform')

  /* 自动判断：当前是否在项目中 */
  const inProject =
    location.pathname !== '/' && location.pathname !== '/settings'
  const contextLabel = inProject ? '当前项目用量' : '当前对话用量'
  const contextIcon = inProject ? (
    <FolderKanban />
  ) : (
    <MessageSquare />
  )
  const contextData = inProject ? mockProjectUsage : mockConversationUsage

  return (
    <Modal
      title="我的用量"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      <div className={styles.switcher}>
        <CapsuleTabs
          value={modelType}
          onChange={(v) => setModelType(v as ModelType)}
          options={[
            { label: '平台模型', value: 'platform' },
            { label: '自定义模型', value: 'custom' },
          ]}
          size="small"
        />
      </div>

      <div className={styles.list}>
        {/* 当前项目/对话用量 */}
        <UsageCard
          icon={contextIcon}
          title={contextLabel}
          data={contextData}
          showTokens
          colorPrimary={token.colorPrimary}
          colorBorder={token.colorBorderSecondary}
        />

        {/* 当前用户总用量 */}
        <UsageCard
          icon={<User />}
          title="当前用户总用量"
          data={mockTotalUsage}
          showTokens
          colorPrimary={token.colorPrimary}
          colorBorder={token.colorBorderSecondary}
        />

        {/* 套餐用量 + 额外用量（仅平台模型） */}
        {modelType === 'platform' && (
          <>
            <UsageCard
              icon={<Crown />}
              title="当前套餐用量"
              data={mockPlanUsage}
              showTokens={false}
              colorPrimary={token.colorPrimary}
              colorBorder={token.colorBorderSecondary}
            />
            <UsageCard
              icon={<Gift />}
              title="额外用量"
              data={mockExtraUsage}
              showTokens={false}
              colorPrimary={token.colorSuccess}
              colorBorder={token.colorBorderSecondary}
            />
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Typography.Link>
          查看详情 <Link />
        </Typography.Link>
      </div>
    </Modal>
  )
}
