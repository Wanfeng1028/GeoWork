// GeoWork GeoComposer — 1:1 port of QoderWorkCopy's qw-composer.
// Business logic (createTask / drop / Ctrl+Enter) preserved, but the visual
// layout matches QoderWorkCopy exactly: fixed-size card, tiny-preview,
// textarea, composer-bar of round + tool-pill + mic + send.

import { useState } from 'react'
import { Plus, Bot, Mic, ArrowUp, FileText } from 'lucide-react'
import useTaskStore from '../../../stores/taskStore'
import useChatStore from '../../../stores/chatStore'
import type { ChatMessage } from '../../../types/chat'
import styles from './GeoComposer.module.scss'

export function GeoComposer() {
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasTinyPreview, setHasTinyPreview] = useState(false)

  const { createTask, isLoading } = useTaskStore()
  const { addMessage } = useChatStore()

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting) return
    setIsSubmitting(true)

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      type: 'text',
      content: prompt,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)

    try {
      await createTask({
        workspaceId: '',
        mode: 'analysis',
        permissionLevel: 'limited',
        model: 'qwen',
        strength: 'normal',
        template: 'default',
        input: prompt,
        attachments: [],
        skills: [],
        speed: 'balanced',
      })
      setPrompt('')
      setHasTinyPreview(false)
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) setHasTinyPreview(true)
  }

  return (
    <section className={`${styles.composer} ${styles.glow}`}>
      {/* Tiny preview slot (top-left, hidden in dark mode via CSS) */}
      {hasTinyPreview && (
        <div className={styles.tinyPreview} title="已附加文件">
          <FileText size={14} />
        </div>
      )}

      {/* Textarea */}
      <textarea
        className={styles.textarea}
        placeholder="问点什么，或描述任务…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />

      {/* Composer bar */}
      <div className={styles.composerBar}>
        <div className={styles.tools}>
          {/* Attach (round, 32px) */}
          <button
            className={styles.round}
            title="添加上下文"
            onClick={() => setHasTinyPreview((v) => !v)}
          >
            <Plus size={17} />
          </button>
          {/* Skill (round, 32px) */}
          <button className={styles.round} title="技能">
            <Bot size={15} />
          </button>
          {/* Model pill (32px tall, soft bg) */}
          <button className={styles.toolPill} title="模型">
            <span className={styles.modelDot} />
            Qwen
          </button>
        </div>

        <div className={styles.modelTools}>
          {/* Mic (round, 32px) */}
          <button className={styles.round} title="语音输入">
            <Mic size={16} />
          </button>
          {/* Send (32px circle, dark fill) */}
          <button
            className={styles.send}
            title="发送 (Ctrl+Enter)"
            disabled={!prompt.trim() || isSubmitting || isLoading}
            onClick={handleSubmit}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}

export default GeoComposer
