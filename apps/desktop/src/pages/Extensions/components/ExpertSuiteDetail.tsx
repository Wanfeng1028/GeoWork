import { useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Card,
  List,
  Space,
  Switch,
  Tag,
  Typography,
  theme,
  App,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  ExportOutlined,
  BookOutlined,
  DatabaseOutlined,
  RadarChartOutlined,
  SettingOutlined,
  AimOutlined,
  PieChartOutlined,
  WarningOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import type { ExpertSuite } from '../expertMockData'
import styles from './ExpertSuiteDetail.module.css'

const { Title, Text, Paragraph } = Typography

const categoryIconMap: Record<string, React.ReactNode> = {
  '总控管理': <SettingOutlined />,
  '空间分析': <AimOutlined />,
  '遥感解译': <RadarChartOutlined />,
  '数据处理': <DatabaseOutlined />,
  '专题制图': <PieChartOutlined />,
  '灾害评估': <WarningOutlined />,
  '工程开发': <CodeOutlined />,
  '学术写作': <EditOutlined />,
}

type ExpertSuiteDetailProps = {
  suite: ExpertSuite
  onBack: () => void
  onToggleChat: (enabled: boolean) => void
}

export function ExpertSuiteDetail({
  suite,
  onBack,
  onToggleChat,
}: ExpertSuiteDetailProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [chatEnabled, setChatEnabled] = useState(true)

  const handleChatToggle = (checked: boolean) => {
    setChatEnabled(checked)
    onToggleChat(checked)
  }

  return (
    <div className={styles.root}>
      {/* 顶部操作栏 */}
      <div
        className={styles.toolbar}
        style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
        >
          返回列表
        </Button>
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => message.info('专家编辑功能后续接入')}
          >
            编辑
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={() => message.info('专家套件导出功能后续接入')}
          >
            导出 ZIP
          </Button>
          <div className={styles.chatToggle}>
            <Text>在聊天中启用</Text>
            <Switch
              checked={chatEnabled}
              onChange={handleChatToggle}
            />
          </div>
        </Space>
      </div>

      {/* 主体信息 */}
      <div className={styles.main}>
        <Card
          className={styles.infoCard}
          style={{ background: token.colorFillQuaternary }}
        >
          <div className={styles.infoHeader}>
            <Avatar
              size={56}
              style={{ background: token.colorPrimary }}
              icon={categoryIconMap[suite.category] ?? <RadarChartOutlined />}
            />
            <div className={styles.infoMeta}>
              <Title level={4} style={{ margin: 0, color: token.colorText }}>
                {suite.name}
              </Title>
              <Space size="small" className={styles.infoTags}>
                <Tag>{suite.version}</Tag>
                <Tag color="blue">{suite.category}</Tag>
                <Text type="secondary">{suite.author}</Text>
              </Space>
            </div>
          </div>
          <Paragraph type="secondary" className={styles.infoDesc}>
            {suite.description}
          </Paragraph>
        </Card>

        {/* 快捷命令 */}
        <Card
          title="快捷命令"
          className={styles.section}
          style={{ background: token.colorBgContainer }}
        >
          <List
            dataSource={suite.quickCommands}
            renderItem={(cmd) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => message.info('快捷命令将在对话中调用，后续接入')}
              >
                <div className={styles.commandRow}>
                  <Text strong style={{ fontFamily: 'monospace', color: token.colorPrimary }}>
                    {cmd.trigger}
                  </Text>
                  <Text type="secondary">{cmd.description}</Text>
                </div>
              </List.Item>
            )}
          />
        </Card>

        {/* 数据连接 */}
        <Card
          title="数据连接"
          className={styles.section}
          style={{ background: token.colorBgContainer }}
        >
          <List
            dataSource={suite.dataConnections}
            renderItem={(conn) => (
              <List.Item>
                <div className={styles.connectionRow}>
                  <DatabaseOutlined style={{ marginRight: 8, color: token.colorTextSecondary }} />
                  <div className={styles.connectionInfo}>
                    <Text>{conn.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {conn.description}
                    </Text>
                  </div>
                  <Switch
                    defaultChecked={conn.enabled}
                    size="small"
                    onChange={() => message.info('数据连接开关后续接入')}
                  />
                </div>
              </List.Item>
            )}
          />
        </Card>

        {/* 知识模块 */}
        <Card
          title="知识模块"
          className={styles.section}
          style={{ background: token.colorBgContainer }}
        >
          <List
            dataSource={suite.knowledgeModules}
            renderItem={(mod) => (
              <List.Item>
                <div className={styles.knowledgeRow}>
                  <BookOutlined style={{ marginRight: 8, color: token.colorTextSecondary }} />
                  <div className={styles.knowledgeInfo}>
                    <Text>{mod.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {mod.description}
                    </Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>

        {/* 套件说明 */}
        <Alert
          type="info"
          showIcon
          title="套件说明"
          description="该专家套件当前为前端 mock，后续将接入真实专家配置、知识库、工具调用和工作流执行。"
          className={styles.notice}
        />
      </div>
    </div>
  )
}
