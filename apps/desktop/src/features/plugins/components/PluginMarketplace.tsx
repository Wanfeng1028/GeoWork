// GeoWork Desktop - Plugin Marketplace Grid
// Displays installed and available plugins as a searchable, filterable grid

import { useState, useMemo, useCallback } from 'react'
import { Card } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Input } from '../../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../components/ui/select'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../components/ui/tooltip'
import { Empty } from '../../../components/ui/empty'
import { Search, Download, CheckCircle, Settings } from 'lucide-react'
import usePluginStore from '../../pluginStore'
import styles from './PluginMarketplace.module.scss'

interface PluginMarketplaceProps {
  onSelectPlugin?: (plugin: { id: string; name: string; description: string; version: string; author: string; permissions: string[]; installed: boolean; enabled: boolean }) => void
}

const CATEGORIES = [
  { label: '全部', value: '' },
  { label: '数据处理', value: 'data' },
  { label: '可视化', value: 'visualization' },
  { label: '分析', value: 'analysis' },
  { label: '导入/导出', value: 'io' },
  { label: '工具', value: 'tool' },
]

const RATING_COLORS = ['#ff2400', '#ff8c00', '#ffd700', '#9acd32', '#00c853']

const getBadgeClass = (color: string): string => {
  const map: Record<string, string> = {
    magenta: 'bg-pink-500/20 text-pink-400',
    orange: 'bg-orange-500/20 text-orange-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    default: 'bg-gray-500/20 text-gray-400',
  }
  return map[color] || map.default
}

export function PluginMarketplace({ onSelectPlugin }: PluginMarketplaceProps) {
  const { plugins, isLoading } = usePluginStore()
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filteredPlugins = useMemo(() => {
    let result = plugins

    if (categoryFilter) {
      result = result.filter((p) => p.category === categoryFilter)
    }

    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.author.toLowerCase().includes(query)
      )
    }

    return result
  }, [plugins, searchText, categoryFilter])

  const handleCardClick = useCallback(
    (plugin: (typeof plugins)[number]) => {
      if (onSelectPlugin) {
        onSelectPlugin({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          author: plugin.author,
          permissions: plugin.permissions,
          installed: plugin.installed,
          enabled: plugin.enabled,
        })
      }
    },
    [onSelectPlugin]
  )

  const getInstallCountText = (count?: number) => {
    if (!count) return '0'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}w`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count)
  }

  const getRatingStars = (rating?: number) => {
    if (!rating) return null
    const stars = Math.round(rating)
    return (
      <div className={styles.ratingStars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            style={{
              color: i < stars ? RATING_COLORS[stars - 1] : '#334',
              fontSize: 12,
            }}
          >
            ★
          </span>
        ))}
        <span className="text-[13px] text-[var(--gw-text-secondary)] ml-1">
          {rating.toFixed(1)}
        </span>
      </div>
    )
  }

  const getPermissionTagColor = (perm: string): string => {
    const highRisk = ['install_package', 'run_shell', 'network_access', 'access_secrets']
    if (highRisk.includes(perm)) return 'magenta'
    const medRisk = ['write_file', 'delete_file', 'run_python', 'launch_process']
    if (medRisk.includes(perm)) return 'orange'
    return 'blue'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h3 className="text-[15px] font-semibold text-[var(--gw-text)]">
            插件市场
          </h3>
          <span className="text-[13px] text-[var(--gw-text-secondary)]">
            {filteredPlugins.length} 个插件
          </span>
        </div>
        <div className={styles.headerFilters}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className={styles.categorySelect}>
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--gw-text-tertiary)]" />
            <Input
              placeholder="搜索插件..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={`pl-8 ${styles.searchInput}`}
            />
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {isLoading ? (
          <Empty description="加载中..." className={styles.empty} />
        ) : filteredPlugins.length === 0 ? (
          <Empty description="没有找到匹配的插件" className={styles.empty} />
        ) : (
          filteredPlugins.map((plugin) => (
            <Card
              key={plugin.id}
              className={`${styles.pluginCard} ${plugin.installed ? styles.pluginCardInstalled : ''}`}
              onClick={() => handleCardClick(plugin)}
            >
              <div className={styles.pluginHeader}>
                <div className={styles.pluginIcon}>
                  {plugin.installed ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Settings className="h-5 w-5" />
                  )}
                </div>
                <div className={styles.pluginTitleWrap}>
                  <span className={styles.pluginName}>{plugin.name}</span>
                  {plugin.installed && (
                    <Badge className="bg-green-500/20 text-green-400">已安装</Badge>
                  )}
                </div>
              </div>

              <p className={styles.pluginDescription}>{plugin.description}</p>

              <div className={styles.pluginMeta}>
                <div className={styles.metaLeft}>
                  <span className="text-[13px] text-[var(--gw-text-secondary)]">
                    v{plugin.version}
                  </span>
                  <span className="text-[13px] text-[var(--gw-text-secondary)] ml-2">
                    {plugin.author}
                  </span>
                </div>
                <div className={styles.metaRight}>
                  {getRatingStars(plugin.rating)}
                  {plugin.installCount !== undefined && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-[13px] text-[var(--gw-text-tertiary)]">
                          <Download className="h-3 w-3" />
                          <span>{getInstallCountText(plugin.installCount)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>安装次数</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {plugin.permissions.length > 0 && (
                <div className={styles.pluginPermissions}>
                  {plugin.permissions.slice(0, 3).map((perm) => (
                    <Badge
                      key={perm}
                      className={getBadgeClass(getPermissionTagColor(perm))}
                    >
                      {perm}
                    </Badge>
                  ))}
                  {plugin.permissions.length > 3 && (
                    <Badge variant="secondary">
                      +{plugin.permissions.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
