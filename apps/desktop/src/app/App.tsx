import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Form, Input, List, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined
} from '@ant-design/icons'
import { api, Artifact, Project, RuntimeEvent, Task } from '../services/api'
import { MonacoEditor } from '../components/common/MonacoEditor'
import { Terminal } from '../components/common/Terminal'
import NDVIChart from '../components/common/NDVIChart'
import UsageChart from '../components/common/UsageChart'
import PlotlyChart from '../components/common/PlotlyChart'
import { ProjectFiles } from '../pages/ProjectFiles/ProjectFiles'
import NdvAnalysis from '../pages/NdvAnalysis/NdvAnalysis'
import styles from './App.module.scss'

const navItems = [
  ['workbench', '工作台', <RobotOutlined />],
  ['projects', '项目文件', <FolderOpenOutlined />],
  ['map', '地图与图层', <GlobalOutlined />],
  ['ndvi', 'NDVI 分析', <ExperimentOutlined />],
  ['papers', '论文搜索', <FileSearchOutlined />],
  ['knowledge', '知识库', <BookOutlined />],
  ['data', '数据中心', <DatabaseOutlined />],
  ['experts', '专家', <TeamOutlined />],
  ['skills', '技能', <ExperimentOutlined />],
  ['automation', '自动化', <ToolOutlined />],
  ['cron', '定时任务', <CalendarOutlined />],
  ['extensions', '扩展', <AppstoreOutlined />],
  ['marketplace', '插件市场', <CloudServerOutlined />],
  ['models', '模型与 API', <ApiOutlined />],
  ['usage', '用量统计', <BarChartOutlined />],
  ['settings', '设置', <SettingOutlined />]
] as const

const modes = ['Research', 'Data', 'GeoCode', 'Analysis', 'Write']

