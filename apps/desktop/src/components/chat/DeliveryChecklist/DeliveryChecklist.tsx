// GeoWork - Delivery Checklist Component
// Displays a checklist of delivery items grouped by category

import React from 'react'
import { Typography, Divider } from 'antd'
import {
  CheckCircleOutlined,
  FileTextOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FolderOutlined,
  FileDoneOutlined,
} from '@ant-design/icons'
import styles from './DeliveryChecklist.module.scss'

const { Text, Title } = Typography

export interface DeliveryChecklistItem {
  maps: string[]
  codes: string[]
  documents: string[]
  datasets: string[]
  logs: string[]
}

export interface DeliveryChecklistProps {
  checklist?: DeliveryChecklistItem
}

const SECTION_CONFIG = [
  { key: 'maps', label: '地图文件', icon: <FolderOutlined />, color: 'var(--gw-accent-map)' },
  { key: 'codes', label: '代码脚本', icon: <CodeOutlined />, color: 'var(--gw-accent-blue)' },
  { key: 'documents', label: '文档资料', icon: <FileTextOutlined />, color: 'var(--gw-text-secondary)' },
  { key: 'datasets', label: '数据集', icon: <DatabaseOutlined />, color: 'var(--gw-warning)' },
  { key: 'logs', label: '运行日志', icon: <FileDoneOutlined />, color: 'var(--gw-text-tertiary)' },
] as const

const DeliveryChecklist: React.FC<DeliveryChecklistProps> = ({ checklist }) => {
  if (!checklist) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <FileDoneOutlined style={{ fontSize: 32, color: 'var(--gw-text-tertiary)' }} />
          <Text type="secondary">暂无交付清单信息</Text>
        </div>
      </div>
    )
  }

  const totalCount = Object.values(checklist).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  const sections = SECTION_CONFIG.map((section) => {
    const items = checklist[section.key]
    const count = Array.isArray(items) ? items.length : 0
    return { ...section, items: items || [], count }
  })

  const filledSections = sections.filter((s) => s.count > 0).length

  return (
    <div className={styles.container}>
      {sections.map((section) => (
        <div key={section.key} className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon} style={{ color: section.color }}>
              {section.icon}
            </span>
            <span className={styles.sectionLabel}>{section.label}</span>
            <div className={styles.sectionCount}>
              {section.count} / {filledSections}
            </div>
          </div>

          <Divider style={{ margin: 'var(--gw-space-8) 0' }} />

          {section.items.length === 0 ? (
            <div className={styles.emptyItem}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                暂无{section.label}
              </Text>
            </div>
          ) : (
            <div className={styles.sectionItems}>
              {section.items.map((item, index) => (
                <div key={index} className={styles.item}>
                  <CheckCircleOutlined className={styles.itemIcon} style={{ color: 'var(--gw-accent)' }} />
                  <span className={styles.itemText}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className={styles.summary}>
        <div className={styles.summaryStats}>
          <CheckCircleOutlined style={{ color: 'var(--gw-accent)', marginRight: 'var(--gw-space-8)' }} />
          <Text strong>已完成: {totalCount} 项</Text>
          <Text type="secondary" style={{ marginLeft: 'var(--gw-space-12)' }}>
            (12 项)
          </Text>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.round((filledSections / sections.length) * 100)}%` }}
          />
        </div>
        <Text type="secondary" className={styles.progressText}>
          {Math.round((filledSections / sections.length) * 100)}%
        </Text>
      </div>
    </div>
  )
}

export default DeliveryChecklist
