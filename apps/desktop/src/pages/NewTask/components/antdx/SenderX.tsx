import { useMemo, useState } from 'react'
import { App, Button, Dropdown, Space, Tag, Tooltip } from 'antd'
import { Sender, Suggestion } from '@ant-design/x'
import type { SuggestionItem } from '@ant-design/x/es/suggestion'
import {
  Plus,
  Zap,
  Bot,
  Globe,
  CloudUpload,
  Folder,
  FolderOpen,
  Target,
  PieChart,
  FileText,
  Search,
  Network,
} from 'lucide-react'
import { ModelPicker } from '../ModelPicker'
import { SelectedContextBar } from '../SelectedContextBar'
import { useFilePickers } from '../useFilePickers'
import { loadPromptSkills, loadExpertCommands } from './promptData'
import type { SelectedContextItem, SelectedContextKind } from '../../../../shared/session/types'
import type { ContextPickerType } from '../ContextPickerModal'
import styles from './antdx.module.css'

/* ── GIS 模式选项（与自研 ChatComposer 同一份文案） ── */
const MODE_OPTIONS = [
  { key: 'general', label: '通用 GIS', icon: <Globe size={14} />, desc: '通用地理信息系统任务' },
  { key: 'spatial', label: '空间分析', icon: <Target size={14} />, desc: '缓冲区、叠加、空间查询' },
  {
    key: 'cartography',
    label: '专题制图',
    icon: <PieChart size={14} />,
    desc: '生成专题地图和可视化',
  },
  { key: 'paper', label: '论文辅助', icon: <FileText size={14} />, desc: '学术论文写作辅助' },
  { key: 'query', label: '数据查询', icon: <Search size={14} />, desc: '属性与空间数据检索' },
  {
    key: 'remote-sensing',
    label: '遥感解译',
    icon: <Network size={14} />,
    desc: '遥感影像处理与解译',
  },
]

export interface SenderXProps {
  prompt: string
  onPromptChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  model: string
  onModelChange: (model: string) => void
  placeholder?: string
  onOpenContextPicker?: (type: ContextPickerType) => void
  onPickDirectory?: () => void
  selectedContexts?: SelectedContextItem[]
  onRemoveContext?: (id: string, kind: SelectedContextKind) => void
  onClearContexts?: () => void
}

/**
 * antdx 输入区（doc/26）：antd-x Sender 替代自研 ChatComposer。
 * 数据契约一致（prompt/onSend/onStop/上下文选择），交互增强：
 * 内置语音输入（allowSpeech）、Enter 发送/Shift+Enter 换行由 Sender 托管。
 * 二期：Suggestion 输入联想——输入 `/` 弹出已安装技能与专家快捷命令，
 * 方向键导航、Enter 选中（Sender onKeyDown 返回 false 阻断提交），选中填入输入框。
 */