export function App() {
  const [active, setActive] = useState('workbench')
  const [health, setHealth] = useState<Record<string, unknown>>({})
  const [projects, setProjects] = useState<Project[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [datasets, setDatasets] = useState<any[]>([])
  const [layers, setLayers] = useState<any[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [plugins, setPlugins] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [usage, setUsage] = useState<Record<string, unknown>>({})
  const [usageRecords, setUsageRecords] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [environmentChecks, setEnvironmentChecks] = useState<any[]>([])
  const [automations, setAutomations] = useState<any[]>([])
  const [automationRuns, setAutomationRuns] = useState<any[]>([])
  const [mcp, setMcp] = useState<any[]>([])
  const [experts, setExperts] = useState<any[]>([])
  const [papers, setPapers] = useState<any[]>([])
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [securityDecisions, setSecurityDecisions] = useState<any[]>([])
  const [tools, setTools] = useState<any[]>([])
  const [einoSchema, setEinoSchema] = useState<Record<string, unknown>>({})
  const [form] = Form.useForm()

  async function refresh() {
    const [healthRes, projectsRes, tasksRes, artifactRes, deliveryRes, datasetRes, layerRes, skillsRes, pluginsRes, modelsRes, usageRes, usageRecordRes, settingsRes, envRes, autoRes, runRes, expertRes, paperRes, knowledgeRes, securityRes, toolRes, einoRes, mcpRes] = await Promise.all([
      api.health(),
      api.projects(),
      api.tasks(),
      api.artifacts(),
      api.deliveries(),
      api.datasets(),
      api.layers(),
      api.skills(),
      api.plugins(),
      api.models(),
      api.usage(),
      api.usageRecords(),
      api.settings(),
      api.environmentChecks(),
      api.automations(),
      api.automationRuns(),
      api.experts(),
      api.papers(),
      api.knowledge(),
      api.securityDecisions(),
      api.tools(),
      api.einoSchema(),
      api.mcp()
    ])
    setHealth(healthRes)
    setProjects(projectsRes)
    setTasks(tasksRes)
    setArtifacts(artifactRes)
    setDeliveries(deliveryRes)
    setDatasets(datasetRes)
    setLayers(layerRes)
    setSkills(skillsRes)
    setPlugins(pluginsRes)
    setModels(modelsRes)
    setUsage(usageRes)
    setUsageRecords(usageRecordRes)
    setSettings(settingsRes)
    setEnvironmentChecks(envRes)
    setAutomations(autoRes)
    setAutomationRuns(runRes)
    setExperts(expertRes)
    setPapers(paperRes)
    setKnowledge(knowledgeRes)
    setSecurityDecisions(securityRes)
    setTools(toolRes)
    setEinoSchema(einoRes)
    setMcp(mcpRes)
  }

  useEffect(() => {
    refresh().catch((error) => message.error(error.message))
  }, [])

  const currentTask = tasks[0]
  useEffect(() => {
    if (!currentTask) return
    const timer = window.setInterval(() => api.events(currentTask.id).then(setEvents).catch(() => undefined), 1000)
    return () => window.clearInterval(timer)
  }, [currentTask?.id])

  async function runWorkflow(values: { prompt: string; mode: string }) {
    let project = projects[0]
    if (!project) {
      project = await api.createProject({ name: 'GeoWork V1 Workspace', mode: values.mode })
    }
    const task = await api.createTask({ projectId: project.id, prompt: values.prompt, mode: values.mode })
    setTasks([task, ...tasks])
    const completed = await api.runTask(task.id)
    setTasks((existing) => [completed, ...existing.filter((item) => item.id !== completed.id)])
    setEvents(await api.events(task.id))
    await refresh()
  }

  const moduleContent = useMemo(() => {
    if (active === 'workbench') {
      return <Workbench form={form} task={currentTask} events={events} onRun={runWorkflow} />
    }
    if (active === 'skills') {
      return <Catalog title="官方 Skill" data={skills} action={(item) => <Button size="small" icon={<PlayCircleOutlined />} onClick={() => api.runSkill(item.id).then(refresh)}>运行</Button>} />
    }
    if (active === 'marketplace' || active === 'extensions') {
      return <Catalog title="本地插件市场" data={plugins} action={(item) => <Button size="small" onClick={() => api.enablePlugin(item.id, !item.enabled).then(refresh)}>{item.enabled ? '禁用' : '启用'}</Button>} />
    }
    if (active === 'models') {
      return <Models models={models} onSave={(provider) => api.saveModel({ provider, name: provider, baseUrl: 'https://api.example.local/v1' }).then(refresh)} onTest={(provider) => api.testModel({ provider, name: provider, baseUrl: 'https://api.example.local/v1' }).then(refresh)} />
    }
    if (active === 'usage') {
      return <Usage usage={usage} records={usageRecords} />
    }
    if (active === 'settings') {
      return <SettingsPanel settings={settings} environmentChecks={environmentChecks} onSave={(theme) => api.saveSettings({ theme }).then(refresh)} />
    }
    if (active === 'automation' || active === 'cron') {
      return <AutomationPanel automations={automations} runs={automationRuns} onCreate={() => api.createAutomation({ name: '每日知识库索引', trigger: 'cron:0 21 * * *', target: 'Research', enabled: true }).then(refresh)} onTrigger={(id) => api.triggerAutomation(id).then(refresh)} />
    }
    if (active === 'papers') {
      return <ResearchPanel papers={papers} onSearch={(query) => api.papers(query).then(setPapers)} />
    }
    if (active === 'knowledge') {
      return <KnowledgePanel knowledge={knowledge} onIndex={() => api.indexKnowledge({ title: 'Imported research notes', type: 'markdown', path: 'workspace/knowledge/imported.md' }).then(refresh)} />
    }
    if (active === 'data') {
      return <DataPanel datasets={datasets} onRegister={() => api.registerDataset({ projectId: projects[0]?.id, name: 'Sentinel-2 NDVI Sample', type: 'GeoTIFF' }).then(refresh)} />
    }
    if (active === 'experts') {
      return <Catalog title="专家团队" data={experts} />
    }
    if (active === 'map') {
      return <MapPanel artifacts={currentTask?.artifacts ?? []} layers={layers} onToggle={(layer) => api.updateLayer(layer.id, { visible: !layer.visible, opacity: layer.opacity }).then(refresh)} />
    }
    if (active === 'ndvi') {
      return <NdvAnalysis />
    }
    if (active === 'projects') {
      return <ProjectFiles />
    }
    return <SecurityPanel mcp={mcp} tools={tools} einoSchema={einoSchema} decisions={securityDecisions} onResolve={(id) => api.resolveSecurityDecision(id, { decision: 'approved', reason: 'User approved in desktop UI' }).then(refresh)} />
  }, [active, artifacts, automations, automationRuns, currentTask, datasets, einoSchema, environmentChecks, events, experts, form, knowledge, layers, mcp, models, papers, plugins, projects, securityDecisions, settings, skills, tasks, tools, usage, usageRecords])

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <Typography.Title level={4}>GeoWork</Typography.Title>
          <span>地理遥感科研工程 Agent 工作台</span>
        </div>
        <Space>
          {modes.map((mode) => <Tag key={mode} color="blue">{mode}</Tag>)}
          <Tag icon={<CheckCircleOutlined />} color={health.status === 'ok' ? 'green' : 'orange'}>{String(health.status ?? 'checking')}</Tag>
        </Space>
      </header>
      <aside className={styles.sidebar}>
        {navItems.map(([key, label, icon]) => (
          <button key={key} className={active === key ? styles.activeNav : styles.navItem} onClick={() => setActive(key)}>
            {icon}<span>{label}</span>
          </button>
        ))}
        <div className={styles.security}><SafetyCertificateOutlined /> 工作区安全模式</div>
      </aside>
      <main className={styles.main}>{moduleContent}</main>
      <BottomPanel events={events} task={currentTask} />
    </div>
  )
}

function Workbench({ form, task, events, onRun }: { form: any; task?: Task; events: RuntimeEvent[]; onRun: (values: any) => Promise<void> }) {
  const [showEditor, setShowEditor] = useState(false)
  const [editorContent, setEditorContent] = useState<string | undefined>(undefined)
  const [editorLanguage, setEditorLanguage] = useState<'python' | 'javascript' | 'json' | 'markdown'>('python')
  const [editorFilename, setEditorFilename] = useState('script.py')

  const handleViewScript = useCallback(() => {
    setEditorContent(undefined)
    setEditorLanguage('python')
    setEditorFilename('script.py')
    setShowEditor(true)
  }, [])

  const handleEditorChange = useCallback((value: string) => {
    setEditorContent(value)
  }, [])

  const handleCommand = useCallback((cmd: string) => {
    // Command handled by Terminal component
  }, [])

  return (
    <div className={styles.workbench}>
      <Card title="项目上下文" size="small">
        <List size="small" dataSource={['课程实验项目', 'Sentinel-2 数据', 'GEE + Python', 'DOCX/PDF 报告']} renderItem={(item) => <List.Item>{item}</List.Item>} />
      </Card>
      <Card title="任务操作区" size="small">
        <Form form={form} layout="vertical" initialValues={{ mode: 'Analysis', prompt: '运行 NDVI 实验报告 Skill，生成 GEE 脚本、地图预览和 Word 报告' }} onFinish={onRun}>
          <Form.Item name="mode" label="工作模式"><Select options={modes.map((mode) => ({ label: mode, value: mode }))} /></Form.Item>
          <Form.Item name="prompt" label="任务"><Input.TextArea rows={4} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />}>创建并执行任务</Button>
            <Button icon={<CodeOutlined />} onClick={handleViewScript}>查看脚本</Button>
          </Space>
        </Form>
        <div className={styles.plan}>
          {(task?.plan ?? []).map((step) => <div key={step.id} className={styles.step}><Tag>{step.status}</Tag><strong>{step.title}</strong><span>{step.toolName}</span></div>)}
        </div>
      </Card>
      <Card title="上下文面板" size="small">
        <NDVIChart />
        <List size="small" header="成果" dataSource={task?.artifacts ?? []} renderItem={(item) => <List.Item><Typography.Text>{item.name}</Typography.Text><Tag>{item.type}</Tag></List.Item>} />
        <List size="small" header="最新事件" dataSource={events.slice(-5)} renderItem={(item) => <List.Item>{item.message}</List.Item>} />
      </Card>

      {/* Monaco Editor overlay */}
      {showEditor && (
        <div className={styles.editorOverlay}>
          <div className={styles.editorHeader}>
            <span>GEE 脚本编辑器</span>
            <Space>
              <Select
                value={editorLanguage}
                onChange={(v) => setEditorLanguage(v)}
                options={[
                  { label: 'Python', value: 'python' },
                  { label: 'JavaScript', value: 'javascript' },
                  { label: 'JSON', value: 'json' },
                  { label: 'Markdown', value: 'markdown' }
                ]}
                style={{ width: 120 }}
                size="small"
              />
              <Input
                value={editorFilename}
                onChange={(e) => setEditorFilename(e.target.value)}
                style={{ width: 160 }}
                size="small"
              />
              <Button size="small" onClick={() => setShowEditor(false)}>关闭</Button>
            </Space>
          </div>
          <div className={styles.editorBody}>
            <MonacoEditor
              value={editorContent}
              language={editorLanguage}
              filename={editorFilename}
              onChange={handleEditorChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BottomPanel({ events, task }: { events: RuntimeEvent[]; task?: Task }) {
  return (
    <footer className={styles.bottom}>
      <Terminal title={`任务终端 — ${task?.status ?? 'idle'}`} />
    </footer>
  )
}

function Catalog({ title, data, action }: { title: string; data: any[]; action?: (item: any) => ReactNode }) {
  return <Card title={title}><List grid={{ gutter: 12, column: 3 }} dataSource={data} renderItem={(item) => <List.Item><Card size="small" title={item.name ?? item.id} extra={action?.(item)}><p>{item.description ?? item.path ?? item.trigger}</p><Space wrap>{Object.keys(item.permissions ?? {}).map((p) => <Tag key={p}>{p}</Tag>)}{item.enabled !== undefined && <Tag color={item.enabled ? 'green' : 'default'}>{item.enabled ? 'enabled' : 'disabled'}</Tag>}</Space></Card></List.Item>} /></Card>
}

function ResearchPanel({ papers, onSearch }: { papers: any[]; onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('NDVI remote sensing')
  return (
    <Card title="论文搜索与精读">
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="primary" onClick={() => onSearch(query)}>OpenAlex 搜索</Button>
      </Space.Compact>
      <Table rowKey="id" dataSource={papers} pagination={false} columns={[
        { title: 'Title', dataIndex: 'title' },
        { title: 'Year', dataIndex: 'year', width: 90 },
        { title: 'Source', dataIndex: 'source', width: 150 },
        { title: 'Tags', dataIndex: 'tags', render: (tags: string[]) => <Space wrap>{(tags ?? []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> }
      ]} />
    </Card>
  )
}

function KnowledgePanel({ knowledge, onIndex }: { knowledge: any[]; onIndex: () => void }) {
  return (
    <Card title="知识库索引" extra={<Button onClick={onIndex}>索引示例资料</Button>}>
      <Table rowKey="id" dataSource={knowledge} pagination={false} columns={[
        { title: 'Title', dataIndex: 'title' },
        { title: 'Type', dataIndex: 'type', width: 120 },
        { title: 'Summary', dataIndex: 'summary' }
      ]} />
    </Card>
  )
}

function AutomationPanel({ automations, runs, onCreate, onTrigger }: { automations: any[]; runs: any[]; onCreate: () => void; onTrigger: (id: string) => void }) {
  return (
    <div className={styles.stack}>
      <Card title="自动化规则" extra={<Button onClick={onCreate}>新建规则</Button>}>
        <List grid={{ gutter: 12, column: 2 }} dataSource={automations} renderItem={(item) => <List.Item><Card size="small" title={item.name} extra={<Button size="small" onClick={() => onTrigger(item.id)}>触发</Button>}><p>{item.trigger}</p><Tag>{item.target}</Tag></Card></List.Item>} />
      </Card>
      <Card title="执行记录">
        <Table rowKey="id" dataSource={runs} pagination={false} columns={[
          { title: 'Automation', dataIndex: 'automationId' },
          { title: 'Task', dataIndex: 'taskId' },
          { title: 'Status', dataIndex: 'status' },
          { title: 'Message', dataIndex: 'message' }
        ]} />
      </Card>
    </div>
  )
}

function Models({ models, onSave, onTest }: { models: any[]; onSave: (provider: string) => void; onTest: (provider: string) => void }) {
  return <Card title="模型与 API"><Table rowKey="id" dataSource={models} pagination={false} columns={[{ title: 'Provider', dataIndex: 'provider' }, { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> }, { title: 'Action', render: (_, row) => <Space><Button size="small" onClick={() => onSave(row.provider)}>保存</Button><Button size="small" onClick={() => onTest(row.provider)}>测试</Button></Space> }]} /></Card>
}

function Usage({ usage, records }: { usage: Record<string, unknown>; records: any[] }) {
  return (
    <div className={styles.stack}>
      <Space size={16}>
        <Card><Statistic title="任务数" value={Number(usage.tasks ?? 0)} /></Card>
        <Card><Statistic title="成果数" value={Number(usage.artifacts ?? 0)} /></Card>
        <Card><Statistic title="估算 Tokens" value={Number(usage.estimatedTokens ?? 0)} /></Card>
        <Card><Statistic title="成本 CNY" value={Number(usage.costCny ?? 0)} precision={2} /></Card>
      </Space>
      <UsageChart />
      <Card title="用量记录">
        <Table rowKey="id" dataSource={records} pagination={{ pageSize: 8 }} columns={[
          { title: 'Kind', dataIndex: 'kind' },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Tokens', dataIndex: 'tokens', width: 120 },
          { title: 'Cost CNY', dataIndex: 'costCny', width: 120 }
        ]} />
      </Card>
    </div>
  )
}

function Scenario({ title, description, tags }: { title: string; description: string; tags: string[] }) {
  return <Card title={title}><Typography.Paragraph>{description}</Typography.Paragraph><Space wrap>{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space></Card>
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
  return <Card title={title}><pre className={styles.json}>{JSON.stringify(data, null, 2)}</pre></Card>
}

function SettingsPanel({ settings, environmentChecks, onSave }: { settings: Record<string, unknown>; environmentChecks: any[]; onSave: (theme: string) => void }) {
  return (
    <div className={styles.stack}>
      <Card title="外观与环境" extra={<Button onClick={() => onSave('dark')}>保存深色设置</Button>}>
        <pre className={styles.json}>{JSON.stringify(settings, null, 2)}</pre>
      </Card>
      <Card title="本地环境检查">
        <Table rowKey="name" dataSource={environmentChecks} pagination={false} columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
          { title: 'Required', dataIndex: 'required', width: 120, render: (value) => value ? 'Yes' : 'No' },
          { title: 'Message', dataIndex: 'message' }
        ]} />
      </Card>
    </div>
  )
}

function SecurityPanel({ mcp, tools, einoSchema, decisions, onResolve }: { mcp: any[]; tools: any[]; einoSchema: Record<string, unknown>; decisions: any[]; onResolve: (id: string) => void }) {
  return (
    <div className={styles.stack}>
      <Card title="Tool Registry">
        <Table rowKey="name" dataSource={tools} pagination={false} columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Risk', dataIndex: 'risk', width: 120 }, { title: 'Description', dataIndex: 'description' }]} />
      </Card>
      <Card title="安全审批记录">
        <Table rowKey="id" dataSource={decisions} pagination={{ pageSize: 6 }} columns={[{ title: 'Tool', dataIndex: 'tool' }, { title: 'Risk', dataIndex: 'risk' }, { title: 'Decision', dataIndex: 'decision' }, { title: 'Action', render: (_, row) => <Button size="small" onClick={() => onResolve(row.id)}>批准</Button> }]} />
      </Card>
      <JsonPanel title="MCP / Eino" data={{ mcp, einoSchema }} />
    </div>
  )
}

function DataPanel({ datasets, onRegister }: { datasets: any[]; onRegister: () => void }) {
  return (
    <Card title="数据中心" extra={<Button onClick={onRegister}>登记样例数据</Button>}>
      <Table rowKey="id" dataSource={datasets} pagination={{ pageSize: 8 }} columns={[
        { title: 'Name', dataIndex: 'name' },
        { title: 'Type', dataIndex: 'type' },
        { title: 'CRS', dataIndex: 'crs' },
        { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
        { title: 'Path', dataIndex: 'path' }
      ]} />
    </Card>
  )
}

function MapPanel({ artifacts, layers, onToggle }: { artifacts: Artifact[]; layers: any[]; onToggle: (layer: any) => void }) {
  return <Card title="地图与图层"><PlotlyChart chartType="terrain" title="DEM 地形可视化" height={300} /><Table rowKey="id" dataSource={layers} pagination={false} columns={[{ title: 'Layer', dataIndex: 'name' }, { title: 'Kind', dataIndex: 'kind' }, { title: 'Visible', dataIndex: 'visible', render: (value, row) => <Button size="small" onClick={() => onToggle(row)}>{value ? '隐藏' : '显示'}</Button> }, { title: 'Opacity', dataIndex: 'opacity' }]} /><List dataSource={artifacts} renderItem={(item) => <List.Item>{item.name}<Tag>{item.mimeType}</Tag></List.Item>} /></Card>
}
