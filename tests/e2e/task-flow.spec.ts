import { test, expect } from '@playwright/test'
import { AppShellPage } from './pages/app-shell.page'
import { ChatComposerPage } from './pages/chat-composer.page'

/**
 * 任务流程 E2E 测试
 *
 * 断言纪律（P0）：
 * - 可确定性验证的部分（应用加载、composer 可见）使用硬断言。
 * - 依赖真实后端 + LLM 才能产生任务/进度/交付物的部分，在没有测试 fixture
 *   之前无法确定性运行，显式 skip 并保留意图（Class B），而不是用
 *   .catch(() => {}) 吞掉断言静默通过。
 */

test.describe('Task Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error('[E2E] Page exception:', err.message)
    })
  })

  test('app loads and composer input is visible', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/new-task')

    // Composer 是新建任务的入口，必须存在且可见。
    const composer = new ChatComposerPage(page)
    await composer.expectVisible()
    await expect(composer.input).toBeVisible()
  })

  // Class B：以下用例需要真实 Go core（8765）+ LLM 驱动一次任务执行，
  // 才能观察到监控面板 / 实时进度 / 交付清单。当前 E2E 拓扑只启动渲染层
  // （vite.e2e.config.ts），不启动 core/worker。待 mock SSE 流或种子任务
  // fixture 落地后启用（依赖项见 doc/20-Engineering-E2E-Testing.md §1）。
  test.describe.skip('任务执行流程 — 待 mock SSE / 种子任务 fixture（需 Go core）', () => {
    test.skip('create a task and see it in the monitor', async () => {
      // TODO: 提交任务后，断言任务监控面板出现该任务条目（硬断言）。
    })

    test.skip('task progress updates in real-time', async () => {
      // TODO: 任务执行中断言进度指示器随 SSE 事件更新（硬断言）。
    })

    test.skip('task completion shows delivery checklist', async () => {
      // TODO: 任务完成后断言交付清单渲染（硬断言）。
    })
  })
})
