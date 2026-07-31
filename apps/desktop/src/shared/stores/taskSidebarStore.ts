import { apiGet } from '../api/client'

export const SIDEBAR_TASKS_KEY = 'geowork.sidebar.tasks.v1'
export const SIDEBAR_WORKSPACES_KEY = 'geowork.sidebar.workspaces.v1'

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

/* ── Core Task 对接（/api/db/tasks） ── */

/** Core 端 Task 形状（仅取侧栏需要的字段）。 */
interface CoreTask {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: string
  mode?: string
  prompt?: string
  updatedAt: string
  completedAt?: string
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

/**
 * 从 Core API 加载任务列表并合并到 localStorage。
 *
 * 合并策略：Core 任务 id 已存在则更新 status/updatedAt/title/lastMessage，
 * 不存在则新增；本地已有的 workspaceName/pinned 等元数据予以保留。
 * 失败时静默返回，保留 localStorage 现状（保留 CustomEvent 通知模式）。
 */
export async function refreshSidebarTasksFromCore(): Promise<void> {
  try {
    const res = await apiGet<{ total: number; tasks: CoreTask[] }>(
      '/api/db/tasks?workspaceId=default',
    )
    const coreTasks = res?.tasks ?? []
    if (coreTasks.length === 0) return

    const local = loadSidebarTasks()

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

    local.sort((a, b) => b.updatedAt - a.updatedAt)
    saveSidebarTasks(local.slice(0, 50))
    dispatchUpdated()
  } catch {
    /* Core 不可用：保留 localStorage 现状，不抛错 */
  }
}

/** 从 localStorage 读取侧栏任务列表，异常返回空数组。旧数据自动补 workspaceId */
export function loadSidebarTasks(): SidebarTaskItem[] {
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
        workspaceId: (typeof item.workspaceId === 'string' ? item.workspaceId : 'default') as string,
        workspaceName: (typeof item.workspaceName === 'string' && item.workspaceName !== '' ? item.workspaceName : '默认') as string,
      })) as SidebarTaskItem[]
  } catch {
    return []
  }
}

function saveSidebarTasks(tasks: SidebarTaskItem[]): void {
  try {
    window.localStorage.setItem(SIDEBAR_TASKS_KEY, JSON.stringify(tasks))
  } catch {
    /* 静默忽略 */
  }
}

function dispatchUpdated(): void {
  requestAnimationFrame(() => {
    window.dispatchEvent(new CustomEvent('geowork:sidebar-tasks-updated'))
  })
}

/** 创建或更新一条侧栏任务，按 updatedAt 倒序，最多保留 50 条 */
export function upsertSidebarTask(item: SidebarTaskItem): void {
  const tasks = loadSidebarTasks()
  const idx = tasks.findIndex((t) => t.id === item.id)
  if (idx >= 0) {
    tasks[idx] = item
  } else {
    tasks.unshift(item)
  }
  tasks.sort((a, b) => b.updatedAt - a.updatedAt)
  saveSidebarTasks(tasks.slice(0, 50))
  dispatchUpdated()
}

/** 局部更新一条侧栏任务 */
export function updateSidebarTask(id: string, patch: Partial<SidebarTaskItem>): void {
  const tasks = loadSidebarTasks()
  const idx = tasks.findIndex((t) => t.id === id)
  if (idx < 0) return
  tasks[idx] = { ...tasks[idx], ...patch, updatedAt: Date.now() }
  saveSidebarTasks(tasks)
  dispatchUpdated()
}

/** 归档指定 workspaceId 下所有任务 */
export function archiveSidebarTasksByWorkspace(workspaceId: string): void {
  const tasks = loadSidebarTasks().map((t) =>
    t.workspaceId === workspaceId ? { ...t, archived: true, updatedAt: Date.now() } : t,
  )
  saveSidebarTasks(tasks)
  dispatchUpdated()
}

/** 从侧栏任务列表中移除指定 id */
export function removeSidebarTask(id: string): void {
  const tasks = loadSidebarTasks().filter((t) => t.id !== id)
  saveSidebarTasks(tasks)
  dispatchUpdated()
}

/* ── Workspace Meta ── */

export function loadWorkspaceMeta(): SidebarWorkspaceMeta[] {
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

function saveWorkspaceMeta(meta: SidebarWorkspaceMeta[]): void {
  try {
    window.localStorage.setItem(SIDEBAR_WORKSPACES_KEY, JSON.stringify(meta))
  } catch {
    /* 静默忽略 */
  }
}

/** 更新工作空间 meta（置顶/归档等） */
export function upsertWorkspaceMeta(item: SidebarWorkspaceMeta): void {
  const meta = loadWorkspaceMeta()
  const idx = meta.findIndex((m) => m.id === item.id)
  if (idx >= 0) {
    meta[idx] = item
  } else {
    meta.push(item)
  }
  saveWorkspaceMeta(meta)
  dispatchUpdated()
}
