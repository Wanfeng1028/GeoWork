import { Page, expect } from '@playwright/test'

export class AppHelpers {
  constructor(private page: Page) {}

  async waitForAppReady() {
    // Wait for the app to be ready
    await this.page.waitForTimeout(2000)
  }

  async verifySidebarVisible() {
    const sidebar = this.page.locator('.left-sidebar')
    await expect(sidebar).toBeVisible()
  }

  async verifyComposerVisible() {
    const composer = this.page.locator('.geo-composer')
    await expect(composer).toBeVisible()
  }

  async verifyRightDockVisible() {
    const dock = this.page.locator('.right-dock')
    await expect(dock).toBeVisible()
  }

  async switchMode(mode: 'work' | 'code' | 'paper' | 'ppt') {
    const modeBtn = this.page.getByRole('button', { name: new RegExp(mode, 'i') })
    await modeBtn.click()
    await this.page.waitForTimeout(500)
  }

  async openRightDock(panel: 'task' | 'artifacts' | 'diff' | 'context') {
    // Click the panel toggle
    const panelBtn = this.page.getByRole('button', { name: panel })
    await panelBtn.click()
    await this.page.waitForTimeout(500)
  }

  async openBottomDock(panel: 'terminal' | 'browser' | 'logs') {
    const panelBtn = this.page.getByRole('button', { name: panel })
    await panelBtn.click()
    await this.page.waitForTimeout(500)
  }
}

export function createHelpers(page: Page) {
  return new AppHelpers(page)
}
