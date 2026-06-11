// GeoWork Desktop - Plugin Marketplace Grid
// Displays installed and available plugins as a searchable, filterable grid

import { useState, useMemo, useCallback } from 'react'
import { Card, Tag, Rate, Input, Select, Badge, Tooltip, Typography, Empty, Space } from 'antd'
import { SearchOutlined, DownloadOutlined, CheckCircleOutlined, SettingOutlined } from '@ant-design/icons'
import usePluginStore from '../../pluginStore'
import styles from './PluginMarketplace.module.scss'

const { Text, Title } = Typography
const { Search } = Input

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
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
          {rating.toFixed(1)}
        </Text>
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
          <Title level={4} style={{ margin: 0 }}>
            插件市场
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {filteredPlugins.length} 个插件
          </Text>
        </div>
        <div className={styles.headerFilters}>
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={CATEGORIES}
            className={styles.categorySelect}
            allowClear
            placeholder="分类"
            size="middle"
          />
          <Search
            placeholder="搜索插件..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(val) => setSearchText(val)}
            allowClear
            prefix={<SearchOutlined />}
            className={styles.searchInput}
            size="middle"
          />
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
              hoverable
              className={`${styles.pluginCard} ${plugin.installed ? styles.pluginCardInstalled : ''}`}
              onClick={() => handleCardClick(plugin)}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <div className={styles.pluginHeader}>
                <div className={styles.pluginIcon}>
                  {plugin.installed ? (
                    <CheckCircleOutlined />
                  ) : (
                    <SettingOutlined />
                  )}
                </div>
                <div className={styles.pluginTitleWrap}>
                  <span className={styles.pluginName}>{plugin.name}</span>
                  {plugin.installed && (
                    <Badge status="success" text="已安装" />
                  )}
                </div>
              </div>

              <p className={styles.pluginDescription}>{plugin.description}</p>

              <div className={styles.pluginMeta}>
                <div className={styles.metaLeft}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    v{plugin.version}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    {plugin.author}
                  </Text>
                </div>
                <div className={styles.metaRight}>
                  {getRatingStars(plugin.rating)}
                  {plugin.installCount !== undefined && (
                    <Tooltip title="安装次数">
                      <Space style={{ fontSize: 12, color: '#8899aa' }}>
                        <DownloadOutlined />
                        <span>{getInstallCountText(plugin.installCount)}</span>
                      </Space>
                    </Tooltip>
                  )}
                </div>
              </div>

              {plugin.permissions.length > 0 && (
                <div className={styles.pluginPermissions}>
                  {plugin.permissions.slice(0, 3).map((perm) => (
                    <Tag
                      key={perm}
                      color={getPermissionTagColor(perm)}
                      style={{ margin: 0, fontSize: 11 }}
                    >
                      {perm}
                    </Tag>
                  ))}
                  {plugin.permissions.length > 3 && (
                    <Tag style={{ margin: 0, fontSize: 11, background: '#1a2030', color: '#8899aa', border: 'none' }}>
                      +{plugin.permissions.length - 3}
                    </Tag>
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
