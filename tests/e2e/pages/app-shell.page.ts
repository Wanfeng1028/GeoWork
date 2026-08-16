import { Page, Locator, expect } from '@playwright/test'

/**
 * AppShell 页面对象 — 覆盖全局布局（侧栏 / 主工作区 / 右侧工作台）。
 * 锚点约定见 doc/20-Engineering-E2E-Testing.md §2.2。
 */
export class AppShellPage {
  readonly root: Locator
  readonly sidebar: Locator
  readonly sidebarTaskList: Locator
  readonly settingsButton: Locator
  readonly mainWorkspace: Locator
  readonly rightPanel: Locator
  readonly rightPanelExpandButton: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('app-shell')
    this.sidebar = page.getByTestId('sidebar')
    this.sidebarTaskList = page.getByTestId('sidebar-task-list')
    this.settingsButton = page.getByTestId('sidebar-settings')
    this.mainWorkspace = page.getByTestId('main-workspace')
    this.rightPanel = page.getByTestId('right-workspace-panel')
    this.rightPanelExpandButton = page.getByTestId('right-workspace-expand')
  }

  /** 打开应用并等待外壳就绪（替代固定 waitForTimeout）。 */
  async goto(path = '/') {
    await this.page.goto(path)
    await expect(this.root).toBeVisible({ timeout: 15_000 })
  }

  async openSettings() {
    await this.settingsButton.click()
    await this.page.waitForURL(/\/settings/)
  }

  /** 侧栏分段切换：tasks | channels。 */
  async switchSidebarSegment(segment: 'tasks' | 'channels') {
    await this.page.getByTestId(`sidebar-segment-${segment}`).click()
  }

  /** 右侧工作台是否处于展开态（收起态在浏览器模式渲染 expand 按钮）。 */
  async isRightPanelExpanded(): Promise<boolean> {
    return this.rightPanel.isVisible()
  }

  /** 确保右侧工作台展开（已展开则不动作）。 */
  async expandRightPanel() {
    if (!(await this.isRightPanelExpanded())) {
      await this.rightPanelExpandButton.click()
      await expect(this.rightPanel).toBeVisible()
    }
  }
}
