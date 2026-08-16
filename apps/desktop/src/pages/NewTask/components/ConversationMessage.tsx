import { memo } from 'react'
import { App, Button, Tag, Typography, theme } from 'antd'
import { Copy, Zap, Bot, Globe } from 'lucide-react'
import type {
  ConversationMessage as ConversationMessageType,
  RunStatus,
  SelectedContextKind,
} from './conversationStorage'
import { MarkdownStream } from './MarkdownStream'
import { ThinkingPanel } from './ThinkingPanel'
import { DiffViewer } from './DiffViewer'
import { ToolCallTimeline } from './ToolCallTimeline'
import { WorkflowRunCard } from './WorkflowRunCard'
import styles from './ConversationMessage.module.css'

const { Text } = Typography

const CONTEXT_KIND_ICON: Record<SelectedContextKind, React.ReactNode> = {
  skill: <Zap />,
  expert: <Bot />,
  mcp: <Globe />,
}

const CONTEXT_KIND_LABEL: Record<SelectedContextKind, string> = {
  skill: '技能',
  expert: '专家',
  mcp: 'MCP',
}

interface ConversationMessageProps {
  data: ConversationMessageType
  /** 当前 runStatus，仅最后一条 assistant message 使用 */
  runStatus?: RunStatus
  onConfirmRun?: () => void
  onAdjustPlan?: () => void
  /** 是否是最后一条 assistant message */
  isLastAssistant?: boolean
}

/* memo：流式 delta 只重渲末条消息（Session 差分快照保证其余消息引用稳定） */
export const ConversationMessageView = memo(function ConversationMessageView({
  data,
  runStatus,
  onConfirmRun,
  onAdjustPlan,
  isLastAssistant,
}: ConversationMessageProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  const isUser = data.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(data.content).then(
      () => message.success('已复制回复内容'),
      () => message.warning('复制失败，请手动选择文本复制'),
    )
  }

  return (
    <div
      className={`${styles.messageRow} ${isUser ? styles.messageRowUser : styles.messageRowAssistant}`}
    >
      {/* 内容区：bubble + timeline + workflow 纵向排列 */}
      <div className={styles.contentColumn}>
        {/* ── 思考面板（A3：state_change / message 推理流，assistant 消息） ── */}
        {!isUser && data.thinkingSteps && data.thinkingSteps.length > 0 && (
          <ThinkingPanel
            thinkingSteps={data.thinkingSteps}
            streaming={data.status === 'streaming'}
          />
        )}

        {/* 消息气泡 */}
        <div
          className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}
          style={{
            background: isUser ? token.colorPrimary : token.colorFillQuaternary,
            color: isUser ? token.colorTextLightSolid : token.colorText,
            border: isUser ? 'none' : `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {isUser ? (
            <Text style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>{data.content}</Text>
          ) : (
            <>
              <MarkdownStream content={data.content} />
              {data.status === 'streaming' && (
                <span
                  className={styles.streamingCursor}
                  style={{ background: token.colorPrimary }}
                />
              )}
              {/* 复制按钮 */}
              {data.status !== 'streaming' && data.content && (
                <Button
                  type="text"
                  size="small"
                  icon={<Copy />}
                  className={styles.copyBtn}
                  onClick={handleCopy}
                />
              )}
            </>
          )}
        </div>

        {/* ── 用户消息上下文标签 ── */}
        {isUser && data.contexts && data.contexts.length > 0 && (
          <div className={styles.contextLabels}>
            {data.contexts.map((ctx) => (
              <Tag
                key={`${ctx.kind}-${ctx.id}`}
                icon={CONTEXT_KIND_ICON[ctx.kind]}
                style={{ fontSize: 11, lineHeight: '16px', margin: 0 }}
              >
                {CONTEXT_KIND_LABEL[ctx.kind]} {ctx.name}
              </Tag>
            ))}
          </div>
        )}

        {/* ── 工具调用日志（assistant 消息下方） ── */}
        {!isUser && data.toolCalls && data.toolCalls.length > 0 && (
          <ToolCallTimeline toolCalls={data.toolCalls} />
        )}

        {/* ── 文件变更（A4：diff.created unified diff 内联渲染） ── */}
        {!isUser && data.fileDiffs && data.fileDiffs.length > 0 && (
          <DiffViewer fileDiffs={data.fileDiffs} />
        )}

        {/* ── 工作流计划卡片（仅最后一条 assistant message） ── */}
        {!isUser && isLastAssistant && data.workflow && data.workflow.length > 0 && runStatus && (
          <WorkflowRunCard
            workflow={data.workflow}
            runStatus={runStatus}
            onConfirmRun={onConfirmRun ?? (() => {})}
            onAdjustPlan={onAdjustPlan ?? (() => {})}
          />
        )}
      </div>
    </div>
  )
})
