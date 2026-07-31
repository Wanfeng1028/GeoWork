import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadSidebarTasks,
  upsertSidebarTask,
  updateSidebarTask,
  removeSidebarTask,
  archiveSidebarTasksByWorkspace,
  loadWorkspaceMeta,
  upsertWorkspaceMeta,
  SIDEBAR_TASKS_KEY,
  SIDEBAR_WORKSPACES_KEY,
  type SidebarTaskItem,
  type SidebarWorkspaceMeta,
} from '../shared/stores/taskSidebarStore'

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(0)
  return 0
})

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

describe('taskSidebarStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('loadSidebarTasks', () => {
    it('should return empty array when no tasks in localStorage', () => {
      expect(loadSidebarTasks()).toEqual([])
    })

    it('should return parsed tasks from localStorage', () => {
      const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })]
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify(tasks))
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(2)
      expect(loaded[0].id).toBe('t1')
    })

    it('should return empty array for invalid JSON', () => {
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, 'not-json')
      expect(loadSidebarTasks()).toEqual([])
    })

    it('should return empty array for non-array data', () => {
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify({ foo: 'bar' }))
      expect(loadSidebarTasks()).toEqual([])
    })

    it('should backfill workspaceId for old tasks missing it', () => {
      const oldTask = { id: 'old-1', status: 'completed', updatedAt: 1000 }
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify([oldTask]))
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].workspaceId).toBe('default')
      expect(loaded[0].workspaceName).toBe('默认')
    })

    it('should filter out items without id or status', () => {
      const items = [
        { id: 'valid', status: 'idle', updatedAt: 1 },
        { status: 'idle', updatedAt: 2 }, // missing id
        { id: 'no-status', updatedAt: 3 }, // missing status
      ]
      window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify(items))
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('valid')
    })
  })

  describe('upsertSidebarTask', () => {
    it('should insert a new task', () => {
      const task = makeTask({ id: 'new-1', updatedAt: 100 })
      upsertSidebarTask(task)
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('new-1')
    })

    it('should update an existing task by id', () => {
      const task = makeTask({ id: 't1', title: 'Original', updatedAt: 100 })
      upsertSidebarTask(task)
      upsertSidebarTask({ ...task, title: 'Updated', updatedAt: 200 })
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].title).toBe('Updated')
    })

    it('should sort tasks by updatedAt descending', () => {
      upsertSidebarTask(makeTask({ id: 'a', updatedAt: 100 }))
      upsertSidebarTask(makeTask({ id: 'b', updatedAt: 300 }))
      upsertSidebarTask(makeTask({ id: 'c', updatedAt: 200 }))
      const loaded = loadSidebarTasks()
      expect(loaded.map((t) => t.id)).toEqual(['b', 'c', 'a'])
    })

    it('should keep at most 50 tasks', () => {
      for (let i = 0; i < 55; i++) {
        upsertSidebarTask(makeTask({ id: `t-${i}`, updatedAt: i }))
      }
      const loaded = loadSidebarTasks()
      expect(loaded.length).toBeLessThanOrEqual(50)
    })

    it('should dispatch geowork:sidebar-tasks-updated event', () => {
      const handler = vi.fn()
      window.addEventListener('geowork:sidebar-tasks-updated', handler)
      upsertSidebarTask(makeTask())
      expect(handler).toHaveBeenCalled()
      window.removeEventListener('geowork:sidebar-tasks-updated', handler)
    })
  })

  describe('updateSidebarTask', () => {
    it('should patch an existing task', () => {
      upsertSidebarTask(makeTask({ id: 't1', status: 'idle' }))
      updateSidebarTask('t1', { status: 'streaming' })
      const loaded = loadSidebarTasks()
      expect(loaded[0].status).toBe('streaming')
    })

    it('should do nothing if task id not found', () => {
      upsertSidebarTask(makeTask({ id: 't1' }))
      updateSidebarTask('nonexistent', { status: 'failed' })
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('t1')
    })
  })

  describe('removeSidebarTask', () => {
    it('should remove a task by id', () => {
      upsertSidebarTask(makeTask({ id: 't1' }))
      upsertSidebarTask(makeTask({ id: 't2' }))
      removeSidebarTask('t1')
      const loaded = loadSidebarTasks()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('t2')
    })
  })

  describe('archiveSidebarTasksByWorkspace', () => {
    it('should archive all tasks for a given workspace', () => {
      upsertSidebarTask(makeTask({ id: 'a', workspaceId: 'ws-1' }))
      upsertSidebarTask(makeTask({ id: 'b', workspaceId: 'ws-1' }))
      upsertSidebarTask(makeTask({ id: 'c', workspaceId: 'ws-2' }))
      archiveSidebarTasksByWorkspace('ws-1')
      const loaded = loadSidebarTasks()
      const ws1Tasks = loaded.filter((t) => t.workspaceId === 'ws-1')
      expect(ws1Tasks.every((t) => t.archived === true)).toBe(true)
      const ws2Task = loaded.find((t) => t.id === 'c')
      expect(ws2Task?.archived).toBeUndefined()
    })
  })

  describe('loadWorkspaceMeta', () => {
    it('should return empty array when no data', () => {
      expect(loadWorkspaceMeta()).toEqual([])
    })

    it('should return parsed workspace meta', () => {
      const items: SidebarWorkspaceMeta[] = [
        { id: 'ws-1', name: 'Project A' },
        { id: 'ws-2', name: 'Project B', pinned: true },
      ]
      window.localStorage.setItem(SIDEBAR_WORKSPACES_KEY, JSON.stringify(items))
      const loaded = loadWorkspaceMeta()
      expect(loaded).toHaveLength(2)
      expect(loaded[1].pinned).toBe(true)
    })

    it('should filter out invalid entries', () => {
      const items = [
        { id: 'ws-1', name: 'Valid' },
        { id: 'no-name' },
        { name: 'no-id' },
      ]
      window.localStorage.setItem(SIDEBAR_WORKSPACES_KEY, JSON.stringify(items))
      const loaded = loadWorkspaceMeta()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe('ws-1')
    })
  })

  describe('upsertWorkspaceMeta', () => {
    it('should add a new workspace meta', () => {
      upsertWorkspaceMeta({ id: 'ws-1', name: 'New Workspace' })
      const loaded = loadWorkspaceMeta()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].name).toBe('New Workspace')
    })

    it('should update existing workspace meta', () => {
      upsertWorkspaceMeta({ id: 'ws-1', name: 'Original' })
      upsertWorkspaceMeta({ id: 'ws-1', name: 'Updated', pinned: true })
      const loaded = loadWorkspaceMeta()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].name).toBe('Updated')
      expect(loaded[0].pinned).toBe(true)
    })
  })
})
