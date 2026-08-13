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
import { ExpertSuiteCard } from './components/ExpertSuiteCard'
import { ExpertSuiteDetail } from './components/ExpertSuiteDetail'
import { ExpertUploadModal } from './components/ExpertUploadModal'
import { expertCategories } from './expertMockData'
import type { ExpertSuite } from './expertMockData'
import { loadExpertStore, mergeExperts, updateExpertState } from './expertStorage'
import type { ExpertStore } from './expertStorage'
import styles from './ExpertsPage.module.css'

const { Title, Text, Paragraph } = Typography

const CREATE_EXPERT_PROMPT = `我要创建一个 GeoWork 专家套件，面向【GIS / 遥感 / 空间分析】场景。

专家套件目标：
【请描述这个专家套件要解决的问题】

建议包含：
1. 适用行业或场景，例如自然资源、城市规划、生态监测、灾害评估。
2. 需要具备的快捷命令。
3. 需要连接的数据类型，例如 GeoJSON、Shapefile、CSV、遥感影像、DEM。
4. 需要内置的知识模块，例如坐标系统、缓冲区分析、NDVI、土地利用分类。
5. 期望输出，例如地图、报告、表格、图层或分析摘要。`

export function ExpertsPage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { message } = App.useApp()

  /* ── 状态 ── */
  const [expertStore, setExpertStore] = useState<ExpertStore>(() => loadExpertStore())
  const suites = useMemo(() => mergeExperts(expertStore), [expertStore])
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'market' | 'installed'>('market')
  const [categoryFilter, setCategoryFilter] = useState<string>('全部')
  const [selectedSuite, setSelectedSuite] = useState<ExpertSuite | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  /* ── 派生数据 ── */
  const installedCount = suites.filter((s) => s.installed).length

  const filteredSuites = useMemo(() => {
    let result = suites

    // 搜索过滤
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      )
    }

    // 分类筛选
    if (categoryFilter !== '全部') {
      result = result.filter((s) => s.category === categoryFilter)
    }

    // Tab 过滤
    if (activeTab === 'installed') {
      result = result.filter((s) => s.installed)
    }

    return result
  }, [suites, searchText, categoryFilter, activeTab])

  /* ── 安装/卸载 ── */
  const handleInstall = (id: string) => {
    setExpertStore((prev) => updateExpertState(prev, id, { installed: true }))
    message.success('已安装专家套件')
  }

  const handleUninstall = (id: string) => {
    setExpertStore((prev) => updateExpertState(prev, id, { installed: false }))
    message.info('已卸载专家套件')
  }

  /* ── 跳转创建 ── */
  const handleCreateExpert = () => {
    navigate('/new-task', { state: { initialPrompt: CREATE_EXPERT_PROMPT } })
  }

  /* ── 刷新 ── */
  const handleRefresh = () => {
    message.info('专家套件列表已刷新')
  }

  /* ── 添加 Dropdown ── */
  const addMenuItems = [
    {
      key: 'create',
      label: '通过 GeoWork 创建',
      onClick: handleCreateExpert,
    },
    {
      key: 'upload',
      label: '上传专家套件',
      onClick: () => setUploadModalOpen(true),
    },
  ]

  /* ── 筛选 Dropdown ── */
  const filterMenuItems = expertCategories.map((cat) => ({
    key: cat,
    label: cat,
    onClick: () => setCategoryFilter(cat),
  }))

  /* ── 详情页视图 ── */
  if (selectedSuite) {
    return (
      <div className={styles.pageContainer}>
        <ExpertSuiteDetail
          suite={selectedSuite}
          onBack={() => setSelectedSuite(null)}
          onToggleChat={(enabled) => {
            if (enabled) {
              message.success('已在聊天中启用该专家')
            } else {
              message.info('已关闭聊天中启用')
            }
          }}
        />
        <ExpertUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
        />
      </div>
    )
  }

  /* ── 列表页视图 ── */
  return (
    <div className={styles.pageContainer}>
      {/* 顶部工具栏 */}
      <div className={styles.toolbar}>
        <Space>
          <Button
            type="text"
            icon={<RotateCw />}
            onClick={handleRefresh}
          />
          <Input
            placeholder="搜索专家套件..."
            prefix={<Search />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
        </Space>
        <Dropdown menu={{ items: addMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<Plus />}>
            添加
          </Button>
        </Dropdown>
      </div>

      {/* 页面标题 */}
      <div className={styles.header}>
        <Title level={2} className={styles.pageTitle}>专家套件</Title>
        <Paragraph type="secondary" className={styles.pageSubtitle}>
          专家套件是面向空间分析、遥感解译、数据处理和专题制图的能力组合，可在 GeoWork 对话中快速调用。
        </Paragraph>
      </div>

      {/* Hero 推荐卡片 */}
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
              空间智能专家套件
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              把常用 GIS 流程、遥感模型、数据检查和制图规范封装为可复用专家，一键加入 GeoWork 工作流。
            </Text>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.heroPills}>
              <Tag>空间分析</Tag>
              <Tag>遥感解译</Tag>
              <Tag>专题制图</Tag>
              <Tag>数据质检</Tag>
              <Tag>城市规划</Tag>
            </div>
            <Button type="primary" onClick={handleCreateExpert}>
              让 GeoWork 帮我创建
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs + 筛选 */}
      <div className={styles.tabsRow}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'market' | 'installed')}
          items={[
            {
              key: 'market',
              label: `套件广场 ${suites.length}`,
            },
            {
              key: 'installed',
              label: `已安装 ${installedCount}`,
            },
          ]}
        />
        <Dropdown menu={{ items: filterMenuItems }} trigger={['click']}>
          <Button>
            {categoryFilter}
          </Button>
        </Dropdown>
      </div>

      {/* 卡片网格 */}
      {filteredSuites.length === 0 ? (
        <div className={styles.emptyArea}>
          {activeTab === 'installed' ? (
            <Empty
              description={
                <div className={styles.emptyContent}>
                  <Text strong>暂无已安装专家套件</Text>
                  <Text type="secondary">
                    创建一个专属的 GeoWork 专家，或从套件广场中安装常用能力。
                  </Text>
                  <Button type="primary" onClick={handleCreateExpert}>
                    让 GeoWork 帮我创建
                  </Button>
                </div>
              }
            />
          ) : (
            <Empty description="暂无匹配专家套件" />
          )}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredSuites.map((suite) => (
            <ExpertSuiteCard
              key={suite.id}
              suite={suite}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onClick={setSelectedSuite}
            />
          ))}
        </div>
      )}

      {/* 上传弹窗 */}
      <ExpertUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
    </div>
  )
}