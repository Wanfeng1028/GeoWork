import { Avatar, Button, Card, Space, Tag, Typography, theme } from 'antd'
import {
  Plus,
  Check,
  Network,
  BookOpen,
  Settings,
  Target,
  Database,
  PieChart,
  AlertTriangle,
  Code,
  Pencil,
} from 'lucide-react'
import type { ExpertSuite } from '../expertMockData'
import styles from './ExpertSuiteCard.module.css'

const { Text, Paragraph } = Typography

type ExpertSuiteCardProps = {
  suite: ExpertSuite
  onInstall: (id: string) => void
  onUninstall: (id: string) => void
  onClick: (suite: ExpertSuite) => void
}

const categoryIconMap: Record<string, React.ReactNode> = {
  '总控管理': <Settings />,
  '空间分析': <Target />,
  '遥感解译': <Network />,
  '数据处理': <Database />,
  '专题制图': <PieChart />,
  '灾害评估': <AlertTriangle />,
  '工程开发': <Code />,
  '学术写作': <Pencil />,
}

export function ExpertSuiteCard({
  suite,
  onInstall,
  onUninstall,
  onClick,
}: ExpertSuiteCardProps) {
  const { token } = theme.useToken()

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (suite.installed) {
      onUninstall(suite.id)
    } else {
      onInstall(suite.id)
    }
  }

  return (
    <Card
      hoverable
      className={styles.card}
      style={{
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      }}
      onClick={() => onClick(suite)}
    >
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Avatar
            size={32}
            style={{ background: token.colorPrimary }}
            icon={categoryIconMap[suite.category]}
          />
          <div className={styles.nameBlock}>
            <Text strong className={styles.name}>{suite.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{suite.author}</Text>
          </div>
        </div>
        <div className={styles.headerRight}>
          {suite.installed ? (
            <Tag icon={<Check />} color="success">已安装</Tag>
          ) : (
            <Button
              type="text"
              size="small"
              icon={<Plus />}
              onClick={handleInstallClick}
            />
          )}
        </div>
      </div>

      {/* 描述 */}
      <Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        className={styles.description}
      >
        {suite.description}
      </Paragraph>

      {/* 底部信息 */}
      <div className={styles.footer}>
        <Space size="small">
          <Tag style={{ margin: 0 }}>
            <Network /> {suite.commandCount} 个命令
          </Tag>
          <Tag style={{ margin: 0 }}>
            <BookOpen /> {suite.knowledgeCount} 个知识
          </Tag>
        </Space>
        <Text type="secondary" style={{ fontSize: 11 }}>{suite.version}</Text>
      </div>
    </Card>
  )
}