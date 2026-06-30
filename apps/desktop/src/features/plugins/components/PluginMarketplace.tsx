// GeoWork Desktop - Plugin Marketplace Grid
// Displays installed and available plugins as a searchable, filterable grid

import { useState, useMemo, useCallback } from 'react'
import { Search, Download, CheckCircle, Settings } from 'lucide-react'
import usePluginStore from '../pluginStore'
import type { Plugin } from '../pluginClient'
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
      result = result.filter((p: Plugin) => p.category === categoryFilter)
    }

    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase()
      result = result.filter(
        (p: Plugin) =>
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
            style={{ color: i < stars ? RATING_COLORS[stars - 1] : '#334', fontSize: 12 }}
          >
            ★
          </span>
        ))}
        <span >
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
          <h3 >
            插件市场
          </h3>
          <span >
            {filteredPlugins.length} 个插件
          </span>
        </div>
        <div className={styles.headerFilters}>
          <select>
            <div className={styles.categorySelect}>
              <span placeholder="分类" />
            </div>
            <div>
              {CATEGORIES.map((cat) => (
                <option key={cat.value}>
                  {cat.label}
                </option>
              ))}
            </div>
          </select>
          <div >
            <Search  />
            <input
              placeholder="搜索插件..."
              onChange={(e) => setSearchText(e.target.value)}
              className={`${styles.searchInput}`}
            />
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {isLoading ? (
          <div description="加载中..." className={styles.empty} />
        ) : filteredPlugins.length === 0 ? (
          <div description="没有找到匹配的插件" className={styles.empty} />
        ) : (
          filteredPlugins.map((plugin: Plugin) => (
            <div
              key={plugin.id}
              className={`${styles.pluginCard} ${plugin.installed ? styles.pluginCardInstalled : ''}`}
              onClick={() => handleCardClick(plugin)}
            >
              <div className={styles.pluginHeader}>
                <div className={styles.pluginIcon}>
                  {plugin.installed ? (
                    <CheckCircle  />
                  ) : (
                    <Settings  />
                  )}
                </div>
                <div className={styles.pluginTitleWrap}>
                  <span className={styles.pluginName}>{plugin.name}</span>
                  {plugin.installed && (
                    <span >已安装</span>
                  )}
                </div>
              </div>

              <p className={styles.pluginDescription}>{plugin.description}</p>

              <div className={styles.pluginMeta}>
                <div className={styles.metaLeft}>
                  <span >
                    v{plugin.version}
                  </span>
                  <span >
                    {plugin.author}
                  </span>
                </div>
                <div className={styles.metaRight}>
                  {getRatingStars(plugin.rating)}
                  {plugin.installCount !== undefined && (
                    <div>
                      <span asChild>
                        <div >
                          <Download  />
                          <span>{getInstallCountText(plugin.installCount)}</span>
                        </div>
                      </span>
                      <div>安装次数</div>
                    </div>
                  )}
                </div>
              </div>

              {plugin.permissions.length > 0 && (
                <div className={styles.pluginPermissions}>
                  {plugin.permissions.slice(0, 3).map((perm: string) => (
                    <span
                      key={perm}
                      className={getBadgeClass(getPermissionTagColor(perm))}
                    >
                      {perm}
                    </span>
                  ))}
                  {plugin.permissions.length > 3 && (
                    <span>
                      +{plugin.permissions.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
