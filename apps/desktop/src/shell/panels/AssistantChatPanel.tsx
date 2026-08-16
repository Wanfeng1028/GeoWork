/**
 * AssistantChatPanel.tsx
 *
 * 辅助对话面板组件（集成到右侧工作台）
 * - 纯面板式聊天界面，无拟人化元素
 * - 扁平化消息流（用户靠右/AI靠左，无头像气泡）
 * - 支持 Markdown 渲染
 * - 保留完整对话逻辑：API调用、SSE事件流、上下文继承
 * - 底部输入框支持多行、Enter发送/Shift+Enter换行
 * - 状态栏显示模型信息与Token用量
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Tag, Tooltip, theme } from 'antd'
import { Send, Link, Plus, Square, Lightbulb } from 'lucide-react'
import { getCoreConversationId } from '../../pages/NewTask/components/streamAdapters'
import { getConversation } from '../../pages/NewTask/components/conversationStorage'
import { MarkdownStream } from '../../pages/NewTask/components/MarkdownStream'
import { coreFetch, coreEventSource } from '../../shared/api/coreApi'
import styles from './AssistantChatPanel.module.css'

/**
 * 将前端本地会话 id 解析为 Go Core 端会话 id。
 * 优先查 streamAdapters 的内存缓存，其次查 localStorage 持久化的映射。
 */
