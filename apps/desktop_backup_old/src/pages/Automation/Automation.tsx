import { useMemo, useState } from 'react'
import { Bot, Clock3, MoreHorizontal, Plus, RotateCw, Search, SlidersHorizontal } from 'lucide-react'
import { useAutomationStore, type CronJob, type AutomationRule } from './store'
import { RuleEditor } from './RuleEditor'
import { CronEditor } from './CronEditor'
import styles from './Automation.module.scss'

export function Automation() {
  const { rules, jobs, runs, fetchRules, fetchJobs, fetchRuns } = useAutomationStore()
  const [activeTab, setActiveTab] = useState<'rules' | 'jobs'>('jobs')
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false)
  const [cronEditorOpen, setCronEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [editingJob, setEditingJob] = useState<CronJob | null>(null)
  const [searchText, setSearchText] = useState('')

  const filteredRules = useMemo(() => {
    if (!searchText) return rules
    const lower = searchText.toLowerCase()
    return rules.filter(
      (r) => r.name.toLowerCase().includes(lower) || r.description.toLowerCase().includes(lower),
    )
  }, [rules, searchText])

  const filteredJobs = useMemo(() => {
    if (!searchText) return jobs
    const lower = searchText.toLowerCase()
    return jobs.filter((j) => j.name.toLowerCase().includes(lower))
  }, [jobs, searchText])

  const refreshAll = () => {
    fetchRules()
    fetchJobs()
    fetchRuns()
  }

  return (
    <div className={styles.cronPage}>
      {/* Top toolbar */}
      <div className={styles.cronActions}>
        <button className={styles.refresh} title="刷新" onClick={refreshAll}>
          <RotateCw size={14} />
        </button>
        <div className={styles.searchField}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            placeholder="搜索任务..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <button
          className={`${styles.createBtn} ${styles.soft}`}
          onClick={() => {
            setEditingJob(null)
            setCronEditorOpen(true)
          }}
        >
          <Bot size={14} /> 通过 GeoWork 创建
        </button>
        <button
          className={styles.createBtn}
          onClick={() => {
            setEditingJob(null)
            setCronEditorOpen(true)
          }}
        >
          <Plus size={14} /> 新建定时任务
        </button>
      </div>

      {/* Content */}
      <div className={styles.cronContent}>
        <h1 className={styles.title}>定时任务</h1>
        <p className={styles.subtitle}>
          按计划自动执行地理空间任务，也可随时手动触发。在任意对话中描述你想定期做的事，即可快速创建。
        </p>

        {/* Info strip */}
        <div className={styles.cronStrip}>
          <b>定时任务仅在电脑保持唤醒时运行</b>
          <button>保持系统唤醒</button>
        </div>

        {/* Head: tabs + sort */}
        <div className={styles.cronHead}>
          <div className={styles.tabGroup}>
            <button
              className={activeTab === 'jobs' ? styles.active : ''}
              onClick={() => setActiveTab('jobs')}
            >
              我的定时任务
            </button>
            <button
              className={activeTab === 'rules' ? styles.active : ''}
              onClick={() => setActiveTab('rules')}
            >
              自动化规则
            </button>
          </div>
          <button className={styles.sortBtn}>
            <SlidersHorizontal size={13} /> 按创建时间倒序
          </button>
        </div>

        {/* Grid */}
        {activeTab === 'jobs' ? (
          filteredJobs.length > 0 ? (
            <div className={styles.cronGrid}>
              {filteredJobs.map((job) => (
                <article key={job.id} className={styles.cronCard}>
                  <button
                    className={`${styles.cronToggle} ${job.enabled ? styles.on : ''}`}
                    onClick={() => useAutomationStore.getState().toggleJob?.(job.id)}
                    aria-label="切换任务"
                  />
                  <button
                    className={styles.cronMore}
                    onClick={() => {
                      setEditingJob(job)
                      setCronEditorOpen(true)
                    }}
                    aria-label="更多"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  <strong className={styles.cronName}>{job.name}</strong>
                  <p className={styles.cronDesc}>目标：{job.target} · 周期性执行的地理空间任务</p>
                  <span className={styles.cronTime}>
                    <Clock3 size={13} />
                    {job.cronExpression}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>暂无定时任务，点击右上角创建</div>
          )
        ) : filteredRules.length > 0 ? (
          <div className={styles.cronGrid}>
            {filteredRules.map((rule) => (
              <article key={rule.id} className={styles.cronCard}>
                <button
                  className={`${styles.cronToggle} ${rule.enabled ? styles.on : ''}`}
                  onClick={() => useAutomationStore.getState().toggleRule?.(rule.id)}
                  aria-label="切换规则"
                />
                <button
                  className={styles.cronMore}
                  onClick={() => {
                    setEditingRule(rule)
                    setRuleEditorOpen(true)
                  }}
                  aria-label="更多"
                >
                  <MoreHorizontal size={16} />
                </button>
                <strong className={styles.cronName}>{rule.name}</strong>
                <p className={styles.cronDesc}>{rule.description}</p>
                <span className={styles.cronTime}>
                  <Clock3 size={13} />
                  {rule.trigger}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>暂无自动化规则</div>
        )}

        {/* Run history */}
        {runs.length > 0 && (
          <div className={styles.runsCard}>
            <div className={styles.runsHead}>
              执行记录
              <button className={styles.sortBtn} onClick={fetchRuns}>
                <RotateCw size={13} /> 刷新
              </button>
            </div>
            <table className={styles.runsTable}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>类型</th>
                  <th style={{ width: 90 }}>状态</th>
                  <th style={{ width: 170 }}>开始时间</th>
                  <th>消息</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.ruleId ? '规则' : '定时'}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${run.status}`}>
                        {run.status === 'running' ? '运行中' : run.status === 'completed' ? '已完成' : '失败'}
                      </span>
                    </td>
                    <td>{new Date(run.startedAt).toLocaleString('zh-CN')}</td>
                    <td>{run.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating avatar */}
      <button className={styles.avatarFloat} title="账户">
        G
      </button>

      {/* Editors */}
      <RuleEditor
        open={ruleEditorOpen}
        onClose={() => {
          setRuleEditorOpen(false)
          setEditingRule(null)
        }}
        editingRule={editingRule}
      />
      <CronEditor
        open={cronEditorOpen}
        onClose={() => {
          setCronEditorOpen(false)
          setEditingJob(null)
        }}
        editingJob={editingJob}
      />
    </div>
  )
}
