/**
 * ContextPickerModal.tsx
 *
 * 通用上下文选择弹窗，支持技能 / 专家 / MCP 三种类型。
 * 数据来源复用已有 skillsStorage / expertStorage / mcpStorage。
 */

import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  Zap,
  Bot,
  Globe,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import type { SelectedContextItem } from './conversationStorage'
import { loadSkillsStore } from '../../Extensions/skillsStorage'
import { marketSkills, builtInSkills } from '../../Extensions/skillsMockData'
import type { SkillItem } from '../../Extensions/skillsMockData'
import { loadExpertStore, mergeExperts } from '../../Extensions/expertStorage'
import type { ExpertSuite } from '../../Extensions/expertMockData'
import { loadMcpStore, mergeMcpServers } from '../../Extensions/mcpStorage'
import { marketMcpServers, builtInMcpServers } from '../../Extensions/mcpMockData'
import type { McpServerItem } from '../../Extensions/mcpMockData'
import styles from './ContextPickerModal.module.css'

const { Text } = Typography

/* ── 类型 ── */

export type ContextPickerType = 'skill' | 'expert' | 'mcp'

interface ContextPickerModalProps {
  open: boolean
  type: ContextPickerType
  selectedIds: string[]
  onCancel: () => void
  onConfirm: (items: SelectedContextItem[]) => void
}

/* ── 选择限制 ── */

const MAX_SELECT: Record<ContextPickerType, number> = {
  skill: 5,
  expert: 3,
  mcp: 5,
}

/* ── 标题和图标映射 ── */

const TYPE_CONFIG: Record<ContextPickerType, {
  title: string
  searchPlaceholder: string
  icon: React.ReactNode
  emptyDesc: string
  emptyBtnLabel: string
  emptyRoute: string
}> = {
  skill: {
    title: '选择技能',
    searchPlaceholder: '搜索已安装技能...',
    icon: <Zap />,
    emptyDesc: '暂无可用技能，请先前往技能页面安装或启用技能。',
    emptyBtnLabel: '去技能页面',
    emptyRoute: '/extensions/skills',
  },
  expert: {
    title: '选择专家',
    searchPlaceholder: '搜索已安装专家...',
    icon: <Bot />,
    emptyDesc: '暂无可用专家，请先前往专家页面安装专家套件。',
    emptyBtnLabel: '去专家页面',
    emptyRoute: '/extensions/experts',
  },
  mcp: {
    title: '连接 MCP',
    searchPlaceholder: '搜索已连接 MCP...',
    icon: <Globe />,
    emptyDesc: '暂无已连接 MCP，请先前往 MCP 页面连接服务。',
    emptyBtnLabel: '去 MCP 页面',
    emptyRoute: '/extensions/mcp',
  },
}

/* ── 内部数据项 ── */

interface PickerDataItem {
  id: string
  name: string
  slug?: string
  description: string
  tags?: string[]
}

/* ── 数据加载 ── */

function loadPickerData(type: ContextPickerType): PickerDataItem[] {
  switch (type) {
    case 'skill': {
      const store = loadSkillsStore()
      const allSkills: SkillItem[] = [
        ...marketSkills,
        ...builtInSkills,
        ...store.localSkills,
      ].map((skill) => {
        const stored = store.states[skill.id]
        if (!stored) return skill
        return { ...skill, installed: stored.installed, enabled: stored.enabled }
      })
      return allSkills
        .filter((s) => s.installed && s.enabled)
        .map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          tags: [s.category, s.source],
        }))
    }
    case 'expert': {
      const store = loadExpertStore()
      const allExperts: ExpertSuite[] = mergeExperts(store)
      return allExperts
        .filter((e) => e.installed)
        .map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          tags: [e.category],
        }))
    }
    case 'mcp': {
      const store = loadMcpStore()
      const allMcp: McpServerItem[] = [
        ...mergeMcpServers(marketMcpServers, store),
        ...mergeMcpServers(builtInMcpServers, store),
        ...store.localServers,
      ]
      // 去重
      const seen = new Set<string>()
      const unique = allMcp.filter((m) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      return unique
        .filter((m) => m.connected && m.enabled)
        .map((m) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          description: m.description,
          tags: [m.category, m.transport],
        }))
    }
  }
}

/* ── 组件 ── */

export function ContextPickerModal({
  open,
  type,
  selectedIds,
  onCancel,
  onConfirm,
}: ContextPickerModalProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<string[]>(selectedIds)

  // 弹窗打开时同步已选 ID
  useEffect(() => {
    if (open) {
      setChecked(selectedIds)
      setSearch('')
    }
  }, [open, selectedIds])

  const config = TYPE_CONFIG[type]
  const allItems = useMemo(() => loadPickerData(type), [type])

  const filtered = useMemo(() => {
    if (!search.trim()) return allItems
    const q = search.trim().toLowerCase()
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.slug ?? '').toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    )
  }, [allItems, search])

  const handleToggle = (id: string) => {
    setChecked((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }
      const limit = MAX_SELECT[type]
      if (prev.length >= limit) {
        message.warning(`${config.title}最多选择 ${limit} 个`)
        return prev
      }
      return [...prev, id]
    })
  }

  const handleConfirm = () => {
    const items: SelectedContextItem[] = checked
      .map((id): SelectedContextItem | null => {
        const item = allItems.find((x) => x.id === id)
        if (!item) return null
        return {
          id: item.id,
          kind: type,
          name: item.name,
          slug: item.slug,
          description: item.description,
        }
      })
      .filter((x): x is SelectedContextItem => x !== null)
    onConfirm(items)
    setSearch('')
  }

  const handleCancel = () => {
    setSearch('')
    onCancel()
  }

  const handleGoToPage = () => {
    handleCancel()
    navigate(config.emptyRoute)
  }

  return (
    <Modal
      title={
        <Space>
          {config.icon}
          <span>{config.title}</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      width={520}
      destroyOnHidden
      footer={
        <div className={styles.footer}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            已选择 {checked.length} 个
          </Text>
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={handleConfirm}>
              确认选择
            </Button>
          </Space>
        </div>
      }
    >
      {/* 搜索框 */}
      <Input
        placeholder={config.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />

      {/* 内容区 */}
      {allItems.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Empty
            description={config.emptyDesc}
          >
            <Button type="primary" onClick={handleGoToPage}>
              {config.emptyBtnLabel}
            </Button>
          </Empty>
        </div>
      ) : filtered.length === 0 ? (
        <Empty description="没有匹配项" />
      ) : (
        <List
          className={styles.list}
          dataSource={filtered}
          renderItem={(item) => {
            const isChecked = checked.includes(item.id)
            return (
              <List.Item
                className={styles.listItem}
                style={
                  isChecked
                    ? { background: token.colorPrimaryBg }
                    : undefined
                }
                onClick={() => handleToggle(item.id)}
              >
                <div className={styles.itemRow}>
                  <Checkbox checked={isChecked} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemHeader}>
                      <Text strong style={{ fontSize: 13 }}>
                        {item.name}
                      </Text>
                      {item.slug && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {item.slug}
                        </Text>
                      )}
                    </div>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12 }}
                      ellipsis
                    >
                      {item.description}
                    </Text>
                    {item.tags && item.tags.length > 0 && (
                      <div className={styles.itemTags}>
                        {item.tags.map((tag) => (
                          <Tag
                            key={tag}
                            style={{ fontSize: 11, lineHeight: '16px' }}
                          >
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </List.Item>
            )
          }}
        />
      )}
    </Modal>
  )
}
