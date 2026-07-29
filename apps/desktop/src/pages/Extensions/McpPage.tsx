import { useEffect, useMemo, useState } from 'react'
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
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { McpServerCard } from './components/McpServerCard'
import { McpServerList } from './components/McpServerList'
import { McpConfigModal } from './components/McpConfigModal'
import {
  marketMcpServers,
  builtInMcpServers,
  mcpCategories,
} from './mcpMockData'
import type { McpServerItem, McpTransport, McpStatus } from './mcpMockData'
import {
  loadMcpStore,
  mergeMcpServers,
  updateMcpState,
  addLocalMcpServer,
  resetMcpState,
  sanitizeEnv,
} from './mcpStorage'
import type { McpStore } from './mcpStorage'
import styles from './McpPage.module.css'

const { Title, Paragraph, Text } = Typography

type TabKey = 'market' | 'builtin' | 'connected'
type SortKey = 'popular' | 'latest' | 'name' | 'connected-first'
type ConnectedFilter = 'all' | 'enabled' | 'disabled' | 'error'

const CREATE_MCP_PROMPT = `我要创建一个 GeoWork MCP 服务配置，面向【GIS / 遥感 / 空间数据处理】场景。

MCP 服务目标：
【请描述这个 MCP 服务要连接什么工具或数据源】

建议包含：
1. 服务名称。
2. 连接方式，例如 stdio、HTTP、SSE 或 WebSocket。
3. 需要接入的工具，例如 PostGIS、GeoServer、QGIS、GDAL、Sentinel Hub、ArcGIS REST。
4. 需要暴露的能力，例如读取图层、查询空间数据、执行缓冲区分析、导出地图、读取遥感影像。
5. 输入参数和输出结果格式。
6. 权限、安全和环境变量要求。
7. 在 GeoWork 对话中如何调用这个 MCP 服务。`

