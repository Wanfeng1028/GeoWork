/**
 * Electron 三进程联调 E2E 配置（P7-1）。
 *
 * 与 playwright.config.ts（纯 Chromium 渲染层）分离：
 *   - 不带 webServer：三进程由 processes.fixture 预启，Electron 由
 *     electron.fixture 经 _electron.launch() 启动构建产物
 *   - workers: 1：进程 fixture 是 worker 级，且同一时刻只能有一个 Electron 实例
 *   - testDir 只指向 projects/electron（@integration 标签）
 *
 * 前置（CI 负责，本地手动）：
 *   1. apps/desktop 已 npm run build（electron-vite build 产出 out/）
 *   2. Go 1.26+ / Python 3.11+ 在 PATH（fixture 用 go run / python 起进程）
 *
 * 运行：cd tests/e2e && npx playwright test -c playwright.electron.config.ts
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './projects/electron',
  testMatch: '**/*.spec.ts',
  // 三进程启动 + Electron 冷启动较慢，给足全局超时
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // 无 webServer：进程编排全部在 fixture 内完成
})
