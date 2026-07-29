import { useState } from 'react'
import { Plus, Bot, Mic, ArrowUp, FileText } from 'lucide-react'
import useTaskStore from '../../../../stores/taskStore'
import useChatStore from '../../../../stores/chatStore'
import type { ChatMessage } from '../../../../types/chat'
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
      {hasTinyPreview && (
        <div className={styles.tinyPreview} title="已附加文件">
          <FileText size={14} />
        </div>
      )}

      <textarea
        className={styles.textarea}
        placeholder="描述任务，/ 快捷调用，@ 添加上下文"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />

      <div className={styles.composerBar}>
        <div className={styles.tools}>
          <button className={styles.round} title="添加上下文" onClick={() => setHasTinyPreview((v) => !v)}>
            <Plus size={17} />
          </button>
          <button className={styles.round} title="技能">
            <Bot size={15} />
          </button>
          <button className={styles.toolPill} title="模式">
            <span className={styles.modelDot} />
            通用
          </button>
        </div>

        <div className={styles.modelTools}>
          <button className={styles.model} title="模型">
            Qwen3.7-Max
          </button>
          <button className={styles.mic} title="语音输入">
            <Mic size={16} />
          </button>
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
