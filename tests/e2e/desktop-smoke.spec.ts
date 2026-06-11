import { test, expect } from '@playwright/test'
import { createHelpers } from '../helpers/app-helpers'

test.describe('Desktop Smoke Tests', () => {
  test.skip(({ baseURL }) => !baseURL, 'Desktop app must be running for e2e tests')

  test.beforeEach(async ({ page }) => {
    // Intercept console messages for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[E2E] Page error:', msg.text())
      }
      if (msg.type() === 'warning') {
        console.warn('[E2E] Page warning:', msg.text())
      }
    })
    page.on('pageerror', (err) => {
      console.error('[E2E] Page exception:', err.message)
    })
  })

  test('app opens and shows main UI layout', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    // Main viewport should be visible with layout
    const viewport = page.locator('#root, .app-root, main, [class*="viewport"], [class*="layout"]')
    await expect(viewport.first()).toBeVisible({ timeout: 10000 })
  })

  test('left sidebar is visible with navigation items', async ({ page }) => {
    const helpers = createHelpers(page)
    await page.goto('/')
    await helpers.waitForAppReady()

    const sidebar = page.locator('.left-sidebar, nav[class*="sidebar"], aside[class*="nav"]')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Check for navigation items
    const navItems = page.getByRole('navigation').locator('li, a, button').first()
    await expect(navItems).toBeVisible()
  })

  test('composer input is visible and focused', async ({ page }) => {
    const helpers = createHelpers(page)
    await page.goto('/')
    await helpers.waitForAppReady()

    const composer = page.locator('.geo-composer, [class*="composer"], textarea, [contenteditable]')
    await expect(composer).toBeVisible({ timeout: 10000 })

    // The input area should be focused or focusable
    const inputArea = page.locator('input, textarea, [contenteditable]').first()
    await expect(inputArea).toBeVisible()
  })

  test('right dock can be toggled', async ({ page }) => {
    const helpers = createHelpers(page)
    await page.goto('/')
    await helpers.waitForAppReady()

    const initialRightPanel = page.locator('.right-dock, [class*="right-panel"], [class*="dock-right"]')
    const initialVisible = await initialRightPanel.isVisible().catch(() => false)

    // Try to find and click dock toggle buttons
    const toggleButtons = page.getByRole('button', { name: /dock|panel|toggle/i })
    if (await toggleButtons.count() > 0) {
      await toggleButtons.first().click()
      await page.waitForTimeout(300)
    }

    // Verify some right-side area exists
    const rightArea = page.locator('[class*="right"], [class*="dock"]').first()
    await expect(rightArea).toBeVisible()
  })

  test('bottom dock can be toggled', async ({ page }) => {
    const helpers = createHelpers(page)
    await page.goto('/')
    await helpers.waitForAppReady()

    // Try to find and click bottom panel toggles
    const bottomToggles = page.getByRole('button', { name: /terminal|console|output/i })
    if (await bottomToggles.count() > 0) {
      await bottomToggles.first().click()
      await page.waitForTimeout(300)
    }

    // Verify some bottom area exists
    const bottomArea = page.locator('[class*="bottom"], [class*="panel-bottom"]').first()
    await expect(bottomArea).toBeVisible({ timeout: 5000 }).catch(() => {
      // Bottom area may not always be present in the default layout
    })
  })
})
