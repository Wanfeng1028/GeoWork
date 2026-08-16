/**
 * taskStore — 侧栏任务 zustand store（doc/21 §P5）
 *
 * 替代旧 taskSidebarStore（localStorage 函数集 + CustomEvent 通知）：
 * - 状态单一真相源在内存，localStorage 只作持久化镜像（同 key 平滑迁移）
 * - 跨组件同步走 zustand 订阅，删除 geowork:sidebar-tasks-updated CustomEvent
 * - refreshFromCore 吸收旧三重合并策略：core 任务更新本地状态字段，保留本地元数据
 * - source 标注数据来源（core 在线 / cache 降级），UI 据此显示离线提示
 */

import { create } from 'zustand'
import { apiGet } from '../api/client'
import type { CoreTaskListResponse } from '../api/types'

export type SidebarTaskStatus = 'idle' | 'streaming' | 'completed' | 'stopped' | 'failed'

export interface SidebarTaskItem {
  id: string
  title: string
  lastMessage: string
  status: SidebarTaskStatus
  updatedAt: number

  workspaceId: string
  workspaceName: string
  workDirName?: string
  workDirPath?: string

  pinned?: boolean
  archived?: boolean
}

export interface SidebarWorkspaceMeta {
  id: string
  name: string
  pinned?: boolean
  archived?: boolean
}

const SIDEBAR_TASKS_KEY = 'geowork.sidebar.tasks.v1'
const SIDEBAR_WORKSPACES_KEY = 'geowork.sidebar.workspaces.v1'
const MAX_TASKS = 50

/* ── localStorage 读写（P6 收编到 shared/storage 统一入口） ── */

function loadTasksFromStorage(): SidebarTaskItem[] {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_TASKS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).id === 'string' &&
          typeof (item as Record<string, unknown>).status === 'string',
      )
      .map((item) => ({
        ...item,
        workspaceId: (typeof item.workspaceId === 'string'
          ? item.workspaceId
          : 'default') as string,
        workspaceName: (typeof item.workspaceName === 'string' && item.workspaceName !== ''
          ? item.workspaceName
          : '默认') as string,
      })) as SidebarTaskItem[]
  } catch {
    return []
  }
}

function saveTasksToStorage(tasks: SidebarTaskItem[]): void {
  try {
    window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify(tasks))
  } catch {
    /* 静默忽略 */
  }
}

function loadWorkspacesFromStorage(): SidebarWorkspaceMeta[] {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WORKSPACES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SidebarWorkspaceMeta =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SidebarWorkspaceMeta).id === 'string' &&
        typeof (item as SidebarWorkspaceMeta).name === 'string',
    )
  } catch {
    return []
  }
}

function saveWorkspacesToStorage(meta: SidebarWorkspaceMeta[]): void {
  try {
    window.localStorage.setItem(SIDEBAR_WORKSPACES_KEY, JSON.stringify(meta))
  } catch {
    /* 静默忽略 */
  }
}

/** Core Task status → 侧栏 SidebarTaskStatus 映射。 */
function mapCoreStatusToSidebar(status: string): SidebarTaskStatus {
  switch (status) {
    case 'running':
      return 'streaming'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'stopped'
    case 'pending':
    case 'paused':
    case 'recovered':
    default:
      return 'idle'
  }
}

interface TaskState {
  tasks: SidebarTaskItem[]
  workspaces: SidebarWorkspaceMeta[]
  /** 数据来源：core 在线拉取 / 本地缓存降级 */
  source: 'core' | 'cache'

