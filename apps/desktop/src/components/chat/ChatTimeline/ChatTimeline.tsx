// GeoWork ChatTimeline - Wired to chatStore

import { AlertCircle, Terminal, User, Bot } from 'lucide-react'
import useChatStore from '../../../stores/chatStore'
import type { ChatMessage } from '../../../types/chat'
import { Empty } from '../../ui/empty'
import { Badge } from '../../ui/badge'
import styles from './ChatTimeline.module.scss'

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
      <div className="flex flex-col gap-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageItem} ${styles.messageCard} ${styles[`${msg.role}Msg`]} ${styles[`${msg.type}Msg`]}`}>
            <div className="rounded-[var(--gw-radius-md)] border border-[var(--gw-border-soft)] bg-[var(--gw-bg-surface)] p-3">
              <div className={styles.messageHeader}>
                <Badge variant={
                  msg.role === 'user' ? 'info' : msg.role === 'system' ? 'danger' : 'success'
                }>
                  {msg.role === 'user' ? '用户' : msg.role === 'system' ? '系统' : 'Agent'}
                </Badge>
                <span className={styles.timestamp}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p className="mt-2 text-[13px] text-[var(--gw-text-primary)]">
                {msg.content}
              </p>

              {/* Tool Call */}
              {msg.toolCall && (
                <details
                  className={styles.toolCall}
                  open={msg.toolCall.status === 'running'}
                >
                  <summary className="cursor-pointer py-1">
                    <span>
                      {msg.toolCall.status === 'running' ? (
                        <span className={styles.runningIndicator}>
                          <span className={styles.spinner} /> 运行中: {msg.toolCall.toolName}
                        </span>
                      ) : msg.toolCall.status === 'failed' ? (
                        <span className={styles.failedIndicator}>
                          <AlertCircle className="inline h-3.5 w-3.5" /> 失败: {msg.toolCall.toolName}
                        </span>
                      ) : (
                        <span>
                          <Terminal className="inline h-3.5 w-3.5" /> 工具调用: {msg.toolCall.toolName}
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
                    <Badge variant={
                      msg.approval.riskLevel === 'critical' ? 'danger' :
                      msg.approval.riskLevel === 'high' ? 'warning' :
                      msg.approval.riskLevel === 'medium' ? 'warning' : 'info'
                    }>
                      {msg.approval.riskLevel}
                    </Badge>
                    <span className={styles.approvalTitle}>{msg.approval.title}</span>
                  </div>
                  <p className={styles.approvalDesc}>{msg.approval.description}</p>
                  <div className={styles.approvalActions}>
                    <Badge variant="success">允许一次</Badge>
                    <Badge variant="info">允许本次任务</Badge>
                    <Badge variant="danger">拒绝</Badge>
                    <Badge variant="default">记住选择</Badge>
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
