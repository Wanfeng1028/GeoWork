import { useCallback, useMemo, useState } from 'react'
import { Button, Card, Input, Space, Table, Tag, Popconfirm, message, Badge, Typography } from 'antd'
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
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

  // Fetch data on mount
  useCallback(() => {
    fetchRules()
    fetchJobs()
    fetchRuns()
  }, [fetchRules, fetchJobs, fetchRuns])

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

  // ── Rule columns ─────────────────────────────────────────────────────────

  const ruleColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '触发条件',
      dataIndex: 'trigger',
      key: 'trigger',
      width: 120,
      render: (trigger: TriggerType) => <Tag color="blue">{TRIGGER_LABELS[trigger]}</Tag>
    },
    {
      title: '执行目标',
      dataIndex: 'target',
      key: 'target',
      width: 140
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 90,
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? '启用' : '禁用'} className={styles.statusTag} />
      )
    },
    {
      title: '最后执行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 160,
      render: (val: string | undefined, record: AutomationRule) => (
        <span>
          {val ? new Date(val).toLocaleString('zh-CN') : '-'}
          {record.lastRunStatus && (
            <Tag color={record.lastRunStatus === 'success' ? 'green' : 'red'} className={styles.runTag}>
              {record.lastRunStatus === 'success' ? '成功' : '失败'}
            </Tag>
          )}
        </span>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: AutomationRule) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => useAutomationStore.getState().triggerRule(record.id)}
            disabled={loading}
          >
            触发
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingRule(record); setRuleEditorOpen(true) }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此规则？" onConfirm={() => useAutomationStore.getState().deleteRule(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // ── Job columns ──────────────────────────────────────────────────────────

  const jobColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      width: 180,
      render: (expr: string) => (
        <code className={styles.cronCode}>{expr}</code>
      )
    },
    {
      title: '下次执行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 180,
      render: (val: string | undefined) => (
        val ? new Date(val).toLocaleString('zh-CN') : '-'
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 90,
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? '启用' : '禁用'} className={styles.statusTag} />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: CronJob) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => useAutomationStore.getState().triggerJob(record.id)}
            disabled={loading}
          >
            执行
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingJob(record); setCronEditorOpen(true) }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此定时任务？" onConfirm={() => useAutomationStore.getState().deleteJob(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // ── Run history columns ──────────────────────────────────────────────────

  const runColumns = [
    {
      title: '类型',
      key: 'type',
      width: 80,
      render: (_: unknown, record: { ruleId?: string; jobId?: string }) => (
        <Tag>{record.ruleId ? '规则' : '定时任务'}</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = { running: 'processing', completed: 'success', failed: 'error' }
        const labelMap: Record<string, string> = { running: '运行中', completed: '已完成', failed: '失败' }
        return <Tag color={colorMap[status] || 'default'}>{labelMap[status] || status}</Tag>
      }
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 170,
      render: (val: string) => new Date(val).toLocaleString('zh-CN')
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 170,
      render: (val: string | undefined) => val ? new Date(val).toLocaleString('zh-CN') : '-'
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message'
    }
  ]

  return (
    <div className={styles.container}>
      {/* Tabs */}
      <Card
        className={styles.toolbar}
        size="small"
        extra={
          <Space>
            <Input.Search
              className={styles.searchInput}
              placeholder="搜索..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(val) => setSearchText(val)}
              style={{ width: 240 }}
              size="small"
            />
            <Button size="small" icon={<ReloadOutlined />} onClick={() => { fetchRules(); fetchJobs(); fetchRuns() }}>
              刷新
            </Button>
            {activeTab === 'rules' ? (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setEditingRule(null); setRuleEditorOpen(true) }}
              >
                新建规则
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setEditingJob(null); setCronEditorOpen(true) }}
              >
                新建定时任务
              </Button>
            )}
          </Space>
        }
      >
        <Typography.Text type="secondary">
          {activeTab === 'rules'
            ? `自动化规则 (${filteredRules.length} 条)`
            : `定时任务 (${filteredJobs.length} 个)`}
        </Typography.Text>
      </Card>

      {/* Tab content */}
      <Card size="small" style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'rules' ? (
          <Table
            rowKey="id"
            dataSource={filteredRules}
            columns={ruleColumns}
            pagination={{ pageSize: 10 }}
            size="small"
            locale={{ emptyText: '暂无自动化规则' }}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={filteredJobs}
            columns={jobColumns}
            pagination={{ pageSize: 10 }}
            size="small"
            locale={{ emptyText: '暂无定时任务' }}
          />
        )}
      </Card>

      {/* Run history */}
      <Card
        title="执行记录"
        size="small"
        className={styles.runsPanel}
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchRuns}>
            刷新
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={runs}
          columns={runColumns}
          pagination={{ pageSize: 8 }}
          size="small"
          locale={{ emptyText: '暂无执行记录' }}
        />
      </Card>

      {/* Rule Editor Drawer */}
      <RuleEditor
        open={ruleEditorOpen}
        onClose={() => { setRuleEditorOpen(false); setEditingRule(null) }}
        editingRule={editingRule}
      />

      {/* Cron Editor Drawer */}
      <CronEditor
        open={cronEditorOpen}
        onClose={() => { setCronEditorOpen(false); setEditingJob(null) }}
        editingJob={editingJob}
      />
    </div>
  )
}
