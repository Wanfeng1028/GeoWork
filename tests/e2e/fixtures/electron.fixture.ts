/**
 * Electron testbed fixture（P7-1）— 启动真实 Electron 壳。
 *
 * 依赖 processes fixture（worker 级）：三进程已预启且端口占用，
 * Electron 主进程的 startRuntime() 检测到 8765/8767 已占用会跳过自启，
 * 直接连接预启进程。
 *
 * 启动方式：_electron.launch() 加载 electron-vite 构建产物
 * （apps/desktop/out/main/main.js），renderer 走构建后的 index.html
 * （不设 ELECTRON_RENDERER_URL），测试真实生产渲染路径。
 *
 * 用法：
 *   import { test } from '../fixtures/electron.fixture'
 *   test('...', async ({ electronApp, window, processes }) => { ... })
 */
import { test as processesTest, type ProcessBundle } from './processes.fixture'
import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const desktopDir = resolve(here, '../../../apps/desktop')
const mainEntry = resolve(desktopDir, 'out/main/main.js')

export interface ElectronFixtures {
  electronApp: ElectronApplication
  window: Page
  processes: ProcessBundle
}

export const test = processesTest.extend<ElectronFixtures>({
  electronApp: async ({ processes }, use) => {
    // 确保构建产物存在（CI 预构建；本地需先 npm run build）
    if (!fs.existsSync(mainEntry)) {
      throw new Error(
        `[electron] main entry not found: ${mainEntry}。` +
          `请先在 apps/desktop 下运行 npm run build（electron-vite build）。`,
      )
    }

    const app = await _electron.launch({
      args: [mainEntry],
      cwd: desktopDir,
      env: {
        ...process.env,
        // 禁用 token auth（三进程已以 insecure 模式运行）
        GEOWORK_INSECURE_NO_AUTH: '1',
        // 不设 ELECTRON_RENDERER_URL → main.ts 走 loadFile(../renderer/index.html)
        // 测试构建后的真实渲染路径
      },
    })

    await use(app)
    await app.close()
  },

  window: async ({ electronApp }, use) => {
    const win = await electronApp.firstWindow()
    // 等待渲染层就绪（app-shell testid 是全局布局根节点）
    await win.waitForSelector('[data-testid="app-shell"]', { timeout: 30_000 })
    await use(win)
  },
})

export { expect } from '@playwright/test'
