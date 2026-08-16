/**
 * streamAdapters.ts
 *
 * 统一流式适配器接口 + 三种实现：
 * - mockStreamAdapter：当前默认，前端模拟流式输出
 * - sseStreamAdapter：SSE 骨架（10.x 阶段接入）
 * - websocketStreamAdapter：WebSocket 骨架（10.x 阶段接入）
 *
 * NewTaskPage 只调用 activeAdapter.start()，不关心底层实现。
 */

import type {
  AttachedFileMeta,
  RunStatus,
  SelectedContextItem,
  ToolCallLog,
  WorkflowStep,
  WorkMode,
} from './conversationStorage'
import { coreFetch, coreEventSource } from '../../../shared/api/coreApi'

/* ── 统一接口 ── */

export interface StreamAdapterPayload {
  conversationId: string
  input: string
  model: string
  mode: string
  workMode?: WorkMode
  workDirName?: string
  attachments?: AttachedFileMeta[]
  contexts?: SelectedContextItem[]
}

export interface StreamAdapterCallbacks {
  onDelta: (delta: string) => void
  onDone: () => void
  onError: (error: Error) => void
  onStatus?: (status: RunStatus) => void
  onToolCall?: (log: ToolCallLog) => void
  onWorkflow?: (steps: WorkflowStep[]) => void
}

export interface StreamAdapter {
  start: (
    payload: StreamAdapterPayload,
    callbacks: StreamAdapterCallbacks,
    signal: AbortSignal,
  ) => Promise<void>
}

/* ── Mock 工具调用定义 ── */

const MOCK_TOOL_CALLS: Array<{
  id: string
  name: string
  inputSummary: string
  outputSummary: string
}> = [
  {
    id: 'tool_read_dir',
    name: '读取工作目录',
    inputSummary: '读取当前绑定的工作目录名称和可用文件元信息。',
    outputSummary: '已确认工作目录上下文，等待接入真实文件系统索引。',
  },
  {
    id: 'tool_check_data',
    name: '检查空间数据',
    inputSummary: '检查任务中提到的 GeoJSON、CSV、栅格影像或图层线索。',
    outputSummary: '已生成数据需求清单。',
  },
  {
    id: 'tool_select_gis',
    name: '选择 GIS 工具',
    inputSummary: '根据任务类型匹配空间分析、专题制图、遥感解译或论文辅助能力。',
    outputSummary: '已选择 GeoWork 前端 mock 工具链。',
  },
  {
    id: 'tool_gen_plan',
    name: '生成执行计划',
    inputSummary: '把自然语言任务拆解为可确认的执行步骤。',
    outputSummary: '已生成待确认工作流计划。',
  },
]

const MOCK_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: 'understand',
    title: '理解任务',
    description: '解析用户目标、空间对象和预期输出。',
    status: 'finish',
  },
  {
    key: 'prepare',
    title: '准备数据',
    description: '检查工作目录、输入文件、图层和坐标系统。',
    status: 'finish',
  },
  {
    key: 'select',
    title: '选择能力',
    description: '匹配空间分析、专题制图、遥感解译或论文辅助能力。',
    status: 'finish',
  },
  {
    key: 'confirm',
    title: '等待确认',
    description: '生成可执行计划，等待用户确认后进入真实执行。',
    status: 'process',
  },
]

/* ── Mock 响应模板（按 workMode 分支） ── */

const MOCK_RESPONSE_WORK = `我已理解你的空间任务，下面会把它拆成可执行的 GeoWork 工作流。

**第一步：确认输入**
我会检查输入数据、工作目录和坐标系统是否正确。

**第二步：选择能力**
根据任务类型，匹配以下能力之一：
- 空间分析（缓冲区、叠加、空间查询）
- 专题制图（生成专题地图和可视化）
- 遥感解译（影像处理和分类）
- 论文辅助（学术写作和文献引用）

**第三步：生成执行计划**
输出可执行计划并等待你确认后再进入真实执行阶段。

示例配置片段：
\`\`\`json
{
  "task": "spatial-analysis",
  "input": "land_parcels.geojson",
  "crs": "EPSG:4326",
  "buffer": 500
}
\`\`\`

> 当前版本是前端交互流程演示，后续会接入真实模型网关、工具调用和任务队列。`

