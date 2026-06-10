// GeoWork ChatTimeline

import { List, Card, Tag, Typography, Collapse } from 'antd'
import type { ChatMessage } from '../../../types/chat'
import { mockMessages } from '../../../mocks/chat.mock'
import styles from './ChatTimeline.module.scss'

const { Panel } = Collapse

export function ChatTimeline() {
  return (
    <div className={styles.timeline}>
      <List
        dataSource={mockMessages as ChatMessage[]}
        renderItem={(msg) => (
          <List.Item className={styles.messageItem}>
            <Card 
              className={`${styles.messageCard} ${styles.userMsg}`}
              size="small"
            >
              <div className={styles.messageHeader}>
                <Tag color={msg.role === 'user' ? 'blue' : 'green'}>
                  {msg.role === 'user' ? '用户' : 'Agent'}
                </Tag>
                <span className={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <Typography.Paragraph className={styles.messageContent}>
                {msg.content}
              </Typography.Paragraph>
              
              {msg.toolCall && (
                <Collapse size="small" className={styles.toolCall}>
                  <Panel header={`工具调用: ${msg.toolCall.toolName}`} key="1">
                    <div className={styles.toolCallDetail}>
                      <p><strong>输入:</strong> {JSON.stringify(msg.toolCall.input)}</p>
                      <p><strong>输出:</strong> {msg.toolCall.output}</p>
                      <p><strong>耗时:</strong> {msg.toolCall.duration}s</p>
                    </div>
                  </Panel>
                </Collapse>
              )}
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}
