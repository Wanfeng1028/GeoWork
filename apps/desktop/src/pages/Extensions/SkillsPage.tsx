import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Space,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  RotateCw,
  Search,
  Plus,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import type { UploadFile } from 'antd'
import { SkillCard } from './components/SkillCard'
import { InstalledSkillList } from './components/InstalledSkillList'
import { SkillUploadModal } from './components/SkillUploadModal'
import {
  marketSkills,
  builtInSkills,
  skillCategories,
} from './skillsMockData'
import type { SkillItem } from './skillsMockData'
import {
  loadSkillsStore,
  updateSkillState,
  addLocalSkill,
  removeLocalSkill,
} from './skillsStorage'
import type { SkillsStore } from './skillsStorage'
import styles from './SkillsPage.module.css'

const { Title, Paragraph, Text } = Typography

type TabKey = 'market' | 'builtin' | 'installed'
type SortKey = 'popular' | 'latest' | 'name' | 'installed-first'
type InstalledFilter = 'all' | 'enabled' | 'disabled'

const CREATE_SKILL_PROMPT = `我要创建一个 GeoWork 技能，面向【GIS / 遥感 / 空间数据处理】场景。

技能目标：
【请描述这个技能要解决的问题】

建议包含：
1. 技能名称。
2. 适用场景，例如空间分析、遥感影像、专题制图、数据质检。
3. 输入数据类型，例如 GeoJSON、Shapefile、CSV、DEM、遥感影像。
4. 输出结果，例如地图图层、统计表、报告、Markdown 摘要或图片。
5. 需要调用的工具或步骤。
6. 需要注意的坐标系、字段、文件格式或质量检查规则。`

/* ── 合并 mock 数据与 localStorage 状态 ── */
function mergeSkills(store: SkillsStore): SkillItem[] {
  const apply = (skill: SkillItem): SkillItem => {
    const state = store.states[skill.id]
    if (state) {
      return { ...skill, installed: state.installed, enabled: state.enabled }
    }
    return skill
  }

  const market = marketSkills.map(apply)
  const builtin = builtInSkills.map(apply)
  const local = store.localSkills.map(apply)

  return [...market, ...builtin, ...local]
}

