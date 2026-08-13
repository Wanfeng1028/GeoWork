import { useRef, useState } from 'react'
import {
  App,
  Button,
  Dropdown,
  Input,
  Space,
  Tag,
  Tooltip,
  theme,
} from 'antd'
import {
  Plus,
  Send,
  AudioLines,
  Square,
  Zap,
  FolderOpen,
  Check,
  Globe,
  Bot,
  CloudUpload,
  Folder,
  Target,
  PieChart,
  FileText,
  Search,
  Network,
} from 'lucide-react'
import { ModelPicker } from './ModelPicker'
import { SelectedContextBar } from './SelectedContextBar'
import type { SelectedContextItem, SelectedContextKind } from './conversationStorage'
import type { ContextPickerType } from './ContextPickerModal'
import styles from './ChatComposer.module.css'

/* ── 常量 ── */

const MODE_OPTIONS = [
  { key: 'general', label: '通用 GIS', icon: <Globe />, desc: '通用地理信息系统任务' },
  { key: 'spatial', label: '空间分析', icon: <Target />, desc: '缓冲区、叠加、空间查询' },
  { key: 'cartography', label: '专题制图', icon: <PieChart />, desc: '生成专题地图和可视化' },
  { key: 'paper', label: '论文辅助', icon: <FileText />, desc: '学术论文写作辅助' },
  { key: 'query', label: '数据查询', icon: <Search />, desc: '属性与空间数据检索' },
  { key: 'remote-sensing', label: '遥感解译', icon: <Network />, desc: '遥感影像处理与解译' },
]

const ATTACH_ITEMS = [
  { key: 'skill', icon: <Zap />, label: '选择技能', msg: '技能选择面板后续接入' },
  { key: 'expert', icon: <Bot />, label: '选择专家', msg: '专家模式后续接入' },
  { key: 'mcp', icon: <Globe />, label: '连接 MCP', msg: 'MCP 工具连接后续接入' },
  { key: 'file', icon: <CloudUpload />, label: '选择文件', msg: '文件选择后续接入' },
  { key: 'folder', icon: <Folder />, label: '选择文件夹', msg: '文件夹选择后续接入' },
  { key: 'image', icon: <FolderOpen />, label: '上传图片', msg: '图片上传后续接入' },
]

/* File System Access API 类型 */
type GeoWorkDirectoryHandle = { kind: 'directory'; name: string }
type GeoWorkFileHandle = { kind: 'file'; name: string }
type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<GeoWorkDirectoryHandle>
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<GeoWorkFileHandle[]>
}

