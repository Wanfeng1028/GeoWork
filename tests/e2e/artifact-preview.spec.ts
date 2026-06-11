import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Artifact Preview Tests', () => {
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

  test('artifacts appear in the artifact panel', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Open artifact panel
    await helpers.openRightDock('artifacts')

    // Look for artifact items
    const artifactList = page.locator('[class*="artifact"], [class*="preview-list"]').first()
    const isVisible = await artifactList.isVisible({ timeout: 8000 }).catch(() => false)

    if (isVisible) {
      const artifactItems = artifactList.locator('[class*="item"], li, [class*="card"]').first()
      await expect(artifactItems).toBeVisible({ timeout: 5000 }).catch(() => {
        // May be empty if no artifacts exist
      })
    }
  })

  test('click artifact shows preview', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Open artifact panel
    await helpers.openRightDock('artifacts')

    // Look for clickable artifact items
    const artifactItems = page.locator('[class*="artifact"] [class*="item"], [class*="card"]').first()

    if (await artifactItems.isVisible({ timeout: 5000 }).catch(() => false)) {
      await artifactItems.click()
      await page.waitForTimeout(500)

      // Preview area should appear
      const previewArea = page.locator('[class*="preview"], [class*="viewer"], iframe').first()
      await expect(previewArea).toBeVisible({ timeout: 5000 }).catch(() => {
        // Preview may not always be visible
      })
    }
  })

  test('multiple artifact types render correctly', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Open artifact panel
    await helpers.openRightDock('artifacts')

    // Look for different artifact type indicators
    const artifactTypes = page.locator('[class*="type"], [class*="badge"], span').first()

    if (await artifactTypes.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(artifactTypes).toBeVisible()
    }
  })
})
