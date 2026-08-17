import { test, expect } from '@playwright/test'
import { AppShellPage } from './pages/app-shell.page'
import { SenderXPage } from './pages/sender-x.page'

/**
 * 桌面冒烟测试 — CI PR 门禁子集（@smoke）。
 * 全部走 data-testid 锚点 + Page Object，见 doc/20-Engineering-E2E-Testing.md。
 */
test.describe('Desktop Smoke Tests @smoke', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error('[E2E] Page exception:', err.message)
    })
  })

  test('app opens and renders the shell', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/')
    await expect(shell.mainWorkspace).toBeVisible()
  })

  test('left sidebar is visible', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/')
    await expect(shell.sidebar).toBeVisible()
  })

  test('composer input is visible on new task page', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/new-task')
    const composer = new SenderXPage(page)
    await composer.expectVisible()
    await expect(composer.input).toBeVisible()
  })

  test('composer send button is disabled until text is entered', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/new-task')
    const composer = new SenderXPage(page)
    await composer.expectVisible()

    await expect(composer.sendButton).toBeDisabled()
    await composer.typePrompt('测试任务')
    await expect(composer.sendButton).toBeEnabled()
  })

  test('settings button navigates to settings page', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/')
    await shell.openSettings()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('right workspace panel can be expanded', async ({ page }) => {
    const shell = new AppShellPage(page)
    await shell.goto('/')
    await shell.expandRightPanel()
    await expect(shell.rightPanel).toBeVisible()
  })
})
