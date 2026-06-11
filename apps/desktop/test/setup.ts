import { vi } from 'vitest'

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
    on: vi.fn(),
    isReady: true,
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: {
      on: vi.fn(),
      executeJavaScript: vi.fn(),
    },
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1920, height: 1080 } })),
  },
  session: {
    defaultSession: {
      resolveProxy: vi.fn(),
    },
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
    openExternal: vi.fn(),
  },
}))

// Mock window.geowork API
window.geowork = {
  runtime: {
    health: vi.fn(() => Promise.resolve({ status: 'ok' })),
  },
  system: {
    getAppDataPath: vi.fn(() => Promise.resolve('/tmp/geowork')),
    getPlatformInfo: vi.fn(() => Promise.resolve({ platform: 'win32' })),
  },
  fileDialogs: {
    chooseFolder: vi.fn(() => Promise.resolve(['/tmp/workspace'])),
    chooseFiles: vi.fn(() => Promise.resolve([])),
    revealInFileExplorer: vi.fn(() => Promise.resolve()),
  },
  clipboard: {
    readText: vi.fn(() => Promise.resolve('')),
    writeText: vi.fn(() => Promise.resolve()),
  },
  notifications: {
    show: vi.fn(() => Promise.resolve()),
  },
  plugin: {
    list: vi.fn(() => Promise.resolve([])),
  },
}

// Global setup for all tests
beforeEach(() => {
  vi.clearAllMocks()
})