export function McpPage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { message } = App.useApp()

  /* ─ 状态 ── */
  const [store, setStore] = useState<McpStore>(loadMcpStore)
  const [activeTab, setActiveTab] = useState<TabKey>('market')
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('全部')
  const [sortBy, setSortBy] = useState<SortKey>('popular')
  const [connectedFilter, setConnectedFilter] = useState<ConnectedFilter>('all')
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configModalMode, setConfigModalMode] = useState<'connect' | 'config' | 'import'>('connect')
  const [configModalServer, setConfigModalServer] = useState<McpServerItem | null>(null)

  /* ── 合并后的全部 MCP ── */
  const allServers = useMemo(() => {
    const market = mergeMcpServers(marketMcpServers, store)
    const builtin = mergeMcpServers(builtInMcpServers, store)
    const local = store.localServers
    return [...market, ...builtin, ...local]
  }, [store])

  /* ── 分类统计 ── */
  const marketCount = marketMcpServers.length
  const builtinCount = builtInMcpServers.length
  const connectedCount = allServers.filter((s) => s.connected).length

  /* ── 市场 MCP 过滤排序 ── */
  const filteredMarketServers = useMemo(() => {
    let result = allServers.filter((s) => s.source === 'market')

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          s.tools.some((t) => t.toLowerCase().includes(q)),
      )
    }

    if (categoryFilter !== '全部') {
      result = result.filter((s) => s.category === categoryFilter)
    }

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
      case 'connected-first':
        result = [...result].sort((a, b) => Number(b.connected) - Number(a.connected))
        break
      case 'latest':
      default:
        break
    }

    return result
  }, [allServers, searchText, categoryFilter, sortBy])

  /* ── 内置 MCP 过滤 ── */
  const filteredBuiltinServers = useMemo(() => {
    let result = allServers.filter((s) => s.source === 'built-in')

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tools.some((t) => t.toLowerCase().includes(q)),
      )
    }

    return result
  }, [allServers, searchText])

  /* ── 已连接 MCP 过滤 ── */
  const filteredConnectedServers = useMemo(() => {
    let result = allServers.filter((s) => s.connected)

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tools.some((t) => t.toLowerCase().includes(q)),
      )
    }

    if (connectedFilter === 'enabled') {
      result = result.filter((s) => s.enabled)
    } else if (connectedFilter === 'disabled') {
      result = result.filter((s) => !s.enabled)
    } else if (connectedFilter === 'error') {
      result = result.filter((s) => s.status === 'error')
    }

    return result
  }, [allServers, searchText, connectedFilter])

  /* ── 事件监听 ── */
  useEffect(() => {
    const refresh = () => setStore(loadMcpStore())
    window.addEventListener('geowork:mcp-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('geowork:mcp-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  /* ─ 操作 ── */
  const handleConnect = (server: McpServerItem) => {
    setConfigModalServer(server)
    setConfigModalMode('connect')
    setConfigModalOpen(true)
  }

  const handleConfigure = (server: McpServerItem) => {
    setConfigModalServer(server)
    setConfigModalMode('config')
    setConfigModalOpen(true)
  }

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    const status: McpStatus = enabled ? 'connected' : 'disabled'
    const next = updateMcpState(store, id, { enabled, status })
    setStore(next)
  }

  const handleDisconnect = (id: string) => {
    const server = allServers.find((s) => s.id === id)
    if (!server) return
    if (server.source === 'built-in') {
      message.info('内置 MCP 不允许断开连接，只能禁用')
      return
    }
    const next = updateMcpState(store, id, {
      connected: false,
      enabled: false,
      status: 'not-connected',
    })
    setStore(next)
    message.info('MCP 已断开连接')
  }

  const handleReset = (id: string) => {
    const marketServer = marketMcpServers.find((s) => s.id === id)
    const builtinServer = builtInMcpServers.find((s) => s.id === id)
    const original = marketServer ?? builtinServer
    if (original) {
      const next = resetMcpState(store, id, {
        connected: original.connected,
        enabled: original.enabled,
        status: original.status,
      })
      setStore(next)
      message.info('MCP 已重置为默认状态')
    }
  }

  const handleConfigSave = (data: {
    name: string
    transport: McpTransport
    endpoint?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    enabled: boolean
  }) => {
    if (configModalMode === 'import') {
      const ts = Date.now()
      const localServer: McpServerItem = {
        id: `local-mcp-${ts}`,
        name: data.name,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
        author: '@Local',
        category: '开发工具',
        source: 'local',
        description: '本地导入的 MCP 服务配置。',
        version: 'v1.0.0',
        transport: data.transport,
        endpoint: data.endpoint,
        command: data.command,
        args: data.args,
        env: sanitizeEnv(data.env),
        connected: true,
        enabled: data.enabled,
        status: 'connected',
        tags: ['本地', '导入'],
        tools: [],
      }
      const next = addLocalMcpServer(store, localServer)
      setStore(next)
      message.success('MCP 配置已导入')
    } else if (configModalServer) {
      const next = updateMcpState(store, configModalServer.id, {
        connected: true,
        enabled: data.enabled,
        status: 'connected',
        endpoint: data.endpoint,
        command: data.command,
        args: data.args,
        env: sanitizeEnv(data.env),
      })
      setStore(next)
      message.success('MCP 已连接')
    }
    setConfigModalOpen(false)
  }

  const handleCreateMcp = () => {
    navigate('/new-task', { state: { initialPrompt: CREATE_MCP_PROMPT } })
  }

  const handleRefresh = () => {
    setStore(loadMcpStore())
    message.info('MCP 服务列表已刷新')
  }

  /* ── Dropdown 菜单 ── */
  const addMenuItems = [
    {
      key: 'create',
      label: '通过 GeoWork 创建',
      onClick: handleCreateMcp,
    },
    {
      key: 'import',
      label: '导入 MCP 配置',
      onClick: () => {
        setConfigModalServer(null)
        setConfigModalMode('import')
        setConfigModalOpen(true)
      },
    },
  ]

  const filterMenuItems = mcpCategories.map((cat) => ({
    key: cat,
    label: cat,
    onClick: () => setCategoryFilter(cat),
  }))

  const sortMenuItems = [
    { key: 'popular', label: '热门', onClick: () => setSortBy('popular') },
    { key: 'latest', label: '最新', onClick: () => setSortBy('latest') },
    { key: 'name', label: '名称', onClick: () => setSortBy('name') },
    { key: 'connected-first', label: '已连接优先', onClick: () => setSortBy('connected-first') },
  ]

  const connectedFilterItems = [
    { key: 'all', label: '全部', onClick: () => setConnectedFilter('all') },
    { key: 'enabled', label: '已启用', onClick: () => setConnectedFilter('enabled') },
    { key: 'disabled', label: '已禁用', onClick: () => setConnectedFilter('disabled') },
    { key: 'error', label: '错误', onClick: () => setConnectedFilter('error') },
  ]

  const sortLabel = sortMenuItems.find((i) => i.key === sortBy)?.label ?? '热门'
  const connectedFilterLabel = connectedFilterItems.find((i) => i.key === connectedFilter)?.label ?? '全部'

  return (
    <div className={styles.pageContainer}>
      {/* 顶部工具栏 */}
      <div className={styles.toolbar}>
        <Space>
          <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} />
          <Input
            placeholder="搜索 MCP 服务..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
        </Space>
        <Dropdown menu={{ items: addMenuItems }} trigger={['click']}>
          <Button type="primary" icon={<PlusOutlined />}>添加</Button>
        </Dropdown>
      </div>

      {/* 标题区 */}
      <div className={styles.header}>
        <Title level={2} className={styles.pageTitle}>MCP</Title>
        <Paragraph type="secondary" className={styles.pageSubtitle}>
          连接和管理 GeoWork 的 MCP 服务，让空间数据、地图服务、遥感工具和本地能力进入对话工作流。
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
              连接空间智能工具链
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              通过 MCP 接入 GIS 服务、遥感平台、数据库、文件系统和分析工具，让 GeoWork 在任务中调用外部能力。
            </Text>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.heroPills}>
              <Tag>PostGIS</Tag>
              <Tag>GeoServer</Tag>
              <Tag>QGIS</Tag>
              <Tag>GDAL</Tag>
              <Tag>遥感影像</Tag>
              <Tag>矢量数据</Tag>
              <Tag>地图服务</Tag>
              <Tag>工具调用</Tag>
            </div>
            <Button type="primary" onClick={handleCreateMcp}>
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
          { key: 'connected', label: `已连接 ${connectedCount}` },
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
        {activeTab === 'connected' && (
          <Dropdown menu={{ items: connectedFilterItems }} trigger={['click']}>
            <Button size="small">{connectedFilterLabel}</Button>
          </Dropdown>
        )}
      </div>

      {/* 内容区 */}
      <div className={styles.content}>
        {/* 市场 Tab */}
        {activeTab === 'market' && (
          <>
            {filteredMarketServers.length === 0 ? (
              <Empty description="暂无匹配 MCP 服务" />
            ) : (
              <div className={styles.cardGrid}>
                {filteredMarketServers.map((server) => (
                  <McpServerCard
                    key={server.id}
                    server={server}
                    onConnect={handleConnect}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* 内置 Tab */}
        {activeTab === 'builtin' && (
          <>
            {filteredBuiltinServers.length === 0 ? (
              <Empty description="暂无匹配内置 MCP" />
            ) : (
              <McpServerList
                servers={filteredBuiltinServers}
                mode="builtin"
                onToggleEnabled={handleToggleEnabled}
              />
            )}
          </>
        )}

        {/* 已连接 Tab */}
        {activeTab === 'connected' && (
          <>
            {filteredConnectedServers.length === 0 ? (
              <Empty
                description={
                  <div className={styles.emptyContent}>
                    <Text strong>暂无已连接 MCP</Text>
                    <Text type="secondary">可以从市场连接，或导入本地 MCP 配置。</Text>
                  </div>
                }
              />
            ) : (
              <McpServerList
                servers={filteredConnectedServers}
                mode="connected"
                onToggleEnabled={handleToggleEnabled}
                onConfigure={handleConfigure}
                onDisconnect={handleDisconnect}
                onReset={handleReset}
              />
            )}
          </>
        )}
      </div>

      {/* 配置弹窗 */}
      <McpConfigModal
        open={configModalOpen}
        mode={configModalMode}
        server={configModalServer}
        onClose={() => setConfigModalOpen(false)}
        onSave={handleConfigSave}
      />
    </div>
  )
}
