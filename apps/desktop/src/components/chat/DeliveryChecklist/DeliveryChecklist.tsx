// GeoWork - Delivery Checklist Component
// Displays a checklist of delivery items grouped by category

import React from 'react'
import {
  CheckCircle,
  FileText,
  Code,
  Database,
  Folder,
  FileCheck,
} from 'lucide-react'
import styles from './DeliveryChecklist.module.scss'

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
  { key: 'maps', label: '地图文件', icon: <Folder  />, color: '' },
  { key: 'codes', label: '代码脚本', icon: <Code  />, color: '' },
  { key: 'documents', label: '文档资料', icon: <FileText  />, color: '' },
  { key: 'datasets', label: '数据集', icon: <Database  />, color: '' },
  { key: 'logs', label: '运行日志', icon: <FileCheck  />, color: '' },
] as const

const DeliveryChecklist: React.FC<DeliveryChecklistProps> = ({ checklist }) => {
  if (!checklist) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <FileCheck style={{ fontSize: 32 }} />
          <span >暂无交付清单信息</span>
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

          <Separator  />

          {section.items.length === 0 ? (
            <div className={styles.emptyItem}>
              <span >
                暂无{section.label}
              </span>
            </div>
          ) : (
            <div className={styles.sectionItems}>
              {section.items.map((item, index) => (
                <div key={index} className={styles.item}>
                  <CheckCircle className={styles.itemIcon}  />
                  <span className={styles.itemText}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className={styles.summary}>
        <div className={styles.summaryStats}>
          <CheckCircle   />
          <span >已完成: {totalCount} 项</span>
          <span  >
            (12 项)
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.round((filledSections / sections.length) * 100)}%` }}
          />
        </div>
        <span className={`${styles.progressText}`}>
          {Math.round((filledSections / sections.length) * 100)}%
        </span>
      </div>
    </div>
  )
}

export default DeliveryChecklist
