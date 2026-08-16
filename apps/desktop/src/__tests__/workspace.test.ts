import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTaskStore } from '../shared/stores/taskStore'
import type { SidebarTaskItem, SidebarWorkspaceMeta } from '../shared/stores/taskStore'

const SIDEBAR_TASKS_KEY = 'geowork.sidebar.tasks.v1'
const SIDEBAR_WORKSPACES_KEY = 'geowork.sidebar.workspaces.v1'

function makeTask(overrides: Partial<SidebarTaskItem> = {}): SidebarTaskItem {
  return {
    id: 'task-1',
    title: 'Test Task',
    lastMessage: 'Hello',
    status: 'idle',
    updatedAt: Date.now(),
    workspaceId: 'ws-1',
    workspaceName: 'Workspace 1',
    ...overrides,
  }
}

function resetStore() {
  window.localStorage.clear()
  useTaskStore.setState({ tasks: [], workspaces: [], source: 'cache' })
}

describe('taskStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('hydrate（原 loadSidebarTasks）', () => {
    it('空 localStorage 时任务为空数组', () => {
      useTaskStore.getState().hydrate()
      expect(useTaskStore.getState().tasks).toEqual([])
    })

    it('从 localStorage 解析任务', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })]
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify(tasks))
      useTaskStore.getState().hydrate()
      const loaded = useTaskStore.getState().tasks
      expect(loaded).toHaveLength(2)
      expect(loaded[0].id).toBe('t1')
    })

    it('非法 JSON 返回空数组', () => {
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, 'not-json')
      useTaskStore.getState().hydrate()
      expect(useTaskStore.getState().tasks).toEqual([])
    })

    it('非数组数据返回空数组', () => {
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify({ foo: 'bar' }))
      useTaskStore.getState().hydrate()
      expect(useTaskStore.getState().tasks).toEqual([])
    })

    it('旧数据自动补 workspaceId/workspaceName', () => {
      const oldTask = { id: 'old-1', status: 'completed', updatedAt: 1000 }
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify([oldTask]))
      useTaskStore.getState().hydrate()
      const loaded = useTaskStore.getState().tasks
      expect(loaded).toHaveLength(1)
      expect(loaded[0].workspaceId).toBe('default')
      expect(loaded[0].workspaceName).toBe('默认')
    })

    it('过滤缺 id 或 status 的条目', () => {
      const items = [
        { id: 'valid', status: 'idle', updatedAt: 1 },
        { status: 'idle', updatedAt: 2 }, // missing id
        { id: 'no-status', updatedAt: 3 }, // missing status
      ]
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify(items))
      useTaskStore.getState().hydrate()
      const loaded = useTaskStore.getState().tasks
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('valid')
    })
  })

  describe('upsertLocal（原 upsertSidebarTask）', () => {
    it('插入新任务并持久化', () => {
      const task = makeTask({ id: 'new-1', updatedAt: 100 })
      useTaskStore.getState().upsertLocal(task)
      const state = useTaskStore.getState()
      expect(state.tasks).toHaveLength(1)
      expect(state.tasks[0].id).toBe('new-1')
      expect(JSON.parse(window.localStorage.getItem(SIDEBAR_TASKS_KEY)!)[0].id).toBe('new-1')
    })

    it('按 id 更新既有任务', () => {
      const task = makeTask({ id: 't1', title: 'Original', updatedAt: 100 })
      useTaskStore.getState().upsertLocal(task)
      useTaskStore.getState().upsertLocal({ ...task, title: 'Updated', updatedAt: 200 })
      const loaded = useTaskStore.getState().tasks
      expect(loaded).toHaveLength(1)
      expect(loaded[0].title).toBe('Updated')
    })

    it('按 updatedAt 倒序排序', () => {
      const { upsertLocal } = useTaskStore.getState()
      upsertLocal(makeTask({ id: 'a', updatedAt: 100 }))
      upsertLocal(makeTask({ id: 'b', updatedAt: 300 }))
      upsertLocal(makeTask({ id: 'c', updatedAt: 200 }))
      expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual(['b', 'c', 'a'])
    })

    it('最多保留 50 条', () => {
      const { upsertLocal } = useTaskStore.getState()
      for (let i = 0; i < 55; i++) {
        upsertLocal(makeTask({ id: `t-${i}`, updatedAt: i }))
      }
      expect(useTaskStore.getState().tasks.length).toBeLessThanOrEqual(50)
    })

    it('zustand 订阅者在 upsert 后被通知（替代旧 CustomEvent）', () => {
      const listener = vi.fn()
      const unsub = useTaskStore.subscribe(listener)
      useTaskStore.getState().upsertLocal(makeTask())
      expect(listener).toHaveBeenCalled()
      unsub()
    })
  })

  describe('updateLocal（原 updateSidebarTask）', () => {
    it('局部更新既有任务', () => {
      const { upsertLocal, updateLocal } = useTaskStore.getState()
      upsertLocal(makeTask({ id: 't1', status: 'idle' }))
      updateLocal('t1', { status: 'streaming' })
      expect(useTaskStore.getState().tasks[0].status).toBe('streaming')
    })

    it('id 不存在时不产生变更', () => {
      const { upsertLocal, updateLocal } = useTaskStore.getState()
      upsertLocal(makeTask({ id: 't1' }))
      updateLocal('nonexistent', { status: 'failed' })
      const loaded = useTaskStore.getState().tasks
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('t1')
    })
  })

  describe('removeLocal（原 removeSidebarTask）', () => {
    it('按 id 移除任务', () => {
      const { upsertLocal, removeLocal } = useTaskStore.getState()
      upsertLocal(makeTask({ id: 't1' }))
      upsertLocal(makeTask({ id: 't2' }))
      removeLocal('t1')
      const loaded = useTaskStore.getState().tasks
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('t2')
    })
  })

  describe('archiveByWorkspace（原 archiveSidebarTasksByWorkspace）', () => {
    it('归档指定工作空间的全部任务', () => {
      const { upsertLocal, archiveByWorkspace } = useTaskStore.getState()
      upsertLocal(makeTask({ id: 'a', workspaceId: 'ws-1' }))
      upsertLocal(makeTask({ id: 'b', workspaceId: 'ws-1' }))
      upsertLocal(makeTask({ id: 'c', workspaceId: 'ws-2' }))
      archiveByWorkspace('ws-1')
      const loaded = useTaskStore.getState().tasks
      const ws1Tasks = loaded.filter((t) => t.workspaceId === 'ws-1')
      expect(ws1Tasks.every((t) => t.archived === true)).toBe(true)
      const ws2Task = loaded.find((t) => t.id === 'c')
      expect(ws2Task?.archived).toBeUndefined()
    })
  })

  describe('workspace meta', () => {
    it('hydrate 解析工作空间 meta', () => {
      const items: SidebarWorkspaceMeta[] = [
        { id: 'ws-1', name: 'Project A' },
        { id: 'ws-2', name: 'Project B', pinned: true },
      ]
      window.localStorage.setItem(SIDEBAR_WORKSPACES_KEY, JSON.stringify(items))
      useTaskStore.getState().hydrate()
      const loaded = useTaskStore.getState().workspaces
      expect(loaded).toHaveLength(2)
      expect(loaded[1].pinned).toBe(true)
    })

    it('hydrate 过滤无效条目', () => {
      const items = [{ id: 'ws-1', name: 'Valid' }, { id: 'no-name' }, { name: 'no-id' }]
      window.localStorage.setItem(SIDEBAR_WORKSPACES_KEY, JSON.stringify(items))
      useTaskStore.getState().hydrate()
      const loaded = useTaskStore.getState().workspaces
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('ws-1')
    })

    it('upsertWorkspace 新增与更新', () => {
      const { upsertWorkspace } = useTaskStore.getState()
      upsertWorkspace({ id: 'ws-1', name: 'New Workspace' })
      upsertWorkspace({ id: 'ws-1', name: 'Updated', pinned: true })
      const loaded = useTaskStore.getState().workspaces
      expect(loaded).toHaveLength(1)
      expect(loaded[0].name).toBe('Updated')
      expect(loaded[0].pinned).toBe(true)
    })
  })
})