const MOCK_RESPONSE_CODE = `我已理解你的开发任务，下面会帮你搭建空间分析代码框架。

**第一步：确认技术栈**
检查你使用的编程语言、依赖库和目标运行环境。

**第二步：代码结构**
根据任务类型生成对应的代码骨架：
- Python（GeoPandas / Rasterio / Shapely）
- JavaScript（Turf.js / MapLibre GL）
- SQL（PostGIS 空间查询）

**第三步：调试与运行**
输出可运行代码片段并给出测试建议。

示例代码片段：
\`\`\`python
import geopandas as gpd

# 读取数据
gdf = gpd.read_file("land_parcels.geojson")
# 缓冲区分析
buffered = gdf.buffer(500)
\`\`\`

> 当前版本是前端交互流程演示，后续会接入真实代码执行沙箱。`

const MOCK_RESPONSE_MAP = `我已理解你的制图任务，下面会帮你完成专题地图的生成流程。

**第一步：确认数据与样式**
检查输入图层、分类字段和配色方案。

**第二步：地图配置**
根据任务类型匹配制图能力：
- 分级统计图（Choropleth）
- 热力图（Heatmap）
- 标注地图（Label Map）
- 等值线图（Isoline）

**第三步：输出与导出**
生成可交互地图预览，支持导出为 PNG / SVG / PDF。

示例配置片段：
\`\`\`json
{
  "type": "choropleth",
  "layer": "districts.geojson",
  "field": "population",
  "colors": "YlOrRd"
}
\`\`\`

> 当前版本是前端交互流程演示，后续会接入真实制图引擎。`

function generateMockResponse(
  input: string,
  workMode: WorkMode = 'work',
  contexts?: SelectedContextItem[],
): string {
  let prefix = ''
  if (contexts && contexts.length > 0) {
    const lines = contexts.map((ctx) => {
      const kindLabel = ctx.kind === 'skill' ? '技能' : ctx.kind === 'expert' ? '专家' : 'MCP'
      return `- ${kindLabel}：${ctx.name}`
    })
    prefix = `已接入以下上下文能力：\n${lines.join('\n')}\n\n`
  }

  const template =
    workMode === 'code'
      ? MOCK_RESPONSE_CODE
      : workMode === 'map'
        ? MOCK_RESPONSE_MAP
        : MOCK_RESPONSE_WORK

  /* 关键词微调（仅 work 模式下生效） */
  if (workMode === 'work') {
    const lower = input.toLowerCase()
    if (lower.includes('遥感') || lower.includes('影像')) {
      return (
        prefix +
        template.replace(
          '我已理解你的空间任务，下面会把它拆成可执行的 GeoWork 工作流。',
          '我已理解你的遥感任务，下面会把它拆成可执行的 GeoWork 工作流。',
        )
      )
    }
    if (lower.includes('制图') || lower.includes('地图')) {
      return (
        prefix +
        template.replace(
          '我已理解你的空间任务，下面会把它拆成可执行的 GeoWork 工作流。',
          '我已理解你的制图任务，下面会把它拆成可执行的 GeoWork 工作流。',
        )
      )
    }
  }

  return prefix + template
}

/* ── 辅助：可中断的延迟 ── */

function createInterruptibleDelay(
  fn: () => void,
  ms: number,
  signal: AbortSignal,
  timers: Set<ReturnType<typeof setTimeout>>,
): void {
  if (signal.aborted) return
  const t = setTimeout(() => {
    timers.delete(t)
    if (!signal.aborted) fn()
  }, ms)
  timers.add(t)
}

