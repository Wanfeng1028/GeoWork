// GeoWork Desktop - Plugin Detail Panel
// Detailed view for a single plugin with actions, permissions, and reviews

import { useState } from 'react'
import { Card, Button, Tag, Space, Typography, Divider, Badge, Switch, Alert, Empty } from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  UserOutlined,
  GlobalOutlined,
  SafetyOutlined,
  StarOutlined,
} from '@ant-design/icons'
import type { Plugin } from '../../pluginClient'
import usePluginStore from '../../pluginStore'
import styles from './PluginDetail.module.scss'

const { Text, Title, Paragraph } = Typography

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

export function PluginDetail({ plugin, onClose }: PluginDetailProps) {
  const { install, uninstall, toggle, isLoading } = usePluginStore()
  const [showConfirm, setShowConfirm] = useState<'install' | 'uninstall' | null>(null)

  const riskInfo = plugin.permissions.map((perm) => ({
    name: perm,
    ...PERMISSION_RISK[perm],
  }))

  const hasHighRisk = riskInfo.some((r) => r.level === '高风险')
  const hasMediumRisk = riskInfo.some((r) => r.level === '中等风险')

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
            <DownloadOutlined />
          </div>
          <div className={styles.headerInfo}>
            <div className={styles.headerTitle}>
              <Title level={4} style={{ margin: 0 }}>
                {plugin.name}
              </Title>
              {plugin.installed && (
                <Badge
                  status={plugin.enabled ? 'success' : 'default'}
                  text={plugin.enabled ? '已启用' : '已禁用'}
                />
              )}
            </div>
            <Space size="large">
              <Space>
                <UserOutlined />
                <Text type="secondary">{plugin.author}</Text>
              </Space>
              <Space>
                <StarOutlined />
                <Text type="secondary">
                  {plugin.rating !== undefined ? `${plugin.rating.toFixed(1)} 分` : '暂无评分'}
                </Text>
              </Space>
              {plugin.installCount !== undefined && (
                <Space>
                  <DownloadOutlined />
                  <Text type="secondary">
                    {getInstallCountText(plugin.installCount)} 次安装
                  </Text>
                </Space>
              )}
            </Space>
          </div>
        </div>
        <Button type="text" onClick={onClose} className={styles.closeBtn}>
          关闭
        </Button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Description */}
        <section className={styles.section}>
          <Title level={5} className={styles.sectionTitle}>
            简介
          </Title>
          <Paragraph className={styles.description}>
            {plugin.description || '暂无描述'}
          </Paragraph>
        </section>

        {/* Info */}
        <section className={styles.section}>
          <Title level={5} className={styles.sectionTitle}>
            信息
          </Title>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <Text type="secondary">版本</Text>
              <Text>v{plugin.version}</Text>
            </div>
            {plugin.category && (
              <div className={styles.infoItem}>
                <Text type="secondary">分类</Text>
                <Text>{plugin.category}</Text>
              </div>
            )}
            {plugin.license && (
              <div className={styles.infoItem}>
                <Text type="secondary">许可证</Text>
                <Text>{plugin.license}</Text>
              </div>
            )}
            {plugin.homepage && (
              <div className={styles.infoItem}>
                <GlobalOutlined />
                <Text type="secondary">官网</Text>
                <a href={plugin.homepage} target="_blank" rel="noreferrer">
                  访问
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Permissions */}
        <section className={styles.section}>
          <Title level={5} className={styles.sectionTitle}>
            <SafetyOutlined />
            权限要求
          </Title>

          {hasHighRisk && (
            <Alert
              message="此插件需要访问高风险权限"
              description="安装前请仔细检查以下权限的必要性"
              type="warning"
              showIcon
              className={styles.permissionAlert}
            />
          )}

          <div className={styles.permissionsList}>
            {plugin.permissions.map((perm) => {
              const info = PERMISSION_RISK[perm] || PERMISSION_RISK.default
              return (
                <div key={perm} className={styles.permissionItem}>
                  <div className={styles.permissionRow}>
                    <span className={styles.permissionName}>{perm}</span>
                    <Tag color={info.color}>{info.level}</Tag>
                  </div>
                  <Text type="secondary" className={styles.permissionDesc}>
                    {info.description}
                  </Text>
                </div>
              )
            })}
            {plugin.permissions.length === 0 && (
              <Text type="secondary">此插件不需要额外权限</Text>
            )}
          </div>
        </section>

        {/* Actions */}
        <section className={styles.section}>
          <Divider />
          <div className={styles.actions}>
            {plugin.installed ? (
              <>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div className={styles.actionRow}>
                    <Text>启用/禁用</Text>
                    <Switch
                      checked={plugin.enabled}
                      onChange={handleToggle}
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    danger
                    block
                    onClick={handleUninstall}
                    loading={isLoading}
                    disabled={showConfirm !== 'uninstall' && showConfirm !== null}
                  >
                    {showConfirm === 'uninstall'
                      ? '确认卸载...'
                      : '卸载插件'}
                  </Button>
                </Space>
              </>
            ) : (
              <Button
                type="primary"
                block
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleInstall}
                loading={isLoading}
                disabled={showConfirm !== null}
              >
                {showConfirm === 'install'
                  ? '安装中...'
                  : '安装插件'}
              </Button>
            )}
          </div>
        </section>

        {/* Reviews placeholder */}
        <section className={styles.section}>
          <Divider />
          <Title level={5} className={styles.sectionTitle}>
            用户评价
          </Title>
          <Empty
            description="暂无评价"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            评价功能即将上线
          </Text>
        </section>
      </div>
    </div>
  )
}
