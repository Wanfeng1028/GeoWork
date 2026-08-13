import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Dropdown,
  Empty,
  Input,
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
import { ConnectorCard } from './components/ConnectorCard'
import { ConnectorList } from './components/ConnectorList'
import { ConnectorConfigModal } from './components/ConnectorConfigModal'
import { ConnectorJsonImportModal } from './components/ConnectorJsonImportModal'
import {
  marketConnectors,
  builtInConnectors,
  connectorCategories,
  type ConnectorAuthType,
  type ConnectorCapability,
  type ConnectorItem,
} from './connectorsMockData'
import {
  loadConnectorStore,
  mergeConnectors,
  updateConnectorState,
  addLocalConnector,
  removeLocalConnector,
  resetConnectorState,
  type ConnectorStore,
} from './connectorsStorage'
import styles from './ConnectorsPage.module.css'

const { Title, Paragraph, Text } = Typography

type TabKey = 'market' | 'connected' | 'builtin'
type CategoryFilter = 'all' | ConnectorItem['category']
type MarketSort = 'recommended' | 'popular' | 'latest' | 'name' | 'connected-first'
type ConnectedFilter = 'all' | 'enabled' | 'disabled' | 'expired' | 'error'

const CREATE_CONNECTOR_PROMPT = `我要创建一个 GeoWork 连接器，面向【外部应用 / 云服务 / 空间数据源】集成场景。

连接器目标：
【请描述这个连接器要连接什么应用、账号、数据源或服务】

建议包含：
1. 连接器名称。
2. 连接方式，例如 OAuth、API Key、Webhook、浏览器会话、本地桥接或内置集成。
3. 需要接入的平台，例如 Google Workspace、Microsoft 365、ArcGIS Online、GeoServer、云盘、邮件、日历或地图服务。
4. 需要读取或写入的数据类型，例如文档、表格、日历、邮件、地图图层、GeoJSON、CSV、遥感影像或任务通知。
5. 授权范围，例如只读、读写、发送通知、同步文件。
6. 在 GeoWork 对话或定时任务中如何使用。
7. 安全和权限限制。`

const CATEGORY_OPTIONS = [
  { value: 'all', label: '全部' },
  ...connectorCategories.map((c) => ({ value: c, label: c })),
]

const SORT_OPTIONS: { value: MarketSort; label: string }[] = [
  { value: 'recommended', label: '推荐' },
  { value: 'popular', label: '热门' },
  { value: 'latest', label: '最新' },
  { value: 'name', label: '名称' },
  { value: 'connected-first', label: '已连接优先' },
]

const CONNECTED_FILTER_OPTIONS: { value: ConnectedFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'enabled', label: '已启用' },
  { value: 'disabled', label: '已禁用' },
  { value: 'expired', label: '过期' },
  { value: 'error', label: '错误' },
]

