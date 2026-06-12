// GeoWork - TemplateSelector Component

import React from 'react'
import { FileText } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={styles.templateSelect}>
          <SelectValue placeholder="选择模板" />
        </SelectTrigger>
        <SelectContent>
          {TEMPLATES.map(t => (
            <SelectItem key={t.value} value={t.value}>
              {t.icon} {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default TemplateSelector
