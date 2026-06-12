// GeoWork Account Settings
// Settings page for account, subscription, team, sync, and telemetry preferences

import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Switch } from '../../../components/ui/switch'
import { Separator } from '../../../components/ui/separator'
import { User, CreditCard, Users, Cloud, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAccountStore } from '../../stores/accountStore'
import styles from './AccountSettings.module.scss'

interface AccountSettingsValues {
  name: string
  email: string
  avatar_url: string
}

export function AccountSettings() {
  const { user, teams, plan, usage, loginState, login, logout, updateProfile, loadUsage, loadPlan, loadTeams, loadMarketplace } = useAccountStore()
  const [loading, setLoading] = useState(false)
  const [formValues, setFormValues] = useState<AccountSettingsValues>({ name: '', email: '', avatar_url: '' })

  useEffect(() => {
    if (loginState === 'authenticated') {
      loadUsage()
      loadPlan()
      loadTeams()
      loadMarketplace()
    }
  }, [loginState, loadUsage, loadPlan, loadTeams, loadMarketplace])

  useEffect(() => {
    if (user) {
      setFormValues({
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      })
    }
  }, [user])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateProfile(formValues.name, formValues.avatar_url)
      toast.success('资料已更新')
    } catch {
      toast.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  // ── Login Tab ───────────────────────────────────────────────────────
  if (loginState !== 'authenticated') {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <CardHeader>
            <CardTitle>登录</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginPanel onLogin={login} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) return null

  // ── Main Settings ───────────────────────────────────────────────────
  const planColors: Record<string, string> = { free: 'bg-gray-500/20 text-gray-400', pro: 'bg-yellow-500/20 text-yellow-400', team: 'bg-blue-500/20 text-blue-400' }
  const planLabels: Record<string, string> = { free: '免费', pro: '专业版', team: '团队版' }

  return (
    <div className={styles.container}>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" /> 账号</TabsTrigger>
          <TabsTrigger value="subscription"><CreditCard className="h-4 w-4 mr-1" /> 订阅</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-1" /> 团队</TabsTrigger>
          <TabsTrigger value="sync"><Cloud className="h-4 w-4 mr-1" /> 同步</TabsTrigger>
          <TabsTrigger value="privacy"><Shield className="h-4 w-4 mr-1" /> 隐私与遥测</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className={styles.card}>
            <CardHeader>
              <CardTitle>个人资料</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[13px] text-[var(--gw-text-secondary)]">头像 URL</label>
                  <Input
                    placeholder="https://example.com/avatar.jpg"
                    value={formValues.avatar_url}
                    onChange={(e) => setFormValues((v) => ({ ...v, avatar_url: e.target.value }))}
                  />
                </div>
                <div className={styles.avatarPreview}>
                  <div className="h-16 w-16 rounded-full bg-[var(--gw-bg-secondary)] flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-[var(--gw-text-tertiary)]" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] text-[var(--gw-text-secondary)]">昵称</label>
                  <Input
                    value={formValues.name}
                    onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] text-[var(--gw-text-secondary)]">邮箱</label>
                  <Input
                    disabled
                    value={formValues.email}
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  保存
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card className={styles.card}>
            <CardHeader>
              <CardTitle>当前套餐</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className={styles.planInfo}>
                  <h3 className="text-[15px] font-semibold text-[var(--gw-text)]">
                    {planLabels[user.plan]}
                    <Badge className={planColors[user.plan]}>{user.plan}</Badge>
                  </h3>
                  {plan && (
                    <>
                      <p className="text-[13px] text-[var(--gw-text-secondary)]">价格: ¥{plan.price}/月</p>
                      <p className="text-[13px] text-[var(--gw-text-secondary)]">
                        Token 限额: {(plan.limit_tokens / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[13px] text-[var(--gw-text-secondary)]">
                        功能: {plan.features.join(' / ')}
                      </p>
                    </>
                  )}
                  <Button>升级套餐</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card className={styles.card}>
            <CardHeader>
              <CardTitle>团队</CardTitle>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                  <Users className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[13px] font-medium text-[var(--gw-text)]">暂无团队</span>
                    <span className="text-[13px] text-[var(--gw-text-secondary)] block">您可以创建一个团队进行协作</span>
                    <Button size="sm" className="mt-2">创建团队</Button>
                  </div>
                </div>
              ) : (
                teams.map((team) => (
                  <Card key={team.id} className={styles.teamCard}>
                    <CardHeader>
                      <CardTitle>{team.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-[13px] text-[var(--gw-text-secondary)]">所有者: {team.owner_id}</span>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card className={styles.card}>
            <CardHeader>
              <CardTitle>多端同步</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                <Cloud className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[13px] font-medium text-[var(--gw-text)]">同步功能</span>
                  <span className="text-[13px] text-[var(--gw-text-secondary)] block">同步您的设置、工作区元数据和任务元数据到云端</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Switch defaultChecked />
                <span className="text-[13px] text-[var(--gw-text-secondary)]">启用云同步</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card className={styles.card}>
            <CardHeader>
              <CardTitle>隐私设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                <Shield className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[13px] font-medium text-[var(--gw-text)]">遥测数据收集</span>
                  <span className="text-[13px] text-[var(--gw-text-secondary)] block">我们收集性能数据以改进产品体验，不会收集您的文件内容或个人数据</span>
                </div>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Switch defaultChecked />
                  <span className="text-[13px] text-[var(--gw-text-secondary)]">允许性能遥测 (FPS、延迟等)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch />
                  <span className="text-[13px] text-[var(--gw-text-secondary)]">允许崩溃报告上传</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Login Panel ──────────────────────────────────────────────────────────
interface LoginPanelProps {
  onLogin: (email: string, password: string) => Promise<void>
}

function LoginPanel({ onLogin }: LoginPanelProps) {
  const [loading, setLoading] = useState(false)
  const [loginValues, setLoginValues] = useState({ email: '', password: '' })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onLogin(loginValues.email, loginValues.password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-1">
        <label className="text-[13px] text-[var(--gw-text-secondary)]">邮箱</label>
        <Input
          placeholder="your@email.com"
          value={loginValues.email}
          onChange={(e) => setLoginValues((v) => ({ ...v, email: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[13px] text-[var(--gw-text-secondary)]">密码</label>
        <Input
          type="password"
          placeholder="密码"
          value={loginValues.password}
          onChange={(e) => setLoginValues((v) => ({ ...v, password: e.target.value }))}
        />
      </div>
      <Button type="submit" disabled={loading}>
        登录
      </Button>
    </form>
  )
}
