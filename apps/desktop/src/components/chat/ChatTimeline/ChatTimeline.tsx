// GeoWork ChatTimeline - Wired to chatStore

import { List, Card, Tag, Typography, Collapse, Empty } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  ConsoleSqlOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import useChatStore from '../../../stores/chatStore'
import type { ChatMessage } from '../../../types/chat'
import styles from './ChatTimeline.module.scss'

const { Panel } = Collapse

export function ChatTimeline() {
  const { messages } = useChatStore()

  if (messages.length === 0) {
    return (
      <div className={styles.timeline}>
        <Empty
          description="暂无对话记录 — 在 Composer 中创建任务开始"
          className={styles.emptyState}
        />
      </div>
    )
  }

  return (
    <div className={styles.timeline}>
      <List
        dataSource={messages}
        renderItem={(msg) => (
          <List.Item className={styles.messageItem}>
            <Card
              className={`${styles.messageCard} ${styles[`${msg.role}Msg`]} ${styles[`${msg.type}Msg`]}`}
              size="small"
            >
              <div className={styles.messageHeader}>
                <Tag color={msg.role === 'user' ? 'blue' : msg.role === 'system' ? 'red' : 'green'}>
                  {msg.role === 'user' ? '用户' : msg.role === 'system' ? '系统' : 'Agent'}
                </Tag>
                <span className={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <Typography.Paragraph className={styles.messageContent}>
                {msg.content}
              </Typography.Paragraph>

              {/* Tool Call */}
              {msg.toolCall && (
                <Collapse
                  size="small"
                  className={styles.toolCall}
                  defaultActiveKey={msg.toolCall.status === 'running' ? ['1'] : []}
                >
                  <Panel
                    header={
                      <span>
                        {msg.toolCall.status === 'running' ? (
                          <span className={styles.runningIndicator}>
                            <span className={styles.spinner} /> 运行中: {msg.toolCall.toolName}
                          </span>
                        ) : msg.toolCall.status === 'failed' ? (
                          <span className={styles.failedIndicator}>
                            <ExclamationCircleOutlined /> 失败: {msg.toolCall.toolName}
                          </span>
                        ) : (
                          <span>
                            <ConsoleSqlOutlined /> 工具调用: {msg.toolCall.toolName}
                          </span>
                        )}
                      </span>
                    }
                    key="1"
                  >
                    <div className={styles.toolCallDetail}>
                      <p><strong>输入:</strong> {JSON.stringify(msg.toolCall.input, null, 2)}</p>
                      {msg.toolCall.output && (
                        <p><strong>输出:</strong> <pre className={styles.toolOutput}>{msg.toolCall.output}</pre></p>
                      )}
                      {msg.toolCall.duration && (
                        <p><strong>耗时:</strong> {msg.toolCall.duration}s</p>
                      )}
                      {msg.toolCall.error && (
                        <p className={styles.toolError}><strong>错误:</strong> {msg.toolCall.error}</p>
                      )}
                    </div>
                  </Panel>
                </Collapse>
              )}

              {/* Approval Card */}
              {msg.approval && (
                <Card className={styles.approvalCard} size="small">
                  <div className={styles.approvalHeader}>
                    <Tag color={
                      msg.approval.riskLevel === 'critical' ? 'red' :
                      msg.approval.riskLevel === 'high' ? 'orange' :
                      msg.approval.riskLevel === 'medium' ? 'gold' : 'blue'
                    }>
                      {msg.approval.riskLevel}
                    </Tag>
                    <span className={styles.approvalTitle}>{msg.approval.title}</span>
                  </div>
                  <p className={styles.approvalDesc}>{msg.approval.description}</p>
                  <div className={styles.approvalActions}>
                    <Tag color="green">允许一次</Tag>
                    <Tag color="blue">允许本次任务</Tag>
                    <Tag color="red">拒绝</Tag>
                    <Tag>记住选择</Tag>
                  </div>
                </Card>
              )}
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}
