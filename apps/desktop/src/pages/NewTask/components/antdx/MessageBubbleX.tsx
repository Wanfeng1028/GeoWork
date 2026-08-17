import { memo, useMemo } from 'react'
import { Bubble, ThoughtChain } from '@ant-design/x'
import type { ThoughtChainItemType } from '@ant-design/x'
import { Bot, User } from 'lucide-react'
import type { ConversationMessage, ThinkingStep } from '../../../../shared/session/types'
import { MarkdownStream } from '../MarkdownStream'
import { ToolCallTimeline } from '../ToolCallTimeline'
import { DiffViewer } from '../DiffViewer'
import { WorkflowRunCard } from '../WorkflowRunCard'
import type { RunStatus } from '../../../../shared/session/types'
import styles from './antdx.module.css'

export interface MessageBubbleXProps {
  data: ConversationMessage
  /** 当前 runStatus，仅最后一条 assistant message 使用 */
  runStatus?: RunStatus
  onConfirmRun?: () => void
  onAdjustPlan?: () => void
  /** 是否是最后一条 assistant message */
  isLastAssistant?: boolean
}

/* ThinkingStep → ThoughtChain 节点：未结束的步骤 loading 态 + 可折叠内容 */
function toThoughtChainItems(steps: ThinkingStep[]): ThoughtChainItemType[] {
  return steps.map((step) => ({
    key: step.id,
    title: step.title,
    description: step.kind === 'state' ? step.content : undefined,
    content: step.kind === 'reasoning' ? step.content : undefined,
    collapsible: step.kind === 'reasoning' && step.content.length > 0,
    status: step.endedAt ? 'success' : 'loading',
  }))
}

/**
 * antdx 单条消息（doc/26）：antd-x Bubble + ThoughtChain 组合。
 * 数据契约与自研 ConversationMessageView 完全一致（同一 ConversationMessage），
 * 仅渲染层不同；复用 MarkdownStream / ToolCallTimeline / DiffViewer / WorkflowRunCard。
 */
export const MessageBubbleX = memo(function MessageBubbleX({
  data,
  runStatus,
  onConfirmRun,
  onAdjustPlan,
  isLastAssistant,
}: MessageBubbleXProps) {
  const isUser = data.role === 'user'
  const streaming = data.status === 'streaming'

  const thoughtItems = useMemo(
    () => (data.thinkingSteps?.length ? toThoughtChainItems(data.thinkingSteps) : null),
    [data.thinkingSteps],
  )

  if (isUser) {
    return (
      <div className={`${styles.bubbleRow} ${styles.bubbleRowUser}`}>
        <Bubble
          placement="end"
          variant="filled"
          content={data.content}
          avatar={<User size={14} />}
        />
      </div>
    )
  }

  return (
    <div className={`${styles.bubbleRow} ${styles.bubbleRowAssistant}`}>
      {/* 思考链（A3 数据的 X 呈现）：streaming 时默认展开最新节点 */}
      {thoughtItems && (
        <div className={styles.thoughtChainWrap}>
          <ThoughtChain
            items={thoughtItems}
            defaultExpandedKeys={
              streaming ? [thoughtItems[thoughtItems.length - 1].key!] : undefined
            }
          />
        </div>
      )}

      <Bubble
        placement="start"
        variant="borderless"
        loading={streaming && !data.content}
        content={data.content}
        contentRender={(content) => <MarkdownStream content={String(content)} />}
        avatar={<Bot size={14} />}
      />

      {/* 工具日志 / 文件变更 / 工作流卡片：直接复用自研组件 */}
      {(data.toolCalls?.length || data.fileDiffs?.length || (isLastAssistant && data.workflow)) && (
        <div className={styles.extras}>
          {data.toolCalls && data.toolCalls.length > 0 && (
            <ToolCallTimeline toolCalls={data.toolCalls} />
          )}
          {data.fileDiffs && data.fileDiffs.length > 0 && <DiffViewer fileDiffs={data.fileDiffs} />}
          {isLastAssistant && data.workflow && data.workflow.length > 0 && runStatus && (
            <WorkflowRunCard
              workflow={data.workflow}
              runStatus={runStatus}
              onConfirmRun={onConfirmRun ?? (() => {})}
              onAdjustPlan={onAdjustPlan ?? (() => {})}
            />
          )}
        </div>
      )}
    </div>
  )
})
