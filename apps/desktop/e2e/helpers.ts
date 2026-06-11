// GeoWork E2E Test Setup
// Shared test utilities for E2E tests

import { expect } from 'vitest'
import { Page } from 'playwright-core'

// Test utilities for E2E tests
export const E2ETestHelpers = {
  // Wait for app to be ready
  waitForAppReady: async (page: Page) => {
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await expect(page.locator('.app-shell')).toBeVisible()
  },

  // Wait for sidebar to load
  waitForSidebar: async (page: Page) => {
    await page.waitForSelector('.left-sidebar', { timeout: 5000 })
  },

  // Wait for composer to load
  waitForComposer: async (page: Page) => {
    await page.waitForSelector('.geo-composer', { timeout: 5000 })
  },

  // Wait for dock panel to load
  waitForDock: async (page: Page, panelType: string) => {
    await page.waitForSelector(`.right-dock.${panelType}`, { timeout: 5000 })
  },

  // Take screenshot with context
  screenshotWithLabel: async (page: Page, label: string) => {
    const timestamp = Date.now()
    await page.screenshot({
      path: `e2e/screenshots/${label}-${timestamp}.png`,
      fullPage: true,
    })
  },

  // Wait for task event
  waitForTaskEvent: async (page: Page, eventType: string) => {
    await page.waitForSelector(`[data-event-type="${eventType}"]`, {
      timeout: 10000,
    })
  },

  // Verify permission card
  verifyPermissionCard: async (page: Page, action: string) => {
    await page.waitForSelector('.approval-card')
    const card = page.locator('.approval-card')
    await expect(card.locator(`[data-action="${action}"]`)).toBeVisible()
  },
}

// Test data fixtures
export const TestFixtures = {
  mockWorkspace: {
    id: 'test-ws-001',
    name: 'E2E Test Workspace',
    rootPath: '/tmp/geowork-test',
    storageMode: 'local',
  },

  mockTask: {
    id: 'test-task-001',
    workspaceId: 'test-ws-001',
    mode: 'Analysis',
    permissionLevel: 'limited',
    status: 'running',
  },

  mockArtifact: {
    id: 'test-art-001',
    taskId: 'test-task-001',
    type: 'code' as const,
    name: 'test_script.py',
    path: '/workspace/scripts/test_script.py',
  },

  mockPermissionRequest: {
    id: 'test-perm-001',
    taskId: 'test-task-001',
    action: 'run_python' as const,
    title: 'Run Python Script',
    description: 'Execute NDVI analysis script',
    riskLevel: 'high' as const,
  },
}

// Assertion helpers
export const E2EAssertions = {
  // Verify UI element exists
  expectElementVisible: async (page: Page, selector: string) => {
    await expect(page.locator(selector)).toBeVisible()
  },

  // Verify element does not exist
  expectElementHidden: async (page: Page, selector: string) => {
    await expect(page.locator(selector)).toBeHidden()
  },

  // Verify text content
  expectText: async (page: Page, selector: string, text: string) => {
    await expect(page.locator(selector)).toHaveText(text)
  },

  // Verify component renders correctly
  expectComponent: async (page: Page, componentName: string) => {
    await expect(page.locator(`[data-component="${componentName}"]`)).toBeVisible()
  },
}
