import { useMemo, useState } from 'react'
import { Check, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import styles from './Extensions.module.scss'

type Variant = 'extensions' | 'skills' | 'connectors'

interface MarketItem {
  id: string
  name: string
  subtitle: string
  description: string
  installed?: boolean
  icon?: string
  downloads?: string
}

const CONNECTORS: MarketItem[] = [
  { id: 'qoder', name: 'QoderWork', subtitle: '赋予 Agent 自省与自治能力：查询、配置、操控...', description: '连接 QoderWork 本地能力', installed: true, icon: 'Q' },
  { id: 'browser', name: '浏览器', subtitle: '连接浏览器，实现网页自动化和数据提取。', description: '网页自动化', icon: 'B' },
  { id: 'control', name: '计算机控制', subtitle: '允许 AI 控制鼠标、键盘并截取屏幕。', description: '本机控制', icon: '□' },
  { id: 'm365', name: 'Microsoft 365', subtitle: '连接 Microsoft 365 服务，包括邮件、日历和 Tea...', description: '办公服务', icon: 'M' },
  { id: 'dingtalk', name: '钉钉', subtitle: '发送消息、管理频道，与钉钉工作区交互', description: '生产力', icon: '钉' },
  { id: 'feishu', name: '飞书', subtitle: '接收机器人消息，处理飞书文档和会议', description: '生产力', icon: '飞' },
  { id: 'slack', name: 'Slack', subtitle: '发送消息、管理频道，与 Slack 工作区交互', description: '沟通', icon: 'S' },
  { id: 'figma', name: 'Figma', subtitle: '访问 Figma 设计、组件，协作编辑文件', description: '设计', icon: 'F' },
  { id: 'calendar', name: 'Google 日历', subtitle: '管理 Google 日历事件，创建会议，查看日程安排', description: '日程', icon: '31' },
  { id: 'maps', name: 'Google 地图', subtitle: '搜索地点、获取路线、计算距离、查找附近位置', description: '地图', icon: 'G' },
]

const SKILLS: MarketItem[] = [
  { id: 'deep-research', name: '深入研究', subtitle: 'deep-research', description: '通过来源验证、三角测量和引用支持的报告对技术主题进行系统的深入研究。', downloads: '21.8K' },
  { id: 'ui-designer', name: 'UI 设计', subtitle: 'ui-designer', description: '从参考 UI 图像中提取设计系统并生成可实施的 UI 设计提示。', installed: true, downloads: '19.3K' },
  { id: 'qoder-ppt', name: 'QoderWork 演示文稿', subtitle: 'qoderwork-ppt', description: '生成 QoderWork 风格演示文稿。根据主题自动匹配模板。', downloads: '16.4K' },
  { id: 'diagram', name: '技术图表生成', subtitle: 'drafter-diagram', description: '帮助把系统怎么组成、流程怎么走、模块怎么连讲清楚。', downloads: '12.2K' },
  { id: 'data', name: '智能小Q·数据分析', subtitle: 'quickbi-smartq-chat', description: '超级数据分析技能，用户只需自然语言提出问题。', downloads: '9.7K' },
  { id: 'notion', name: 'Notion 信息图', subtitle: 'notion-infographic', description: '根据参考文档批量生成 Notion 风格信息图。', downloads: '8.4K' },
]

const PLUGINS: MarketItem[] = [
  { id: 'case-law', name: '法律行业', subtitle: '合同审查、条款比对与检索路径预置', description: '合同审查、条款比对与检索路径预置，减少重复说明。' },
  { id: 'remote-sensing', name: '遥感行业', subtitle: '影像筛选、指数计算、变化检测工作流', description: '面向 Sentinel/Landsat 的遥感分析流程。' },
  { id: 'paper', name: '论文行业', subtitle: '文献检索、综述、引用矩阵与写作模板', description: '让研究流程更接近 Qoder 的专家案件体验。' },
]

const COPY: Record<Variant, { title: string; subtitle: string; heroTitle: string; heroText: string; tabs: string[]; section: string; search: string; columns: string }> = {
  extensions: {
    title: '专家案件',
    subtitle: '专家案件是面向角色/行业的工具套件，在对话框中输入 @ 或 / 即可使用。',
    heroTitle: '法律行业',
    heroText: '合同审查、条款比对与检索路径预置：减少重复说明，专注结论输出。',
    tabs: ['案件广场', '已安装'],
    section: '推荐',
    search: '搜索案件...',
    columns: 'wide',
  },
  skills: {
    title: '技能',
    subtitle: '安装与管理技能，在对话中扩展 QoderWork 的能力。',
    heroTitle: '为你精选的职场技能',
    heroText: '涵盖写作、效率、设计、数据分析等多种场景，一键安装。',
    tabs: ['市场', '内置', '已安装'],
    section: '官方精选',
    search: '搜索技能',
    columns: 'cards',
  },
  connectors: {
    title: '连接器',
    subtitle: '连接外部应用、日历与服务，让你的工作流更顺畅。',
    heroTitle: '连接你的应用，释放生产力',
    heroText: '更高效、更愉悦的开发体验。',
    tabs: ['市场', '已安装'],
    section: '推荐',
    search: '搜索...',
    columns: 'rows',
  },
}

export default function Extensions({ variant = 'connectors' }: { variant?: Variant }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(0)
  const config = COPY[variant]
  const items = variant === 'skills' ? SKILLS : variant === 'extensions' ? PLUGINS : CONNECTORS

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const tabOk = tab === 0 || item.installed
      const searchOk = !q || `${item.name} ${item.subtitle} ${item.description}`.toLowerCase().includes(q)
      return tabOk && searchOk
    })
  }, [items, search, tab])

  return (
    <div className={styles.extensions}>
      <div className={styles.topBar}>
        <button className={styles.refresh} title="刷新">
          <RefreshCw size={14} />
        </button>
        <div className={styles.searchField}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            placeholder={config.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.createBtn}>
          <Plus size={14} /> 添加
        </button>
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>{config.title}</h1>
        <p className={styles.subtitle}>{config.subtitle}</p>

        <div className={`${styles.hero} ${styles[variant]}`}>
          <div>
            <strong>{config.heroTitle}</strong>
            <span>{config.heroText}</span>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.tabs}>
            {config.tabs.map((name, index) => (
              <button key={name} className={tab === index ? styles.active : ''} onClick={() => setTab(index)}>
                {name}{index === config.tabs.length - 1 && <em>{items.filter((item) => item.installed).length}</em>}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            {variant === 'skills' && <button><SlidersHorizontal size={13} /> 全部</button>}
            <button><SlidersHorizontal size={13} /> 排序: 热门</button>
          </div>
        </div>

        <p className={styles.sectionLabel}>{config.section}</p>

        {visible.length > 0 ? (
          <div className={`${styles.grid} ${styles[config.columns]}`}>
            {visible.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardIcon}>{item.icon ?? item.name.slice(0, 1)}</div>
                <div className={styles.cardBody}>
                  <strong>{item.name}</strong>
                  <small>{item.subtitle}</small>
                  {variant !== 'connectors' && <span>{item.description}</span>}
                  {item.downloads && <em>↓ {item.downloads}</em>}
                </div>
                <button className={styles.cardAdd} title={item.installed ? '已安装' : '安装'}>
                  {item.installed ? <Check size={15} /> : <Plus size={18} />}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>没有找到匹配内容</div>
        )}
      </div>

      <button className={styles.avatarFloat} title="账户">G</button>
    </div>
  )
}
