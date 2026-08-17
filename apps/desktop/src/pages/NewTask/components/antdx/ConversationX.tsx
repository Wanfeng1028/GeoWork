import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ConversationMessage, RunStatus } from '../../../../shared/session/types'
import type { CoreApprovalRequest } from '../../../../shared/api/types'
import { ApprovalCard } from '../ApprovalCard'
import { MessageBubbleX } from './MessageBubbleX'
import styles from './antdx.module.css'

export interface ConversationXProps {
  messages: readonly ConversationMessage[]
  runStatus: RunStatus
  /** A1：governor 待审批请求（存在时列表上方渲染审批卡片） */
  pendingApproval?: CoreApprovalRequest
  onResolveApproval: (approved: boolean, reason?: string) => Promise<void>
  onConfirmRun: () => void
  onAdjustPlan: () => void
}

/**
 * antdx 会话消息列表（doc/26）：antd-x Bubble 渲染 + 虚拟滚动。
 *
 * Bubble.List 无内置虚拟化（仅 autoScroll），为保住 A5 的长会话性能，
 * 这里自持 @tanstack/react-virtual 虚拟器、逐项渲染 MessageBubbleX，
 * 贴底跟随逻辑与自研分支一致（距底 <80px 才自动滚动）。
 */
export function ConversationX({
  messages,
  runStatus,
  pendingApproval,
  onResolveApproval,
  onConfirmRun,
  onAdjustPlan,
}: ConversationXProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => listRef.current,
    // 二期调优：按角色分层预估首屏高度（measureElement 实测后自动修正）——
    // user 单气泡约 72px；assistant 含思考链/工具日志/卡片，约 220px
    estimateSize: (i) => (messages[i].role === 'user' ? 72 : 220),
    overscan: 6,
    getItemKey: (i) => messages[i].id,
  })
  const totalSize = virtualizer.getTotalSize()

  const stickToBottomRef = useRef(true)
  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    if (!stickToBottomRef.current || messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
  }, [messages, totalSize, virtualizer])

  /* 最后一条 assistant 消息索引（挂 workflow 卡片/确认回调用） */
  let lastAssistantIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIdx = i
      break
    }
  }

  return (
    <div className={styles.conversationRoot}>
      {/* A1 审批卡片：与自研分支同一组件、同一数据源 */}
      {pendingApproval && <ApprovalCard approval={pendingApproval} onResolve={onResolveApproval} />}

      <div className={styles.messageList} ref={listRef} onScroll={handleScroll}>
        <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const msg = messages[vItem.index]
            const isLastAssistant = vItem.index === lastAssistantIdx
            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vItem.start}px)`,
                  paddingBottom: 8,
                }}
              >
                <MessageBubbleX
                  data={msg}
                  runStatus={isLastAssistant ? runStatus : undefined}
                  onConfirmRun={isLastAssistant ? onConfirmRun : undefined}
                  onAdjustPlan={isLastAssistant ? onAdjustPlan : undefined}
                  isLastAssistant={isLastAssistant}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
