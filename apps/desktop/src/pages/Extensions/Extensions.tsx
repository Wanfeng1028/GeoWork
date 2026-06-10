import { useState, useEffect } from 'react'
import { Layout, Card, Row, Col, Tag, Button, Input, Empty, Space, Typography, List, Avatar, Switch, message, Badge } from 'antd'
import {
  SettingOutlined,
  DownloadOutlined,
  StarOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  CodeOutlined,
  SearchOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import styles from './Extensions.module.scss'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

// ─── Mock Plugin Data ───────────────────────────────────────────────

interface Plugin {
  id: string
  name: string
  description: string
  category: string
  version: string
  author: string
  rating: number
  downloads: number
  enabled: boolean
  tags: string[]
}

const MOCK_PLUGINS: Plugin[] = [
  {
    id: 'gee-integration',
    name: 'GEE 集成',
    description: 'Google Earth Engine 数据访问和脚本生成插件，支持 Sentinel-2、Landsat 等数据集',
    category: 'remote-sensing',
    version: '1.2.0',
    author: 'GeoWork Team',
    rating: 4.8,
    downloads: 3200,
    enabled: true,
    tags: ['GEE', 'Sentinel', 'Landsat', 'NDVI']
  },
  {
    id: 'gdal-tools',
    name: 'GDAL 工具集',
    description: '提供 GDAL 栅格数据处理能力，包括裁剪、重投影、COG 生成等',
    category: 'gis',
    version: '1.0.3',
    author: 'GeoWork Team',
    rating: 4.6,
    downloads: 2800,
    enabled: true,
    tags: ['GDAL', 'Raster', 'COG']
  },
  {
    id: 'qgis-bridge',
    name: 'QGIS 桥接',
    description: '连接本地 QGIS 安装，调用 QGIS 处理算法和图层管理',
    category: 'gis',
    version: '0.9.1',
    author: 'GeoWork Team',
    rating: 4.4,
    downloads: 1900,
    enabled: false,
    tags: ['QGIS', 'Processing']
  },
  {
    id: 'office-generator',
    name: 'Office 文档生成',
    description: '生成 Word、PowerPoint、Excel 和 Jupyter Notebook 格式的分析报告',
    category: 'office',
    version: '1.1.0',
    author: 'GeoWork Team',
    rating: 4.5,
    downloads: 2100,
    enabled: true,
    tags: ['Word', 'PPT', 'Excel', 'Notebook']
  },
  {
    id: 'paper-reader',
    name: '论文阅读器',
    description: 'PDF 论文解析、OpenAlex 学术搜索和文献矩阵生成',
    category: 'knowledge',
    version: '0.8.0',
    author: 'GeoWork Team',
    rating: 4.3,
    downloads: 1500,
    enabled: true,
    tags: ['PDF', 'OpenAlex', 'Literature']
  },
  {
    id: 'diff-viewer',
    name: '差异对比查看器',
    description: '栅格影像前后对比、变化检测可视化插件',
    category: 'analysis',
    version: '0.5.2',
    author: 'GeoWork Team',
    rating: 4.2,
    downloads: 980,
    enabled: false,
    tags: ['Diff', 'Change Detection']
  }
]

const CATEGORIES = [
  { key: 'all', label: '全部', icon: <CloudOutlined /> },
  { key: 'remote-sensing', label: '遥感', icon: <ThunderboltOutlined /> },
  { key: 'gis', label: 'GIS', icon: <GlobalOutlined /> },
  { key: 'office', label: '办公', icon: <CodeOutlined /> },
  { key: 'knowledge', label: '知识', icon: <StarOutlined /> },
  { key: 'analysis', label: '分析', icon: <AppstoreOutlined /> },
]

// ─── Plugin Card ────────────────────────────────────────────────────

function PluginCard({ plugin, onToggle }: { plugin: Plugin; onToggle: (id: string) => void }) {
  return (
    <Card className={styles.pluginCard} hoverable>
      <div className={styles.pluginHeader}>
        <Avatar size={40} icon={<AppstoreOutlined />} style={{ background: '#1677ff' }} />
        <div className={styles.pluginInfo}>
          <Text strong>{plugin.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}> v{plugin.version}</Text>
        </div>
        <Badge dot={plugin.enabled} offset={[0, 10]}>
          <Switch
            size="small"
            checked={plugin.enabled}
            onChange={() => onToggle(plugin.id)}
          />
        </Badge>
      </div>

      <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginTop: 12, marginBottom: 8 }}>
        {plugin.description}
      </Paragraph>

      <div className={styles.pluginTags}>
        {plugin.tags.map((tag) => (
          <Tag key={tag} color="blue">{tag}</Tag>
        ))}
      </div>

      <div className={styles.pluginFooter}>
        <Space size="large">
          <span><StarOutlined style={{ color: '#f59e0b' }} /> {plugin.rating}</span>
          <span><DownloadOutlined /> {plugin.downloads > 1000 ? `${(plugin.downloads / 1000).toFixed(1)}k` : plugin.downloads}</span>
          <span style={{ color: 'secondary' }}>{plugin.author}</span>
        </Space>
      </div>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function Extensions() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS)

  const handleToggle = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
    message.success('插件状态已更新')
  }

  const filtered = plugins.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    const matchCategory = category === 'all' || p.category === category
    return matchSearch && matchCategory
  })

  return (
    <Layout className={styles.extensions}>
      <Content className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <Title level={3} style={{ margin: 0 }}>扩展中心</Title>
            <Text type="secondary">管理和安装 GeoWork 扩展插件</Text>
          </div>
          <Space>
            <Button icon={<SettingOutlined />}>插件设置</Button>
            <Button type="primary" icon={<DownloadOutlined />}>从市场安装</Button>
          </Space>
        </div>

        {/* Search and Filter */}
        <div className={styles.filterBar}>
          <Input
            placeholder="搜索插件..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 320 }}
          />
          <Space wrap>
            {CATEGORIES.map((cat) => (
              <Tag
                key={cat.key}
                color={category === cat.key ? 'blue' : 'default'}
                style={{ cursor: 'pointer', padding: '2px 12px', fontSize: 13 }}
                onClick={() => setCategory(cat.key)}
              >
                {cat.icon} {cat.label}
              </Tag>
            ))}
          </Space>
        </div>

        {/* Plugin Grid */}
        {filtered.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filtered.map((plugin) => (
              <Col xs={24} sm={12} lg={8} key={plugin.id}>
                <PluginCard plugin={plugin} onToggle={handleToggle} />
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="没有找到匹配的插件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {/* Installed Plugins List */}
        <Card title="已安装的插件" size="small">
          <List
            dataSource={plugins.filter((p) => p.enabled)}
            renderItem={(plugin) => (
              <List.Item className={styles.installedItem}>
                <List.Item.Meta
                  avatar={<Avatar size="small" icon={<AppstoreOutlined />} style={{ background: '#1677ff' }} />}
                  title={plugin.name}
                  description={`v${plugin.version} — ${plugin.description}`}
                />
                <Tag color="green"><CheckCircleOutlined /> 已启用</Tag>
              </List.Item>
            )}
          />
        </Card>
      </Content>
    </Layout>
  )
}