function resolveCoreConvId(localId?: string | null): string | undefined {
  if (!localId) return undefined
  return getCoreConversationId(localId) ?? getConversation(localId)?.coreConversationId
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

interface AssistantChatPanelProps {
  /** 会话唯一ID，用于区分多个独立对话Tab */
  sessionId: string
  /** 当前主对话的 Core 会话 id；存在时悬浮对话会继承其记忆。 */
  parentConversationId?: string | null
}

export function AssistantChatPanel({ sessionId, parentConversationId }: AssistantChatPanelProps) {
  const { token } = theme.useToken()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [modelInfo] = useState({
    provider: 'moonshotai',
    model: 'kimi-k3-free',
    tokenUsage: 0,
    maxTokens: 128000,
  })

  /** 子对话对应的 Core 会话 id（首次发送时按 parentId 创建并缓存）。 */
  const childConvIdRef = useRef<string | null>(null)
  /** 关联的 parent id 快照，parent 切换时重置子对话缓存。 */
  const lastParentRef = useRef<string | null | undefined>(parentConversationId)
  /** stepId → 标题缓存：step_done 事件不含 title，需从 step_start 缓存中查找。 */
  const stepTitleCacheRef = useRef<Map<string, string>>(new Map())
  const bodyRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* parent 切换时清空子对话缓存与历史，保证继承的是最新主对话 */
  useEffect(() => {
    if (lastParentRef.current !== parentConversationId) {
      lastParentRef.current = parentConversationId
      childConvIdRef.current = null
      setMessages([])
    }
  }, [parentConversationId, sessionId])

  /* sessionId 切换时重置状态（新建Tab或切换Tab） */
  useEffect(() => {
    childConvIdRef.current = null
    lastParentRef.current = parentConversationId
    setMessages([])
    setInput('')
    setSending(false)
    stepTitleCacheRef.current.clear()
    abortRef.current?.abort()
  }, [sessionId])

  /* 自动滚动到底部 */
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages])

  /* 组件卸载时中断进行中的 SSE */
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    const controller = new AbortController()
    abortRef.current = controller
    stepTitleCacheRef.current.clear()

    try {
      // 首次发送：创建带 parentId 的子对话（继承父记忆）
      if (!childConvIdRef.current) {
        const coreParentId = resolveCoreConvId(parentConversationId) ?? ''
        const createRes = await coreFetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'default',
            title: text.slice(0, 40) || '辅助对话',
            mode: 'Work',
            parentId: coreParentId,
          }),
          signal: controller.signal,
        })
        if (!createRes.ok) throw new Error(`创建子对话失败: HTTP ${createRes.status}`)
        const conv = (await createRes.json()) as { id: string }
        childConvIdRef.current = conv.id
      }
      const convId = childConvIdRef.current

      // 发送消息触发 orchestrator
      const msgRes = await coreFetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, mode: 'Work' }),
        signal: controller.signal,
      })
      if (!msgRes.ok) throw new Error(`发送消息失败: HTTP ${msgRes.status}`)
      const msgData = (await msgRes.json()) as { runId?: string; error?: string }
      if (msgData.error) throw new Error(msgData.error)

      // 订阅 SSE 事件流
      await new Promise<void>((resolve) => {
        if (controller.signal.aborted) {
          resolve()
          return
        }
        const es = coreEventSource(`/api/conversations/${convId}/events`)
        let resolved = false
        const assistantId = `a_${Date.now()}`
        let assistantContent = ''
        const finish = () => {
          if (resolved) return
          resolved = true
          es.close()
          resolve()
        }

        controller.signal.addEventListener('abort', finish)

        const parse = (
          e: MessageEvent,
        ): { type: string; data?: Record<string, unknown>; error?: string; message?: string } => {
          try {
            return JSON.parse(e.data) as {
              type: string
              data?: Record<string, unknown>
              error?: string
              message?: string
            }
          } catch {
            return { type: 'unknown' }
          }
        }

        // step_start：缓存 stepId → title
        es.addEventListener('step_start', (e) => {
          const evt = parse(e as MessageEvent)
          const d = evt.data ?? {}
          const stepId = String(d.stepId ?? '')
          const title = String(d.title ?? d.tool ?? '步骤')
          if (stepId) {
            stepTitleCacheRef.current.set(stepId, title)
          }
        })

        // step_done：累积步骤摘要
        es.addEventListener('step_done', (e) => {
          const evt = parse(e as MessageEvent)
          const d = evt.data ?? {}
          const stepId = String(d.stepId ?? '')
          const title = stepTitleCacheRef.current.get(stepId) ?? '步骤'
          assistantContent += `✅ ${title}\n`
          setMessages((prev) =>
            prev.some((m) => m.id === assistantId)
              ? prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
              : [
                  ...prev,
                  { id: assistantId, role: 'assistant' as const, content: assistantContent },
                ],
          )
        })

        // text_delta：累积文本输出
        es.addEventListener('text_delta', (e) => {
          const evt = parse(e as MessageEvent)
          const d = evt.data ?? {}
          const delta = String(d.delta ?? d.content ?? '')
          if (delta) {
            assistantContent += delta
            setMessages((prev) =>
              prev.some((m) => m.id === assistantId)
                ? prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
                : [
                    ...prev,
                    { id: assistantId, role: 'assistant' as const, content: assistantContent },
                  ],
            )
          }
        })

        // done：结束流式
        es.addEventListener('done', () => {
          if (!assistantContent) {
            assistantContent = '✅ 执行完成'
            setMessages((prev) =>
              prev.some((m) => m.id === assistantId)
                ? prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
                : [
                    ...prev,
                    { id: assistantId, role: 'assistant' as const, content: assistantContent },
                  ],
            )
          }
          finish()
        })

        // error：服务端错误事件
        es.addEventListener('error', (e) => {
          if (controller.signal.aborted) {
            finish()
            return
          }
          const me = e as MessageEvent
          if (me && typeof me.data === 'string') {
            const evt = parse(me)
            setMessages((prev) => [
              ...prev,
              {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: evt.error || evt.message || '执行失败',
                error: true,
              },
            ])
          } else if (!resolved) {
            setMessages((prev) => [
              ...prev,
              {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: '与 GeoWork Core 的连接中断',
                error: true,
              },
            ])
          }
          finish()
        })
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const errorMsg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, role: 'assistant', content: errorMsg, error: true },
      ])
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }, [input, sending, parentConversationId])

  const inheritable = !!resolveCoreConvId(parentConversationId)
  const tokenPercent = Math.min(100, Math.round((modelInfo.tokenUsage / modelInfo.maxTokens) * 100))

  return (
    <div
      className={styles.panel}
      style={
        {
          '--border-color': token.colorBorderSecondary,
          '--bg-container': token.colorBgContainer,
          '--bg-layout': token.colorBgLayout,
          '--bg-fill': token.colorFillQuaternary,
          '--bg-fill-tertiary': token.colorFillTertiary,
          '--text': token.colorText,
          '--text-secondary': token.colorTextSecondary,
          '--text-tertiary': token.colorTextTertiary,
          '--accent-bg': token.colorPrimaryBg,
          '--accent-text': token.colorPrimaryText,
          '--accent': token.colorPrimary,
          '--error-text': token.colorError,
        } as React.CSSProperties
      }
    >
      {/* 消息列表区域 */}
      <div className={styles.body} ref={bodyRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Lightbulb />
            </div>
            <div className={styles.emptyTitle}>有什么可以帮你的？</div>
            <div className={styles.emptyDesc}>
              {inheritable ? (
                <>
                  已继承当前主对话的<span className={styles.emptyHighlight}>上下文与记忆</span>，
                  可直接在此进行追问或独立对话。
                </>
              ) : (
                <>可独立进行辅助对话，支持自然语言提问。</>
              )}
            </div>
            {inheritable && (
              <Tag icon={<Link />} color="processing" className={styles.inheritTag}>
                已继承上下文
              </Tag>
            )}
            <div className={styles.suggestions}>
              <button
                type="button"
                className={styles.suggestionBtn}
                onClick={() => setInput('帮我分析一下这段代码的问题')}
              >
                🔍 帮我分析一下这段代码的问题
              </button>
              <button
                type="button"
                className={styles.suggestionBtn}
                onClick={() => setInput('解释一下当前任务的执行逻辑')}
              >
                📖 解释一下当前任务的执行逻辑
              </button>
              <button
                type="button"
                className={styles.suggestionBtn}
                onClick={() => setInput('优化以下方案的可行性')}
              >
                ⚡ 优化以下方案的可行性
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.message} ${
                  m.error
                    ? styles.messageError
                    : m.role === 'user'
                      ? styles.messageUser
                      : styles.messageAssistant
                }`}
              >
                {m.role === 'user' ? (
                  <div className={styles.messageBubble}>
                    <span className={styles.messageContentText}>{m.content}</span>
                  </div>
                ) : m.error ? (
                  <div className={styles.messageErrorContent}>{m.content}</div>
                ) : (
                  <div className={styles.messageMarkdown}>
                    <MarkdownStream content={m.content} />
                  </div>
                )}
              </div>
            ))}
            {sending && messages[messages.length - 1]?.role === 'user' && (
              <div className={`${styles.message} ${styles.messageAssistant}`}>
                <div className={styles.messageBubble}>
                  <span className={styles.typingDots}>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className={styles.inputWrap}>
        <div className={styles.inputArea}>
          <Input.TextArea
            ref={inputRef as any}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="向我提问，使用 @ 添加上下文，使用 / 选择命令或能力"
            autoSize={{ minRows: 1, maxRows: 6 }}
            className={styles.textarea}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={sending}
          />
          <div className={styles.inputActions}>
            <Tooltip title="@ 添加上下文">
              <Button
                type="text"
                size="small"
                icon={<Plus />}
                className={styles.ctxBtn}
                disabled={sending}
              />
            </Tooltip>
            {sending ? (
              <Tooltip title="停止生成">
                <Button
                  type="text"
                  size="small"
                  icon={<Square />}
                  onClick={handleStop}
                  className={styles.stopBtn}
                />
              </Tooltip>
            ) : (
              <Tooltip title="发送 (Enter)">
                <Button
                  type="primary"
                  size="small"
                  icon={<Send />}
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={styles.sendBtn}
                />
              </Tooltip>
            )}
          </div>
        </div>

        {/* 状态栏 */}
        <div className={styles.statusBar}>
          <span className={styles.statusItem}>
            <Tag color="default" bordered={false} className={styles.modelTag}>
              {modelInfo.provider}/{modelInfo.model}
            </Tag>
          </span>
          <span className={styles.statusItem}>
            <span className={styles.tokenBar}>
              <span
                className={styles.tokenBarFill}
                style={{ width: `${tokenPercent}%`, background: token.colorPrimary }}
              />
            </span>
            <span className={styles.tokenText}>
              {modelInfo.tokenUsage.toLocaleString()}/{modelInfo.maxTokens.toLocaleString()} tokens
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