/**
 * mockStreamAdapter
 *
 * 流程：
 * 1. onStatus('thinking')
 * 2. 500-700ms 后 onStatus('planning')
 * 3. 流式输出文本，期间逐步触发 4 条 mock 工具调用
 * 4. 文本完成后 onWorkflow + onStatus('waiting-confirmation') + onDone()
 * 5. AbortSignal 中断时停止一切，不 onDone
 */
export const mockStreamAdapter: StreamAdapter = {
  async start(payload, callbacks, signal) {
    const fullText = generateMockResponse(
      payload.input,
      payload.workMode ?? 'work',
      payload.contexts,
    )
    let index = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const toolCallTriggered = new Set<number>()
    let planningScheduled = false

    const clearAllTimers = () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }

    /* 触发一条工具调用：先 running，延迟后 success */
    const emitToolCall = (toolIndex: number) => {
      if (toolCallTriggered.has(toolIndex)) return
      toolCallTriggered.add(toolIndex)

      const tool = MOCK_TOOL_CALLS[toolIndex]
      const now = Date.now()

      /* 先发 running */
      callbacks.onToolCall?.({
        id: tool.id,
        name: tool.name,
        status: 'running',
        inputSummary: tool.inputSummary,
        startedAt: now,
      })

      /* 300-500ms 后更新为 success */
      const delay = 300 + Math.floor(Math.random() * 201)
      createInterruptibleDelay(
        () => {
          callbacks.onToolCall?.({
            id: tool.id,
            name: tool.name,
            status: 'success',
            inputSummary: tool.inputSummary,
            outputSummary: tool.outputSummary,
            startedAt: now,
            endedAt: Date.now(),
          })
        },
        delay,
        signal,
        timers,
      )
    }

    return new Promise<void>((resolve) => {
      const tick = () => {
        if (signal.aborted) {
          clearAllTimers()
          resolve()
          return
        }
        if (index >= fullText.length) {
          /* 文本完成 */
          callbacks.onWorkflow?.(MOCK_WORKFLOW_STEPS)
          callbacks.onStatus?.('waiting-confirmation')
          callbacks.onDone()
          clearAllTimers()
          resolve()
          return
        }

        /* 在流式输出过程中触发工具调用（20%、40%、60%、80% 进度） */
        const progress = index / fullText.length
        for (let i = 0; i < MOCK_TOOL_CALLS.length; i++) {
          const threshold = (i + 1) * 0.2
          if (progress >= threshold && !toolCallTriggered.has(i)) {
            emitToolCall(i)
          }
        }

        const chunkSize = 2 + Math.floor(Math.random() * 3)
        const chunk = fullText.slice(index, index + chunkSize)
        index += chunkSize
        callbacks.onDelta(chunk)

        const delay = 20 + Math.floor(Math.random() * 16)
        createInterruptibleDelay(tick, delay, signal, timers)
      }

      if (signal.aborted) {
        resolve()
        return
      }

      /* 开始：thinking */
      callbacks.onStatus?.('thinking')

      /* 500-700ms 后 planning */
      const planningDelay = 500 + Math.floor(Math.random() * 201)
      createInterruptibleDelay(
        () => {
          if (!planningScheduled) {
            planningScheduled = true
            callbacks.onStatus?.('planning')
          }
        },
        planningDelay,
        signal,
        timers,
      )

      /* 300ms 后开始流式输出 */
      createInterruptibleDelay(tick, 300, signal, timers)

      signal.addEventListener('abort', () => {
        clearAllTimers()
        resolve()
      })
    })
  },
}

/* ── SSE 适配器骨架 ── */

export const sseStreamAdapter: StreamAdapter = {
  async start(_payload, _callbacks, _signal) {
    throw new Error('SSE stream adapter not implemented yet')
  },
}

/* ── WebSocket 适配器骨架 ── */

export const websocketStreamAdapter: StreamAdapter = {
  async start(_payload, _callbacks, _signal) {
    throw new Error('WebSocket stream adapter not implemented yet')
  },
}

