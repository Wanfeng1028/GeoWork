// GeoWork Account Settings
// Settings page for account, subscription, team, sync, and telemetry preferences

import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent, Card, CardHeader, CardTitle, CardContent, Input, Button, Badge, Switch, Separator } from '../../components/ui'
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
          <TabsTrigger value="profile"><User  /> 账号</TabsTrigger>
          <TabsTrigger value="subscription"><CreditCard  /> 订阅</TabsTrigger>
          <TabsTrigger value="team"><Users  /> 团队</TabsTrigger>
          <TabsTrigger value="sync"><Cloud  /> 同步</TabsTrigger>
          <TabsTrigger value="privacy"><Shield  /> 隐私与遥测</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className={styles.card}>
            <CardHeader>
              <CardTitle>个人资料</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} >
                <div >
                  <label >头像 URL</label>
                  <Input
                    placeholder="https://example.com/avatar.jpg"
                    value={formValues.avatar_url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormValues((v) => ({ ...v, avatar_url: e.target.value }))}
                  />
                </div>
                <div className={styles.avatarPreview}>
                  <div >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="object-cover" />
                    ) : (
                      <User  />
                    )}
                  </div>
                </div>
                <div >
                  <label >昵称</label>
                  <Input
                    value={formValues.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                  />
                </div>
                <div >
                  <label >邮箱</label>
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
              <div className="flex-col">
                <div className={styles.planInfo}>
                  <h3 >
                    {planLabels[user.plan]}
                    <Badge className={planColors[user.plan]}>{user.plan}</Badge>
                  </h3>
                  {plan && (
                    <>
                      <p >价格: ¥{plan.price}/月</p>
                      <p >
                        Token 限额: {(plan.limit_tokens / 1000).toFixed(0)}K
                      </p>
                      <p >
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
                <div className="border">
                  <Users className="shrink-0" />
                  <div>
                    <span >暂无团队</span>
                    <span >您可以创建一个团队进行协作</span>
                    <Button size="sm" >创建团队</Button>
                  </div>
                </div>
              ) : (
                teams.map((team) => (
                  <Card key={team.id} className={styles.teamCard}>
                    <CardHeader>
                      <CardTitle>{team.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span >所有者: {team.owner_id}</span>
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
              <div className="border">
                <Cloud className="shrink-0" />
                <div>
                  <span >同步功能</span>
                  <span >同步您的设置、工作区元数据和任务元数据到云端</span>
                </div>
              </div>
              <div >
                <Switch defaultChecked />
                <span >启用云同步</span>
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
              <div className="border">
                <Shield className="shrink-0" />
                <div>
                  <span >遥测数据收集</span>
                  <span >我们收集性能数据以改进产品体验，不会收集您的文件内容或个人数据</span>
                </div>
              </div>
              <div className="flex-col">
                <div >
                  <Switch defaultChecked />
                  <span >允许性能遥测 (FPS、延迟等)</span>
                </div>
                <div >
                  <Switch />
                  <span >允许崩溃报告上传</span>
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
    <form onSubmit={handleLogin} >
      <div >
        <label >邮箱</label>
        <Input
          placeholder="your@email.com"
          value={loginValues.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginValues((v) => ({ ...v, email: e.target.value }))}
        />
      </div>
      <div >
        <label >密码</label>
        <Input
          type="password"
          placeholder="密码"
          value={loginValues.password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginValues((v) => ({ ...v, password: e.target.value }))}
        />
      </div>
      <Button type="submit" disabled={loading}>
        登录
      </Button>
    </form>
  )
}
