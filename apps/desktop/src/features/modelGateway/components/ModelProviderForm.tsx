// GeoWork Model Gateway - Model Provider Form
// Form for adding and editing model providers

import { useState, useEffect } from 'react'
import { Link, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import modelGatewayClient, { type ModelProvider } from '../modelGatewayClient'
import useModelGatewayStore from '../modelGatewayStore'
import styles from './ModelProviderForm.module.scss'

const PROVIDER_KINDS = [
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'lm_studio', label: 'LM Studio' },
  { value: 'custom', label: 'Custom' },
]

export interface ModelProviderFormProps {
  provider?: ModelProvider | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function ModelProviderForm({ provider, onSuccess, onCancel }: ModelProviderFormProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean } | null>(null)
  const { loadProviders, loadUsage } = useModelGatewayStore()
  const [formValues, setFormValues] = useState<Partial<ModelProvider>>({
    name: '',
    kind: 'openai_compatible',
    baseUrl: '',
    apiKeyRef: '',
    defaultModel: '',
    enabled: true,
  })

  useEffect(() => {
    if (provider) {
      setFormValues(provider as Partial<ModelProvider>)
    } else {
      setFormValues({ kind: 'openai_compatible', enabled: true })
    }
  }, [provider])

  const handleTestConnection = async () => {
    if (!provider?.id) {
      toast.warning('请先保存提供商')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await modelGatewayClient.testConnection(provider.id)
      setTestResult({ ok: result.success })
      if (result.success) {
        toast.success(`连接成功，发现 ${result.modelCount ?? '?'} 个模型`)
      } else {
        toast.error('连接失败')
      }
    } catch {
      setTestResult({ ok: false })
      toast.error('连接测试出错')
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (provider?.id) {
        await modelGatewayClient.updateProvider(provider.id, formValues)
        toast.success('已更新')
      } else {
        await modelGatewayClient.addProvider(formValues)
        toast.success('已添加')
      }
      await loadProviders()
      await loadUsage()
      onSuccess?.()
    } catch {
      toast.error(provider?.id ? '更新失败' : '添加失败')
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div >
        <label >名称</label>
        <Input
          placeholder="例如: OpenAI API, Local Ollama"
          value={formValues.name || ''}
          onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
        />
      </div>

      <div >
        <label >类型</label>
        <Select
          value={formValues.kind || 'openai_compatible'}
          onValueChange={(val) => setFormValues((v) => ({ ...v, kind: val as ModelProvider['kind'] }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_KINDS.map((kind) => (
              <SelectItem key={kind.value} value={kind.value}>
                {kind.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div >
        <label >Base URL</label>
        <Input
          placeholder="https://api.openai.com"
          value={formValues.baseUrl || ''}
          onChange={(e) => setFormValues((v) => ({ ...v, baseUrl: e.target.value }))}
        />
      </div>

      <div >
        <label >API Key</label>
        <Input
          type="password"
          placeholder="sk-... (可选)"
          value={formValues.apiKeyRef || ''}
          onChange={(e) => setFormValues((v) => ({ ...v, apiKeyRef: e.target.value }))}
        />
      </div>

      <div >
        <label >默认模型</label>
        <Input
          placeholder="gpt-4, llama3 等 (可选)"
          value={formValues.defaultModel || ''}
          onChange={(e) => setFormValues((v) => ({ ...v, defaultModel: e.target.value }))}
        />
      </div>

      {provider?.id && (
        <div className={styles.testRow}>
          <Button
            type="button"
            variant="ghost"
            disabled={testing}
            onClick={handleTestConnection}
            className={styles.testBtn}
          >
            <Link  />
            测试连接
          </Button>
          {testResult && (
            <Badge className={testResult.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
              {testResult.ok ? <CheckCircle  /> : <XCircle  />}
              {testResult.ok ? '连接成功' : '连接失败'}
            </Badge>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <div >
          <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
          <Button type="submit">
            {provider?.id ? '保存' : '添加'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default ModelProviderForm
