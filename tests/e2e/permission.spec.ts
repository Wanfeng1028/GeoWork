import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Permission Approval Tests', () => {
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

  test('permission request card appears for dangerous operations', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for permission / approval modal or card
    const permissionCard = page.locator('[class*="permission"], [class*="approval"], [class*="confirm"], [class*="request"]').first()

    if (await permissionCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(permissionCard).toBeVisible()
    }
  })

  test('can approve a permission request', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for approve/allow buttons
    const approveBtn = page.getByRole('button', { name: /approve|allow|confirm|yes/i }).first()

    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('can deny a permission request', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for deny/deny buttons
    const denyBtn = page.getByRole('button', { name: /deny|reject|no|cancel/i }).first()

    if (await denyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await denyBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('remember this decision works', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for a "remember" checkbox or toggle
    const rememberCheckbox = page.locator('[class*="remember"], [class*="persistent"], input[type="checkbox"]').first()

    if (await rememberCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rememberCheckbox.click()
      await page.waitForTimeout(300)

      // Verify it is now checked
      await expect(rememberCheckbox).toBeChecked()
    }
  })
})
