// GeoWork GeoComposer - Main composer with all selector sub-components
// Wired to taskStore, chatStore, and shellStore

import { useState } from 'react'
import { Button, Space, Upload, Tooltip } from 'antd'
import {
  PlayCircleOutlined,
  InboxOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import useTaskStore from '../../../stores/taskStore'
import useChatStore from '../../../stores/chatStore'
import useShellStore from '../../../stores/shellStore'
import type { ChatMessage } from '../../../types/chat'
import { PermissionSelector } from '../PermissionSelector/PermissionSelector'
import { ModelSelector } from '../ModelSelector/ModelSelector'
import { SkillPickerButton } from '../SkillPickerButton/SkillPickerButton'
import { TaskModeSelector } from '../TaskModeSelector/TaskModeSelector'
import type { TaskMode } from '../TaskModeSelector/TaskModeSelector'
import { TemplateSelector } from '../TemplateSelector/TemplateSelector'
import { StrengthSelector } from '../StrengthSelector/StrengthSelector'
import type { StrengthLevel } from '../StrengthSelector/StrengthSelector'
import { SpeedSelector } from '../SpeedSelector/SpeedSelector'
import type { SpeedLevel } from '../SpeedSelector/SpeedSelector'
import styles from './GeoComposer.module.scss'

const { Dragger } = Upload

export function GeoComposer() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<TaskMode>('Analysis')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])

  // Composer sub-state
  const [permissionLevel, setPermissionLevel] = useState<string>('limited')
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [template, setTemplate] = useState<string>('default')
  const [strength, setStrength] = useState<StrengthLevel>('normal')
  const [speed, setSpeed] = useState<SpeedLevel>('balanced')

  const { createTask, isLoading } = useTaskStore()
  const { addMessage } = useChatStore()
  const { activeMode } = useShellStore()

  const handleToggleSkill = (skillId: string) => {
    setSkillIds(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    )
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting) return

    setIsSubmitting(true)

    // Add user message to chat
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
        mode: mode.toLowerCase(),
        permissionLevel,
        model: 'gpt-4o',
        strength,
        template,
        input: prompt,
        attachments,
        skills: skillIds,
        speed,
      })

      // Clear input
      setPrompt('')
      setAttachments([])
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

  return (
    <div className={styles.composer}>
      {/* Top bar: mode + quick actions */}
      <div className={styles.topBar}>
        <TaskModeSelector value={mode} onChange={setMode} />

        <Space size="small">
          <Tooltip title="查看脚本">
            <Button size="small" icon={<CodeOutlined />} />
          </Tooltip>
          <Tooltip title="运行分析">
            <Button size="small" icon={<ExperimentOutlined />} />
          </Tooltip>
        </Space>
      </div>

      {/* Selector row */}
      <div className={styles.selectorRow}>
        <PermissionSelector />
        <ModelSelector />
        <SkillPickerButton selectedSkillIds={skillIds} onToggle={handleToggleSkill} />
        <TemplateSelector value={template} onChange={setTemplate} />
      </div>

      {/* Strength + Speed row */}
      <div className={styles.controlsRow}>
        <StrengthSelector value={strength} onChange={setStrength} />
        <SpeedSelector value={speed} onChange={setSpeed} />
      </div>

      {/* Drop zone */}
      <Dragger
        className={styles.dropZone}
        accept=".txt,.md,.py,.ipynb,.geojson,.shp,.tif,.tiff,.csv,.json"
        multiple
        showUploadList={false}
        customRequest={() => {}}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files).map(f => f.name)
          setAttachments(files)
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: 'var(--gw-accent-primary)' }} />
        </p>
        <p className="ant-upload-text">拖拽文件到此处，或点击上传</p>
        <p className="ant-upload-hint">
          支持 .geojson, .shp, .tif, .csv, .py, .ipynb 等文件
        </p>
      </Dragger>

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className={styles.attachments}>
          {attachments.map((name, i) => (
            <span key={i} className={styles.attachmentTag}>
              📎 {name}
              <button
                className={styles.attachmentRemove}
                onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        className={styles.textarea}
        placeholder="描述你的地理遥感任务，例如：请帮我运行 NDVI 分析，使用 Sentinel-2 数据生成植被指数地图和报告"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
      />

      {/* Footer */}
      <div className={styles.footer}>
        <Space className={styles.footerLeft}>
          <Tooltip title="Ctrl+Enter 发送">
            <Button size="small" icon={<ThunderboltOutlined />}>
              快捷执行
            </Button>
          </Tooltip>
        </Space>

        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          className={styles.primaryBtn}
          loading={isSubmitting || isLoading}
          disabled={!prompt.trim()}
          onClick={handleSubmit}
        >
          创建并执行任务
        </Button>
      </div>
    </div>
  )
}

export default GeoComposer
