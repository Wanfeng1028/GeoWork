// GeoWork — Electron preload type declarations
// Provides full TypeScript support for window.geowork API surface

interface DesktopAPI {
  chooseFolder(): Promise<string[]>
  chooseFiles(options?: {
    filters?: Array<{ name: string; extensions: string[] }>
    properties?: string[]
  }): Promise<string[]>
  revealInFileExplorer(filePath: string): Promise<{ success: boolean; error?: string }>
  openExternal(url: string): Promise<{ success: boolean; error?: string }>
  openLocalApp(appName: string): Promise<{ success: boolean; error?: string }>
}

interface RuntimeAPI {
  // Workspace
  listWorkspaces(): Promise<unknown[]>
  createWorkspace(data: Record<string, unknown>): Promise<unknown>
  getWorkspaceTree(workspaceId: string): Promise<unknown[]>
  readFile(workspaceId: string, path: string): Promise<unknown>
  writeFile(data: Record<string, unknown>): Promise<void>
  importFiles(data: Record<string, unknown>): Promise<void>

  // Tasks
  listTasks(): Promise<unknown[]>
  createTask(data: Record<string, unknown>): Promise<unknown>
  getTask(taskId: string): Promise<unknown>
  cancelTask(taskId: string): Promise<void>
  subscribeTaskEvents(
    taskId: string,
    callback: (data: unknown) => void
  ): () => void

  // Permissions
  getPermissionRequests(): Promise<unknown[]>
  approvePermission(id: string, reason: string): Promise<void>
  denyPermission(id: string, reason: string): Promise<void>
  getPermissions(taskId: string): Promise<Record<string, unknown>>
  updatePermissions(data: Record<string, unknown>): Promise<void>

  // Sandbox
  runCommand(data: Record<string, unknown>): Promise<unknown>
  runPython(data: Record<string, unknown>): Promise<unknown>
  listProcesses(taskId: string): Promise<unknown[]>
  stopProcess(processId: string): Promise<void>

  // Diagnostics
  health(): Promise<unknown>
  performance(): Promise<unknown>
  getLogs(): Promise<unknown[]>

  // SSE
  connectSSE(
    url: string,
    onMessage: (data: unknown) => void,
    onError: (err: unknown) => void,
    onDone: () => void
  ): () => void
}

interface SystemAPI {
  showNotification(options: { title: string; body: string; icon?: string }): Promise<{ success: boolean }>
  getPlatformInfo(): Promise<Record<string, unknown>>
  getAppDataPath(): Promise<string>
  captureScreenshot(): Promise<{ success: boolean; dataUrl?: string; error?: string }>
  createTray(options: Record<string, unknown>): Promise<{ success: boolean; error?: string }>
  registerGlobalShortcut(shortcut: string, callback: () => void): Promise<{ success: boolean }>
  setApplicationMenu(menuTemplate: Record<string, unknown>[]): Promise<{ success: boolean }>
}

interface ClipboardAPI {
  readText(): Promise<string>
  writeText(text: string): Promise<{ success: boolean }>
  readImage(): Promise<string | null>
  writeImage(dataUrl: string): Promise<{ success: boolean }>
  has(format: string): Promise<boolean>
}

interface NotificationsAPI {
  show(options: { title: string; body: string; icon?: string; sound?: string; urgency?: string }): Promise<{ success: boolean }>
  requestPermission(): Promise<'granted'>
}

interface GeoworkWindow {
  geowork: {
    desktop: DesktopAPI
    runtime: RuntimeAPI
    system: SystemAPI
    clipboard: ClipboardAPI
    notifications: NotificationsAPI
  }
}

declare global {
  interface Window extends GeoworkWindow {}
}

export {}