export function ConnectorsPage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { message, modal } = App.useApp()

  /* ── 数据 ── */
  const [store, setStore] = useState<ConnectorStore>(() => loadConnectorStore())
  const [activeTab, setActiveTab] = useState<TabKey>('market')
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [marketSort, setMarketSort] = useState<MarketSort>('recommended')
  const [connectedFilter, setConnectedFilter] = useState<ConnectedFilter>('all')

  /* ─ Modal 状态 ── */
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configModalMode, setConfigModalMode] = useState<'connect' | 'config' | 'manual'>('connect')
  const [configConnector, setConfigConnector] = useState<ConnectorItem | null>(null)
  const [jsonImportOpen, setJsonImportOpen] = useState(false)

  /* ── 刷新数据 ─ */
  const refreshStore = useCallback(() => {
    setStore(loadConnectorStore())
  }, [])

  /* ── 监听事件 ── */
  useEffect(() => {
    const handleUpdate = () => refreshStore()
    window.addEventListener('geowork:connectors-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('geowork:connectors-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [refreshStore])

  /* ── 合并数据 ── */
  const allMarket = useMemo(() => mergeConnectors(marketConnectors, store), [store])
  const allBuiltIn = useMemo(() => mergeConnectors(builtInConnectors, store), [store])
  const allLocal = store.localConnectors

  /* ─ 已连接列表 ── */
  const connectedList = useMemo(() => {
    const marketConnected = allMarket.filter((c) => c.connected && c.source !== 'market' ? false : c.connected)
    const localConnected = allLocal.filter((c) => c.connected)
    return [...marketConnected, ...localConnected, ...allBuiltIn.filter((c) => c.connected)]
  }, [allMarket, allLocal, allBuiltIn])

  /* ── 数量统计 ── */
  const marketCount = allMarket.length
  const connectedCount = connectedList.length
  const builtInCount = allBuiltIn.length

  /* ── 搜索匹配 ── */
  const matchesSearch = useCallback((c: ConnectorItem, text: string) => {
    if (!text.trim()) return true
    const lower = text.toLowerCase()
    return (
      c.name.toLowerCase().includes(lower) ||
      c.slug.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower) ||
      c.tags.some((t) => t.toLowerCase().includes(lower)) ||
      c.category.toLowerCase().includes(lower) ||
      c.capabilities.some((cap) => cap.toLowerCase().includes(lower))
    )
  }, [])

  /* ─ 市场 Tab 过滤排序 ── */
  const filteredMarket = useMemo(() => {
    let list = allMarket.filter((c) => matchesSearch(c, searchText))
    if (categoryFilter !== 'all') {
      list = list.filter((c) => c.category === categoryFilter)
    }
    switch (marketSort) {
      case 'popular':
        list = [...list].sort((a, b) => (b.downloads ?? '').localeCompare(a.downloads ?? ''))
        break
      case 'latest':
        list = [...list].sort((a, b) => b.version.localeCompare(a.version))
        break
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'connected-first':
        list = [...list].sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0))
        break
      default:
        /* recommended: featured first */
        list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    }
    return list
  }, [allMarket, searchText, categoryFilter, marketSort, matchesSearch])

  /* ── 已连接 Tab 过滤 ── */
  const filteredConnected = useMemo(() => {
    let list = connectedList.filter((c) => matchesSearch(c, searchText))
    switch (connectedFilter) {
      case 'enabled':
        list = list.filter((c) => c.enabled)
        break
      case 'disabled':
        list = list.filter((c) => !c.enabled)
        break
      case 'expired':
        list = list.filter((c) => c.status === 'expired')
        break
      case 'error':
        list = list.filter((c) => c.status === 'error')
        break
    }
    return list
  }, [connectedList, searchText, connectedFilter, matchesSearch])

  /* ── 内置 Tab 过滤 ── */
  const filteredBuiltIn = useMemo(() => {
    let list = allBuiltIn.filter((c) => matchesSearch(c, searchText))
    if (connectedFilter === 'enabled') list = list.filter((c) => c.enabled)
    if (connectedFilter === 'disabled') list = list.filter((c) => !c.enabled)
    return list
  }, [allBuiltIn, searchText, connectedFilter, matchesSearch])

  /* ─ 添加 Dropdown ── */
  const handleAddMenuClick = ({ key }: { key: string }) => {
    if (key === 'create') {
      navigate('/new-task', { state: { initialPrompt: CREATE_CONNECTOR_PROMPT } })
    } else if (key === 'manual') {
      setConfigModalMode('manual')
      setConfigConnector(null)
      setConfigModalOpen(true)
    } else if (key === 'json') {
      setJsonImportOpen(true)
    }
  }

  /* ── 连接操作 ─ */
  const handleConnect = (id: string) => {
    const connector = allMarket.find((c) => c.id === id) ?? allLocal.find((c) => c.id === id)
    if (!connector) return
    setConfigModalMode('connect')
    setConfigConnector(connector)
    setConfigModalOpen(true)
  }

  /* ── 配置操作 ── */
  const handleConfig = (id: string) => {
    const connector =
      allMarket.find((c) => c.id === id) ??
      allLocal.find((c) => c.id === id) ??
      allBuiltIn.find((c) => c.id === id)
    if (!connector) return
    setConfigModalMode('config')
    setConfigConnector(connector)
    setConfigModalOpen(true)
  }

  /* ── 保存配置 ── */
  const handleConfigSave = (data: {
    name: string
    authType: ConnectorAuthType
    accountLabel: string
    endpoint: string
    scopes: ConnectorCapability[]
    enabled: boolean
    isManual: boolean
  }) => {
    if (data.isManual) {
      /* 手动添加：创建 localConnector */
      const newConnector: ConnectorItem = {
        id: `local-connector-${Date.now()}`,
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        author: '自定义',
        category: (configConnector?.category ?? '内置能力') as ConnectorItem['category'],
        source: 'local',
        description: configConnector?.description ?? '',
        version: '1.0.0',
        authType: data.authType,
        status: 'connected',
        connected: true,
        enabled: data.enabled,
        tags: [],
        capabilities: data.scopes,
        scopes: data.scopes,
        endpoint: data.endpoint || undefined,
        accountLabel: data.accountLabel || undefined,
      }
      const nextStore = addLocalConnector(store, newConnector)
      setStore(nextStore)
    } else {
      /* 连接/配置已有连接器 */
      const id = configConnector?.id
      if (!id) return
      const nextStore = updateConnectorState(store, id, {
        connected: true,
        enabled: data.enabled,
        status: 'connected',
        authType: data.authType,
        endpoint: data.endpoint || undefined,
        accountLabel: data.accountLabel || 'GeoWork Local Preview',
        scopes: data.scopes,
        hasSecret: true,
      })
      setStore(nextStore)
    }
    setConfigModalOpen(false)
    message.success('连接器已连接')
  }

  /* ── 断开连接 ─ */
  const handleDisconnect = (id: string) => {
    const connector =
      allMarket.find((c) => c.id === id) ??
      allLocal.find((c) => c.id === id) ??
      allBuiltIn.find((c) => c.id === id)
    if (!connector) return

    const isBuiltIn = connector.source === 'built-in' || connector.id === 'geowork-internal'
    if (isBuiltIn) {
      message.warning('内置连接器不允许断开连接')
      return
    }

    modal.confirm({
      title: '确认断开连接？',
      content: connector.name,
      onOk: () => {
        if (connector.source === 'local') {
          const nextStore = removeLocalConnector(store, id)
          setStore(nextStore)
        } else {
          const nextStore = updateConnectorState(store, id, {
            connected: false,
            enabled: false,
            status: 'not-connected',
          })
          setStore(nextStore)
        }
        message.success('已断开连接')
      },
    })
  }

  /* ── 重置 ── */
  const handleReset = (id: string) => {
    modal.confirm({
      title: '确认重置连接器状态？',
      content: '将恢复为默认状态。',
      onOk: () => {
        const nextStore = resetConnectorState(store, id)
        setStore(nextStore)
        message.success('已重置')
      },
    })
  }

  /* ── 切换启用 ── */
  const handleToggleEnabled = (id: string, enabled: boolean) => {
    const nextStore = updateConnectorState(store, id, { enabled })
    setStore(nextStore)
  }

  /* ─ JSON 导入 ── */
  const handleJsonImport = (data: {
    name: string
    slug: string
    authType: string
    category: string
    description: string
    endpoint?: string
    scopes: string[]
    hasSecret: boolean
  }) => {
    const newConnector: ConnectorItem = {
      id: `local-connector-${Date.now()}`,
      name: data.name,
      slug: data.slug,
      author: '自定义',
      category: data.category as ConnectorItem['category'],
      source: 'local',
      description: data.description,
      version: '1.0.0',
      authType: data.authType as ConnectorAuthType,
      status: 'connected',
      connected: true,
      enabled: true,
      tags: [],
      capabilities: data.scopes as ConnectorCapability[],
      scopes: data.scopes as string[],
      endpoint: data.endpoint,
    }
    const nextStore = addLocalConnector(store, newConnector)
    setStore(nextStore)
    setJsonImportOpen(false)
    message.success('连接器配置已导入')
  }

  /* ── 刷新 ── */
  const handleRefresh = () => {
    refreshStore()
    message.info('连接器列表已刷新')
  }

  /* ── Tab 切换时重置筛选 ── */
  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey)
    setSearchText('')
    if (key === 'market') {
      setCategoryFilter('all')
      setMarketSort('recommended')
    } else {
      setConnectedFilter('all')
    }
  }

  /* ── 渲染 ── */
  const renderMarketTab = () => (
    <>
      <div className={styles.filterRow}>
        <Dropdown
          menu={{
            items: CATEGORY_OPTIONS.map((o) => ({
              key: o.value,
              label: o.label,
              onClick: () => setCategoryFilter(o.value as CategoryFilter),
            })),
          }}
          trigger={['click']}
        >
          <Button size="small">
            {CATEGORY_OPTIONS.find((o) => o.value === categoryFilter)?.label ?? '全部'}
          </Button>
        </Dropdown>
        <Dropdown
          menu={{
            items: SORT_OPTIONS.map((o) => ({
              key: o.value,
              label: o.label,
              onClick: () => setMarketSort(o.value),
            })),
          }}
          trigger={['click']}
        >
          <Button size="small">
            {SORT_OPTIONS.find((o) => o.value === marketSort)?.label ?? '推荐'}
          </Button>
        </Dropdown>
      </div>

      {filteredMarket.length === 0 ? (
        <div className={styles.emptyContent}>
          <Empty description="没有找到匹配的连接器" />
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredMarket.map((c) => (
            <ConnectorCard key={c.id} connector={c} onConnect={handleConnect} />
          ))}
        </div>
      )}
    </>
  )

  const renderConnectedTab = () => (
    <>
      <div className={styles.filterRow}>
        <Dropdown
          menu={{
            items: CONNECTED_FILTER_OPTIONS.map((o) => ({
              key: o.value,
              label: o.label,
              onClick: () => setConnectedFilter(o.value as ConnectedFilter),
            })),
          }}
          trigger={['click']}
        >
          <Button size="small">
            {CONNECTED_FILTER_OPTIONS.find((o) => o.value === connectedFilter)?.label ?? '全部'}
          </Button>
        </Dropdown>
      </div>

      {filteredConnected.length === 0 ? (
        <div className={styles.emptyContent}>
          <Empty description="暂无已连接的连接器" />
        </div>
      ) : (
        <ConnectorList
          connectors={filteredConnected}
          mode="connected"
          onConfig={handleConfig}
          onDisconnect={handleDisconnect}
          onReset={handleReset}
          onToggleEnabled={handleToggleEnabled}
        />
      )}
    </>
  )

  const renderBuiltInTab = () => (
    <>
      <div className={styles.filterRow}>
        <Dropdown
          menu={{
            items: CONNECTED_FILTER_OPTIONS.filter((o) => o.value === 'all' || o.value === 'enabled' || o.value === 'disabled').map((o) => ({
              key: o.value,
              label: o.label,
              onClick: () => setConnectedFilter(o.value as ConnectedFilter),
            })),
          }}
          trigger={['click']}
        >
          <Button size="small">
            {connectedFilter === 'enabled' ? '已启用' : connectedFilter === 'disabled' ? '已禁用' : '全部'}
          </Button>
        </Dropdown>
      </div>

      <ConnectorList
        connectors={filteredBuiltIn}
        mode="builtin"
        onConfig={handleConfig}
        onDisconnect={handleDisconnect}
        onReset={handleReset}
        onToggleEnabled={handleToggleEnabled}
      />
    </>
  )

  const tabItems = [
    { key: 'market', label: `市场 ${marketCount}`, children: renderMarketTab() },
    { key: 'connected', label: `已连接 ${connectedCount}`, children: renderConnectedTab() },
    { key: 'builtin', label: `内置 ${builtInCount}`, children: renderBuiltInTab() },
  ]

  return (
    <div className={styles.pageContainer}>
      {/* ── 顶部工具栏 ─ */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Button icon={<RotateCw />} size="small" onClick={handleRefresh} />
          <Input
            placeholder="搜索连接器..."
            prefix={<Search />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 220 }}
            size="small"
          />
        </div>
        <div className={styles.toolbarRight}>
          <Dropdown
            menu={{
              items: [
                { key: 'create', label: '通过 GeoWork 创建' },
                { key: 'manual', label: '手动添加连接器' },
                { key: 'json', label: '粘贴 JSON 配置' },
              ],
              onClick: handleAddMenuClick,
            }}
            trigger={['click']}
          >
            <Button type="primary" size="small" icon={<Plus />}>
              添加
            </Button>
          </Dropdown>
        </div>
      </div>

      {/* ── 标题区 ── */}
      <div className={styles.header}>
        <Title level={3} className={styles.pageTitle}>连接器</Title>
        <Paragraph type="secondary" className={styles.pageSubtitle}>
          连接外部应用、云服务与数据源，让 GeoWork 工作流可以读取、同步和触发跨平台任务。
        </Paragraph>
      </div>

      {/* ── Hero 横幅 ── */}
      <div
        className={styles.heroCard}
        style={{
          background: token.colorPrimaryBg,
          border: `1px solid ${token.colorPrimaryBorder}`,
          padding: '20px 24px',
        }}
      >
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <Title level={5} style={{ margin: 0, fontSize: 16 }}>
              连接你的应用，释放空间工作流生产力
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              接入 Google、Microsoft 365、浏览器、地图服务、云存储和 GeoWork 内部能力，让数据、文档、日程和地图上下文进入工作流。
            </Text>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.heroPills}>
              {['Google', 'Microsoft 365', 'GeoWork', '浏览器', '地图服务', '云存储', '协作平台', '数据源'].map((tag) => (
                <Tag key={tag} style={{ margin: 0, fontSize: 11 }}>{tag}</Tag>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs（children 已在 tabItems 中渲染） ── */}
      <Tabs
        className={styles.tabs}
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
      />

      {/* ── 连接器与 MCP 区别说明 ── */}
      <Alert
        type="info"
        showIcon
        title="连接器用于管理外部应用、账号授权和数据源访问；MCP 用于接入工具协议和可调用工具服务。后续连接器可以映射到 MCP 工具，但当前页面仅保存前端连接配置。"
        style={{ marginBottom: 24 }}
      />

      {/* ── Modal ── */}
      <ConnectorConfigModal
        open={configModalOpen}
        mode={configModalMode}
        connector={configConnector}
        onCancel={() => setConfigModalOpen(false)}
        onSave={handleConfigSave}
      />

      <ConnectorJsonImportModal
        open={jsonImportOpen}
        onCancel={() => setJsonImportOpen(false)}
        onImport={handleJsonImport}
      />
    </div>
  )
}