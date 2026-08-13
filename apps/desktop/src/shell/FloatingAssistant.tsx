/**
 * FloatingAssistant.tsx
 *
 * 悬浮辅助对话组件：
 * - 通过右下角 FloatButton 唤起一个可收起的悬浮聊天面板
 * - 打开时若存在 parentConversationId（当前主对话），则首次发送消息时
 *   会以 parentId 创建子对话，继承父对话记忆（后端注入）
 * - 直接对接 Go Core 的 /api/conversations 接口与 SSE 事件流
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, FloatButton, Input, Tag, Tooltip, theme } from 'antd'
import {
  Headphones,
  X,
  Send,
  Link,
} from 'lucide-react'
import { getCoreConversationId } from '../pages/NewTask/components/streamAdapters'
import { getConversation } from '../pages/NewTask/components/conversationStorage'
import styles from './FloatingAssistant.module.css'

const CORE_BASE_URL =
  (import.meta as unknown as { env?: { VITE_CORE_API_URL?: string } }).env?.VITE_CORE_API_URL ??
  'http://127.0.0.1:8765'

/**
 * 将前端本地会话 id 解析为 Go Core 端会话 id。
 * 优先查 streamAdapters 的内存缓存，其次查 localStorage 持久化的映射。
 */
function resolveCoreConvId(localId?: string | null): string | undefined {
  if (!localId) return undefined
  return getCoreConversationId(localId) ?? getConversation(localId)?.coreConversationId
}

interface FloatingMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

interface FloatingAssistantProps {
  /** 当前主对话的 Core 会话 id；存在时悬浮对话会继承其记忆。 */
  parentConversationId?: string | null
}

export function FloatingAssistant({ parentConversationId }: FloatingAssistantProps) {
  const { token } = theme.useToken()

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<FloatingMessage[]>([])

  /** 悬浮子对话对应的 Core 会话 id（首次发送时按 parentId 创建并缓存）。 */
  const childConvIdRef = useRef<string | null>(null)
  /** 关联的 parent id 快照，parent 切换时重置子对话缓存。 */
  const lastParentRef = useRef<string | null | undefined>(parentConversationId)
  /** stepId → 标题缓存：step_done 事件不含 title，需从 step_start 缓存中查找。 */
  const stepTitleCacheRef = useRef<Map<string, string>>(new Map())
  const bodyRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* parent 切换时清空子对话缓存与历史，保证继承的是最新主对话 */
  useEffect(() => {
    if (lastParentRef.current !== parentConversationId) {
      lastParentRef.current = parentConversationId
      childConvIdRef.current = null
      setMessages([])
    }
  }, [parentConversationId])

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

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: FloatingMessage = {
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
        // 将前端本地会话 id 解析为 Core 端会话 id 作为 parentId
        const coreParentId = resolveCoreConvId(parentConversationId) ?? ''
        const createRes = await fetch(`${CORE_BASE_URL}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'default',
            title: text.slice(0, 40) || '悬浮辅助',
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
      const msgRes = await fetch(`${CORE_BASE_URL}/api/conversations/${convId}/messages`, {
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
        const es = new EventSource(`${CORE_BASE_URL}/api/conversations/${convId}/events`)
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

        const parse = (e: MessageEvent): { type: string; data?: Record<string, unknown>; error?: string; message?: string } => {
          try {
            return JSON.parse(e.data) as { type: string; data?: Record<string, unknown>; error?: string; message?: string }
          } catch {
            return { type: 'unknown' }
          }
        }

        // step_start：缓存 stepId → title（step_done 事件不含 title 字段）
        es.addEventListener('step_start', (e) => {
          const evt = parse(e as MessageEvent)
          const d = evt.data ?? {}
          const stepId = String(d.stepId ?? '')
          const title = String(d.title ?? d.tool ?? '步骤')
          if (stepId) {
            stepTitleCacheRef.current.set(stepId, title)
          }
        })

        // step_done：用缓存的标题累积步骤摘要到 assistant 消息
        es.addEventListener('step_done', (e) => {
          const evt = parse(e as MessageEvent)
          const d = evt.data ?? {}
          const stepId = String(d.stepId ?? '')
          const title = stepTitleCacheRef.current.get(stepId) ?? '步骤'
          assistantContent += `✅ ${title}\n`
          setMessages((prev) =>
            prev.some((m) => m.id === assistantId)
              ? prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
              : [...prev, { id: assistantId, role: 'assistant' as const, content: assistantContent }],
          )
        })

        // done：结束流式
        es.addEventListener('done', () => {
          if (!assistantContent) {
            assistantContent = '✅ 执行完成'
            setMessages((prev) =>
              prev.some((m) => m.id === assistantId)
                ? prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
                : [...prev, { id: assistantId, role: 'assistant' as const, content: assistantContent }],
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
              { id: `err_${Date.now()}`, role: 'assistant', content: evt.error || evt.message || '执行失败', error: true },
            ])
          } else if (!resolved) {
            // 连接级错误（非 abort）
            setMessages((prev) => [
              ...prev,
              { id: `err_${Date.now()}`, role: 'assistant', content: '与 GeoWork Core 的连接中断', error: true },
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

  const cssVars = {
    '--border-color': token.colorBorderSecondary,
    '--bg-container': token.colorBgContainer,
    '--bg-layout': token.colorBgLayout,
    '--bg-fill': token.colorFillQuaternary,
    '--text': token.colorText,
    '--accent-bg': token.colorPrimaryBg,
    '--accent-text': token.colorPrimaryText,
    '--error-text': token.colorError,
  } as React.CSSProperties

  /* 仅当 Core 端会话 id 可解析时才显示"继承上下文"标签，避免误导 */
  const inheritable = !!resolveCoreConvId(parentConversationId)

  return (
    <>
      <FloatButton
        icon={<Headphones />}
        type="primary"
        tooltip="悬浮助手"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div className={styles.panel} style={cssVars}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>
              <Headphones />
              悬浮助手
              {inheritable && (
                <Tooltip title="继承当前主对话上下文">
                  <Tag icon={<Link />} color="processing" className={styles.inheritTag}>
                    继承上下文
                  </Tag>
                </Tooltip>
              )}
            </span>
            <Button
              type="text"
              size="small"
              icon={<X />}
              onClick={() => setOpen(false)}
            />
          </div>

          <div className={styles.body} ref={bodyRef}>
            {messages.length === 0 ? (
              <div className={styles.emptyHint}>
                在此进行微调式追问，{inheritable ? '将继承当前主对话的上下文与记忆。' : '可独立进行辅助对话。'}
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.msg} ${m.error ? styles.msgError : m.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>

          <div className={styles.inputArea}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入追问…"
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={sending}
            />
            <Button
              type="primary"
              icon={<Send />}
              loading={sending}
              onClick={handleSend}
              className={styles.sendBtn}
            />
          </div>
        </div>
      )}
    </>
  )
}
