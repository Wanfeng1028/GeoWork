import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Play,
  Pause,
  Trash2,
  FileText,
  Code,
  Database,
  BarChart3,
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { useAgentStudioStore } from '../../stores/agentStore'
import type { Workflow } from '../../services/agentService'
import styles from './AgentStudio.module.scss'

const MODE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Research: { icon: <Bot />, color: '#1677ff', label: '研究' },
  Data: { icon: <Database />, color: '#10b981', label: '数据' },
  GeoCode: { icon: <Code />, color: '#f59e0b', label: '编码' },
  Analysis: { icon: <BarChart3 />, color: '#8b5cf6', label: '分析' },
  Write: { icon: <FileText />, color: '#ec4899', label: '写作' },
}

interface WorkflowCardProps {
  workflow: { id: string; name: string; description: string; status: string; createdAt: string }
  onSelect: (w: any) => void
  onRun: (id: string) => void
  onStop: (id: string) => void
  onDelete: (id: string) => void
}

function WorkflowCard({ workflow, onSelect, onRun, onStop, onDelete }: WorkflowCardProps) {
  const statusColor = workflow.status === 'running' ? 'bg-green-500' : workflow.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
  const statusLabel = workflow.status === 'running' ? '运行中' : workflow.status === 'failed' ? '错误' : '就绪'

  return (
    <div
      className={styles.workflowCard}
      onClick={() => onSelect(workflow)}
    >
      <div>
        <div >
          <h4 >{workflow.name}</h4>
          <span>
            {statusLabel}
          </span>
        </div>
        <div >
          <Clock  /> {new Date(workflow.createdAt).toLocaleDateString('zh-CN')}
        </div>
        {workflow.description && <p >{workflow.description}</p>}
        <div >
          <button onClick={(e) => { e.stopPropagation(); onRun(workflow.id) }}>
            <Play  /> 运行
          </button>
          <button onClick={(e) => { e.stopPropagation(); onStop(workflow.id) }}>
            <Pause  /> 停止
          </button>
          <button  onClick={(e) => { e.stopPropagation(); onDelete(workflow.id) }}>
            <Trash2  /> 删除
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkflowList({ workflows: wfs, onSelect, onRun, onStop, onDelete }: { workflows: Workflow[]; onSelect: (w: any) => void; onRun: (id: string) => void; onStop: (id: string) => void; onDelete: (id: string) => void }) {
  if (wfs.length === 0) {
    return <div>暂无工作流</div>
  }
  return (
    <div >
      {wfs.map((w: Workflow) => (
        <WorkflowCard key={w.id} workflow={w} onSelect={onSelect} onRun={onRun} onStop={onStop} onDelete={onDelete} />
      ))}
    </div>
  )
}

export default function AgentStudio() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const { workflows, runs, loading, loadWorkflows, loadRuns, createWorkflow, deleteWorkflow, startRun, stopRun } = useAgentStudioStore()

  useEffect(() => {
    loadWorkflows()
    loadRuns()
  }, [loadWorkflows, loadRuns])

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return
    await createWorkflow(formName, formDesc || '')
    setModalOpen(false)
    setFormName('')
    setFormDesc('')
    toast.success('工作流创建成功')
  }, [formName, formDesc, createWorkflow])

  const handleSelectWorkflow = useCallback((w: any) => {
    setSelectedWorkflow(w)
    setDrawerOpen(true)
  }, [])

  const handleRun = useCallback(async (id: string) => {
    await startRun(id)
    toast.success('工作流已启动')
  }, [startRun])

  const handleStop = useCallback(async (id: string) => {
    await stopRun(id)
    toast.success('工作流已停止')
  }, [stopRun])

  const handleDelete = useCallback(async (id: string) => {
    await deleteWorkflow(id)
    toast.success('工作流已删除')
  }, [deleteWorkflow])

  return (
    <div className={styles.agentStudio}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 >AI Agent 工作室</h3>
            <p >创建和管理 AI Agent 工作流，配置工具链和模型网关</p>
          </div>
          <button onClick={() => setModalOpen(true)}>
            <Plus  /> 新建工作流
          </button>
        </div>

        {/* Mode Tabs */}
        <div>
          <div>
            <button>全部</button>
            {Object.entries(MODE_CONFIG).map(([mode, config]) => (
              <button key={mode}>
                <span >{config.icon} {config.label}</span>
              </button>
            ))}
          </div>
          <div>
            <WorkflowList workflows={workflows} onSelect={handleSelectWorkflow} onRun={handleRun} onStop={handleStop} onDelete={handleDelete} />
          </div>
          {Object.entries(MODE_CONFIG).map(([mode]) => (
            <div key={mode}>
              <WorkflowList workflows={workflows.filter(w => w.mode === mode)} onSelect={handleSelectWorkflow} onRun={handleRun} onStop={handleStop} onDelete={handleDelete} />
            </div>
          ))}
        </div>

        {/* Recent Runs */}
        <div>
          <div>
            <div>最近运行记录</div>
          </div>
          <div>
            {runs.length > 0 ? (
              <div >
                {runs.slice(0, 10).map((run) => (
                  <div key={run.id} className={styles.runItem}>
                    <div >
                      <span>{run.workflowName || '未命名工作流'}</span>
                      <span>
                        {run.status === 'completed' ? '完成' : run.status === 'running' ? '运行中' : run.status === 'failed' ? '错误' : '等待中'}
                      </span>
                    </div>
                    <div >
                      <span ><Clock  /> {new Date(run.startedAt).toLocaleString('zh-CN')}</span>
                      {run.completedAt && <span>耗时: {new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()}ms</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>暂无运行记录</div>
            )}
          </div>
        </div>
      </div>

      {/* Create Workflow Modal */}
      <div>
        <div>
          <div>
            <div>新建工作流</div>
          </div>
          <div >
            <div>
              <label >名称</label>
              <input placeholder="例如: NDVI 分析工作流" onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <label >描述</label>
              <textarea
                
                placeholder="描述工作流的用途和步骤"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button onClick={() => setModalOpen(false)}>取消</button>
            <button onClick={handleCreate}>创建</button>
          </div>
        </div>
      </div>

      {/* Workflow Detail Dialog */}
      <div>
        <div >
          <div>
            <div>{selectedWorkflow?.name}</div>
          </div>
          {selectedWorkflow && (
            <div className={styles.workflowDetail}>
              <div >
                <div>
                  <h5 >描述</h5>
                  <p >{selectedWorkflow.description || '暂无描述'}</p>
                </div>
                <div>
                  <h5 >状态</h5>
                  <span>
                    {selectedWorkflow.status === 'running' ? '运行中' : '就绪'}
                  </span>
                </div>
                <div>
                  <h5 >创建时间</h5>
                  <span >{new Date(selectedWorkflow.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
