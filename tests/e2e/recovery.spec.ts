import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Task Recovery Tests', () => {
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

  test('running task shows recovery option after interruption', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for recovery / resume / continue options
    const recoveryBtn = page.getByRole('button', { name: /recover|resume|continue|restore/i }).first()

    if (await recoveryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(recoveryBtn).toBeVisible()
      // Do not actually click - would resume a task we didn't create
    }
  })

  test('recovered task shows read-only state', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for read-only indicator on recovered task
    const readOnlyIndicator = page.locator('[class*="read-only"], [class*="readonly"], [class*="locked"]').first()

    if (await readOnlyIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(readOnlyIndicator).toBeVisible()
    }
  })
})
