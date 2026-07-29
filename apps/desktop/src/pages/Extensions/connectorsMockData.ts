/**
 * GeoWork 连接器 — Mock 数据
 *
 * 市场连接器 12 个 + 内置连接器 4 个。
 * 全部围绕 GeoWork 的 GIS / 遥感 / 空间数据场景。
 */

export type ConnectorCategory =
  | '办公协作'
  | '云存储'
  | '地图服务'
  | '空间数据'
  | '浏览器'
  | '通知渠道'
  | '内置能力'

export type ConnectorAuthType =
  | 'oauth'
  | 'api-key'
  | 'webhook'
  | 'browser-session'
  | 'local-bridge'
  | 'internal'
  | 'manual'

export type ConnectorSource = 'market' | 'built-in' | 'local'

export type ConnectorStatus =
  | 'not-connected'
  | 'connected'
  | 'disabled'
  | 'expired'
  | 'error'

export type ConnectorCapability =
  | 'read-files'
  | 'write-files'
  | 'read-calendar'
  | 'write-calendar'
  | 'read-email'
  | 'send-message'
  | 'read-map'
  | 'write-map'
  | 'read-dataset'
  | 'sync-task'
  | 'trigger-workflow'
  | 'notification'

export interface ConnectorItem {
  id: string
  name: string
  slug: string
  author: string
  category: ConnectorCategory
  source: ConnectorSource
  description: string
  version: string
  authType: ConnectorAuthType
  status: ConnectorStatus
  connected: boolean
  enabled: boolean
  featured?: boolean
  tags: string[]
  capabilities: ConnectorCapability[]
  scopes: string[]
  endpoint?: string
  accountLabel?: string
  downloads?: string
}

/* ── 市场连接器 ── */

