import { useNavigate } from 'react-router'
import { Button, Card, Grid, Typography, theme } from 'antd'
import {
  MessageSquare,
  Database,
  TrendingUp,
  Building2,
  Users,
  MapPin,
  ArrowRight,
  PlayCircle,
} from 'lucide-react'
import styles from './WelcomePage.module.css'

const { Title, Paragraph } = Typography
const { useBreakpoint } = Grid

const features = [
  {
    key: 'chat',
    icon: <MessageSquare style={{ fontSize: 20 }} />,
    title: '智能对话',
    desc: '自然语言交互, AI Agent 自动编排地理任务',
  },
  {
    key: 'data',
    icon: <Database style={{ fontSize: 20 }} />,
    title: '多源数据',
    desc: '遥感/GEE/本地文件, 统一数据管理',
  },
  {
    key: 'viz',
    icon: <TrendingUp style={{ fontSize: 20 }} />,
    title: '可视化工作台',
    desc: '地图/代码/报告, 所见即所得',
  },
  {
    key: 'workflow',
    icon: <Building2 style={{ fontSize: 20 }} />,
    title: '工作流编排',
    desc: 'ReAct 循环, 自动规划与执行',
  },
  {
    key: 'team',
    icon: <Users style={{ fontSize: 20 }} />,
    title: '团队协作',
    desc: '任务追踪, 上下文共享',
  },
  {
    key: 'local',
    icon: <MapPin style={{ fontSize: 20 }} />,
    title: '本地优先',
    desc: '数据隐私, 离线可用',
  },
]

export function WelcomePage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <div className={styles.page} style={{ background: token.colorBgLayout }}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <img
            src="/src/assets/geowork-logo-static.svg"
            alt="GeoWork"
            className={styles.logo}
          />
          <Title level={1} style={{ margin: 0, color: token.colorText }}>
            GeoWork
          </Title>
          <Paragraph className={styles.tagline} style={{ color: token.colorTextSecondary }}>
            让地理空间 AI 工作流更简单
          </Paragraph>
        </section>

        <section
          className={styles.featureGrid}
          style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}
        >
          {features.map((f) => (
            <Card
              key={f.key}
              className={styles.featureCard}
              styles={{ body: { padding: 20 } }}
            >
              <div
                className={styles.featureIcon}
                style={{
                  background: token.colorPrimaryBg,
                  color: token.colorPrimary,
                }}
              >
                {f.icon}
              </div>
              <Title level={5} className={styles.featureTitle}>
                {f.title}
              </Title>
              <Paragraph className={styles.featureDesc}>
                {f.desc}
              </Paragraph>
            </Card>
          ))}
        </section>

        <section className={styles.cta}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRight />}
            onClick={() => navigate('/new-task')}
          >
            开始新任务
          </Button>
          <Button
            size="large"
            icon={<PlayCircle />}
            disabled
          >
            查看示例
          </Button>
        </section>
      </div>
    </div>
  )
}