  /** 从 localStorage 回填内存（初始化 / 跨标签页 storage 事件）。 */
  hydrate: () => void
  /** 从 Core API 拉取任务并合并（core 任务保留本地元数据），失败静默。 */
  refreshFromCore: () => Promise<void>
  /** 创建或更新一条侧栏任务（按 updatedAt 倒序，上限 50）。 */
  upsertLocal: (item: SidebarTaskItem) => void
  /** 局部更新一条任务元数据（置顶/归档/改名等）。 */
  updateLocal: (id: string, patch: Partial<SidebarTaskItem>) => void
  /** 归档指定 workspaceId 下所有任务。 */
  archiveByWorkspace: (workspaceId: string) => void
  /** 移除指定 id 的任务。 */
  removeLocal: (id: string) => void
  /** 更新工作空间 meta（置顶/归档等）。 */
  upsertWorkspace: (item: SidebarWorkspaceMeta) => void
}

const sortTasks = (tasks: SidebarTaskItem[]): SidebarTaskItem[] =>
  [...tasks].sort((a, b) => b.updatedAt - a.updatedAt)

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  workspaces: [],
  source: 'cache',

  hydrate: () => {
    set({ tasks: sortTasks(loadTasksFromStorage()), workspaces: loadWorkspacesFromStorage() })
  },

  refreshFromCore: async () => {
    try {
      const res = await apiGet<CoreTaskListResponse>('/api/db/tasks?workspaceId=default')
      const coreTasks = res?.tasks ?? []
      if (coreTasks.length === 0) return

      const local = [...get().tasks]
      for (const t of coreTasks) {
        const item: SidebarTaskItem = {
          id: t.id,
          title: t.name,
          lastMessage: t.description || (t.prompt ? t.prompt.slice(0, 50) : ''),
          status: mapCoreStatusToSidebar(t.status),
          updatedAt: Date.parse(t.updatedAt) || Date.now(),
          workspaceId: t.workspaceId || 'default',
          workspaceName: '默认',
        }
        const idx = local.findIndex((x) => x.id === item.id)
        if (idx >= 0) {
          /* 保留本地元数据（workspaceName/pinned/archived/workDirName），仅同步 Core 状态 */
          local[idx] = {
            ...local[idx],
            title: item.title,
            lastMessage: item.lastMessage || local[idx].lastMessage,
            status: item.status,
            updatedAt: item.updatedAt,
            workspaceId: item.workspaceId,
          }
        } else {
          local.unshift(item)
        }
      }

      const next = sortTasks(local).slice(0, MAX_TASKS)
      saveTasksToStorage(next)
      set({ tasks: next, source: 'core' })
    } catch {
      /* Core 不可用：保留本地状态与缓存，source 维持 cache */
    }
  },

  upsertLocal: (item) => {
    const tasks = [...get().tasks]
    const idx = tasks.findIndex((t) => t.id === item.id)
    if (idx >= 0) {
      tasks[idx] = item
    } else {
      tasks.unshift(item)
    }
    const next = sortTasks(tasks).slice(0, MAX_TASKS)
    saveTasksToStorage(next)
    set({ tasks: next })
  },

  updateLocal: (id, patch) => {
    const tasks = get().tasks
    const idx = tasks.findIndex((t) => t.id === id)
    if (idx < 0) return
    const next = [...tasks]
    next[idx] = { ...next[idx], ...patch, updatedAt: Date.now() }
    saveTasksToStorage(next)
    set({ tasks: next })
  },

  archiveByWorkspace: (workspaceId) => {
    const next = get().tasks.map((t) =>
      t.workspaceId === workspaceId ? { ...t, archived: true, updatedAt: Date.now() } : t,
    )
    saveTasksToStorage(next)
    set({ tasks: next })
  },

  removeLocal: (id) => {
    const next = get().tasks.filter((t) => t.id !== id)
    saveTasksToStorage(next)
    set({ tasks: next })
  },

  upsertWorkspace: (item) => {
    const meta = [...get().workspaces]
    const idx = meta.findIndex((m) => m.id === item.id)
    if (idx >= 0) {
      meta[idx] = item
    } else {
      meta.push(item)
    }
    saveWorkspacesToStorage(meta)
    set({ workspaces: meta })
  },
}))

/* 初始化即回填缓存（store 创建时同步执行一次） */
useTaskStore.getState().hydrate()
