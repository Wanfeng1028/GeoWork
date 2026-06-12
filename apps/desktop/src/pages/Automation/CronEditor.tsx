import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { Badge } from '../../components/ui/badge'
import { toast } from 'sonner'
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
  const [expression, setExpression] = useState('')
  const [nextRunPreview, setNextRunPreview] = useState<string | null>(null)
  const { createJob, updateJob, loading, toggleJob } = useAutomationStore()
  const [formState, setFormState] = useState({
    name: '',
    target: '',
    params: '',
    enabled: true
  })

  useEffect(() => {
    if (open) {
      const expr = editingJob?.cronExpression ?? '0 0 * * *'
      setExpression(expr)
      setFormState({
        name: editingJob?.name ?? '',
        target: editingJob?.target ?? '',
        params: editingJob?.params ? JSON.stringify(editingJob.params) : '',
        enabled: editingJob?.enabled ?? true
      })
      setNextRunPreview(calculateNextRun(expr))
    }
  }, [open, editingJob])

  useEffect(() => {
    if (expression.trim()) {
      setNextRunPreview(calculateNextRun(expression.trim()))
    } else {
      setNextRunPreview(null)
    }
  }, [expression])

  const handleFinish = useCallback(async () => {
    try {
      let params = {}
      try { params = formState.params ? JSON.parse(formState.params) : {} } catch {}

      if (editingJob) {
        await updateJob({ ...editingJob, ...formState, cronExpression: expression, params })
        toast.success('定时任务已更新')
      } else {
        await createJob({
          name: formState.name,
          cronExpression: expression,
          target: formState.target,
          params,
          enabled: formState.enabled
        })
        toast.success('定时任务已创建')
      }
      onClose()
    } catch {
      toast.error('保存失败')
    }
  }, [editingJob, expression, updateJob, createJob, onClose, formState])

  return (
    <div className={styles.drawer} style={{ display: open ? 'flex' : 'none' }}>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3>{editingJob ? '编辑定时任务' : '新建定时任务'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input placeholder="例如：每日数据备份" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} />
          </div>

          <div>
            <label className="text-sm font-medium">Cron 表达式</label>
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="分 时 日 月 星期"
              className={styles.cronInput}
            />
          </div>

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
          <div>
            <label className="text-sm font-medium">常用表达式</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COMMON_PRESETS.map((preset) => (
                <Badge
                  key={preset.value}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setExpression(preset.value)}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">执行目标</label>
            <Select value={formState.target} onValueChange={(v) => setFormState({ ...formState, target: v })}>
              <SelectTrigger>
                <SelectValue placeholder="选择执行目标" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Research">Research 专家</SelectItem>
                <SelectItem value="Data">Data 专家</SelectItem>
                <SelectItem value="GeoCode">GeoCode 专家</SelectItem>
                <SelectItem value="Analysis">Analysis 专家</SelectItem>
                <SelectItem value="Write">Write 专家</SelectItem>
                <SelectItem value="skill">自定义 Skill</SelectItem>
                <SelectItem value="script">自定义脚本</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">参数配置</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder='{"band": "NIR"}'
              value={formState.params}
              onChange={(e) => setFormState({ ...formState, params: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={formState.enabled} onCheckedChange={(v) => {
              setFormState({ ...formState, enabled: v })
              if (editingJob) toggleJob(editingJob.id)
            }} />
            <label className="text-sm font-medium">启用</label>
          </div>

          <div className={styles.actions}>
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleFinish} disabled={loading}>
              {editingJob ? '保存' : '创建'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

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

    const candidate = new Date(now)
    candidate.setSeconds(0, 0)

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
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min)

  if (field.includes('/')) {
    const [range, stepStr] = field.split('/')
    const step = parseInt(stepStr, 10)
    if (range === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((v) => v % step === 0)
    }
    const [start, end] = range.split('-').map(Number)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i).filter((v) => v % step === 0)
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  if (field.includes(',')) {
    return field.split(',').map(Number)
  }

  const val = parseInt(field, 10)
  if (!isNaN(val)) return [val]

  return []
}