/* Web Speech API 类型 */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event & { error: string }) => void) | null
  onend: (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

/* ── Props ── */

interface ChatComposerProps {
  prompt: string
  onPromptChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  model: string
  onModelChange: (model: string) => void
  /** 是否处于对话态（影响最大宽度） */
  conversationMode?: boolean
  /** 输入框占位文案，由外部根据 workMode 传入 */
  placeholder?: string
  /** 上下文选择回调 */
  onOpenContextPicker?: (type: ContextPickerType) => void
  onPickDirectory?: () => void
  selectedContexts?: SelectedContextItem[]
  onRemoveContext?: (id: string, kind: SelectedContextKind) => void
  onClearContexts?: () => void
}

export function ChatComposer({
  prompt,
  onPromptChange,
  onSend,
  onStop,
  isStreaming,
  model,
  onModelChange,
  conversationMode,
  placeholder,
  onOpenContextPicker,
  onPickDirectory,
  selectedContexts = [],
  onRemoveContext,
  onClearContexts,
}: ChatComposerProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  const [mode, setMode] = useState('通用 GIS')
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const composingRef = useRef(false)
  const [attachments, setAttachments] = useState<string[]>([])

  /* ── 发送 ── */
  const handleSend = () => {
    if (isStreaming) return
    if (!prompt.trim()) {
      message.warning('请先描述你的 GIS 任务')
      return
    }
    onSend()
  }

  /* ── 键盘 ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    /* IME 组合输入中不发送 */
    if (composingRef.current || e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* ── 语音输入 ── */
  const toggleVoiceInput = () => {
    if (recording) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      message.warning('当前浏览器不支持语音输入，请使用 Chrome 或 Edge')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        onPromptChange(prompt ? prompt + ' ' + finalTranscript : finalTranscript)
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        message.error('麦克风权限被拒绝')
      } else if (event.error !== 'aborted') {
        message.error('语音识别出错，请稍后重试')
      }
      setRecording(false)
    }
    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  /* ── 附件操作 handlers ── */
  const handlePickFile = async () => {
    const pickerWindow = window as DirectoryPickerWindow
    if (!pickerWindow.showOpenFilePicker) {
      message.warning('当前浏览器不支持文件选择，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handles = await pickerWindow.showOpenFilePicker({ multiple: true })
      const names = handles.map((h) => h.name)
      setAttachments((prev) => [...prev, ...names])
      message.success(`已添加 ${names.length} 个文件：${names.join('、')}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消文件选择')
      } else {
        console.error(error)
        message.error('选择文件失败')
      }
    }
  }

  const handlePickAttachFolder = async () => {
    const pickerWindow = window as DirectoryPickerWindow
    if (!pickerWindow.showDirectoryPicker) {
      message.warning('当前浏览器不支持文件夹选择，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handle = await pickerWindow.showDirectoryPicker({ mode: 'read' })
      setAttachments((prev) => [...prev, `[文件夹] ${handle.name}`])
      message.success(`已添加文件夹：${handle.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消文件夹选择')
      } else {
        console.error(error)
        message.error('选择文件夹失败')
      }
    }
  }

  const handlePickImage = async () => {
    const pickerWindow = window as DirectoryPickerWindow
    if (!pickerWindow.showOpenFilePicker) {
      message.warning('当前浏览器不支持图片选择，请使用 Chrome 或 Edge')
      return
    }
    try {
      const handles = await pickerWindow.showOpenFilePicker({
        multiple: true,
        types: [{ description: '图片', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'] } }],
      })
      const names = handles.map((h) => h.name)
      setAttachments((prev) => [...prev, ...names])
      message.success(`已添加 ${names.length} 张图片：${names.join('、')}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        message.info('已取消图片选择')
      } else {
        console.error(error)
        message.error('选择图片失败')
      }
    }
  }

  const attachHandlers: Record<string, () => void> = {
    skill: () => onOpenContextPicker?.('skill'),
    expert: () => onOpenContextPicker?.('expert'),
    mcp: () => onOpenContextPicker?.('mcp'),
    file: handlePickFile,
    folder: onPickDirectory ?? handlePickAttachFolder,
    image: handlePickImage,
  }

  /* ── 加号菜单 ── */
  const attachMenu = {
    items: ATTACH_ITEMS.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
      onClick: attachHandlers[item.key] ?? (() => message.info(item.msg)),
    })),
  }

  /* ── 模式下拉面板 ── */
  const modeDropdownRender = () => (
    <div
      className={styles.modeDropdown}
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {MODE_OPTIONS.map((opt) => {
        const isActive = mode === opt.label
        return (
          <div
            key={opt.key}
            className={styles.modeItem}
            style={isActive ? { background: token.colorPrimaryBg } : undefined}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = token.colorFillSecondary }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            onClick={() => { setMode(opt.label); setModeDropdownOpen(false); message.info(`已切换到：${opt.label}`) }}
          >
            <span className={styles.modeItemIcon} style={{ color: isActive ? token.colorPrimary : token.colorTextSecondary }}>{opt.icon}</span>
            <div className={styles.modeItemContent}>
              <span className={styles.modeItemLabel}>{opt.label}</span>
              <span className={styles.modeItemDesc} style={{ color: token.colorTextTertiary }}>{opt.desc}</span>
            </div>
            {isActive && <Check style={{ color: token.colorPrimary, fontSize: 12 }} />}
          </div>
        )
      })}
    </div>
  )

  return (
    <div
      className={`${styles.composer} ${conversationMode ? styles.composerConversation : ''}`}
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        outline: 'none',
      }}
    >
      {/* 附件标签 */}
      {attachments.length > 0 && (
        <div className={styles.attachTags}>
          {attachments.map((name, idx) => (
            <Tag
              key={idx}
              closable
              onClose={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
              style={{ margin: 0, fontSize: 12 }}
            >
              {name}
            </Tag>
          ))}
        </div>
      )}

      {/* 上下文 Chip 条 */}
      {selectedContexts.length > 0 && (
        <SelectedContextBar
          contexts={selectedContexts}
          onRemove={(id, kind) => onRemoveContext?.(id, kind)}
          onClearAll={() => onClearContexts?.()}
        />
      )}

      {/* 单行：[+] TextArea [mode] [model] [folder] [voice] [send] */}
      <div className={styles.composerRow}>
        <Dropdown menu={attachMenu} trigger={['click']} placement="topLeft">
          <Tooltip title="添加附件">
            <Button color="primary" variant="solid" icon={<Plus />} size="small" shape="round" className={styles.iconBtn} />
          </Tooltip>
        </Dropdown>

        <Input.TextArea
          className={styles.textArea}
          placeholder={placeholder ?? '描述你的 GIS 任务……'}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          variant="borderless"
          autoSize={{ minRows: 1, maxRows: 8 }}
          style={{ 
            fontSize: 14, 
            resize: 'none',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}
        />

        <Dropdown
          popupRender={modeDropdownRender}
          trigger={['click']}
          placement="topLeft"
          open={modeDropdownOpen}
          onOpenChange={setModeDropdownOpen}
        >
          <Button color="purple" variant="solid" size="small" shape="round" className={styles.modeBtn}>
            <Space size={4}>
              <Zap />
              {mode}
            </Space>
          </Button>
        </Dropdown>

        <ModelPicker model={model} onModelChange={onModelChange} />

        <Tooltip title={recording ? '停止录音' : '语音输入'}>
          <Button
            color={recording ? 'danger' : 'green'}
            variant="filled"
            shape="round"
            icon={<AudioLines />}
            className={styles.iconBtn}
            onClick={toggleVoiceInput}
          />
        </Tooltip>

        {isStreaming ? (
          <Button
            danger
            shape="round"
            icon={<Square />}
            className={styles.iconBtn}
            onClick={onStop}
          />
        ) : (
          <Button
            color="primary"
            variant="solid"
            shape="circle"
            icon={<Send />}
            className={styles.iconBtn}
            onClick={handleSend}
            disabled={!prompt.trim()}
          />
        )}
      </div>
    </div>
  )
}
