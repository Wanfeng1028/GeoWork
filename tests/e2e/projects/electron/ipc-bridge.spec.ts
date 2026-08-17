/**
 * IPC 桥端到端（P7-1）— 验证 preload 暴露的 window.geowork 真实可达 Go core。
 *
 * 这是当前 E2E 的最大盲区：纯 Chromium 渲染层对 window.geowork 全可选链，
 * IPC 桥从未被测过。本 spec 在真实 Electron 壳里断言：
 *   1. window.geowork 由 preload 注入（非 undefined）
 *   2. runtime.health() 经 IPC → Go core(8765) 返回 status=ok
 *   3. runtime.getStatus() 报告 goCore/cloudServer 均 running
 *   4. runtime.checkHealth() 报告两服务 healthy
 *
 * 依赖 processes fixture 预启三进程（Electron 检测端口占用跳过自启）。
 */
import { test, expect } from '../../fixtures/electron.fixture'

test.describe('IPC Bridge @integration', () => {
  test('window.geowork 由 preload 注入', async ({ window }) => {
    const hasBridge = await window.evaluate(() => {
      const g = (window as any).geowork
      return typeof g === 'object' && g !== null && typeof g.runtime === 'object'
    })
    expect(hasBridge, 'window.geowork.runtime 应存在（preload contextBridge 注入）').toBe(true)
  })

  test('runtime.health() 经 IPC 到达 Go core 并返回 ok', async ({ window }) => {
    const health = await window.evaluate(() => (window as any).geowork.runtime.health())
    expect(health, 'health 响应应为对象').toBeTruthy()
    expect(health.status, 'core /api/diagnostics/health 应返回 status=ok').toBe('ok')
    expect(health.go_version, '应携带 go_version').toBeTruthy()
  })

  test('runtime.getStatus() 报告 goCore 与 cloudServer 均 running', async ({ window }) => {
    const status = await window.evaluate(() => (window as any).geowork.runtime.getStatus())
    expect(status.goCore, 'goCore 状态应存在').toBeTruthy()
    expect(status.cloudServer, 'cloudServer 状态应存在').toBeTruthy()
    // 预启进程已占用端口，Electron startRuntime 走 isPortInUse 分支标记 running
    expect(status.goCore.status, 'goCore 应为 running').toBe('running')
    expect(status.cloudServer.status, 'cloudServer 应为 running').toBe('running')
  })

  test('runtime.checkHealth() 报告两服务 healthy', async ({ window }) => {
    const health = await window.evaluate(() => (window as any).geowork.runtime.checkHealth())
    expect(health.goCore, 'goCore 应 healthy').toBe('healthy')
    expect(health.cloudServer, 'cloudServer 应 healthy').toBe('healthy')
  })
})
