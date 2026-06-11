// GeoWork - TemplateSelector Component
// Select a task template (default, report, dashboard, etc.)

import React from 'react'
import { Select } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import styles from './TemplateSelector.module.scss'

const TEMPLATES = [
  { value: 'default', label: '默认', icon: '📄' },
  { value: 'report', label: '分析报告', icon: '📊' },
  { value: 'dashboard', label: '仪表盘', icon: '📈' },
  { value: 'notebook', label: 'Notebook', icon: '📓' },
]

interface TemplateSelectorProps {
  value?: string
  onChange?: (template: string) => void
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  value = 'default',
  onChange,
}) => {
  return (
    <div className={styles.container}>
      <FileTextOutlined className={styles.icon} />
      <Select
        value={value}
        onChange={onChange}
        size="small"
        className={styles.templateSelect}
        options={TEMPLATES.map(t => ({ label: `${t.icon} ${t.label}`, value: t.value }))}
      />
    </div>
  )
}

export default TemplateSelector
