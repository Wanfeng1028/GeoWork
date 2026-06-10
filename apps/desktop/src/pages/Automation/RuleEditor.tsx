import { useCallback, useEffect } from 'react'
import { Button, Form, Input, Select, Switch, message } from 'antd'
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
  const [form] = Form.useForm<Partial<AutomationRule>>()
  const { createRule, updateRule, loading, triggerRule } = useAutomationStore()

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: editingRule?.name ?? '',
        description: editingRule?.description ?? '',
        trigger: editingRule?.trigger ?? 'manual',
        target: editingRule?.target ?? '',
        params: (editingRule?.params ?? {}) as Record<string, any>,
        enabled: editingRule?.enabled ?? true
      })
    }
  }, [open, editingRule, form])

  const handleFinish = useCallback(async (values: Partial<AutomationRule>) => {
    try {
      if (editingRule) {
        await updateRule({ ...editingRule, ...values, params: values.params ?? {} })
        message.success('规则已更新')
      } else {
        await createRule({
          name: values.name!,
          description: values.description ?? '',
          trigger: values.trigger ?? 'manual',
          target: values.target ?? '',
          params: values.params ?? {},
          enabled: values.enabled ?? true
        })
        message.success('规则已创建')
      }
      onClose()
    } catch {
      message.error('保存失败')
    }
  }, [editingRule, updateRule, createRule, onClose])

  const handleTest = useCallback(async () => {
    if (!editingRule) return
    try {
      await triggerRule(editingRule.id)
      message.success('规则测试触发成功')
    } catch {
      message.error('规则测试触发失败')
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

        <Form<Partial<AutomationRule>>
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如：每日 NDVI 监测" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="规则描述（可选）" />
          </Form.Item>

          <Form.Item name="trigger" label="触发条件" rules={[{ required: true, message: '请选择触发条件' }]}>
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>

          <Form.Item name="target" label="执行目标" rules={[{ required: true, message: '请选择执行目标' }]}>
            <Select options={TARGET_OPTIONS} />
          </Form.Item>

          <Form.Item label="参数配置">
            <Input.TextArea
              rows={4}
              placeholder='{"band": "NIR", "threshold": 0.3}'
              {...{
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  try {
                    const parsed = e.target.value ? JSON.parse(e.target.value) : {}
                    form.setFieldValue('params', parsed)
                  } catch {
                    // invalid JSON — leave as-is
                  }
                }
              }}
            />
            <span className={styles.hint}>JSON 格式，例如：{'{"band": "NIR"}'}</span>
          </Form.Item>

          <Form.Item label="启用" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Form.Item name="enabled" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </Form.Item>

          <div className={styles.actions}>
            <Button onClick={onClose}>取消</Button>
            {editingRule && (
              <Button onClick={handleTest} disabled={loading}>
                测试运行
              </Button>
            )}
            <Button type="primary" htmlType="submit" loading={loading}>
              {editingRule ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
