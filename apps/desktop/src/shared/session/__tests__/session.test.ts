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
  /** GET /api/agent/runs/{id} */
  getRun?: CoreRun | null
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
      if (/\/api\/agent\/runs\//.test(path)) {
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
