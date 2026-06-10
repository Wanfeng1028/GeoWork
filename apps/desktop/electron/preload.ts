import { contextBridge, ipcRenderer } from 'electron'

// Expose desktop APIs
contextBridge.exposeInMainWorld('geowork', {
  // Desktop (file dialogs, system)
  desktop: {
    chooseFolder: () => ipcRenderer.invoke('desktop:chooseFolder'),
    chooseFiles: (options: any) => ipcRenderer.invoke('desktop:chooseFiles', options),
    revealInFileExplorer: (filePath: string) => ipcRenderer.invoke('desktop:revealInFileExplorer', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('desktop:openExternal', url),
    openLocalApp: (appName: string) => ipcRenderer.invoke('desktop:openLocalApp', appName),
  },

  // Runtime (Go Core API via Electron IPC)
  runtime: {
    // Workspace
    listWorkspaces: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/workspaces'),
    createWorkspace: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/workspaces', data),
    getWorkspaceTree: (workspaceId: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/workspaces/tree?workspaceId=${workspaceId}`),
    readFile: (workspaceId: string, path: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/workspaces/files/read?workspaceId=${workspaceId}&path=${encodeURIComponent(path)}`),
    writeFile: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/workspaces/files/write', data),
    importFiles: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/workspaces/files/import', data),

    // Tasks
    listTasks: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/tasks'),
    createTask: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/tasks', data),
    getTask: (taskId: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/tasks/${taskId}`),
    cancelTask: (taskId: string) => ipcRenderer.invoke('runtime:api', 'POST', `/api/tasks/${taskId}/cancel`),
    subscribeTaskEvents: (taskId: string, callback: (data: any) => void) => {
      const channel = `task-events-${taskId}`
      const listener = (_event: any, data: any) => callback(data)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },

    // Permissions
    getPermissionRequests: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/permissions/requests'),
    approvePermission: (id: string, reason: string) => ipcRenderer.invoke('runtime:api', 'POST', `/api/permissions/requests/${id}/approve`, { reason }),
    denyPermission: (id: string, reason: string) => ipcRenderer.invoke('runtime:api', 'POST', `/api/permissions/requests/${id}/deny`, { reason }),
    getPermissions: (taskId: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/permissions/policies?taskId=${taskId}`),
    updatePermissions: (data: any) => ipcRenderer.invoke('runtime:api', 'PATCH', '/api/permissions/policies', data),

    // Sandbox
    runCommand: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/sandbox/run-command', data),
    runPython: (data: any) => ipcRenderer.invoke('runtime:api', 'POST', '/api/sandbox/run-python', data),
    listProcesses: (taskId: string) => ipcRenderer.invoke('runtime:api', 'GET', `/api/sandbox/processes?taskId=${taskId}`),
    stopProcess: (processId: string) => ipcRenderer.invoke('runtime:api', 'POST', '/api/sandbox/processes/stop', { processId }),

    // Diagnostics
    health: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/diagnostics/health'),
    performance: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/diagnostics/performance'),
    getLogs: () => ipcRenderer.invoke('runtime:api', 'GET', '/api/diagnostics/logs'),

    // SSE Event Stream
    connectSSE: (url: string, onMessage: (data: any) => void, onError: (err: any) => void, onDone: () => void) => {
      const eventSource = new EventSource(url)
      eventSource.onmessage = (e) => onMessage(JSON.parse(e.data))
      eventSource.onerror = (e) => onError(e)
      eventSource.addEventListener('done', () => {
        eventSource.close()
        onDone()
      })
      return () => eventSource.close()
    },
  },

  // System
  system: {
    showNotification: (options: any) => ipcRenderer.invoke('system:showNotification', options),
    getPlatformInfo: () => ipcRenderer.invoke('system:getPlatformInfo'),
    getAppDataPath: () => ipcRenderer.invoke('system:getAppDataPath'),
    captureScreenshot: () => ipcRenderer.invoke('system:captureScreenshot'),
    createTray: (options: any) => ipcRenderer.invoke('system:createTray', options),
    registerGlobalShortcut: (shortcut: string, callback: () => void) => ipcRenderer.invoke('system:registerGlobalShortcut', shortcut, callback),
    setApplicationMenu: (menuTemplate: any) => ipcRenderer.invoke('system:setApplicationMenu', menuTemplate),
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
})
