import { useMemo, useRef, useState } from 'react'
import {
  App,
  Empty,
  Input,
  List,
  Modal,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  Search,
  LayoutGrid,
  Wrench,
  Zap,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import styles from './GlobalSearchModal.module.css'

const { Text } = Typography

/* ── 搜索数据 ── */
type SearchItem = {
  key: string
  title: string
  description: string
  path: string
  group: '页面' | '扩展' | '能力'
  keywords: string[]
}

const SEARCH_ITEMS: SearchItem[] = [
  // 页面类
  { key: 'new-task', title: '新任务', description: '创建和描述 GIS 任务', path: '/new-task', group: '页面', keywords: ['创建', '任务', 'new task'] },
  { key: 'dashboard', title: '工作台', description: '工作区概览与最近活动', path: '/', group: '页面', keywords: ['概览', '首页', 'dashboard'] },
  { key: 'workspace', title: '地图工作区', description: '地图视图、图层树和空间分析', path: '/workspace', group: '页面', keywords: ['地图', '图层', 'map'] },
  { key: 'data-center', title: '数据中心', description: '数据资产管理与导入', path: '/data-center', group: '页面', keywords: ['数据', '导入', 'data'] },
  { key: 'tasks', title: '任务管理', description: '任务队列、进度与运行日志', path: '/tasks', group: '页面', keywords: ['队列', '日志', 'task'] },
  { key: 'settings', title: '设置', description: '主题、模型和运行时配置', path: '/settings', group: '页面', keywords: ['配置', '偏好', 'settings'] },
  { key: 'theme-preview', title: '主题预览', description: '验证 Bootstrap 和 Dark 主题', path: '/theme-preview', group: '页面', keywords: ['主题', 'theme', 'preview'] },
  // 扩展类
  { key: 'experts', title: '专家', description: '专家插件管理与配置', path: '/extensions/experts', group: '扩展', keywords: ['专家', 'expert'] },
  { key: 'skills', title: '技能', description: '技能插件管理与配置', path: '/extensions/skills', group: '扩展', keywords: ['技能', 'skill'] },
  { key: 'mcp', title: 'MCP', description: 'MCP 服务管理与配置', path: '/extensions/mcp', group: '扩展', keywords: ['mcp', '服务'] },
  { key: 'connectors', title: '连接器', description: '外部连接器管理与配置', path: '/extensions/connectors', group: '扩展', keywords: ['连接器', 'connector', '连接'] },
  // 能力类
  { key: 'work-dir', title: '选择工作目录', description: '选择本地工作目录路径', path: '/new-task', group: '能力', keywords: ['目录', '文件夹', 'directory'] },
  { key: 'model-config', title: '模型设置', description: '模型启用与上下文长度配置', path: '/new-task', group: '能力', keywords: ['模型', 'model', '上下文'] },
  { key: 'spatial', title: '空间分析', description: '缓冲区、叠加等空间分析', path: '/new-task', group: '能力', keywords: ['缓冲区', '叠加', 'spatial'] },
  { key: 'thematic', title: '专题制图', description: '生成专题地图和统计图表', path: '/new-task', group: '能力', keywords: ['专题', '制图', 'thematic'] },
  { key: 'remote-sensing', title: '遥感解译', description: '遥感影像分析与解译', path: '/new-task', group: '能力', keywords: ['遥感', '影像', 'ndvi'] },
  { key: 'paper', title: '论文辅助', description: '学术论文撰写辅助', path: '/new-task', group: '能力', keywords: ['论文', 'paper', '学术'] },
]

/* 推荐搜索项（直接跳转） */
const RECOMMEND_KEYS = ['new-task', 'workspace', 'experts', 'model-config', 'spatial']

const GROUP_COLOR: Record<string, string> = {
  '页面': 'blue',
  '扩展': 'purple',
  '能力': 'green',
}

const GROUP_ICON: Record<string, React.ReactNode> = {
  '页面': <LayoutGrid />,
  '扩展': <Wrench />,
  '能力': <Zap />,
}

/* ── 组件 ── */
type GlobalSearchModalProps = {
  open: boolean
  onClose: () => void
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [keyword, setKeyword] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  /* 搜索过滤 */
  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return []
    return SEARCH_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(kw) ||
      item.description.toLowerCase().includes(kw) ||
      item.group.toLowerCase().includes(kw) ||
      item.keywords.some((k) => k.toLowerCase().includes(kw))
    )
  }, [keyword])

  /* 跳转逻辑 */
  const handleOpen = (item: SearchItem) => {
    if (location.pathname === item.path) {
      message.info(`当前已在：${item.title}`)
    } else {
      navigate(item.path)
      message.success(`已打开：${item.title}`)
    }
    setKeyword('')
    onClose()
  }

  /* Enter 键 */
  const handleSearch = () => {
    if (results.length > 0) {
      handleOpen(results[0])
    } else {
      message.info('没有匹配的搜索结果')
    }
  }

  /* Modal 打开后聚焦 */
  const handleAfterOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTimeout(() => {
        const el = wrapperRef.current?.querySelector('input') as HTMLInputElement | null
        el?.focus()
      }, 50)
    }
  }

  /* 关闭时清空 */
  const handleClose = () => {
    setKeyword('')
    onClose()
  }

  const recommendItems = RECOMMEND_KEYS
    .map((key) => SEARCH_ITEMS.find((i) => i.key === key))
    .filter(Boolean) as SearchItem[]

  return (
    <Modal
      title="全局搜索"
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={920}
      afterOpenChange={handleAfterOpenChange}
    >
      <div ref={wrapperRef}>
        <Input
          size="large"
          placeholder="搜索页面、工具、模型、数据或 GIS 能力……"
          prefix={<Search />}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
        />
      </div>

      {/* 未输入：推荐搜索 */}
      {!keyword.trim() && (
        <div className={styles.recommendSection}>
          <Text type="secondary" style={{ fontSize: 12 }}>推荐搜索</Text>
          <div className={styles.recommendTags}>
            {recommendItems.map((item) => (
              <Tag
                key={item.key}
                icon={GROUP_ICON[item.group]}
                className={styles.recommendTag}
                onClick={() => handleOpen(item)}
              >
                {item.title}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* 有结果 */}
      {keyword.trim() && results.length > 0 && (
        <div className={styles.resultList} style={{ marginTop: 12 }}>
          <List
            dataSource={results}
            renderItem={(item) => (
              <List.Item
                key={item.key}
                style={{ padding: 0, borderBottom: 'none' }}
              >
                <div
                  className={styles.resultItem}
                  style={{ width: '100%' }}
                  onClick={() => handleOpen(item)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = token.colorFillTertiary
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 16, color: token.colorTextSecondary }}>
                    {GROUP_ICON[item.group]}
                  </span>
                  <div className={styles.resultItemMain}>
                    <div className={styles.resultItemTitle}>
                      <Text strong style={{ fontSize: 14 }}>{item.title}</Text>
                      <Tag color={GROUP_COLOR[item.group]} style={{ margin: 0, fontSize: 11 }}>
                        {item.group}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.description}
                    </Text>
                    <div className={styles.resultItemPath}>
                      <Text type="secondary" style={{ fontSize: 11, color: token.colorTextQuaternary }}>
                        {item.path}
                      </Text>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 无结果 */}
      {keyword.trim() && results.length === 0 && (
        <div style={{ padding: '32px 0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="没有匹配的结果，试试其他关键词"
          />
        </div>
      )}
    </Modal>
  )
}
