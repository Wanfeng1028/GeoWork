// GeoWork Desktop - Plugin Detail Panel
// Detailed view for a single plugin with actions, permissions, and reviews

import { useState } from 'react'
import { CheckCircle, Download, User, Globe, Shield, Star, AlertTriangle } from 'lucide-react'
import type { Plugin } from '../pluginClient'
import usePluginStore from '../pluginStore'
import styles from './PluginDetail.module.scss'

interface PluginDetailProps {
  plugin: Plugin
  onClose: () => void
}

const PERMISSION_RISK: Record<string, { level: string; color: string; description: string }> = {
  install_package: {
    level: '高风险',
    color: 'magenta',
    description: '允许安装第三方包，可能引入恶意依赖',
  },
  run_shell: {
    level: '高风险',
    color: 'magenta',
    description: '允许执行系统 Shell 命令，可直接操作文件系统',
  },
  run_python: {
    level: '高风险',
    color: 'magenta',
    description: '允许执行 Python 脚本，可能修改文件或执行任意代码',
  },
  network_access: {
    level: '高风险',
    color: 'magenta',
    description: '允许网络请求，可能泄露数据或下载恶意内容',
  },
  write_file: {
    level: '中等风险',
    color: 'orange',
    description: '允许写入文件，可能修改或覆盖现有文件',
  },
  delete_file: {
    level: '中等风险',
    color: 'orange',
    description: '允许删除文件，可能导致数据丢失',
  },
  read_folder: {
    level: '中等风险',
    color: 'orange',
    description: '允许读取文件夹内容，可能访问敏感文件列表',
  },
  system_api: {
    level: '高风险',
    color: 'magenta',
    description: '允许访问系统 API，影响系统稳定性',
  },
  launch_process: {
    level: '中等风险',
    color: 'orange',
    description: '允许启动外部进程，可能执行未知程序',
  },
  long_running: {
    level: '中等风险',
    color: 'orange',
    description: '允许长时间运行，可能占用大量系统资源',
  },
  default: {
    level: '低风险',
    color: 'blue',
    description: '常规权限，通常用于功能基础操作',
  },
}

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

export function PluginDetail({ plugin, onClose }: PluginDetailProps) {
  const { install, uninstall, toggle, isLoading } = usePluginStore()
  const [showConfirm, setShowConfirm] = useState<'install' | 'uninstall' | null>(null)

  const riskInfo = plugin.permissions.map((perm: string) => ({
    name: perm,
    ...PERMISSION_RISK[perm],
  }))

  const hasHighRisk = riskInfo.some((r: { level: string }) => r.level === '高风险')
  const hasMediumRisk = riskInfo.some((r: { level: string }) => r.level === '中等风险')

  const handleInstall = async () => {
    setShowConfirm('install')
    await install(plugin.id)
    setShowConfirm(null)
  }

  const handleUninstall = async () => {
    setShowConfirm('uninstall')
    await uninstall(plugin.id)
    setShowConfirm(null)
  }

  const handleToggle = async (checked: boolean) => {
    await toggle(plugin.id, checked)
  }

  const getInstallCountText = (count?: number) => {
    if (!count) return '0'
    if (count >= 10000) return `${(count / 10000).toFixed(1)}w`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count)
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.pluginIcon}>
            <Download  />
          </div>
          <div className={styles.headerInfo}>
            <div className={styles.headerTitle}>
              <h3 >
                {plugin.name}
              </h3>
              {plugin.installed && (
                <span className={plugin.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                  {plugin.enabled ? '已启用' : '已禁用'}
                </span>
              )}
            </div>
            <div >
              <div >
                <User  />
                <span >{plugin.author}</span>
              </div>
              <div >
                <Star  />
                <span >
                  {plugin.rating !== undefined ? `${plugin.rating.toFixed(1)} 分` : '暂无评分'}
                </span>
              </div>
              {plugin.installCount !== undefined && (
                <div >
                  <Download  />
                  <span >
                    {getInstallCountText(plugin.installCount)} 次安装
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          关闭
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Description */}
        <section className={styles.section}>
          <h4 >
            简介
          </h4>
          <p >
            {plugin.description || '暂无描述'}
          </p>
        </section>

        {/* Info */}
        <section className={styles.section}>
          <h4 >
            信息
          </h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span >版本</span>
              <span >v{plugin.version}</span>
            </div>
            {plugin.category && (
              <div className={styles.infoItem}>
                <span >分类</span>
                <span >{plugin.category}</span>
              </div>
            )}
            {plugin.license && (
              <div className={styles.infoItem}>
                <span >许可证</span>
                <span >{plugin.license}</span>
              </div>
            )}
            {plugin.homepage && (
              <div className={styles.infoItem}>
                <Globe  />
                <span >官网</span>
                <a href={plugin.homepage} target="_blank" rel="noreferrer">
                  访问
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Permissions */}
        <section className={styles.section}>
          <h4 >
            <Shield  />
            权限要求
          </h4>

          {hasHighRisk && (
            <div >
              <AlertTriangle  />
              <div>
                <span >此插件需要访问高风险权限</span>
                <span >安装前请仔细检查以下权限的必要性</span>
              </div>
            </div>
          )}

          <div className={styles.permissionsList}>
            {plugin.permissions.map((perm: string) => {
              const info = PERMISSION_RISK[perm] || PERMISSION_RISK.default
              return (
                <div key={perm} className={styles.permissionItem}>
                  <div className={styles.permissionRow}>
                    <span className={styles.permissionName}>{perm}</span>
                    <span className={getBadgeClass(info.color)}>{info.level}</span>
                  </div>
                  <span >
                    {info.description}
                  </span>
                </div>
              )
            })}
            {plugin.permissions.length === 0 && (
              <span >此插件不需要额外权限</span>
            )}
          </div>
        </section>

        {/* Actions */}
        <section className={styles.section}>
          <hr />
          <div className={styles.actions}>
            {plugin.installed ? (
              <div >
                <div className={styles.actionRow}>
                  <span >启用/禁用</span>
                  <button
                  />
                </div>
                <button
                  
                  onClick={handleUninstall}
                >
                  {showConfirm === 'uninstall'
                    ? '确认卸载...'
                    : '卸载插件'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleInstall}
              >
                {isLoading ? <div  /> : <Download  />}
                {showConfirm === 'install'
                  ? '安装中...'
                  : '安装插件'}
              </button>
            )}
          </div>
        </section>

        {/* Reviews placeholder */}
        <section className={styles.section}>
          <hr />
          <h4 >
            用户评价
          </h4>
          <div>
            暂无评价
          </div>
          <span >
            评价功能即将上线
          </span>
        </section>
      </div>
    </div>
  )
}
