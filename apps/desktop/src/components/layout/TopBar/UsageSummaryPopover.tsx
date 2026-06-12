// GeoWork UsageSummaryPopover

import { useState } from 'react'
import {
  User,
  CreditCard,
  Lightbulb,
  Server,
} from 'lucide-react'
import { useAccountStore } from '../../../stores/accountStore'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Separator } from '../../ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover'
import styles from './UsageSummaryPopover.module.scss'

export function UsageSummaryPopover() {
  const { user, plan, credits, usage, loginState } = useAccountStore()
  const [open, setOpen] = useState(false)

  if (loginState !== 'authenticated' || !user) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" className={styles.avatarBtn}>
            <User size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[200px]">
          <div className="p-2 text-[12px] text-[var(--gw-text-secondary)]">登录以查看账号信息</div>
        </PopoverContent>
      </Popover>
    )
  }

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

  const tokensUsed = usage?.model_tokens ?? 0
  const planLimit = plan?.limit_tokens ?? 100000
  const tokenPercent = Math.min(100, Math.round((tokensUsed / planLimit) * 100))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={styles.avatarBtn}>
          <User size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gw-bg-active)]">
              <User size={16} className="text-[var(--gw-text-tertiary)]" />
            </div>
            <div>
              <div className="text-[13px] font-medium text-[var(--gw-text)]">{user.name}</div>
              <div className="text-[11px] text-[var(--gw-text-tertiary)]">{user.email}</div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Server size={14} className="text-[var(--gw-text-tertiary)]" />
            <span className="text-[12px] text-[var(--gw-text-secondary)]">当前套餐</span>
            <Badge variant={planVariant[user.plan] ?? 'default'} className="ml-auto">
              {planLabels[user.plan]}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} className="text-[var(--gw-text-tertiary)]" />
            <span className="text-[12px] text-[var(--gw-text-secondary)]">Credits</span>
            <span className="ml-auto text-[13px] font-semibold text-[var(--gw-text)]">
              {credits.toFixed(1)}
            </span>
          </div>
        </div>

        <Separator />

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-[var(--gw-text-tertiary)]" />
            <span className="text-[12px] text-[var(--gw-text-secondary)]">Token 用量</span>
            <span className="ml-auto text-[11px] text-[var(--gw-text-tertiary)]">
              {(tokensUsed / 1000).toFixed(0)}K / {(planLimit / 1000).toFixed(0)}K
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--gw-bg-active)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                tokenPercent > 90 ? 'bg-[var(--gw-danger)]' : 'bg-[var(--gw-accent)]'
              }`}
              style={{ width: `${tokenPercent}%` }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
