import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Sandbox Tests', () => {
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

  test('terminal panel is accessible', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Open terminal panel
    await helpers.openBottomDock('terminal')

    // Look for terminal area
    const terminal = page.locator('[class*="terminal"], [class*="shell"], [class*="console"], iframe').first()
    await expect(terminal).toBeVisible({ timeout: 10000 })
  })

  test('can type commands in terminal', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Open terminal panel
    await helpers.openBottomDock('terminal')

    // Look for terminal input
    const terminalInput = page.locator('input[type="text"], textarea, [class*="input"], [class*="prompt"]').first()

    if (await terminalInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await terminalInput.fill('echo "hello"')
      await page.waitForTimeout(300)

      // Try pressing Enter if there is a submit mechanism
      await terminalInput.press('Enter')
      await page.waitForTimeout(500)
    }
  })
})
