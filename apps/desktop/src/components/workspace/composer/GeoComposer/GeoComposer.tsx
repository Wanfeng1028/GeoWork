// GeoWork home composer

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AudioLines,
  Cloud,
  FilePlus,
  Lock,
  Send,
  Wrench,
} from 'lucide-react'
import useShellStore from '../../../../stores/shellStore'
import useTaskStore from '../../../../stores/taskStore'
import useChatStore from '../../../../stores/chatStore'
import type { ChatMessage } from '../../../../types/chat'
import styles from './GeoComposer.module.scss'

const modes = [
  ['general', '通用'],
  ['map', '地图'],
  ['gee', 'GEE'],
  ['paper', '论文'],
  ['automation', '自动化'],
] as const

export function GeoComposer() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [permission, setPermission] = useState('limited')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { activeMode, setActiveMode, composerFocusToken, openRightDock, openBottomDock } = useShellStore()
  const { createTask } = useTaskStore()
  const { addMessage } = useChatStore()

  useEffect(() => {
    if (composerFocusToken > 0) {
      textareaRef.current?.focus()
    }
  }, [composerFocusToken])

  const submit = async () => {
    const input = prompt.trim()
    if (!input || isSubmitting) return

    setIsSubmitting(true)
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      type: 'text',
      content: input,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)

    try {
      await createTask({
        workspaceId: '',
        mode: activeMode,
        permissionLevel: permission,
        model,
        input,
        attachments: [],
        skills: [],
      })
      setPrompt('')
      openRightDock('task')
      openBottomDock('events')
      toast.success('任务已创建')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '任务创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.composer}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="描述你的地理遥感任务，例如：基于 Sentinel-2 计算某区域 NDVI，并生成地图和报告"
      />

      <div className={styles.modeRow}>
        {modes.map(([value, label]) => (
          <button
            key={value}
            className={activeMode === value ? styles.modeActive : ''}
            onClick={() => setActiveMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.tools}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const count = event.target.files?.length ?? 0
              if (count > 0) toast.info(`已选择 ${count} 个文件`)
            }}
          />
          <button onClick={() => fileInputRef.current?.click()} title="添加文件">
            <FilePlus />
            <span>添加文件</span>
          </button>
          <button onClick={() => toast.info('技能选择器开发中')} title="技能">
            <Wrench />
            <span>技能</span>
          </button>
          <button onClick={() => toast.info('权限已切换')} title="权限">
            <Lock />
            <select value={permission} onChange={(event) => setPermission(event.target.value)}>
              <option value="limited">受限</option>
              <option value="ask_every_time">询问</option>
              <option value="read_only">只读</option>
            </select>
          </button>
        </div>

        <div className={styles.actions}>
          <label className={styles.modelSelect}>
            <Cloud />
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="gpt-4o">GPT-4o</option>
              <option value="qwen-max">Qwen Max</option>
              <option value="local">Local</option>
            </select>
          </label>
          <button className={styles.iconBtn} onClick={() => toast.warning('语音输入开发中')} title="语音输入">
            <AudioLines />
          </button>
          <button className={styles.sendBtn} onClick={submit} disabled={!prompt.trim() || isSubmitting}>
            <Send />
            <span>{isSubmitting ? '发送中' : '发送'}</span>
          </button>
        </div>
      </div>
    </section>
  )
}

export default GeoComposer
