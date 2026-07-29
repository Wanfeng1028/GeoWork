// GeoWork - ModelSelector Component

import React, { useState } from 'react'
import { Settings } from 'lucide-react'
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
        <select>
          <div className={styles.providerSelect}>
            <span>选择供应商</span>
          </div>
          <div>
            {providers.map(p => (
              <option key={p.id}>{p.name}</option>
            ))}
          </div>
        </select>
        <select>
          <div className={styles.modelSelect}>
            <span>选择模型</span>
          </div>
          <div>
            {models.map(m => (
              <option key={m}>{m}</option>
            ))}
          </div>
        </select>
      </div>
    </div>
  )
}

export default ModelSelector
