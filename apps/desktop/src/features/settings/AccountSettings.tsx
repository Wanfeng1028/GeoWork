// GeoWork Account Settings
// Settings page for account, subscription, team, sync, and telemetry preferences

import { useState, useEffect } from 'react'
import { Tabs, Card, Form, Input, Avatar, Button, Tag, Space, Typography, Switch, message, Alert } from 'antd'
import { UserOutlined, CreditCardOutlined, TeamOutlined, CloudOutlined, SafetyOutlined } from '@ant-design/icons'
import { useAccountStore } from '../../stores/accountStore'
import styles from './AccountSettings.module.scss'

const { Title, Text, Paragraph } = Typography

interface AccountSettingsValues {
  name: string
  email: string
  avatar_url: string
}

export function AccountSettings() {
  const { user, teams, plan, usage, loginState, login, logout, updateProfile, loadUsage, loadPlan, loadTeams, loadMarketplace } = useAccountStore()
  const [form] = Form.useForm<AccountSettingsValues>()
  const [loading, setLoading] = useState(false)

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
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      })
    }
  }, [user, form])

  const handleProfileUpdate = async (values: AccountSettingsValues) => {
    setLoading(true)
    try {
      await updateProfile(values.name, values.avatar_url)
      message.success('资料已更新')
    } catch {
      message.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  // ── Login Tab ───────────────────────────────────────────────────────
  if (loginState !== 'authenticated') {
    return (
      <div className={styles.container}>
        <Card title="登录" className={styles.card}>
          <LoginPanel onLogin={login} />
        </Card>
      </div>
    )
  }

  if (!user) return null

  // ── Main Settings ───────────────────────────────────────────────────
  const planColors: Record<string, string> = { free: 'default', pro: 'gold', team: 'blue' }
  const planLabels: Record<string, string> = { free: '免费', pro: '专业版', team: '团队版' }

  return (
    <div className={styles.container}>
      <Tabs
        defaultActiveKey="profile"
        items={[
          {
            key: 'profile',
            label: <><UserOutlined /> 账号</>,
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Profile */}
                <Card title="个人资料" className={styles.card}>
                  <Form<AccountSettingsValues>
                    form={form}
                    layout="vertical"
                    onFinish={handleProfileUpdate}
                    initialValues={{ name: user.name, email: user.email }}
                  >
                    <Form.Item label="头像 URL" name="avatar_url">
                      <Input placeholder="https://example.com/avatar.jpg" />
                    </Form.Item>
                    <div className={styles.avatarPreview}>
                      <Avatar
                        size={64}
                        src={user.avatar_url}
                        icon={<UserOutlined />}
                      />
                    </div>
                    <Form.Item label="昵称" name="name">
                      <Input />
                    </Form.Item>
                    <Form.Item label="邮箱" name="email">
                      <Input disabled />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={loading}>
                        保存
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              </Space>
            ),
          },
          {
            key: 'subscription',
            label: <><CreditCardOutlined /> 订阅</>,
            children: (
              <Card title="当前套餐" className={styles.card}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div className={styles.planInfo}>
                    <Title level={4}>
                      {planLabels[user.plan]}
                      <Tag color={planColors[user.plan]}>{user.plan}</Tag>
                    </Title>
                    {plan && (
                      <>
                        <Paragraph>价格: ¥{plan.price}/月</Paragraph>
                        <Paragraph>
                          Token 限额: {(plan.limit_tokens / 1000).toFixed(0)}K
                        </Paragraph>
                        <Paragraph>
                          功能: {plan.features.join(' / ')}
                        </Paragraph>
                      </>
                    )}
                    <Button type="primary">升级套餐</Button>
                  </div>
                </Space>
              </Card>
            ),
          },
          {
            key: 'team',
            label: <><TeamOutlined /> 团队</>,
            children: (
              <Card title="团队" className={styles.card}>
                {teams.length === 0 ? (
                  <Alert
                    message="暂无团队"
                    description="您可以创建一个团队进行协作"
                    type="info"
                    action={<Button size="small">创建团队</Button>}
                  />
                ) : (
                  teams.map((team) => (
                    <Card key={team.id} className={styles.teamCard}>
                      <Title level={5}>{team.name}</Title>
                      <Text type="secondary">所有者: {team.owner_id}</Text>
                    </Card>
                  ))
                )}
              </Card>
            ),
          },
          {
            key: 'sync',
            label: <><CloudOutlined /> 同步</>,
            children: (
              <Card title="多端同步" className={styles.card}>
                <Alert
                  message="同步功能"
                  description="同步您的设置、工作区元数据和任务元数据到云端"
                  type="info"
                  showIcon
                />
                <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
                  <Switch checked defaultChecked />
                  <Text type="secondary">启用云同步</Text>
                </Space>
              </Card>
            ),
          },
          {
            key: 'privacy',
            label: <><SafetyOutlined /> 隐私与遥测</>,
            children: (
              <Card title="隐私设置" className={styles.card}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    message="遥测数据收集"
                    description="我们收集性能数据以改进产品体验，不会收集您的文件内容或个人数据"
                    type="info"
                    showIcon
                  />
                  <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
                    <Switch defaultChecked />
                    <Text type="secondary">允许性能遥测 (FPS、延迟等)</Text>
                  </Space>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Switch />
                    <Text type="secondary">允许崩溃报告上传</Text>
                  </Space>
                </Space>
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

// ── Login Panel ──────────────────────────────────────────────────────────
interface LoginPanelProps {
  onLogin: (email: string, password: string) => Promise<void>
}

function LoginPanel({ onLogin }: LoginPanelProps) {
  const [form] = Form.useForm<{ email: string; password: string }>()
  const [loading, setLoading] = useState(false)

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      await onLogin(values.email, values.password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleLogin}>
      <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email' }]}>
        <Input placeholder="your@email.com" />
      </Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, min: 1 }]}>
        <Input.Password placeholder="密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          登录
        </Button>
      </Form.Item>
    </Form>
  )
}
