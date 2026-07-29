// GeoWork Account Settings
// Settings page for account, subscription, team, sync, and telemetry preferences

import { useState, useEffect } from 'react'
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
        <div className={styles.card}>
          <div>
            <div>登录</div>
          </div>
          <div>
            <LoginPanel onLogin={login} />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  // ── Main Settings ───────────────────────────────────────────────────
  const planColors: Record<string, string> = { free: 'bg-gray-500/20 text-gray-400', pro: 'bg-yellow-500/20 text-yellow-400', team: 'bg-blue-500/20 text-blue-400' }
  const planLabels: Record<string, string> = { free: '免费', pro: '专业版', team: '团队版' }

  return (
    <div className={styles.container}>
      <div>
        <div>
          <button><User  /> 账号</button>
          <button><CreditCard  /> 订阅</button>
          <button><Users  /> 团队</button>
          <button><Cloud  /> 同步</button>
          <button><Shield  /> 隐私与遥测</button>
        </div>

        <div>
          <div className={styles.card}>
            <div>
              <div>个人资料</div>
            </div>
            <div>
              <form onSubmit={handleProfileUpdate} >
                <div >
                  <label >头像 URL</label>
                  <input
                    placeholder="https://example.com/avatar.jpg"
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
                  <input
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                  />
                </div>
                <div >
                  <label >邮箱</label>
                  <input
                  />
                </div>
                <button type="submit">
                  保存
                </button>
              </form>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.card}>
            <div>
              <div>当前套餐</div>
            </div>
            <div>
              <div >
                <div className={styles.planInfo}>
                  <h3 >
                    {planLabels[user.plan]}
                    <span className={planColors[user.plan]}>{user.plan}</span>
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
                  <button>升级套餐</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.card}>
            <div>
              <div>团队</div>
            </div>
            <div>
              {teams.length === 0 ? (
                <div >
                  <Users  />
                  <div>
                    <span >暂无团队</span>
                    <span >您可以创建一个团队进行协作</span>
                    <button >创建团队</button>
                  </div>
                </div>
              ) : (
                teams.map((team) => (
                  <div key={team.id} className={styles.teamCard}>
                    <div>
                      <div>{team.name}</div>
                    </div>
                    <div>
                      <span >所有者: {team.owner_id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className={styles.card}>
            <div>
              <div>多端同步</div>
            </div>
            <div>
              <div >
                <Cloud  />
                <div>
                  <span >同步功能</span>
                  <span >同步您的设置、工作区元数据和任务元数据到云端</span>
                </div>
              </div>
              <div >
                <button defaultChecked />
                <span >启用云同步</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.card}>
            <div>
              <div>隐私设置</div>
            </div>
            <div>
              <div >
                <Shield  />
                <div>
                  <span >遥测数据收集</span>
                  <span >我们收集性能数据以改进产品体验，不会收集您的文件内容或个人数据</span>
                </div>
              </div>
              <div >
                <div >
                  <button defaultChecked />
                  <span >允许性能遥测 (FPS、延迟等)</span>
                </div>
                <div >
                  <button />
                  <span >允许崩溃报告上传</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
        <input
          placeholder="your@email.com"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginValues((v) => ({ ...v, email: e.target.value }))}
        />
      </div>
      <div >
        <label >密码</label>
        <input
          type="password"
          placeholder="密码"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginValues((v) => ({ ...v, password: e.target.value }))}
        />
      </div>
      <button type="submit">
        登录
      </button>
    </form>
  )
}
