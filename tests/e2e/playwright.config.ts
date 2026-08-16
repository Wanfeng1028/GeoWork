import { defineConfig, devices } from '@playwright/test'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// desktop 应用目录（renderer 独立 dev server 从这里启动）
// package.json 为 "type": "module"，ESM 下没有 __dirname。
const here = dirname(fileURLToPath(import.meta.url))
const desktopDir = resolve(here, '../../apps/desktop')

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 自包含：由 Playwright 启动独立的 renderer dev server（不依赖 Electron）。
  // 若已通过 BASE_URL 指向外部服务，则跳过自动启动（reuseExistingServer）。
  webServer: {
    command: 'npm run dev:e2e',
    cwd: desktopDir,
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