export function SkillsPage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { message } = App.useApp()

  /* ── 状态 ── */
  const [store, setStore] = useState<SkillsStore>(loadSkillsStore)
  const [activeTab, setActiveTab] = useState<TabKey>('market')
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('全部')
  const [sortBy, setSortBy] = useState<SortKey>('popular')
  const [installedFilter, setInstalledFilter] = useState<InstalledFilter>('all')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  /* ── 合并后的全部技能 ── */
  const allSkills = useMemo(() => mergeSkills(store), [store])

  /* ── 分类统计 ── */
  const marketCount = marketSkills.length
  const builtinCount = builtInSkills.length
  const installedCount = allSkills.filter((s) => s.installed).length

  /* ── 市场技能过滤排序 ── */
  const filteredMarketSkills = useMemo(() => {
    let result = allSkills.filter((s) => s.source === 'market')

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }

    if (categoryFilter !== '全部') {
      result = result.filter((s) => s.category === categoryFilter)
    }

    // 排序
    switch (sortBy) {
      case 'popular':
        result = [...result].sort((a, b) => {
          const da = parseFloat(a.downloads?.replace('K', '') ?? '0')
          const db = parseFloat(b.downloads?.replace('K', '') ?? '0')
          return db - da
        })
        break
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'installed-first':
        result = [...result].sort((a, b) => Number(b.installed) - Number(a.installed))
        break
      case 'latest':
      default:
        break
    }

    return result
  }, [allSkills, searchText, categoryFilter, sortBy])

  /* ── 内置技能过滤 ── */
  const filteredBuiltinSkills = useMemo(() => {
    let result = allSkills.filter((s) => s.source === 'built-in')

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
    }

    return result
  }, [allSkills, searchText])

  /* ── 已安装技能过滤 ── */
  const filteredInstalledSkills = useMemo(() => {
    let result = allSkills.filter((s) => s.installed)

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
    }

    if (installedFilter === 'enabled') {
      result = result.filter((s) => s.enabled)
    } else if (installedFilter === 'disabled') {
      result = result.filter((s) => !s.enabled)
    }

    return result
  }, [allSkills, searchText, installedFilter])

  /* ── 操作 ── */
  const handleInstall = (id: string) => {
    const next = updateSkillState(store, id, { installed: true, enabled: true })
    setStore(next)
    message.success('技能已安装')
  }

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    const next = updateSkillState(store, id, { enabled })
    setStore(next)
  }

  const handleUninstall = (id: string) => {
    const skill = allSkills.find((s) => s.id === id)
    if (!skill) return

    if (skill.source === 'local') {
      const next = removeLocalSkill(store, id)
      setStore(next)
    } else {
      const next = updateSkillState(store, id, { installed: false, enabled: false })
      setStore(next)
    }
    message.info('技能已卸载')
  }

  const handleReset = (id: string) => {
    const marketSkill = marketSkills.find((s) => s.id === id)
    const builtinSkill = builtInSkills.find((s) => s.id === id)
    const original = marketSkill ?? builtinSkill

    if (original) {
      const next = updateSkillState(store, id, {
        installed: original.installed,
        enabled: original.enabled,
      })
      setStore(next)
      message.info('技能已重置为默认状态')
    }
  }

  const handleUploadInstall = (_file: UploadFile) => {
    const ts = Date.now()
    const localSkill: SkillItem = {
      id: `local-${ts}`,
      name: '本地导入技能',
      slug: `local-imported-${ts}`,
      author: '@Local',
      category: '数据处理',
      source: 'local',
      description: '从本地文件导入的 GeoWork 技能，当前为前端占位记录。',
      version: 'v1.0.0',
      installed: true,
      enabled: true,
      tags: ['本地', '导入'],
    }
    const next = addLocalSkill(store, localSkill)
    setStore(next)
    message.success('技能安装流程已记录，后续接入真实解析')
    setUploadModalOpen(false)
  }

  /* ── 跳转创建 ── */
  const handleCreateSkill = () => {
    navigate('/new-task', { state: { initialPrompt: CREATE_SKILL_PROMPT } })
  }

  /* ── 刷新 ── */
  const handleRefresh = () => {
    setStore(loadSkillsStore())
    message.info('技能列表已刷新')
  }

  /* ── 添加 Dropdown ── */
  const addMenuItems = [
    {
      key: 'create',
      label: '通过 GeoWork 创建',
      onClick: handleCreateSkill,
    },
    {
      key: 'upload',
      label: '上传技能',
      onClick: () => setUploadModalOpen(true),
    },
  ]

  /* ── 筛选 Dropdown ── */
  const filterMenuItems = skillCategories.map((cat) => ({
    key: cat,
    label: cat,
    onClick: () => setCategoryFilter(cat),
  }))

  /* ── 排序 Dropdown ── */
  const sortMenuItems = [
    { key: 'popular', label: '热门', onClick: () => setSortBy('popular') },
    { key: 'latest', label: '最新', onClick: () => setSortBy('latest') },
    { key: 'name', label: '名称', onClick: () => setSortBy('name') },
    { key: 'installed-first', label: '已安装优先', onClick: () => setSortBy('installed-first') },
  ]

  /* ── 已安装筛选 Dropdown ── */
  const installedFilterItems = [
    { key: 'all', label: '全部', onClick: () => setInstalledFilter('all') },
    { key: 'enabled', label: '已启用', onClick: () => setInstalledFilter('enabled') },
    { key: 'disabled', label: '已禁用', onClick: () => setInstalledFilter('disabled') },
  ]

  const sortLabel = sortMenuItems.find((i) => i.key === sortBy)?.label ?? '热门'
  const installedFilterLabel = installedFilterItems.find((i) => i.key === installedFilter)?.label ?? '全部'

  return (
    <div className={styles.pageContainer}>
      {/* 顶部工具栏 */}
      <div className={styles.toolbar}>
        <Space>
          <Button type="text" icon={<RotateCw />} onClick={handleRefresh} />
          <Input
            placeholder="搜索技能..."
            prefix={<Search />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
        </Space>
        <Dropdown menu={{ items: addMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<Plus />}>添加</Button>
        </Dropdown>
      </div>

      {/* 标题区 */}
      <div className={styles.header}>
        <Title level={2} className={styles.pageTitle}>技能</Title>
        <Paragraph type="secondary" className={styles.pageSubtitle}>
          安装与管理 GeoWork 技能，在对话中扩展空间分析、遥感解译、数据处理和制图能力。
        </Paragraph>
      </div>

      {/* Hero 横幅 */}
      <Card
        className={styles.heroCard}
        style={{
          background: token.colorPrimaryBg,
          borderColor: token.colorPrimaryBorder,
        }}
      >
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <Title level={4} style={{ margin: 0, color: token.colorText }}>
              为你的空间工作流安装技能
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              连接数据、地图、影像和分析工具，让 GeoWork 在任务中调用可复用的专业能力。
            </Text>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.heroPills}>
              <Tag>GIS</Tag>
              <Tag>遥感</Tag>
              <Tag>数据处理</Tag>
              <Tag>专题制图</Tag>
              <Tag>自动报告</Tag>
            </div>
            <Button type="primary" onClick={handleCreateSkill}>
              通过 GeoWork 创建
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        className={styles.tabs}
        items={[
          { key: 'market', label: `市场 ${marketCount}` },
          { key: 'builtin', label: `内置 ${builtinCount}` },
          { key: 'installed', label: `已安装 ${installedCount}` },
        ]}
      />

      {/* 工具行 */}
      <div className={styles.filterRow}>
        {activeTab === 'market' && (
          <>
            <Dropdown menu={{ items: filterMenuItems }} trigger={['click']}>
              <Button size="small">{categoryFilter}</Button>
            </Dropdown>
            <Dropdown menu={{ items: sortMenuItems }} trigger={['click']}>
              <Button size="small">{sortLabel}</Button>
            </Dropdown>
          </>
        )}
        {activeTab === 'installed' && (
          <Dropdown menu={{ items: installedFilterItems }} trigger={['click']}>
            <Button size="small">{installedFilterLabel}</Button>
          </Dropdown>
        )}
      </div>

      {/* 内容区 */}
      <div className={styles.content}>
        {/* 市场 Tab */}
        {activeTab === 'market' && (
          <>
            {filteredMarketSkills.length === 0 ? (
              <Empty description="暂无匹配技能" />
            ) : (
              <div className={styles.cardGrid}>
                {filteredMarketSkills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onInstall={handleInstall} />
                ))}
              </div>
            )}
          </>
        )}

        {/* 内置 Tab */}
        {activeTab === 'builtin' && (
          <>
            {filteredBuiltinSkills.length === 0 ? (
              <Empty description="暂无匹配内置技能" />
            ) : (
              <InstalledSkillList
                skills={filteredBuiltinSkills}
                mode="builtin"
                onToggleEnabled={handleToggleEnabled}
              />
            )}
          </>
        )}

        {/* 已安装 Tab */}
        {activeTab === 'installed' && (
          <>
            {filteredInstalledSkills.length === 0 ? (
              <Empty
                description={
                  <div className={styles.emptyContent}>
                    <Text strong>暂无已安装技能</Text>
                    <Text type="secondary">可以从市场安装，或上传本地技能。</Text>
                  </div>
                }
              />
            ) : (
              <InstalledSkillList
                skills={filteredInstalledSkills}
                mode="installed"
                onToggleEnabled={handleToggleEnabled}
                onUninstall={handleUninstall}
                onReset={handleReset}
              />
            )}
          </>
        )}
      </div>

      {/* 上传弹窗 */}
      <SkillUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onInstall={handleUploadInstall}
      />
    </div>
  )
}