export function SenderX({
  prompt,
  onPromptChange,
  onSend,
  onStop,
  isStreaming,
  model,
  onModelChange,
  placeholder,
  onOpenContextPicker,
  onPickDirectory,
  selectedContexts = [],
  onRemoveContext,
  onClearContexts,
}: SenderXProps) {
  const { message } = App.useApp()
  const [mode, setMode] = useState('通用 GIS')
  const [attachments, setAttachments] = useState<string[]>([])
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const { pickFile, pickAttachFolder, pickImage } = useFilePickers((names) =>
    setAttachments((prev) => [...prev, ...names]),
  )

  /* 联想数据：已安装技能 + 已安装专家快捷命令（挂载时快照读取，与 settings 惯例一致） */
  const suggestionItems = useMemo<SuggestionItem[]>(() => {
    const skills = loadPromptSkills().map((s) => ({
      value: s.key,
      label: s.label,
      icon: <Zap size={14} />,
      extra: '技能',
      text: s.text,
    }))
    const commands = loadExpertCommands().map((c) => ({
      value: c.key,
      label: c.label,
      icon: <Bot size={14} />,
      extra: c.expertName,
      text: `${c.label} `,
    }))
    return [...skills, ...commands]
  }, [])

  const handleSuggestionSelect = (value: string) => {
    const item = suggestionItems.find((i) => i.value === value)
    if (item?.text) onPromptChange(String(item.text))
  }

  /* 加号附件菜单：技能/专家/MCP 走上下文选择弹窗，文件/图片/文件夹走系统选择器 */
  const attachMenu = {
    items: [
      { key: 'skill', icon: <Zap size={14} />, label: '选择技能' },
      { key: 'expert', icon: <Bot size={14} />, label: '选择专家' },
      { key: 'mcp', icon: <Globe size={14} />, label: '连接 MCP' },
      { key: 'file', icon: <CloudUpload size={14} />, label: '选择文件' },
      { key: 'folder', icon: <Folder size={14} />, label: '选择文件夹' },
      { key: 'image', icon: <FolderOpen size={14} />, label: '上传图片' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'skill' || key === 'expert' || key === 'mcp') {
        onOpenContextPicker?.(key)
      } else if (key === 'file') {
        void pickFile()
      } else if (key === 'folder') {
        if (onPickDirectory) onPickDirectory()
        else void pickAttachFolder()
      } else if (key === 'image') {
        void pickImage()
      }
    },
  }

  const modeMenu = {
    items: MODE_OPTIONS.map((opt) => ({
      key: opt.key,
      icon: opt.icon,
      label: opt.label,
    })),
    onClick: ({ key }: { key: string }) => {
      const opt = MODE_OPTIONS.find((o) => o.key === key)
      if (!opt) return
      setMode(opt.label)
      message.info(`已切换到：${opt.label}`)
    },
  }

  return (
    <div className={styles.senderWrap} data-testid="sender-x">
      {/* 附件标签 */}
      {attachments.length > 0 && (
        <Space size={4} wrap>
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
        </Space>
      )}

      {/* 上下文 Chip 条（复用自研 SelectedContextBar） */}
      {selectedContexts.length > 0 && (
        <SelectedContextBar
          contexts={selectedContexts}
          onRemove={(id, kind) => onRemoveContext?.(id, kind)}
          onClearAll={() => onClearContexts?.()}
        />
      )}

      <Suggestion
        items={suggestionItems}
        onSelect={handleSuggestionSelect}
        onOpenChange={setSuggestionOpen}
        block
      >
        {({ onTrigger, onKeyDown }) => (
          <Sender
            value={prompt}
            onChange={(v) => {
              onPromptChange(v)
              // 输入 `/` 打开联想面板；内容被清空/改掉时关闭
              onTrigger(v === '/' ? undefined : false)
            }}
            onKeyDown={(e) => {
              if (suggestionOpen) {
                onKeyDown(e)
                // 联想面板打开时拦截 Enter（选中项），阻断 Sender 提交
                if (e.key === 'Enter') return false
              }
            }}
            onSubmit={() => onSend()}
            onCancel={onStop}
            loading={isStreaming}
            placeholder={placeholder ?? '描述你的 GIS 任务，输入 / 唤起技能与专家命令……'}
            allowSpeech
            autoSize={{ minRows: 1, maxRows: 8 }}
            prefix={
              <Dropdown menu={attachMenu} trigger={['click']} placement="topLeft">
                <Tooltip title="添加附件">
                  <Button
                    color="primary"
                    variant="solid"
                    icon={<Plus size={14} />}
                    size="small"
                    shape="round"
                  />
                </Tooltip>
              </Dropdown>
            }
            footer={(oriNode) => (
              <div className={styles.senderFooterRow}>
                <div className={styles.senderFooterLeft}>
                  <Dropdown menu={modeMenu} trigger={['click']} placement="topLeft">
                    <Button color="purple" variant="solid" size="small" shape="round">
                      <Space size={4}>
                        <Zap size={12} />
                        {mode}
                      </Space>
                    </Button>
                  </Dropdown>
                  <ModelPicker model={model} onModelChange={onModelChange} />
                </div>
                {oriNode}
              </div>
            )}
          />
        )}
      </Suggestion>
    </div>
  )
}