/* ───────────────────────────────────────────────────────────
 *  realStreamAdapter
 *
 *  通过直连 Go Core（HTTP + SSE）驱动真实的 Orchestrator 执行链路。
 *  流程：
 *    1. 确保 Core 端会话存在（本地 temp id → 创建 Core 会话并缓存映射）
 *    2. POST /api/conversations/{id}/messages 触发 orchestrator.StartRun
 *    3. 订阅 /api/conversations/{id}/events SSE，把 orchestrator 事件
 *       映射为 onDelta / onToolCall / onWorkflow / onStatus / onDone / onError
 *
 *  说明：Go Core 的 orchestrator 执行的是"工具调用计划"而非聊天文本流，
 *  因此 onDelta 主要用于步骤摘要与完成提示，onToolCall 承载真实工具执行。
 * ─────────────────────────────────────────────────────────── */

/** 本地 temp 会话 id → Core 会话 id 的缓存，支持多轮复用同一 Core 会话。 */
const coreConvIdCache = new Map<string, string>()

/** 读取本地会话对应的 Core 会话 id（用于复用同一 Core 会话）。 */
export function getCoreConversationId(localConvId: string): string | undefined {
  return coreConvIdCache.get(localConvId)
}

/** 设置本地会话与 Core 会话的映射（如从 URL 直连 Core 会话后恢复缓存）。 */
export function setCoreConversationId(localConvId: string, coreConvId: string): void {
  coreConvIdCache.set(localConvId, coreConvId)
}

/** 前端 WorkMode → orchestrator mode 映射。 */
function mapWorkModeToMode(workMode?: WorkMode): string {
  switch (workMode) {
    case 'code':
      return 'Code'
    case 'map':
      return 'Analysis'
    case 'work':
    default:
      return 'Work'
  }
}

/** Core 端 TaskEventPayload 的 JSON 形状。 */
interface CoreEventPayload {
  type: string
  taskId?: string
  message?: string
  data?: Record<string, unknown>
  error?: string
}

/** Core 端 Run.Plan.Step 形状（用于 onWorkflow 映射）。 */
interface CoreRunStep {
  id: string
  title: string
  tool?: string
  status?: string
}

/** 确保 Core 会话存在：本地 temp id 首次发送时创建 Core 会话并缓存。 */
async function ensureCoreConversation(
  localConvId: string,
  input: string,
  mode: string,
  signal: AbortSignal,
): Promise<string> {
  const cached = coreConvIdCache.get(localConvId)
  if (cached) return cached

  const res = await coreFetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: 'default',
      title: input.slice(0, 40) || '新任务',
      mode,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`create conversation failed: HTTP ${res.status}`)
  const conv = (await res.json()) as { id: string }
  coreConvIdCache.set(localConvId, conv.id)
  return conv.id
}

