import { Page, Locator, expect } from '@playwright/test'

/**
 * SenderX 页面对象 — 新任务页 antdx 输入区（doc/26 迁移后的默认组件，
 * settings.aiComponentsV2 默认 true 时渲染）。
 *
 * 根锚点是自有 `data-testid="sender-x"`；输入框与发送按钮位于 antd-x
 * Sender 内部，库不暴露 testid，退而使用其稳定 class 锚点
 * （`.ant-sender-input` / `.ant-sender-actions-list`），见
 * doc/20-Engineering-E2E-Testing.md §2.3 选择器优先级。
 */
export class SenderXPage {
  readonly root: Locator
  readonly input: Locator
  readonly sendButton: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('sender-x')
    this.input = this.root.locator('textarea.ant-sender-input')
    // 操作区还有语音按钮（allowSpeech，variant=text），发送按钮是唯一的 primary 圆钮
    this.sendButton = this.root.locator('.ant-sender-actions-list button.ant-btn-primary')
  }

  async expectVisible() {
    await expect(this.root).toBeVisible({ timeout: 15_000 })
  }

  async typePrompt(text: string) {
    await this.input.fill(text)
  }

  /** 发送当前输入（要求发送按钮可用）。 */
  async send() {
    await expect(this.sendButton).toBeEnabled()
    await this.sendButton.click()
  }
}
