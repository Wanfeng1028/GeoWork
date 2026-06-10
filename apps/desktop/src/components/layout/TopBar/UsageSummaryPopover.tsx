// GeoWork UsageSummaryPopover
// Displays credits, tokens, model usage, and plan info in the top bar

import { useState } from 'react'
import { Popover, Tag, Progress, Space, Typography, Avatar, Button, Divider } from 'antd'
import { UserOutlined, CreditCardOutlined, BulbOutlined, CloudServerOutlined } from '@ant-design/icons'
import { useAccountStore } from '../../stores/accountStore'
import styles from './UsageSummaryPopover.module.scss'

const { Text, Paragraph } = Typography

export function UsageSummaryPopover() {
  const { user, plan, credits, usage, loginState } = useAccountStore()
  const [visible, setVisible] = useState(false)

  if (loginState !== 'authenticated' || !user) {
    return (
      <Popover
        content={
          <div className={styles.loginPrompt}>
            <Text>登录以查看账号信息</Text>
          </div>
        }
        trigger="hover"
        placement="bottomRight"
      >
        <Button type="text" className={styles.avatarBtn}>
          <UserOutlined />
        </Button>
      </Popover>
    )
  }

  const planColors: Record<string, string> = {
    free: 'default',
    pro: 'gold',
    team: 'blue',
  }

  const planLabels: Record<string, string> = {
    free: '免费',
    pro: '专业版',
    team: '团队版',
  }

  const tokensUsed = usage?.model_tokens ?? 0
  const planLimit = plan?.limit_tokens ?? 100000
  const tokenPercent = Math.min(100, Math.round((tokensUsed / planLimit) * 100))

  return (
    <Popover
      visible={visible}
      onVisibleChange={setVisible}
      content={
        <div className={styles.popoverContent}>
          {/* User info */}
          <div className={styles.userInfo}>
            <Avatar size="small" icon={<UserOutlined />} />
            <div>
              <Text strong>{user.name}</Text>
              <Paragraph className={styles.email} copyable={{ text: user.email }}>
                {user.email}
              </Paragraph>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* Plan */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <CloudServerOutlined />
              <Text>当前套餐</Text>
              <Tag color={planColors[user.plan]}>{planLabels[user.plan]}</Tag>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* Credits */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <CreditCardOutlined />
              <Text>Credits</Text>
            </div>
            <Text strong className={styles.creditsValue}>{credits.toFixed(1)}</Text>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* Token Usage */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <BulbOutlined />
              <Text>Token 用量</Text>
              <Text type="secondary">
                {(tokensUsed / 1000).toFixed(0)}K / {(planLimit / 1000).toFixed(0)}K
              </Text>
            </div>
            <Progress
              percent={tokenPercent}
              size="small"
              status={tokenPercent > 90 ? 'exception' : 'normal'}
            />
          </div>
        </div>
      }
      trigger="click"
      placement="bottomRight"
      overlayClassName={styles.overlay}
    >
      <Button type="text" className={styles.avatarBtn}>
        <Avatar size="small" icon={<UserOutlined />} />
      </Button>
    </Popover>
  )
}
