// GeoWork - ModelSelector Component

import React, { useState } from 'react'
import { Settings } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { Badge } from '../../ui/badge'
import useSettingsStore from '../../../stores/settingsStore'
import styles from './ModelSelector.module.scss'

export const ModelSelector: React.FC = () => {
  const { settings } = useSettingsStore()
  const providers = settings.modelApi.providers.filter(p => p.enabled)
  const [selectedProvider, setSelectedProvider] = useState(providers[0]?.id)
  const [selectedModel, setSelectedModel] = useState<string>('')

  const currentProvider = providers.find(p => p.id === selectedProvider)

  const models = currentProvider
    ? ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'llama-3.1-70b']
    : []

  return (
    <div className={styles.container}>
      <Settings size={14} className={styles.icon} />
      <div className={styles.selectors}>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className={styles.providerSelect}>
            <SelectValue placeholder="选择供应商" />
          </SelectTrigger>
          <SelectContent>
            {providers.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedModel || models[0]} onValueChange={setSelectedModel}>
          <SelectTrigger className={styles.modelSelect}>
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default ModelSelector
