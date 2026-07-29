// GeoWork - TemplateSelector Component

import React from 'react'
import { FileText } from 'lucide-react'
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
      <FileText size={14} className={styles.icon} />
      <select>
        <div className={styles.templateSelect}>
          <span>选择模板</span>
        </div>
        <div>
          {TEMPLATES.map(t => (
            <option key={t.value}>
              {t.icon} {t.label}
            </option>
          ))}
        </div>
      </select>
    </div>
  )
}

export default TemplateSelector
