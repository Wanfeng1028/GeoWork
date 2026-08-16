import { contextBridge, ipcRenderer } from 'electron'

// Expose desktop APIs
contextBridge.exposeInMainWorld('geowork', {
  // Desktop (file dialogs, system)
  desktop: {
    chooseFolder: () => ipcRenderer.invoke('desktop:chooseFolder'),
    chooseFiles: (options: any) => ipcRenderer.invoke('desktop:chooseFiles', options),
    revealInFileExplorer: (filePath: string) =>
      ipcRenderer.invoke('desktop:revealInFileExplorer', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('desktop:openExternal', url),
    openLocalApp: (appName: string) => ipcRenderer.invoke('desktop:openLocalApp', appName),
    minimizeWindow: () => ipcRenderer.invoke('windows:minimize'),
    toggleMaximizeWindow: () => ipcRenderer.invoke('windows:maximize'),
    closeWindow: () => ipcRenderer.invoke('windows:close'),
    isWindowMaximized: () => ipcRenderer.invoke('windows:isMaximized'),
    setTitleBarTheme: (dark: boolean) => ipcRenderer.invoke('window:set-titlebar-theme', dark),
  },

  // Runtime (Go Core API via Electron IPC)
  runtime: {
    // Workspace
    listWorkspaces: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/workspaces'),
    createWorkspace: (data: any) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/workspaces', data),
    getWorkspaceTree: (workspaceId: string) =>
      ipcRenderer.invoke('runtime:api', 'GET', `/api/workspaces/tree?workspaceId=${workspaceId}`),
    getTreeByPath: (root: string) =>
      ipcRenderer.invoke(
        'runtime:api',
        'GET',
        `/api/workspaces/tree?root=${encodeURIComponent(root)}`,
      ),
    readFile: (workspaceId: string, path: string) =>
      ipcRenderer.invoke(
        'runtime:api',
        'GET',
        `/api/workspaces/files/read?workspaceId=${workspaceId}&path=${encodeURIComponent(path)}`,
      ),
    readFileByPath: (root: string, path: string) =>
      ipcRenderer.invoke(
        'runtime:api',
        'GET',
        `/api/workspaces/files/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
      ),
    writeFile: (data: any) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/workspaces/files/write', data),
    importFiles: (data: any) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/workspaces/files/import', data),

    // Tasks
    listTasks: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/tasks'),
    createTask: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/tasks', data),
    getTask: (taskId: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/tasks/${taskId}`),
    cancelTask: (taskId: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', `/api/tasks/${taskId}/cancel`),
    subscribeTaskEvents: (taskId: string, callback: (data: any) => void) => {
      const channel = `task-events-${taskId}`
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },

    // Permissions
    getPermissionRequests: () =>
      ipcRenderer.invoke('runtime:api', 'GET', '/api/permissions/requests'),
    approvePermission: (id: string, reason: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', `/api/permissions/requests/${id}/approve`, {
        reason,
      }),
    denyPermission: (id: string, reason: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', `/api/permissions/requests/${id}/deny`, { reason }),
    getPermissions: (taskId: string) =>
      ipcRenderer.invoke('runtime:api', 'GET', `/api/permissions/policies?taskId=${taskId}`),
    updatePermissions: (data: any) =>
      ipcRenderer.invoke('runtime:api', 'PATCH', '/api/permissions/policies', data),

    // Diff / Review (real endpoints under /api/security/diff)
    listDiffs: (status?: string) =>
      ipcRenderer.invoke(
        'runtime:api',
        'GET',
        `/api/security/diff${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      ),
    getDiff: (id: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/security/diff/${id}`),
    approveDiff: (id: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', `/api/security/diff/${id}/approve`),
    rejectDiff: (id: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', `/api/security/diff/${id}/reject`),
    applyAllDiffs: () => ipcRenderer.invoke('runtime:api', 'POST', '/api/security/apply-all'),
    rollbackPath: (path: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/security/rollback', { path }),

    // Sandbox
    runCommand: (data: any) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/sandbox/run-command', data),
    runPython: (data: any) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/sandbox/run-python', data),
    listProcesses: (taskId: string) =>
      ipcRenderer.invoke('runtime:api', 'GET', `/api/sandbox/processes?taskId=${taskId}`),
    stopProcess: (processId: string) =>
      ipcRenderer.invoke('runtime:api', 'POST', '/api/sandbox/processes/stop', { processId }),

    // Diagnostics
    health: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/diagnostics/health'),
    performance: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/diagnostics/performance'),
    getLogs: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/diagnostics/logs'),

    // Runtime status & health
    getStatus: () => ipcRenderer.invoke('runtime:status'),
    checkHealth: () => ipcRenderer.invoke('runtime:health'),

    // P0-4: runtime token for direct renderer→Go API calls
    getToken: () => ipcRenderer.invoke('runtime:token'),

    // SSE Event Stream
    connectSSE: (
      url: string,
      onMessage: (data: any) => void,
      onError: (err: any) => void,
      onDone: () => void,
    ) => {
      const eventSource = new EventSource(url)
      eventSource.onmessage = (e) => onMessage(JSON.parse(e.data))
      eventSource.onerror = (e) => onError(e)
      eventSource.addEventListener('done', () => {
        eventSource.close()
        onDone()
      })
      return () => eventSource.close()
    },

    // Runtime status change events
    onStatusChange: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('runtime:status-change', listener)
      return () => ipcRenderer.removeListener('runtime:status-change', listener)
    },
  },

  // Cloud API proxy -> http://127.0.0.1:8767
  cloud: {
    api: (method: string, path: string, body?: any) =>
      ipcRenderer.invoke('cloud:api', method, path, body),
  },

  // P1-8: encrypted secret store (Electron safeStorage)
  secrets: {
    get: (key: string) => ipcRenderer.invoke('secrets:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('secrets:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('secrets:delete', key),
  },

  // System
  system: {
    showNotification: (options: any) => ipcRenderer.invoke('system:showNotification', options),
    getPlatformInfo: () => ipcRenderer.invoke('system:getPlatformInfo'),
    getAppDataPath: () => ipcRenderer.invoke('system:getAppDataPath'),
    captureScreenshot: () => ipcRenderer.invoke('system:captureScreenshot'),
    createTray: (options: any) => ipcRenderer.invoke('system:createTray', options),
    registerGlobalShortcut: (shortcut: string, callback: () => void) =>
      ipcRenderer.invoke('system:registerGlobalShortcut', shortcut, callback),
    setApplicationMenu: (menuTemplate: any) =>
      ipcRenderer.invoke('system:setApplicationMenu', menuTemplate),
  },

  // Clipboard
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
    readImage: () => ipcRenderer.invoke('clipboard:readImage'),
    writeImage: (dataUrl: string) => ipcRenderer.invoke('clipboard:writeImage', dataUrl),
    has: (format: string) => ipcRenderer.invoke('clipboard:has', format),
  },

  // Notifications
  notifications: {
    show: (options: any) => ipcRenderer.invoke('notifications:show', options),
    requestPermission: () => ipcRenderer.invoke('notifications:requestPermission'),
  },

  // Security/Permission Approval
  security: {
    requestPermission: (category: string, detail?: Record<string, unknown>) =>
      ipcRenderer.invoke('security:requestPermission', category, detail),
    approvePermission: (permissionId: string) =>
      ipcRenderer.invoke('security:approvePermission', permissionId),
    denyPermission: (permissionId: string, reason?: string) =>
      ipcRenderer.invoke('security:denyPermission', permissionId, reason),
    listPermissions: () => ipcRenderer.invoke('security:listPermissions'),
    onStatusChange: (callback: (data: any) => void) => {
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on('security:status-change', listener)
      return () => ipcRenderer.removeListener('security:status-change', listener)
    },
  },

  // Built-in browser (WebContentsView) — 内嵌真实 Chromium,支持 Google Earth / GEE
  browser: {
    create: (id: string) => ipcRenderer.invoke('browser:create', id),
    navigate: (id: string, url: string) => ipcRenderer.invoke('browser:navigate', id, url),
    setBounds: (id: string, bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('browser:setBounds', id, bounds),
    setVisible: (id: string, visible: boolean) =>
      ipcRenderer.invoke('browser:setVisible', id, visible),
    back: (id: string) => ipcRenderer.invoke('browser:back', id),
    forward: (id: string) => ipcRenderer.invoke('browser:forward', id),
    reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
    getUrl: (id: string) => ipcRenderer.invoke('browser:getUrl', id),
    destroy: (id: string) => ipcRenderer.invoke('browser:destroy', id),
    onDidNavigate: (id: string, callback: (url: string) => void) => {
      const channel = `browser:did-navigate-${id}`
      const listener = (_event: any, url: string) => callback(url)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onLoading: (id: string, callback: (loading: boolean) => void) => {
      const channel = `browser:loading-${id}`
      const listener = (_event: any, loading: boolean) => callback(loading)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onTitle: (id: string, callback: (title: string) => void) => {
      const channel = `browser:title-${id}`
      const listener = (_event: any, title: string) => callback(title)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
  },

  // Real terminal (node-pty) — 真·交互式终端
  terminal: {
    create: (opts: { id: string; cwd?: string; shell?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke('term:create', opts),
    write: (id: string, data: string) => ipcRenderer.invoke('term:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('term:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('term:kill', id),
    onData: (id: string, callback: (data: string) => void) => {
      const channel = `term:data-${id}`
      const listener = (_event: any, data: string) => callback(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id: string, callback: (exitCode: number) => void) => {
      const channel = `term:exit-${id}`
      const listener = (_event: any, code: number) => callback(code)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
  },
})