export const realStreamAdapter: StreamAdapter = {
  async start(payload, callbacks, signal) {
    const mode = mapWorkModeToMode(payload.workMode)
    callbacks.onStatus?.('thinking')

    // 1. 确保 Core 会话存在（失败则抛出，由 autoStreamAdapter 降级 mock）
    const coreConvId = await ensureCoreConversation(
      payload.conversationId,
      payload.input,
      mode,
      signal,
    )

    // 2. 发送消息，触发 orchestrator
    const msgRes = await coreFetch(`/api/conversations/${coreConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: payload.input, mode }),
      signal,
    })
    if (!msgRes.ok) {
      throw new Error(`send message failed: HTTP ${msgRes.status}`)
    }
    const msgData = (await msgRes.json()) as { runId?: string; error?: string }
    if (msgData.error) {
      throw new Error(msgData.error)
    }
    const runId = msgData.runId
    callbacks.onStatus?.('planning')

    // 3. 订阅 SSE 事件流
    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }

      const es = coreEventSource(`/api/conversations/${coreConvId}/events`)
      let resolved = false
      const finish = () => {
        if (resolved) return
        resolved = true
        es.close()
        resolve()
      }

      signal.addEventListener('abort', () => {
        finish()
      })

      const parse = (e: MessageEvent): CoreEventPayload => {
        try {
          return JSON.parse(e.data) as CoreEventPayload
        } catch {
          return { type: 'unknown' }
        }
      }

      // 计划就绪：尝试拉取 run 详情以填充工作流步骤
      es.addEventListener('plan', (_e) => {
        callbacks.onStatus?.('planning')
        if (!runId) return
        coreFetch(`/api/agent/runs/${runId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((run: { plan?: CoreRunStep[] } | null) => {
            if (run?.plan && run.plan.length > 0) {
              callbacks.onWorkflow?.(
                run.plan.map((s, idx) => ({
                  key: s.id || `step-${idx}`,
                  title: s.title || s.tool || `步骤 ${idx + 1}`,
                  description: s.tool ? `工具：${s.tool}` : '',
                  status:
                    s.status === 'completed'
                      ? 'finish'
                      : s.status === 'running'
                        ? 'process'
                        : 'wait',
                })),
              )
            }
          })
          .catch(() => {
            /* 拉取计划失败不影响主流程 */
          })
      })

      // 步骤开始：触发 running 工具调用
      es.addEventListener('step_start', (e) => {
        const evt = parse(e as MessageEvent)
        const d = evt.data ?? {}
        callbacks.onToolCall?.({
          id: String(d.stepId ?? `step-${Date.now()}`),
          name: String(d.title ?? d.tool ?? '执行步骤'),
          status: 'running',
          inputSummary: d.tool ? `工具：${d.tool}` : '',
          startedAt: Date.now(),
        })
        callbacks.onStatus?.('running')
      })

      // 步骤完成：更新工具调用为 success
      es.addEventListener('step_done', (e) => {
        const evt = parse(e as MessageEvent)
        const d = evt.data ?? {}
        callbacks.onToolCall?.({
          id: String(d.stepId ?? `step-${Date.now()}`),
          name: String(d.title ?? d.tool ?? '执行步骤'),
          status: 'success',
          inputSummary: d.tool ? `工具：${d.tool}` : '',
          outputSummary: d.duration ? `耗时 ${d.duration}ms` : '已完成',
          startedAt: Date.now(),
          endedAt: Date.now(),
        })
      })

      // 完成：输出摘要并结束
      es.addEventListener('done', (e) => {
        const evt = parse(e as MessageEvent)
        callbacks.onDelta(`\n\n✅ 执行完成（run: ${evt.data?.runId ?? runId ?? 'unknown'}）`)
        callbacks.onStatus?.('completed')
        callbacks.onDone()
        finish()
      })

      // 服务端 error 事件 vs 连接错误：MessageEvent 带 data 为服务端错误
      es.addEventListener('error', (e) => {
        if (signal.aborted) {
          finish()
          return
        }
        const me = e as MessageEvent
        if (me && typeof me.data === 'string') {
          const evt = parse(me)
          callbacks.onError(new Error(evt.error || evt.message || '执行失败'))
        } else {
          // 连接级错误（非 aborted）
          callbacks.onError(new Error('与 GeoWork Core 的连接中断'))
        }
        finish()
      })
    })
  },
}

/* ───────────────────────────────────────────────────────────
 *  autoStreamAdapter
 *
 *  优先使用真实后端（realStreamAdapter）；若后端不可用（初始连接失败），
 *  自动降级到 mockStreamAdapter，保证前端体验不中断。
 *  一旦真实流式开始（SSE 已连接），中途错误走 onError，不再降级。
 * ─────────────────────────────────────────────────────────── */

export const autoStreamAdapter: StreamAdapter = {
  async start(payload, callbacks, signal) {
    try {
      await realStreamAdapter.start(payload, callbacks, signal)
    } catch (err) {
      if (signal.aborted) return
      // 初始连接失败：降级到 mock
      callbacks.onStatus?.('idle')
      await mockStreamAdapter.start(payload, callbacks, signal)
    }
  },
}

/* ── 当前默认适配器 ── */
export const activeAdapter: StreamAdapter = autoStreamAdapter
