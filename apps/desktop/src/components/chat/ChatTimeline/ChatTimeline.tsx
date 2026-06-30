// GeoWork ChatTimeline - Wired to chatStore

import { AlertCircle, Terminal, User, Bot } from 'lucide-react'
import useChatStore from '../../../stores/chatStore'
import type { ChatMessage } from '../../../types/chat'
import styles from './ChatTimeline.module.scss'

export function ChatTimeline() {
  const { messages } = useChatStore()

  if (messages.length === 0) {
    return (
      <div className={styles.timeline}>
        <div
          description="暂无对话记录 — 在 Composer 中创建任务开始"
          className={styles.emptyState}
        />
      </div>
    )
  }

  return (
    <div className={styles.timeline}>
      <div >
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageItem} ${styles.messageCard} ${styles[`${msg.role}Msg`]} ${styles[`${msg.type}Msg`]}`}>
            <div >
              <div className={styles.messageHeader}>
                <span>
                  {msg.role === 'user' ? '用户' : msg.role === 'system' ? '系统' : 'Agent'}
                </span>
                <span className={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p >
                {msg.content}
              </p>

              {/* Tool Call */}
              {msg.toolCall && (
                <details
                  className={styles.toolCall}
                  open={msg.toolCall.status === 'running'}
                >
                  <summary >
                    <span>
                      {msg.toolCall.status === 'running' ? (
                        <span className={styles.runningIndicator}>
                          <span className={styles.spinner} /> 运行中: {msg.toolCall.toolName}
                        </span>
                      ) : msg.toolCall.status === 'failed' ? (
                        <span className={styles.failedIndicator}>
                          <AlertCircle  /> 失败: {msg.toolCall.toolName}
                        </span>
                      ) : (
                        <span>
                          <Terminal  /> 工具调用: {msg.toolCall.toolName}
                        </span>
                      )}
                    </span>
                  </summary>
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
                </details>
              )}

              {/* Approval Card */}
              {msg.approval && (
                <div className={styles.approvalCard}>
                  <div className={styles.approvalHeader}>
                    <span>
                      {msg.approval.riskLevel}
                    </span>
                    <span className={styles.approvalTitle}>{msg.approval.title}</span>
                  </div>
                  <p className={styles.approvalDesc}>{msg.approval.description}</p>
                  <div className={styles.approvalActions}>
                    <span>允许一次</span>
                    <span>允许本次任务</span>
                    <span>拒绝</span>
                    <span>记住选择</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
