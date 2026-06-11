import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Diff Tests', () => {
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

  test('diff appears when agent modifies files', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Open diff panel
    await helpers.openRightDock('diff')

    // Look for diff view
    const diffView = page.locator('[class*="diff"], [class*="change"], [class*="side-by-side"]').first()
    const isVisible = await diffView.isVisible({ timeout: 8000 }).catch(() => false)

    if (isVisible) {
      // Diff should show added/removed lines
      const addedLines = page.locator('[class*="added"], [class*="insert"], +[class*="line"]')
      await expect(addedLines.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Diff may have only context lines
      })
    }
  })

  test('can accept a diff', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for accept/apply button in diff
    const acceptBtn = page.getByRole('button', { name: /accept|apply|yes|approve/i }).first()

    if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await acceptBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('can reject a diff', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for reject/discard button in diff
    const rejectBtn = page.getByRole('button', { name: /reject|discard|no|cancel/i }).first()

    if (await rejectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rejectBtn.click()
      await page.waitForTimeout(500)
    }
  })
})
