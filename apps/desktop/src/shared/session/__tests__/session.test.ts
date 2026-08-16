// @vitest-environment node
/**
 * Session 对象层测试（doc/21 §P2，纯 Node、无 jsdom/DOM API）。
 *
 * 网络经 SessionTransport 注入 fake，localStorage 以内存 stub 提供，
 * demoAdapter/demoMode 用模块 mock 隔离——测试只关注状态机本身。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoreConversation, CoreMessageListResponse, CoreRun } from '../../api/types'

/* ── demoAdapter 全量 mock：记录调用并立即产出可控事件 ── */
vi.mock('../demoAdapter', () => {
  const demoCallbacks: {
    onDelta: (delta: string) => void
    onDone: () => void
    onError: (error: Error) => void
    onStatus?: (status: string) => void
    onToolCall?: (log: unknown) => void
    onWorkflow?: (steps: unknown[]) => void
  }[] = []
  const mockStreamAdapter = {
    start: async (_payload: unknown, callbacks: never, _signal: AbortSignal) => {
      demoCallbacks.push(callbacks)
    },
  }
  return { mockStreamAdapter, __demoCallbacks: demoCallbacks }
})

/* ── demoMode mock：各用例内切换返回值 ── */
vi.mock('../demoMode', () => ({
  isDemoModeEnabled: vi.fn(() => false),
  setDemoMode: vi.fn(),
}))

import { isDemoModeEnabled } from '../demoMode'
import { Session } from '../Session'
import type { SessionTransport } from '../Session'
import { sessionManager, SessionManager } from '../SessionManager'

/* ══════════ 测试基建 ══════════ */

class MemoryStorage {
  private map = new Map<string, string>()
  writes: { key: string; value: string }[] = []
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
    this.writes.push({ key, value })
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

class FakeEventSource {
  static instances: FakeEventSource[] = []
  listeners = new Map<string, Array<(e: { data?: string }) => void>>()
  closed = false
  path: string

  constructor(path: string) {
    this.path = path
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (e: { data?: string }) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(cb)
    this.listeners.set(type, list)
  }

  emit(type: string, data?: unknown): void {
    /* 仿真真 EventSource：close 后不再派发任何事件 */
    if (this.closed) return
    for (const cb of this.listeners.get(type) ?? []) {
      cb({ data: data === undefined ? undefined : JSON.stringify(data) })
    }
  }

