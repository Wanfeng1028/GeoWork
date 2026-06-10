// GeoWork - ModelSelector Component
// Select model provider and model from configuration

import React, { useState } from 'react'
import { Select, Tag } from 'antd'
import { SparklesOutlined } from '@ant-design/icons'
import useSettingsStore from '../../../stores/settingsStore'
import styles from './ModelSelector.module.scss'

const { Option } = Select

export const ModelSelector: React.FC = () => {
  const { settings } = useSettingsStore()
  const providers = settings.modelApi.providers.filter(p => p.enabled)
  const [selectedProvider, setSelectedProvider] = useState(providers[0]?.id)
  const [selectedModel, setSelectedModel] = useState<string>('')

  const currentProvider = providers.find(p => p.id === selectedProvider)

  // Mock models list - in real implementation would come from API
  const models = currentProvider
    ? ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'llama-3.1-70b']
    : []

  return (
    <div className={styles.container}>
      <SparklesOutlined className={styles.icon} />
      <div className={styles.selectors}>
        <Select
          value={selectedProvider}
          onChange={setSelectedProvider}
          size="small"
          className={styles.providerSelect}
          options={providers.map(p => ({ label: p.name, value: p.id }))}
          suffixIcon={<Tag color="blue">API</Tag>}
        />
        <Select
          value={selectedModel || models[0]}
          onChange={setSelectedModel}
          size="small"
          className={styles.modelSelect}
          options={models.map(m => ({ label: m, value: m }))}
          placeholder="选择模型"
          suffixIcon={<Tag color="cyan">Model</Tag>}
        />
      </div>
    </div>
  )
}

export default ModelSelector
