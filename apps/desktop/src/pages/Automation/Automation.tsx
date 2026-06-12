import { useCallback, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { toast } from 'sonner'
import { Plus, Play, Trash2, Edit, RefreshCw } from 'lucide-react'
import { useAutomationStore, AutomationRule, CronJob, TriggerType } from './store'
import { RuleEditor } from './RuleEditor'
import { CronEditor } from './CronEditor'
import styles from './Automation.module.scss'

const TRIGGER_LABELS: Record<TriggerType, string> = {
  'file-change': '文件变更',
  'data-ready': '数据就绪',
  'task-complete': '任务完成',
  'manual': '手动触发',
  'cron': 'Cron 定时'
}

export function Automation() {
  const { rules, jobs, runs, loading, fetchRules, fetchJobs, fetchRuns } = useAutomationStore()
  const [activeTab, setActiveTab] = useState<'rules' | 'jobs'>('rules')
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false)
  const [cronEditorOpen, setCronEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [editingJob, setEditingJob] = useState<CronJob | null>(null)
  const [searchText, setSearchText] = useState('')

  const filteredRules = useMemo(() => {
    if (!searchText) return rules
    const lower = searchText.toLowerCase()
    return rules.filter(
      (r) => r.name.toLowerCase().includes(lower) || r.description.toLowerCase().includes(lower)
    )
  }, [rules, searchText])

  const filteredJobs = useMemo(() => {
    if (!searchText) return jobs
    const lower = searchText.toLowerCase()
    return jobs.filter((j) => j.name.toLowerCase().includes(lower))
  }, [jobs, searchText])

  return (
    <div className={styles.container}>
      {/* Tabs */}
      <Card className={styles.toolbar}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant={activeTab === 'rules' ? 'default' : 'outline'} onClick={() => setActiveTab('rules')}>
                自动化规则 ({filteredRules.length} 条)
              </Button>
              <Button size="sm" variant={activeTab === 'jobs' ? 'default' : 'outline'} onClick={() => setActiveTab('jobs')}>
                定时任务 ({filteredJobs.length} 个)
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                className="w-[240px]"
                placeholder="搜索..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => { fetchRules(); fetchJobs(); fetchRuns() }}>
                <RefreshCw className="w-4 h-4 mr-1" /> 刷新
              </Button>
              {activeTab === 'rules' ? (
                <Button size="sm" onClick={() => { setEditingRule(null); setRuleEditorOpen(true) }}>
                  <Plus className="w-4 h-4 mr-1" /> 新建规则
                </Button>
              ) : (
                <Button size="sm" onClick={() => { setEditingJob(null); setCronEditorOpen(true) }}>
                  <Plus className="w-4 h-4 mr-1" /> 新建定时任务
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab content */}
      <Card className="flex-1 overflow-auto">
        <CardContent className="p-0">
          {activeTab === 'rules' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">名称</th>
                  <th className="text-left p-3 w-[120px]">触发条件</th>
                  <th className="text-left p-3 w-[140px]">执行目标</th>
                  <th className="text-left p-3 w-[90px]">状态</th>
                  <th className="text-left p-3 w-[160px]">最后执行</th>
                  <th className="text-left p-3 w-[160px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="p-3 font-medium">{record.name}</td>
                    <td className="p-3"><Badge variant="secondary">{TRIGGER_LABELS[record.trigger]}</Badge></td>
                    <td className="p-3">{record.target}</td>
                    <td className="p-3">
                      <Badge variant={record.enabled ? 'default' : 'outline'}>{record.enabled ? '启用' : '禁用'}</Badge>
                    </td>
                    <td className="p-3">
                      <span>{record.lastRunAt ? new Date(record.lastRunAt).toLocaleString('zh-CN') : '-'}</span>
                      {record.lastRunStatus && (
                        <Badge variant={record.lastRunStatus === 'success' ? 'default' : 'destructive'} className="ml-1">
                          {record.lastRunStatus === 'success' ? '成功' : '失败'}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => useAutomationStore.getState().triggerRule(record.id)} disabled={loading}>
                          <Play className="w-3 h-3 mr-1" /> 触发
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingRule(record); setRuleEditorOpen(true) }}>
                          <Edit className="w-3 h-3 mr-1" /> 编辑
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => useAutomationStore.getState().deleteRule(record.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">名称</th>
                  <th className="text-left p-3 w-[180px]">Cron 表达式</th>
                  <th className="text-left p-3 w-[180px]">下次执行</th>
                  <th className="text-left p-3 w-[90px]">状态</th>
                  <th className="text-left p-3 w-[160px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="p-3 font-medium">{record.name}</td>
                    <td className="p-3"><code className="text-xs bg-muted px-1 py-0.5 rounded">{record.cronExpression}</code></td>
                    <td className="p-3">{record.nextRunAt ? new Date(record.nextRunAt).toLocaleString('zh-CN') : '-'}</td>
                    <td className="p-3">
                      <Badge variant={record.enabled ? 'default' : 'outline'}>{record.enabled ? '启用' : '禁用'}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => useAutomationStore.getState().triggerJob(record.id)} disabled={loading}>
                          <Play className="w-3 h-3 mr-1" /> 执行
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingJob(record); setCronEditorOpen(true) }}>
                          <Edit className="w-3 h-3 mr-1" /> 编辑
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => useAutomationStore.getState().deleteJob(record.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Run history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>执行记录</CardTitle>
            <Button size="sm" variant="outline" onClick={fetchRuns}>
              <RefreshCw className="w-4 h-4 mr-1" /> 刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 w-[80px]">类型</th>
                <th className="text-left p-3 w-[100px]">状态</th>
                <th className="text-left p-3 w-[170px]">开始时间</th>
                <th className="text-left p-3 w-[170px]">完成时间</th>
                <th className="text-left p-3">消息</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b">
                  <td className="p-3"><Badge variant="outline">{run.ruleId ? '规则' : '定时任务'}</Badge></td>
                  <td className="p-3">
                    <Badge variant={run.status === 'completed' ? 'default' : run.status === 'running' ? 'secondary' : 'destructive'}>
                      {run.status === 'running' ? '运行中' : run.status === 'completed' ? '已完成' : '失败'}
                    </Badge>
                  </td>
                  <td className="p-3">{new Date(run.startedAt).toLocaleString('zh-CN')}</td>
                  <td className="p-3">{run.completedAt ? new Date(run.completedAt).toLocaleString('zh-CN') : '-'}</td>
                  <td className="p-3">{run.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Rule Editor */}
      <RuleEditor open={ruleEditorOpen} onClose={() => { setRuleEditorOpen(false); setEditingRule(null) }} editingRule={editingRule} />

      {/* Cron Editor */}
      <CronEditor open={cronEditorOpen} onClose={() => { setCronEditorOpen(false); setEditingJob(null) }} editingJob={editingJob} />
    </div>
  )
}