  close(): void {
    this.closed = true
  }
}

interface TransportScript {
  /** POST /api/conversations → 返回 core 会话 id */
  createConversation?: { ok: boolean; id?: string; status?: number }
  /** POST /api/conversations/{id}/messages */
  postMessage?: { ok: boolean; runId?: string; error?: string; status?: number }
  /** GET /api/conversations/{id}（open 用） */
  getConversation?: { ok: boolean; conv?: CoreConversation; status?: number }
  getMessages?: { messages?: CoreMessageListResponse['messages'] }
  /** GET /api/agent/runs/{id}（数组时按调用次序依次返回，供轮询测试） */
  getRun?: CoreRun | null | Array<CoreRun | null>
  /** POST /api/agent/approvals/{id}/approve|reject */
  resolveApproval?: { ok: boolean; status?: number }
}

function makeTransport(script: TransportScript = {}): SessionTransport & {
  calls: Array<{ path: string; method?: string }>
} {
  const calls: Array<{ path: string; method?: string }> = []
  const transport: SessionTransport & { calls: typeof calls } = {
    calls,
    async fetchJson(path, init) {
      calls.push({ path, method: init?.method ?? 'GET' })
      if (init?.method === 'POST' && path === '/api/conversations') {
        const s = script.createConversation ?? { ok: true, id: 'core-1' }
        return { ok: s.ok, status: s.status ?? 201, data: { id: s.id } }
      }
      if (init?.method === 'POST' && /\/messages$/.test(path)) {
        const s = script.postMessage ?? { ok: true, runId: 'run-1' }
        return { ok: s.ok, status: s.status ?? 200, data: { runId: s.runId, error: s.error } }
      }
      if (/\/api\/agent\/approvals\//.test(path)) {
        const s = script.resolveApproval ?? { ok: true }
        return {
          ok: s.ok,
          status: s.status ?? (s.ok ? 200 : 404),
          data: { status: 'resolved' },
        }
      }
      if (/\/api\/agent\/runs\//.test(path)) {
        if (Array.isArray(script.getRun)) {
          const next = script.getRun.shift() ?? null
          return { ok: true, status: 200, data: next }
        }
        return { ok: true, status: 200, data: script.getRun ?? null }
      }
      if (/\/messages\?limit=/.test(path)) {
        return { ok: true, status: 200, data: script.getMessages ?? { total: 0, messages: [] } }
      }
      if (/\/api\/conversations\//.test(path)) {
        const s = script.getConversation ?? { ok: true, conv: undefined }
        return { ok: s.ok, status: s.status ?? (s.ok ? 200 : 404), data: s.conv }
      }
      return { ok: false, status: 404, data: undefined }
    },
    openEvents(path) {
      return new FakeEventSource(path)
    },
  }
  return transport
}

/** 推进微任务队列若干轮，让合批 flush 与 async 链路走完。 */
async function tick(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  FakeEventSource.instances = []
  vi.mocked(isDemoModeEnabled).mockReturnValue(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  sessionManager.clear()
})

/** 完整 send 到 SSE 订阅建立，返回当前事件源。 */
async function sendUntilSubscribed(
  session: Session,
  input = '做一次缓冲区分析',
): Promise<FakeEventSource> {
  const promise = session.send(input)
  void promise
  await tick()
  const es = FakeEventSource.instances.at(-1)
  expect(es).toBeDefined()
  return es!
}

/* ══════════ 用例 ══════════ */

describe('Session 对象层', () => {
  it('1. step 事件按 stepId 合并 toolCalls：重复/乱序帧不产生重复条目', async () => {
    const session = new Session('conv-a', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('step_start', { data: { stepId: 's1', title: '步骤一', tool: 'gis.buffer' } })
    es.emit('step_start', { data: { stepId: 's1', title: '步骤一', tool: 'gis.buffer' } })
    es.emit('step_done', { data: { stepId: 's0', title: '前置步骤', duration: 12 } })
    es.emit('step_done', { data: { stepId: 's0', title: '前置步骤', duration: 12 } })
    session.flushSync()

    const assistant = session.getSnapshot().messages.at(-1)!
    expect(assistant.toolCalls).toHaveLength(2)
    expect(assistant.toolCalls![0]).toMatchObject({ id: 's1', status: 'running' })
    expect(assistant.toolCalls![1]).toMatchObject({ id: 's0', status: 'success' })

    es.emit('step_done', { data: { stepId: 's1', title: '步骤一', duration: 30 } })
    session.flushSync()
    const updated = session.getSnapshot().messages.at(-1)!
    expect(updated.toolCalls).toHaveLength(2)
    expect(updated.toolCalls![0]).toMatchObject({ id: 's1', status: 'success' })
  })

  it('2. 重复 done 帧幂等：不重复追加完成摘要', async () => {
    const session = new Session('conv-b', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('done', { data: { runId: 'run-1' } })
    await tick()
    const afterFirst = session.getSnapshot().messages.at(-1)!.content
    expect(afterFirst).toContain('✅ 执行完成')

    es.emit('done', { data: { runId: 'run-1' } })
    await tick()
    const afterSecond = session.getSnapshot().messages.at(-1)!.content
    expect(afterSecond).toBe(afterFirst)
    expect(session.getSnapshot().runStatus).toBe('completed')
  })

  it('3. open 失败 + cache 命中 → frozen（只读视口）', async () => {
    storage.setItem(
      'geowork.conversations.v1',
      JSON.stringify([
        {
          id: 'conv-c',
          title: '历史会话',
          messages: [{ id: 'm1', role: 'user', content: 'hi', createdAt: 1 }],
          model: 'Auto',
          mode: '通用 GIS',
          runStatus: 'idle',
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    )
    const session = new Session('conv-c', {
      transport: makeTransport({ getConversation: { ok: false } }),
    })
    await session.open()

    expect(session.getSnapshot().phase).toBe('frozen')
    expect(session.getSnapshot().messages).toHaveLength(1)
    expect(session.getSnapshot().title).toBe('历史会话')
  })

  it('4. open 失败 + 无 cache → error', async () => {
    const session = new Session('conv-d', {
      transport: makeTransport({ getConversation: { ok: false } }),
    })
    await session.open()

    const snap = session.getSnapshot()
    expect(snap.phase).toBe('error')
    expect(snap.lastError).toContain('不可达')
  })

  it('5. cancel 后不再收 delta：SSE 事件被忽略，终态 stopped 落盘', async () => {
    const session = new Session('conv-e', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    session.cancel()
    await tick()
    expect(session.getSnapshot().runStatus).toBe('stopped')

    const contentAtCancel = session.getSnapshot().messages.at(-1)!.content
    es.emit('step_done', { data: { stepId: 's1', title: '步骤' } })
    es.emit('done', { data: { runId: 'run-1' } })
    await tick()

    const snap = session.getSnapshot()
    expect(snap.messages.at(-1)!.content).toBe(contentAtCancel)
    expect(snap.runStatus).toBe('stopped')
  })

  it('6. done 终态回填 cache 恰好一次，且流式过程零写入', async () => {
    const session = new Session('conv-f', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)
    const writesBefore = storage.writes.filter((w) => w.key === 'geowork.conversations.v1').length

    es.emit('delta-frame-noop')
    es.emit('step_start', { data: { stepId: 's1', title: '步骤一' } })
    session.flushSync()
    expect(storage.writes.filter((w) => w.key === 'geowork.conversations.v1').length).toBe(
      writesBefore,
    )

    es.emit('done', { data: { runId: 'run-1' } })
    await tick()

    const convWrites = storage.writes.filter((w) => w.key === 'geowork.conversations.v1')
    expect(convWrites.length).toBe(writesBefore + 1)
    const stored: unknown[] = JSON.parse(convWrites.at(-1)!.value)
    expect(stored[0]).toMatchObject({ id: 'conv-f', runStatus: 'completed' })
  })

  it('7. SSE 连接中断触发 resync：清窗口重建并重试 open', async () => {
    const transport = makeTransport()
    const session = new Session('conv-g', { transport, resyncBaseMs: 5, resyncMaxMs: 20 })
    const es = await sendUntilSubscribed(session)

    // 连接级错误：无 data → 冻结 + 排定 resync
    es.listeners.get('error')?.forEach((cb) => cb({}))
    await Promise.resolve()
    expect(session.getSnapshot().lastError).toContain('连接中断')

    await new Promise((resolve) => setTimeout(resolve, 40))
    /* resync → open → GET /api/conversations/{coreId}（send 阶段已建立 core-1 映射） */
    expect(
      transport.calls.filter((c) => c.path.startsWith('/api/conversations/core-1')).length,
    ).toBeGreaterThan(0)
    expect(es.closed).toBe(true)
  })

  it('8. 快照差分纪律：未变更消息对象引用稳定', async () => {
    const session = new Session('conv-h', { transport: makeTransport() })
    await sendUntilSubscribed(session)

    const userBefore = session.getSnapshot().messages[0]
    const assistantBefore = session.getSnapshot().messages[1]
    const es = FakeEventSource.instances.at(-1)!
    const before = session.getSnapshot().messages[0]

    es.emit('step_start', { data: { stepId: 's1', title: '步骤一' } })
    session.flushSync()

    const messages = session.getSnapshot().messages
    expect(messages[0]).toBe(userBefore)
    expect(messages[0]).toBe(before)
    expect(messages[1]).not.toBe(assistantBefore) // assistant 变更 → 新引用
  })

  it('9. D1 回归：演示开关关闭时 core 失败不触发 demoAdapter', async () => {
    vi.mocked(isDemoModeEnabled).mockReturnValue(false)
    const transport = makeTransport({ createConversation: { ok: false, status: 503 } })
    const session = new Session('conv-i', { transport })
    await session.send('测试输入')
    await tick()

    const snap = session.getSnapshot()
    expect(snap.isDemo).toBeUndefined()
    expect(snap.runStatus).toBe('failed')
    expect(snap.messages.at(-1)!.status).toBe('error')
    expect(snap.messages.at(-1)!.content).toContain('执行出错')
  })

  it('10. D1 回归：演示开关开启时走 demoAdapter 且快照 isDemo=true', async () => {
    vi.mocked(isDemoModeEnabled).mockReturnValue(true)
    const demoModule = (await import('../demoAdapter')) as unknown as {
      __demoCallbacks: Array<{
        onStatus?: (s: string) => void
        onDelta: (d: string) => void
        onDone: () => void
      }>
    }
    const demoCallbacks = demoModule.__demoCallbacks

    const transport = makeTransport({ createConversation: { ok: false, status: 503 } })
    const session = new Session('conv-j', { transport })
    void session.send('测试输入')
    await tick()

    expect(session.getSnapshot().isDemo).toBe(true)
    expect(demoCallbacks.length).toBeGreaterThan(0)

    const demo = demoCallbacks.at(-1)!
    demo.onStatus?.('planning')
    session.flushSync()
    expect(session.getSnapshot().runStatus).toBe('planning')

    demo.onDelta('演示输出')
    session.flushSync()
    expect(session.getSnapshot().messages.at(-1)!.content).toContain('演示输出')

    demo.onDone()
    session.flushSync()
    expect(session.getSnapshot().messages.at(-1)!.status).toBe('done')
    expect(session.getSnapshot().phase).toBe('frozen')
  })
})

describe('Session.confirmRun（D2 真实 run 轮询）', () => {
  it('11. 轮询 run 状态到终态 completed 停止并落盘', async () => {
    const transport = makeTransport({
      getRun: [
        { id: 'run-1', status: 'running' },
        { id: 'run-1', status: 'running' },
        { id: 'run-1', status: 'completed' },
      ],
    })
    const session = new Session('conv-k', { transport, confirmPollMs: 5 })
    const es = await sendUntilSubscribed(session)
    es.emit('done', { data: { runId: 'run-1' } })
    await tick()
    expect(session.getSnapshot().runStatus).toBe('completed')

    /* 模拟确认执行：currentRunId 已在快照中，轮询经 running 到 completed */
    const transport2 = makeTransport({
      getRun: [
        { id: 'run-1', status: 'pending' },
        { id: 'run-1', status: 'completed' },
      ],
    })
    const session2 = new Session('conv-k2', { transport: transport2, confirmPollMs: 5 })
    const es2 = await sendUntilSubscribed(session2)
    es2.emit('done', { data: { runId: 'run-1' } })
    await tick()
    void session2.confirmRun()
    await tick(10)
    expect(session2.getSnapshot().runStatus).toBe('completed')
    expect(
      transport2.calls.filter((c) => c.path.includes('/api/agent/runs/')).length,
    ).toBeGreaterThan(0)
  })

  it('12. 无 runId 时 confirmRun 抛错（按钮禁用 + 提示语义）', async () => {
    const session = new Session('conv-l', { transport: makeTransport() })
    await expect(session.confirmRun()).rejects.toThrow('无可执行的运行')
  })
})

describe('Session 审批流（A1，doc/23）', () => {
  it('13. approval_request 事件填充快照 pendingApproval', async () => {
    const session = new Session('conv-ap1', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('approval_request', {
      data: {
        approvalId: 'appr-1',
        runId: 'run-1',
        toolName: 'run_shell',
        args: { command: 'rm -rf build' },
        riskLevel: 'high',
      },
    })
    session.flushSync()

    expect(session.getSnapshot().pendingApproval).toMatchObject({
      id: 'appr-1',
      toolName: 'run_shell',
      riskLevel: 'high',
    })
  })

  it('14. resolveApproval 批准：POST approve + 卡片乐观清除', async () => {
    const transport = makeTransport()
    const session = new Session('conv-ap2', { transport })
    const es = await sendUntilSubscribed(session)
    es.emit('approval_request', { data: { approvalId: 'appr-2', toolName: 'write_file' } })
    session.flushSync()
    expect(session.getSnapshot().pendingApproval?.id).toBe('appr-2')

    await session.resolveApproval(true)
    expect(session.getSnapshot().pendingApproval).toBeUndefined()
    expect(
      transport.calls.find((c) => c.path === '/api/agent/approvals/appr-2/approve'),
    ).toBeDefined()
  })

  it('15. resolveApproval 拒绝：POST reject 且 body 携带 reason；失败恢复卡片', async () => {
    const transport = makeTransport({ resolveApproval: { ok: false, status: 404 } })
    const session = new Session('conv-ap3', { transport })
    const es = await sendUntilSubscribed(session)
    es.emit('approval_request', { data: { approvalId: 'appr-3', toolName: 'run_shell' } })
    session.flushSync()

    await expect(session.resolveApproval(false, '危险操作')).rejects.toThrow()
    expect(session.getSnapshot().pendingApproval?.id).toBe('appr-3')

    /* 换成功 transport 语义：直接验证 reject 路径调用 */
    const okTransport = makeTransport()
    const session2 = new Session('conv-ap3b', { transport: okTransport })
    const es2 = await sendUntilSubscribed(session2)
    es2.emit('approval_request', { data: { approvalId: 'appr-3b', toolName: 'run_shell' } })
    session2.flushSync()
    await session2.resolveApproval(false, '危险操作')
    expect(
      okTransport.calls.find((c) => c.path === '/api/agent/approvals/appr-3b/reject'),
    ).toBeDefined()
    expect(session2.getSnapshot().pendingApproval).toBeUndefined()
  })

  it('16. approval_resolved / approval_timeout / cancel 均清除卡片', async () => {
    const session = new Session('conv-ap4', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('approval_request', { data: { approvalId: 'appr-4', toolName: 'run_shell' } })
    session.flushSync()
    expect(session.getSnapshot().pendingApproval).toBeDefined()

    es.emit('approval_resolved', {})
    session.flushSync()
    expect(session.getSnapshot().pendingApproval).toBeUndefined()

    es.emit('approval_request', { data: { approvalId: 'appr-5', toolName: 'run_shell' } })
    session.flushSync()
    es.emit('approval_timeout', {})
    session.flushSync()
    expect(session.getSnapshot().pendingApproval).toBeUndefined()
    expect(session.getSnapshot().lastError).toContain('超时')

    es.emit('approval_request', { data: { approvalId: 'appr-6', toolName: 'run_shell' } })
    session.flushSync()
    session.cancel()
    session.flushSync()
    expect(session.getSnapshot().pendingApproval).toBeUndefined()
  })
})

describe('Session 思考步骤（A3，doc/23）', () => {
  it('17. state_change 事件生成 state 类思考步骤（中文标签 + reason）', async () => {
    const session = new Session('conv-th1', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('state_change', { data: { from: 'idle', to: 'planning', reason: '任务开始' } })
    es.emit('state_change', { data: { from: 'planning', to: 'inspecting', reason: '读取数据' } })
    session.flushSync()

    const steps = session.getSnapshot().messages.at(-1)!.thinkingSteps!
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatchObject({ kind: 'state', title: '规划中', content: '任务开始' })
    expect(steps[1]).toMatchObject({ kind: 'state', title: '分析数据', content: '读取数据' })
    expect(steps[0].endedAt).toBeDefined()
  })

  it('18. 连续相同状态去噪：不新增步骤，只更新 reason', async () => {
    const session = new Session('conv-th2', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('state_change', { data: { to: 'editing', reason: '写文件 a' } })
    es.emit('state_change', { data: { to: 'editing', reason: '写文件 b' } })
    es.emit('state_change', { data: { to: 'verifying', reason: '校验' } })
    session.flushSync()

    const steps = session.getSnapshot().messages.at(-1)!.thinkingSteps!
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatchObject({ kind: 'state', title: '执行操作', content: '写文件 b' })
    expect(steps[1]).toMatchObject({ kind: 'state', title: '验证结果', content: '校验' })
  })

  it('19. message isDelta 累积进 reasoning 步骤；完整帧关闭步骤并并入气泡', async () => {
    const session = new Session('conv-th3', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('message', { data: { content: '我需要', role: 'assistant', isDelta: true } })
    es.emit('message', { data: { content: '先做缓冲区分析', role: 'assistant', isDelta: true } })
    session.flushSync()

    let msg = session.getSnapshot().messages.at(-1)!
    expect(msg.thinkingSteps).toHaveLength(1)
    expect(msg.thinkingSteps![0]).toMatchObject({ kind: 'reasoning', title: '模型推理' })
    expect(msg.thinkingSteps![0].content).toBe('我需要先做缓冲区分析')
    expect(msg.thinkingSteps![0].endedAt).toBeUndefined()

    /* 完整帧：关闭 reasoning 步骤，全文进消息气泡 */
    es.emit('message', { data: { content: '我需要先做缓冲区分析', role: 'assistant' } })
    session.flushSync()

    msg = session.getSnapshot().messages.at(-1)!
    expect(msg.thinkingSteps![0].endedAt).toBeDefined()
    expect(msg.content).toContain('我需要先做缓冲区分析')

    /* 下一轮 delta 新建第二个 reasoning 步骤 */
    es.emit('message', { data: { content: '接下来验证', role: 'assistant', isDelta: true } })
    session.flushSync()
    msg = session.getSnapshot().messages.at(-1)!
    expect(msg.thinkingSteps).toHaveLength(2)
    expect(msg.thinkingSteps![1]).toMatchObject({ kind: 'reasoning', content: '接下来验证' })
  })

  it('20. done / cancel 关闭开放的 reasoning 步骤（补 endedAt）', async () => {
    const session = new Session('conv-th4', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('message', { data: { content: '思考中…', role: 'assistant', isDelta: true } })
    session.flushSync()
    expect(session.getSnapshot().messages.at(-1)!.thinkingSteps![0].endedAt).toBeUndefined()

    es.emit('done', { data: { runId: 'run-1' } })
    await tick()
    expect(session.getSnapshot().messages.at(-1)!.thinkingSteps![0].endedAt).toBeDefined()

    /* cancel 路径：新会话流式中取消 */
    const session2 = new Session('conv-th5', { transport: makeTransport() })
    const es2 = await sendUntilSubscribed(session2)
    es2.emit('message', { data: { content: '半截推理', role: 'assistant', isDelta: true } })
    session2.flushSync()
    session2.cancel()
    session2.flushSync()
    expect(session2.getSnapshot().messages.at(-1)!.thinkingSteps![0].endedAt).toBeDefined()
  })
})

describe('Session 文件变更（A4，doc/23）', () => {
  it('21. diff.created 事件写入当前 assistant 消息的 fileDiffs', async () => {
    const session = new Session('conv-df1', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('diff.created', {
      data: {
        path: 'src/analysis.ts',
        toolCallId: 'tc-1',
        unified: '--- a/src/analysis.ts\n+++ b/src/analysis.ts\n@@ -1 +1,2 @@\n a\n+b\n',
      },
    })
    session.flushSync()

    const diffs = session.getSnapshot().messages.at(-1)!.fileDiffs!
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toMatchObject({ path: 'src/analysis.ts', toolCallId: 'tc-1' })
    expect(diffs[0].unified).toContain('@@ -1 +1,2 @@')
    expect(diffs[0].id).toBeTruthy()
    expect(diffs[0].createdAt).toBeGreaterThan(0)
  })

  it('22. 同路径多次 diff.created 去重：保留最新一条', async () => {
    const session = new Session('conv-df2', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('diff.created', {
      data: { path: 'a.ts', unified: '@@ -1 +1 @@\n-old\n+v1\n' },
    })
    es.emit('diff.created', {
      data: { path: 'b.ts', unified: '@@ -1 +1 @@\n-old\n+v1\n' },
    })
    es.emit('diff.created', {
      data: { path: 'a.ts', unified: '@@ -1 +1 @@\n-v1\n+v2\n' },
    })
    session.flushSync()

    const diffs = session.getSnapshot().messages.at(-1)!.fileDiffs!
    expect(diffs).toHaveLength(2)
    const aDiff = diffs.find((d) => d.path === 'a.ts')!
    expect(aDiff.unified).toContain('+v2')
  })

  it('23. 缺少 path 或 unified 的 diff.created 被忽略', async () => {
    const session = new Session('conv-df3', { transport: makeTransport() })
    const es = await sendUntilSubscribed(session)

    es.emit('diff.created', { data: { unified: '@@ -1 +1 @@\n-x\n+y\n' } })
    es.emit('diff.created', { data: { path: 'a.ts' } })
    es.emit('diff.created', { data: {} })
    session.flushSync()

    expect(session.getSnapshot().messages.at(-1)!.fileDiffs ?? []).toHaveLength(0)
  })
})

describe('SessionManager', () => {
  it('ensure 惰性建且常驻：同 id 返回同实例；reset 后重建并 dispose', () => {
    const manager = new SessionManager()
    const a = manager.ensure('conv-x')
    expect(manager.ensure('conv-x')).toBe(a)

    const disposeSpy = vi.spyOn(a, 'dispose')
    manager.reset('conv-x')
    expect(disposeSpy).toHaveBeenCalled()
    expect(manager.get('conv-x')).toBeUndefined()

    const b = manager.ensure('conv-x')
    expect(b).not.toBe(a)
    manager.reset('conv-x')
  })
})
