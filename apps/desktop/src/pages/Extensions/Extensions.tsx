import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Empty } from '../../components/ui/empty'
import { toast } from 'sonner'
import {
  Settings,
  Download,
  Star,
  CheckCircle,
  Cloud,
  Zap,
  Globe,
  Code,
  Search,
  LayoutGrid
} from 'lucide-react'
import styles from './Extensions.module.scss'

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
  { key: 'all', label: '全部', icon: <Cloud /> },
  { key: 'remote-sensing', label: '遥感', icon: <Zap /> },
  { key: 'gis', label: 'GIS', icon: <Globe /> },
  { key: 'office', label: '办公', icon: <Code /> },
  { key: 'knowledge', label: '知识', icon: <Star /> },
  { key: 'analysis', label: '分析', icon: <LayoutGrid /> },
]

function PluginCard({ plugin, onToggle }: { plugin: Plugin; onToggle: (id: string) => void }) {
  return (
    <Card className={styles.pluginCard}>
      <CardContent>
        <div className={styles.pluginHeader}>
          <div className="flex items-center justify-center rounded-full w-10 h-10" style={{ background: '#1677ff' }}>
            <LayoutGrid className="text-white w-5 h-5" />
          </div>
          <div className={styles.pluginInfo}>
            <span className="font-semibold">{plugin.name}</span>
            <span className="text-xs text-muted-foreground"> v{plugin.version}</span>
          </div>
          <div className="flex items-center gap-2">
            {plugin.enabled && <div className="w-2 h-2 rounded-full bg-green-500" />}
            <Switch
              checked={plugin.enabled}
              onCheckedChange={() => onToggle(plugin.id)}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-3 mb-2 line-clamp-2">
          {plugin.description}
        </p>

        <div className={styles.pluginTags}>
          {plugin.tags.map((tag) => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>

        <div className={styles.pluginFooter}>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500" /> {plugin.rating}</span>
            <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" /> {plugin.downloads > 1000 ? `${(plugin.downloads / 1000).toFixed(1)}k` : plugin.downloads}</span>
            <span className="text-muted-foreground">{plugin.author}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Extensions() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS)

  const handleToggle = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
    toast.success('插件状态已更新')
  }

  const filtered = plugins.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    const matchCategory = category === 'all' || p.category === category
    return matchSearch && matchCategory
  })

  return (
    <div className={styles.extensions}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 className="text-xl font-semibold m-0">扩展中心</h3>
            <p className="text-sm text-muted-foreground">管理和安装 GeoWork 扩展插件</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Settings className="w-4 h-4 mr-1" /> 插件设置</Button>
            <Button><Download className="w-4 h-4 mr-1" /> 从市场安装</Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className={styles.filterBar}>
          <Input
            placeholder="搜索插件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[320px]"
          />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat.key}
                variant={category === cat.key ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1 text-xs"
                onClick={() => setCategory(cat.key)}
              >
                {cat.icon} {cat.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Plugin Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} onToggle={handleToggle} />
            ))}
          </div>
        ) : (
          <Empty description="没有找到匹配的插件" />
        )}

        {/* Installed Plugins List */}
        <Card>
          <CardHeader>
            <CardTitle>已安装的插件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              {plugins.filter((p) => p.enabled).map((plugin) => (
                <div key={plugin.id} className={styles.installedItem}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-full w-8 h-8" style={{ background: '#1677ff' }}>
                      <LayoutGrid className="text-white w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{plugin.name}</div>
                      <div className="text-xs text-muted-foreground">v{plugin.version} — {plugin.description}</div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> 已启用</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
