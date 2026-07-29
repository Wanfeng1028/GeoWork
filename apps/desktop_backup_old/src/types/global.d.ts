// GeoWork - Global Type Declarations
// Extends window object with preload-exposed APIs

interface DesktopAPI {
  chooseFolder(): Promise<string[]>;
  chooseFiles(options?: { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }): Promise<string[]>;
  revealInFileExplorer(filePath: string): Promise<{ success: boolean; error?: string }>;
  openExternal(url: string): Promise<{ success: boolean; error?: string }>;
  openLocalApp(appName: string): Promise<{ success: boolean; error?: string }>;
  minimizeWindow(): Promise<{ success: boolean }>;
  toggleMaximizeWindow(): Promise<{ success: boolean }>;
  closeWindow(): Promise<{ success: boolean }>;
  isWindowMaximized(): Promise<{ isMaximized: boolean }>;
}

interface RuntimeAPI {
  listWorkspaces(): Promise<any[]>;
  createWorkspace(data: { name: string; path: string; mode: string }): Promise<any>;
  getWorkspaceTree(workspaceId: string): Promise<any[]>;
  readFile(workspaceId: string, path: string): Promise<{ content?: string }>;
  writeFile(data: { workspaceId: string; path: string; content: string }): Promise<void>;
  importFiles(data: { workspaceId: string; srcPaths: string[] }): Promise<void>;
  listTasks(): Promise<any[]>;
  createTask(data: Record<string, any>): Promise<any>;
  getTask(taskId: string): Promise<any>;
  cancelTask(taskId: string): Promise<void>;
  subscribeTaskEvents(taskId: string, callback: (data: any) => void): () => void;
  getPermissionRequests(): Promise<any[]>;
  approvePermission(id: string, reason: string): Promise<void>;
  denyPermission(id: string, reason: string): Promise<void>;
  getPermissions(taskId: string): Promise<any>;
  updatePermissions(data: Record<string, any>): Promise<void>;
  runCommand(data: { taskId: string; workspace: string; command: string }): Promise<any>;
  runPython(data: { taskId: string; workspace: string; scriptPath: string; env?: Record<string, string>; timeout?: number }): Promise<any>;
  listProcesses(taskId: string): Promise<any[]>;
  stopProcess(processId: string): Promise<void>;
  health(): Promise<any>;
  performance(): Promise<any>;
  getLogs(): Promise<any[]>;
  connectSSE(url: string, onMessage: (data: any) => void, onError: (err: any) => void, onDone: () => void): () => void;
}

interface SystemAPI {
  showNotification(options: { title: string; body: string; icon?: string }): Promise<{ success: boolean }>;
  getPlatformInfo(): Promise<any>;
  getAppDataPath(): Promise<string>;
  captureScreenshot(): Promise<{ success: boolean; error?: string }>;
  createTray(options: { iconPath: string; menu?: Array<{ label: string; click?: () => void }>; tooltip?: string }): Promise<{ success: boolean; error?: string }>;
  registerGlobalShortcut(shortcut: string, callback: () => void): Promise<boolean>;
  setApplicationMenu(menuTemplate: Array<any>): Promise<{ success: boolean }>;
}

interface ClipboardAPI {
  readText(): Promise<string>;
  writeText(text: string): Promise<{ success: boolean }>;
  readImage(): Promise<string | null>;
  writeImage(dataUrl: string): Promise<{ success: boolean }>;
  has(format: string): Promise<boolean>;
}

interface NotificationsAPI {
  show(options: { title: string; body: string; icon?: string; sound?: string; urgency?: string }): Promise<{ success: boolean }>;
  requestPermission(): Promise<string>;
}

interface PluginAPI {
  listMarketplace(): Promise<any[]>;
  getPlugin(id: string): Promise<any>;
  installPlugin(id: string): Promise<void>;
  uninstallPlugin(id: string): Promise<void>;
  togglePlugin(id: string, enabled: boolean): Promise<void>;
}

interface GeoWorkWindow {
  coreUrl?: string;
  desktop: DesktopAPI;
  runtime: RuntimeAPI;
  plugin: PluginAPI;
  system: SystemAPI;
  clipboard: ClipboardAPI;
  notifications: NotificationsAPI;
}

interface Window {
  geowork: GeoWorkWindow;
}