export const marketConnectors: ConnectorItem[] = [
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    slug: 'google-workspace',
    author: 'Google',
    category: '办公协作',
    source: 'market',
    description: '连接 Google Drive、Docs、Sheets 和 Calendar，用于读取项目文档、表格数据和日程提醒。',
    version: '2.1.0',
    authType: 'oauth',
    status: 'not-connected',
    connected: false,
    enabled: false,
    featured: true,
    tags: ['Google', 'Drive', 'Docs', 'Calendar'],
    capabilities: ['read-files', 'write-files', 'read-calendar', 'write-calendar'],
    scopes: ['Drive 文件', '表格', '日历'],
    downloads: '38.2K',
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    slug: 'microsoft-365',
    author: 'Microsoft',
    category: '办公协作',
    source: 'market',
    description: '连接 OneDrive、Word、Excel、Outlook 和 Teams，用于同步文档、表格、邮件和协作通知。',
    version: '3.0.2',
    authType: 'oauth',
    status: 'not-connected',
    connected: false,
    enabled: false,
    featured: true,
    tags: ['Microsoft', 'OneDrive', 'Outlook', 'Teams'],
    capabilities: ['read-files', 'write-files', 'read-email', 'send-message'],
    scopes: ['OneDrive', 'Outlook', 'Teams'],
    downloads: '35.6K',
  },
  {
    id: 'geowork-internal',
    name: 'GeoWork',
    slug: 'geowork-internal',
    author: 'GeoWork',
    category: '内置能力',
    source: 'market',
    description: '连接 GeoWork 内部任务、记忆、工作目录、数据中心和地图上下文。',
    version: '1.0.0',
    authType: 'internal',
    status: 'connected',
    connected: true,
    enabled: true,
    featured: true,
    tags: ['GeoWork', '核心'],
    capabilities: ['read-dataset', 'sync-task', 'trigger-workflow', 'read-map'],
    scopes: ['任务', '记忆', '工作目录', '数据中心', '地图'],
    downloads: '31.4K',
  },
  {
    id: 'browser-context',
    name: '浏览器',
    slug: 'browser-context',
    author: 'GeoWork',
    category: '浏览器',
    source: 'market',
    description: '读取当前浏览器标签页标题、URL 和选中内容，辅助 GeoWork 理解网页上下文。',
    version: '1.2.0',
    authType: 'browser-session',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['浏览器', '标签页', '上下文'],
    capabilities: ['read-files', 'trigger-workflow'],
    scopes: ['浏览器标签页'],
    downloads: '27.8K',
  },
  {
    id: 'arcgis-online',
    name: 'ArcGIS Online',
    slug: 'arcgis-online',
    author: 'Esri',
    category: '地图服务',
    source: 'market',
    description: '连接 ArcGIS Online 图层、Web Map 和要素服务，用于读取地图和空间数据。',
    version: '4.5.1',
    authType: 'oauth',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['ArcGIS', 'Esri', 'Web Map'],
    capabilities: ['read-map', 'write-map', 'read-dataset'],
    scopes: ['图层', 'Web Map', '要素服务'],
    downloads: '24.2K',
  },
  {
    id: 'geoserver',
    name: 'GeoServer',
    slug: 'geoserver',
    author: 'OpenSource',
    category: '地图服务',
    source: 'market',
    description: '连接 GeoServer 工作区、图层、样式和 WMS/WFS 服务。',
    version: '2.24.0',
    authType: 'api-key',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['GeoServer', 'WMS', 'WFS'],
    capabilities: ['read-map', 'read-dataset'],
    scopes: ['工作区', '图层', '样式'],
    downloads: '22.5K',
  },
  {
    id: 'postgis-database',
    name: 'PostGIS 数据库',
    slug: 'postgis-database',
    author: 'PostgreSQL',
    category: '空间数据',
    source: 'market',
    description: '连接 PostGIS 数据库，读取空间表、字段、几何类型和范围统计。',
    version: '3.4.0',
    authType: 'manual',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['PostGIS', 'PostgreSQL', '空间表'],
    capabilities: ['read-dataset'],
    scopes: ['空间表', '字段', '几何类型'],
    downloads: '21.1K',
  },
  {
    id: 'google-earth-engine',
    name: 'Google Earth Engine',
    slug: 'google-earth-engine',
    author: 'Google',
    category: '空间数据',
    source: 'market',
    description: '连接 Earth Engine 资产和遥感数据集，用于影像检索和指数分析。',
    version: '1.8.3',
    authType: 'oauth',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['Earth Engine', '遥感', '影像'],
    capabilities: ['read-dataset', 'trigger-workflow'],
    scopes: ['资产', '遥感数据集'],
    downloads: '19.3K',
  },
  {
    id: 'amap-open-platform',
    name: '高德开放平台',
    slug: 'amap-open-platform',
    author: '高德',
    category: '地图服务',
    source: 'market',
    description: '连接高德地图开放平台，用于地址解析、路径规划和 POI 查询。',
    version: '2.0.5',
    authType: 'api-key',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['高德', '地图', 'POI'],
    capabilities: ['read-map', 'read-dataset'],
    scopes: ['地址解析', '路径规划', 'POI'],
    downloads: '16.9K',
  },
  {
    id: 'wecom',
    name: '企业微信',
    slug: 'wecom',
    author: '腾讯',
    category: '通知渠道',
    source: 'market',
    description: '通过企业微信群机器人发送任务提醒、报告摘要和执行结果。',
    version: '1.3.0',
    authType: 'webhook',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['企业微信', '机器人', '通知'],
    capabilities: ['send-message', 'notification'],
    scopes: ['群机器人'],
    downloads: '13.8K',
  },
  {
    id: 'lark',
    name: '飞书',
    slug: 'lark',
    author: '字节跳动',
    category: '通知渠道',
    source: 'market',
    description: '连接飞书机器人和文档，用于发送任务通知、同步报告和协作信息。',
    version: '2.1.1',
    authType: 'webhook',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['飞书', '机器人', '文档'],
    capabilities: ['send-message', 'notification', 'read-files'],
    scopes: ['机器人', '文档'],
    downloads: '12.4K',
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    slug: 'dingtalk',
    author: '阿里巴巴',
    category: '通知渠道',
    source: 'market',
    description: '连接钉钉机器人，将 GeoWork 任务状态和报告摘要推送到团队群。',
    version: '1.5.2',
    authType: 'webhook',
    status: 'not-connected',
    connected: false,
    enabled: false,
    tags: ['钉钉', '机器人', '推送'],
    capabilities: ['send-message', 'notification'],
    scopes: ['群机器人'],
    downloads: '10.9K',
  },
]

