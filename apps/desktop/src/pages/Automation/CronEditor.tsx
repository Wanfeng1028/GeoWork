import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Select, Switch, message, Tag, Space } from 'antd'
import { useAutomationStore, CronJob } from './store'
import styles from './CronEditor.module.scss'

const COMMON_PRESETS: { label: string; value: string }[] = [
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 00:00', value: '0 0 * * *' },
  { label: '每天 09:00', value: '0 9 * * *' },
  { label: '每周日 00:00', value: '0 0 * * 0' },
  { label: '每月1号 00:00', value: '0 0 1 * *' },
  { label: '每 30 分钟', value: '*/30 * * * *' },
  { label: '每 15 分钟', value: '*/15 * * * *' },
  { label: '工作日 09:00', value: '0 9 * * 1-5' }
]

const FIELD_LABELS = ['分钟 (0-59)', '小时 (0-23)', '日 (1-31)', '月 (1-12)', '星期 (0-6)']

export function CronEditor({ open, onClose, editingJob }: { open: boolean; onClose: () => void; editingJob?: CronJob | null }) {
  const [form] = Form.useForm<Partial<CronJob>>()
  const [expression, setExpression] = useState('')
  const [nextRunPreview, setNextRunPreview] = useState<string | null>(null)
  const { createJob, updateJob, loading, toggleJob } = useAutomationStore()

  useEffect(() => {
    if (open) {
      const expr = editingJob?.cronExpression ?? '0 0 * * *'
      setExpression(expr)
      form.setFieldsValue({
        name: editingJob?.name ?? '',
        cronExpression: expr,
        target: editingJob?.target ?? '',
        params: (editingJob?.params ?? {}) as Record<string, any>,
        enabled: editingJob?.enabled ?? true
      })
      setNextRunPreview(calculateNextRun(expr))
    }
  }, [open, editingJob, form])

  // Live preview when expression changes
  useEffect(() => {
    if (expression.trim()) {
      setNextRunPreview(calculateNextRun(expression.trim()))
    } else {
      setNextRunPreview(null)
    }
  }, [expression])

  const handleFinish = useCallback(async (values: Partial<CronJob>) => {
    try {
      if (editingJob) {
        await updateJob({ ...editingJob, ...values, cronExpression: expression, params: values.params ?? {} })
        message.success('定时任务已更新')
      } else {
        await createJob({
          name: values.name!,
          cronExpression: expression,
          target: values.target ?? '',
          params: values.params ?? {},
          enabled: values.enabled ?? true
        })
        message.success('定时任务已创建')
      }
      onClose()
    } catch {
      message.error('保存失败')
    }
  }, [editingJob, expression, updateJob, createJob, onClose])

  const handlePreset = useCallback((value: string) => {
    setExpression(value)
  }, [])

  return (
    <div className={styles.drawer} style={{ display: open ? 'flex' : 'none' }}>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>{editingJob ? '编辑定时任务' : '新建定时任务'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <Form<Partial<CronJob>>
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ enabled: true }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="例如：每日数据备份" />
          </Form.Item>

          {/* Cron expression */}
          <Form.Item label="Cron 表达式" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="分 时 日 月 星期"
              className={styles.cronInput}
            />
          </Form.Item>

          {/* Visual field breakdown */}
          <div className={styles.cronFields}>
            {expression.split(/\s+/).map((field, i) => (
              <div key={i} className={styles.cronField}>
                <span className={styles.cronFieldValue}>{field || '-'}</span>
                <span className={styles.cronFieldLabel}>{FIELD_LABELS[i]}</span>
              </div>
            ))}
          </div>

          {/* Next run preview */}
          {nextRunPreview && (
            <div className={styles.preview}>
              下次执行: <strong>{nextRunPreview}</strong>
            </div>
          )}

          {/* Common presets */}
          <Form.Item label="常用表达式">
            <Space wrap className={styles.presets}>
              {COMMON_PRESETS.map((preset) => (
                <Tag
                  key={preset.value}
                  color="blue"
                  className={styles.presetTag}
                  onClick={() => handlePreset(preset.value)}
                >
                  {preset.label}
                </Tag>
              ))}
            </Space>
          </Form.Item>

          <Form.Item name="target" label="执行目标" rules={[{ required: true, message: '请选择执行目标' }]}>
            <Select options={[
              { label: 'Research 专家', value: 'Research' },
              { label: 'Data 专家', value: 'Data' },
              { label: 'GeoCode 专家', value: 'GeoCode' },
              { label: 'Analysis 专家', value: 'Analysis' },
              { label: 'Write 专家', value: 'Write' },
              { label: '自定义 Skill', value: 'skill' },
              { label: '自定义脚本', value: 'script' }
            ]} />
          </Form.Item>

          <Form.Item label="参数配置">
            <Input.TextArea
              rows={3}
              placeholder='{"band": "NIR"}'
              {...{
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  try {
                    const parsed = e.target.value ? JSON.parse(e.target.value) : {}
                    form.setFieldValue('params', parsed)
                  } catch {
                    // invalid JSON
                  }
                }
              }}
            />
          </Form.Item>

          <Form.Item label="启用" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Form.Item name="enabled" valuePropName="checked" noStyle>
              <Switch checked={editingJob ? editingJob.enabled : undefined} onChange={(checked) => {
                if (editingJob) toggleJob(editingJob.id)
              }} />
            </Form.Item>
          </Form.Item>

          <div className={styles.actions}>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {editingJob ? '保存' : '创建'}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

/**
 * Simple next-run calculator for cron expressions.
 * This is a best-effort approximation — not a full cron parser.
 */
function calculateNextRun(expression: string): string | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null

  try {
    const now = new Date()
    const minute = parseCronField(parts[0], 0, 59)
    const hour = parseCronField(parts[1], 0, 23)
    const day = parseCronField(parts[2], 1, 31)
    const month = parseCronField(parts[3], 1, 12)
    const dow = parseCronField(parts[4], 0, 6)

    // Find next matching time
    const candidate = new Date(now)
    candidate.setSeconds(0, 0)

    // Increment by one minute and search up to 7 days
    for (let i = 0; i < 7 * 24 * 60; i++) {
      candidate.setMinutes(candidate.getMinutes() + 1)
      const cm = candidate.getMinutes()
      const ch = candidate.getHours()
      const cd = candidate.getDate()
      const cmo = candidate.getMonth() + 1
      const cday = candidate.getDay()

      if (
        minute.includes(cm) &&
        hour.includes(ch) &&
        day.includes(cd) &&
        month.includes(cmo) &&
        dow.includes(cday)
      ) {
        return candidate.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    }
    return '7天内无匹配'
  } catch {
    return null
  }
}

function parseCronField(field: string, min: number, max: number): number[] {
  // Handle wildcard
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min)

  // Handle step: */N or N-M/S
  if (field.includes('/')) {
    const [range, stepStr] = field.split('/')
    const step = parseInt(stepStr, 10)
    if (range === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((v) => v % step === 0)
    }
    const [start, end] = range.split('-').map(Number)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).filter((v) => v % step === 0)
  }

  // Handle range: N-M
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  // Handle comma-separated values
  if (field.includes(',')) {
    return field.split(',').map(Number)
  }

  // Single value
  const val = parseInt(field, 10)
  if (!isNaN(val)) return [val]

  return []
}
