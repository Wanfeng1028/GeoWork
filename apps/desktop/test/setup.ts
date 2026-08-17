import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

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

// Mock window.geowork API（node 环境的对象层测试无 window，跳过 DOM 相关 stub）
if (typeof window !== 'undefined') {
  window.geowork = {
    runtime: {
      health: vi.fn(() => Promise.resolve({ status: 'ok' })),
      getToken: vi.fn(() => Promise.resolve(null)),
    },
    secrets: {
      get: vi.fn(() => Promise.resolve(null)),
      set: vi.fn(() => Promise.resolve({ success: true })),
      delete: vi.fn(() => Promise.resolve({ success: true })),
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
}

// Global setup for all tests
beforeEach(() => {
  vi.clearAllMocks()
})

// jsdom 无 ResizeObserver（antd / @ant-design/x 的 resize-observer 依赖它）
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverStub {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