/* ── 内置连接器 ─ */

export const builtInConnectors: ConnectorItem[] = [
  {
    id: 'geowork-workdir',
    name: 'GeoWork 工作目录',
    slug: 'geowork-workdir',
    author: 'GeoWork',
    category: '内置能力',
    source: 'built-in',
    description: '连接当前任务工作目录，读取本地数据文件、地图文件和分析输入。',
    version: '1.0.0',
    authType: 'internal',
    status: 'connected',
    connected: true,
    enabled: true,
    tags: ['工作目录', '本地文件'],
    capabilities: ['read-files', 'write-files'],
    scopes: ['工作目录'],
  },
  {
    id: 'geowork-datacenter',
    name: 'GeoWork 数据中心',
    slug: 'geowork-datacenter',
    author: 'GeoWork',
    category: '内置能力',
    source: 'built-in',
    description: '连接 GeoWork 数据中心，读取已登记的数据集、字段、坐标系和元信息。',
    version: '1.0.0',
    authType: 'internal',
    status: 'connected',
    connected: true,
    enabled: true,
    tags: ['数据中心', '数据集'],
    capabilities: ['read-dataset'],
    scopes: ['数据集', '字段', '坐标系'],
  },
  {
    id: 'geowork-map-context',
    name: 'GeoWork 地图上下文',
    slug: 'geowork-map-context',
    author: 'GeoWork',
    category: '内置能力',
    source: 'built-in',
    description: '连接当前地图视图、图层列表、选中要素和制图状态。',
    version: '1.0.0',
    authType: 'internal',
    status: 'connected',
    connected: true,
    enabled: true,
    tags: ['地图', '图层', '视图'],
    capabilities: ['read-map', 'write-map'],
    scopes: ['地图视图', '图层', '选中要素'],
  },
  {
    id: 'geowork-task-center',
    name: 'GeoWork 任务中心',
    slug: 'geowork-task-center',
    author: 'GeoWork',
    category: '内置能力',
    source: 'built-in',
    description: '连接定时任务、执行记录、任务状态和通知队列。',
    version: '1.0.0',
    authType: 'internal',
    status: 'connected',
    connected: true,
    enabled: true,
    tags: ['任务', '定时', '通知'],
    capabilities: ['sync-task', 'trigger-workflow', 'notification'],
    scopes: ['定时任务', '执行记录', '通知队列'],
  },
]

/* ── 分类列表 ── */

export const connectorCategories: ConnectorCategory[] = [
  '办公协作',
  '云存储',
  '地图服务',
  '空间数据',
  '浏览器',
  '通知渠道',
  '内置能力',
]

/* ── 连接方式标签映射 ── */

export const AUTH_TYPE_LABELS: Record<ConnectorAuthType, string> = {
  oauth: 'OAuth',
  'api-key': 'API Key',
  webhook: 'Webhook',
  'browser-session': '浏览器会话',
  'local-bridge': '本地桥接',
  internal: '内置集成',
  manual: '手动配置',
}

/* ── 能力标签映射 ── */

export const CAPABILITY_LABELS: Record<ConnectorCapability, string> = {
  'read-files': '读取文件',
  'write-files': '写入文件',
  'read-calendar': '读取日历',
  'write-calendar': '写入日历',
  'read-email': '读取邮件',
  'send-message': '发送消息',
  'read-map': '读取地图',
  'write-map': '写入地图',
  'read-dataset': '读取数据集',
  'sync-task': '同步任务',
  'trigger-workflow': '触发工作流',
  notification: '通知',
}
