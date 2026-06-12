// GeoWork GeoComposer - Main composer with all selector sub-components

import { useState } from 'react'
import {
  Play,
  Inbox,
  Zap,
  Code,
  FlaskConical,
} from 'lucide-react'
import useTaskStore from '../../../stores/taskStore'
import useChatStore from '../../../stores/chatStore'
import useShellStore from '../../../stores/shellStore'
import type { ChatMessage } from '../../../types/chat'
import { Button } from '../../ui/button'
import { Textarea } from '../../ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { Badge } from '../../ui/badge'
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

export function GeoComposer() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<TaskMode>('Analysis')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])

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
      <div className={styles.topBar}>
        <TaskModeSelector value={mode} onChange={setMode} />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <Code size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>查看脚本</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <FlaskConical size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>运行分析</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className={styles.selectorRow}>
        <PermissionSelector />
        <ModelSelector />
        <SkillPickerButton selectedSkillIds={skillIds} onToggle={handleToggleSkill} />
        <TemplateSelector value={template} onChange={setTemplate} />
      </div>

      <div className={styles.controlsRow}>
        <StrengthSelector value={strength} onChange={setStrength} />
        <SpeedSelector value={speed} onChange={setSpeed} />
      </div>

      <div
        className={styles.dropZone}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files).map(f => f.name)
          setAttachments(files)
        }}
      >
        <Inbox size={32} className="text-[var(--gw-accent)] mb-2" />
        <p className="text-[13px] text-[var(--gw-text-secondary)]">拖拽文件到此处，或点击上传</p>
        <p className="text-[11px] text-[var(--gw-text-tertiary)]">
          支持 .geojson, .shp, .tif, .csv, .py, .ipynb 等文件
        </p>
      </div>

      {attachments.length > 0 && (
        <div className={styles.attachments}>
          {attachments.map((name, i) => (
            <Badge key={i} variant="outline" className="gap-1">
              {name}
              <button
                className="ml-1 text-[var(--gw-text-tertiary)] hover:text-[var(--gw-text)]"
                onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
              >
                x
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Textarea
        className={styles.textarea}
        placeholder="描述你的地理遥感任务，例如：请帮我运行 NDVI 分析，使用 Sentinel-2 数据生成植被指数地图和报告"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
      />

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm">
                <Zap size={14} />
                快捷执行
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ctrl+Enter 发送</TooltipContent>
          </Tooltip>
        </div>

        <Button
          variant="primary"
          loading={isSubmitting || isLoading}
          disabled={!prompt.trim()}
          onClick={handleSubmit}
        >
          <Play size={14} />
          创建并执行任务
        </Button>
      </div>
    </div>
  )
}

export default GeoComposer
