// GeoWork GeoComposer - Wired to taskStore

import { useState } from 'react'
import { Button, Select, Space, Tooltip, Upload } from 'antd'
import {
  PlayCircleOutlined,
  CodeOutlined,
  ExperimentOutlined,
  SettingOutlined,
  InboxOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import useTaskStore from '../../../stores/taskStore'
import useChatStore from '../../../stores/chatStore'
import useShellStore from '../../../stores/shellStore'
import type { ChatMessage } from '../../../types/chat'
import styles from './GeoComposer.module.scss'

const { Dragger } = Upload

export function GeoComposer() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('Analysis')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const { createTask, isLoading } = useTaskStore()
  const { addMessage } = useChatStore()
  const { activeMode } = useShellStore()

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
        permissionLevel: 'limited',
        model: 'default',
        strength: 'normal',
        template: 'default',
        input: prompt,
        attachments: attachments[0],
      })

      // Clear input
      setPrompt('')
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
      <div className={styles.toolbar}>
        <Select
          value={mode}
          onChange={setMode}
          size="small"
          className={styles.modeSelect}
          options={[
            { label: 'Research', value: 'Research' },
            { label: 'Data', value: 'Data' },
            { label: 'GeoCode', value: 'GeoCode' },
            { label: 'Analysis', value: 'Analysis' },
            { label: 'Write', value: 'Write' }
          ]}
        />

        <Space size="small">
          <Tooltip title="查看脚本">
            <Button size="small" icon={<CodeOutlined />} />
          </Tooltip>
          <Tooltip title="运行分析">
            <Button size="small" icon={<ExperimentOutlined />} />
          </Tooltip>
        </Space>
      </div>

      <Dragger
        className={styles.dropZone}
        accept=".txt,.md,.py,.ipynb,.geojson,.shp,.tif,.tiff,.csv,.json"
        multiple
        showUploadList={false}
        customRequest={() => {}}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ color: 'var(--gw-accent-primary)' }} />
        </p>
        <p className="ant-upload-text">拖拽文件到此处，或点击上传</p>
        <p className="ant-upload-hint">
          支持 .geojson, .shp, .tif, .csv, .py, .ipynb 等文件
        </p>
      </Dragger>

      <textarea
        className={styles.textarea}
        placeholder="描述你的地理遥感任务，例如：请帮我运行 NDVI 分析，使用 Sentinel-2 数据生成植被指数地图和报告"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
      />

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
