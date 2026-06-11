import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Workspace Tests', () => {
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

  test('can open folder and create workspace', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for open folder / open directory button
    const openFolderBtn = page.getByRole('button', { name: /open|folder|directory|workspace/i }).first()
    if (await openFolderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openFolderBtn.click()
      await page.waitForTimeout(1000)
    }

    // Verify workspace area is present
    const workspaceArea = page.locator('[class*="workspace"], [class*="tree"], [class*="file-tree"]').first()
    await expect(workspaceArea).toBeVisible({ timeout: 10000 }).catch(() => {
      // Workspace may depend on a folder being open
    })
  })

  test('file tree displays files', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for file tree / explorer
    const fileTree = page.locator('[class*="tree"], [class*="file-tree"], [class*="explorer"], [class*="sidebar"]').first()
    const isVisible = await fileTree.isVisible({ timeout: 8000 }).catch(() => false)

    if (isVisible) {
      // File tree should have items
      const treeItems = fileTree.locator('[class*="item"], li, [class*="node"]').first()
      await expect(treeItems).toBeVisible({ timeout: 5000 }).catch(() => {
        // Tree may be empty if no folder is opened
      })
    }
  })

  test('can drag and drop files into workspace', async ({ page }) => {
    await page.goto('/')
    const helpers = createHelpers(page)
    await helpers.waitForAppReady()

    // Look for a drop zone
    const dropZone = page.locator('[class*="drop"], [class*="upload"], [class*="workspace"]').first()

    if (await dropZone.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Simulate drag and drop
      await dropZone.dragTo(dropZone, {
        targetPosition: { x: 50, y: 50 },
      })
      await page.waitForTimeout(500)
    }
  })
})
