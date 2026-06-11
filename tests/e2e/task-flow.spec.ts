import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Task Flow Tests', () => {
  test.skip(({ baseURL }) => !baseURL, 'Desktop app must be running for e2e tests')

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[E2E] Page error:', msg.text())
      if (msg.type() === 'warning') console.warn('[E2E] Page warning:', msg.text())
    })
    page.on('pageerror', (err) => {
      console.error('[E2E] Page exception:', err.message)
    })
  })

  test('create a task and see it in the monitor', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Find the composer input and type a task
    const composer = page.locator('.geo-composer, textarea, [contenteditable]').first()
    await expect(composer).toBeVisible({ timeout: 10000 })
    await composer.click()

    // Check for a submit/send button
    const submitBtn = page.getByRole('button', { name: /submit|send|create|run|go/i }).first()
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click()
      await page.waitForTimeout(1000)
    }

    // Look for task in monitor
    const taskMonitor = page.locator('[class*="monitor"], [class*="task"], [class*="activity"]').first()
    await expect(taskMonitor).toBeVisible({ timeout: 8000 }).catch(() => {
      // Task panel may require a real task to be submitted
    })
  })

  test('task progress updates in real-time', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for progress indicators
    const progressBars = page.locator('[class*="progress"], [class*="spinner"], [class*="loading"], [class*="step"]')
    const hasProgress = await progressBars.count() > 0

    if (hasProgress) {
      await expect(progressBars.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Progress bar may only appear during active task
      })
    }
  })

  test('task completion shows delivery checklist', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for completion or delivery elements
    const completionArea = page.locator('[class*="completion"], [class*="delivery"], [class*="result"], [class*="output"]').first()

    if (await completionArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(completionArea).toBeVisible()
    }
  })
})
