import { test, expect } from '@playwright/test'
import { createHelpers } from './helpers/app-helpers'

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
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[E2E] Page error:', msg.text())
      if (msg.type() === 'warning') console.warn('[E2E] Page warning:', msg.text())
    })
    page.on('pageerror', (err) => {
      console.error('[E2E] Page exception:', err.message)
    })
  })

  test('app loads and composer input is visible', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Composer 是新建任务的入口，必须存在且可见。
    const composer = page.locator('.geo-composer, textarea, [contenteditable]').first()
    await expect(composer).toBeVisible({ timeout: 10000 })
  })

  // Class B（P0 分级）：以下用例需要真实后端 + LLM 驱动一次任务执行，
  // 才能观察到监控面板 / 实时进度 / 交付清单。在任务 fixture（mock SSE 流
  // 或种子任务）落地之前无法确定性运行，显式 skip 并保留意图。
  test.describe.skip('任务执行流程 — 待任务 fixture（mock SSE / 种子任务）', () => {
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
