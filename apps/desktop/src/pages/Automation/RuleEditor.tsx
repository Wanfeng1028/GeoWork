import { useCallback, useEffect, useState } from 'react'

import { toast } from 'sonner'
import { useAutomationStore, AutomationRule, TriggerType } from './store'
import styles from './RuleEditor.module.scss'

const TRIGGER_OPTIONS: { label: string; value: TriggerType }[] = [
  { label: '文件变更', value: 'file-change' },
  { label: '数据就绪', value: 'data-ready' },
  { label: '任务完成', value: 'task-complete' },
  { label: '手动触发', value: 'manual' },
  { label: 'Cron 定时', value: 'cron' }
]

const TARGET_OPTIONS = [
  { label: 'Research 专家', value: 'Research' },
  { label: 'Data 专家', value: 'Data' },
  { label: 'GeoCode 专家', value: 'GeoCode' },
  { label: 'Analysis 专家', value: 'Analysis' },
  { label: 'Write 专家', value: 'Write' },
  { label: '自定义 Skill', value: 'skill' },
  { label: '自定义脚本', value: 'script' }
]

interface RuleEditorProps {
  open: boolean
  onClose: () => void
  editingRule?: AutomationRule | null
}

export function RuleEditor({ open, onClose, editingRule }: RuleEditorProps) {
  const { createRule, updateRule, loading, triggerRule } = useAutomationStore()
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    trigger: 'manual' as TriggerType,
    target: '',
    params: '',
    enabled: true
  })

  useEffect(() => {
    if (open) {
      setFormState({
        name: editingRule?.name ?? '',
        description: editingRule?.description ?? '',
        trigger: editingRule?.trigger ?? 'manual',
        target: editingRule?.target ?? '',
        params: editingRule?.params ? JSON.stringify(editingRule.params) : '',
        enabled: editingRule?.enabled ?? true
      })
    }
  }, [open, editingRule])

  const handleFinish = useCallback(async () => {
    try {
      let params = {}
      try { params = formState.params ? JSON.parse(formState.params) : {} } catch {}

      if (editingRule) {
        await updateRule({ ...editingRule, ...formState, params })
        toast.success('规则已更新')
      } else {
        await createRule({
          name: formState.name,
          description: formState.description,
          trigger: formState.trigger,
          target: formState.target,
          params,
          enabled: formState.enabled
        })
        toast.success('规则已创建')
      }
      onClose()
    } catch {
      toast.error('保存失败')
    }
  }, [editingRule, updateRule, createRule, onClose, formState])

  const handleTest = useCallback(async () => {
    if (!editingRule) return
    try {
      await triggerRule(editingRule.id)
      toast.success('规则测试触发成功')
    } catch {
      toast.error('规则测试触发失败')
    }
  }, [editingRule, triggerRule])

  return (
    <div className={styles.drawer} style={{ display: open ? 'flex' : 'none' }}>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>{editingRule ? '编辑规则' : '新建规则'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div >
          <div>
            <label >名称</label>
            <input placeholder="例如：每日 NDVI 监测" onChange={(e) => setFormState({ ...formState, name: e.target.value })} />
          </div>

          <div>
            <label >描述</label>
            <textarea
              
              placeholder="规则描述（可选）"
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>触发条件</label>
            <select
              value={formState.trigger}
              onChange={(e) => setFormState({ ...formState, trigger: e.target.value as TriggerType })}
            >
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>执行目标</label>
            <select
              value={formState.target}
              onChange={(e) => setFormState({ ...formState, target: e.target.value })}
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label >参数配置</label>
            <textarea
              
              placeholder='{"band": "NIR", "threshold": 0.3}'
              value={formState.params}
              onChange={(e) => setFormState({ ...formState, params: e.target.value })}
            />
            <span >JSON 格式，例如：{'{"band": "NIR"}'}</span>
          </div>

          <div className={styles.toggleRow}>
            <button
              type="button"
              onClick={() => setFormState({ ...formState, enabled: !formState.enabled })}
              className={formState.enabled ? styles.enabled : ''}
            >
              {formState.enabled ? 'ON' : 'OFF'}
            </button>
            <label className={styles.label}>启用</label>
          </div>

          <div className={styles.actions}>
            <button onClick={onClose}>取消</button>
            {editingRule && (
              <button onClick={handleTest}>测试运行</button>
            )}
            <button onClick={handleFinish}>
              {editingRule ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
