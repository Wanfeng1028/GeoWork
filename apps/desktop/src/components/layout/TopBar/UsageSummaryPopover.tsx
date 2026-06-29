
import { useState } from 'react'
import { User, CreditCard, Server } from 'lucide-react'
import { useAccountStore } from '../../../stores/accountStore'
import styles from './UsageSummaryPopover.module.scss'

export function UsageSummaryPopover() {
  const { user, plan, credits, usage, loginState } = useAccountStore()
  const [open, setOpen] = useState(false)

  const planLabels: Record<string, string> = {
    free: '免费',
    pro: '专业版',
    team: '团队版',
  }

  const planVariant: Record<string, 'default' | 'accent' | 'info'> = {
    free: 'default',
    pro: 'accent',
    team: 'info',
  }

  if (loginState !== 'authenticated' || !user) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={styles.avatarBtn} title="账号">
            <User size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className={styles.popoverContent}>
          <div className={styles.loginPrompt}>登录以查看账号信息</div>
        </PopoverContent>
      </Popover>
    )
  }

  const tokensUsed = usage?.model_tokens ?? 0
  const planLimit = plan?.limit_tokens ?? 100000
  const tokenPercent = Math.min(100, Math.round((tokensUsed / planLimit) * 100))

  // Build 46 usage bars — filled proportionally to tokenPercent.
  const totalBars = 46
  const filledBars = Math.round((tokenPercent / 100) * totalBars)
  const bars = Array.from({ length: totalBars }, (_, i) => {
    if (i < filledBars) return tokenPercent > 90 ? 'warn' : 'active'
    return 'idle'
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={styles.avatarBtn} title="用量">
          <User size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className={styles.popoverContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.avatarCircle}>
            <User size={16} />
          </div>
          <div>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userEmail}>{user.email}</div>
          </div>
        </div>

        {/* Plan */}
        <div className={styles.row}>
          <span className={styles.label}>
            <Server size={14} /> 当前套餐
          </span>
          <Badge variant={planVariant[user.plan] ?? 'default'}>
            {planLabels[user.plan]}
          </Badge>
        </div>

        {/* Credits */}
        <div className={styles.row}>
          <span className={styles.label}>
            <CreditCard size={14} /> Credits
          </span>
          <span className={styles.value}>{credits.toFixed(1)}</span>
        </div>

        {/* Usage bars (46 cells) */}
        <div className={styles.usageSection}>
          <div className={styles.usageHead}>
            <span>本月用量</span>
            <span className={styles.right}>
              {(tokensUsed / 1000).toFixed(0)}K / {(planLimit / 1000).toFixed(0)}K
            </span>
          </div>
          <div className={styles.usageBars}>
            {bars.map((state, i) => (
              <span
                key={i}
                className={`${styles.usageBar} ${ state === 'active' ? styles.usageBarActive : state === 'warn' ? styles.usageBarWarn : '' }`}
              />
            ))}
          </div>
          <div className={styles.usageNumbers}>
            <span>已用 <strong>{tokenPercent}%</strong></span>
            <span>重置于 7 月 1 日</span>
          </div>
          <button className={styles.detailBtn}>查看详细用量</button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
