import { Page, Locator, expect } from '@playwright/test'

export type ComposerMode =
  | 'general'
  | 'spatial'
  | 'cartography'
  | 'paper'
  | 'query'
  | 'remote-sensing'

/**
 * ChatComposer 页面对象 — 新任务页输入区。
 * 锚点约定见 doc/20-Engineering-E2E-Testing.md §2.2。
 */
export class ChatComposerPage {
  readonly root: Locator
  readonly input: Locator
  readonly modeButton: Locator
  readonly sendButton: Locator
  readonly stopButton: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('chat-composer')
    this.input = page.getByTestId('chat-composer-input')
    this.modeButton = page.getByTestId('chat-composer-mode')
    this.sendButton = page.getByTestId('chat-composer-send')
    this.stopButton = page.getByTestId('chat-composer-stop')
  }

  async expectVisible() {
    await expect(this.root).toBeVisible({ timeout: 15_000 })
  }

  async typePrompt(text: string) {
    await this.input.fill(text)
  }

  /** 打开模式下拉并选择指定模式。 */
  async selectMode(mode: ComposerMode) {
    await this.modeButton.click()
    await this.page.getByTestId(`mode-option-${mode}`).click()
  }

  /** 发送当前输入（要求发送按钮可用）。 */
  async send() {
    await expect(this.sendButton).toBeEnabled()
    await this.sendButton.click()
  }
}
