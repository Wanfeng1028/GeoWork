/**
 * 审批流端到端（P7-1）— 验证 Electron 安全审批状态机经 IPC 桥完整闭环。
 *
 * 覆盖 permission-forwarder 的"请求 → 待批 → 批准 → 缓存放行"状态机：
 *   1. 危险类目（screenshot）首次请求 → { allowed:false, permissionId }
 *   2. listPermissions() 能看到待批请求
 *   3. approvePermission(id) → { approved:true }
 *   4. 同类目再次请求 → { allowed:true }（命中批准缓存）
 *   5. 安全类目（platform-info）直接放行，无需审批
 *
 * 这是 Electron 壳侧的审批流（与 Go core governor 审批是两条独立链路）。
 * 全部经真实 IPC 桥往返，验证 preload→ipcMain→forwarder 装配正确。
 */
import { test, expect } from '../../fixtures/electron.fixture'

test.describe('Permission Approval Flow @integration', () => {
  test('危险类目首次请求返回 permissionId 而非直接放行', async ({ window }) => {
    const result = await window.evaluate(() =>
      (window as any).geowork.security.requestPermission('screenshot', { source: 'e2e' }),
    )
    expect(result.allowed, '危险类目首次请求不应直接放行').toBe(false)
    expect(result.permissionId, '应返回 permissionId 供后续批准').toBeTruthy()
  })

  test('待批请求出现在 listPermissions，批准后同类目缓存放行', async ({ window }) => {
    // 用一个带唯一 detail 的类目，避免与其它用例的缓存串扰
    const detail = { marker: `e2e-${Date.now()}` }
    const first = await window.evaluate(
      (d) => (window as any).geowork.security.requestPermission('clipboard:read', d),
      detail,
    )
    expect(first.allowed).toBe(false)
    const permissionId = first.permissionId
    expect(permissionId).toBeTruthy()

    // 待批列表应包含该请求
    const pending = await window.evaluate(() => (window as any).geowork.security.listPermissions())
    expect(Array.isArray(pending), 'listPermissions 应返回数组').toBe(true)
    const found = pending.some((p: any) => p.id === permissionId)
    expect(found, `待批列表应包含 ${permissionId}`).toBe(true)

    // 批准
    const approveResult = await window.evaluate(
      (id) => (window as any).geowork.security.approvePermission(id),
      permissionId,
    )
    expect(approveResult.approved, '批准应成功').toBe(true)

    // 同类目 + 同 detail 再次请求 → 命中缓存直接放行
    const second = await window.evaluate(
      (d) => (window as any).geowork.security.requestPermission('clipboard:read', d),
      detail,
    )
    expect(second.allowed, '批准后同类目应缓存放行').toBe(true)
  })

  test('拒绝后请求从待批列表移除', async ({ window }) => {
    const detail = { marker: `deny-${Date.now()}` }
    const first = await window.evaluate(
      (d) => (window as any).geowork.security.requestPermission('openLocalApp', d),
      detail,
    )
    expect(first.allowed).toBe(false)
    const permissionId = first.permissionId

    const denyResult = await window.evaluate(
      (id) => (window as any).geowork.security.denyPermission(id, 'e2e deny'),
      permissionId,
    )
    expect(denyResult.denied, '拒绝应成功').toBe(true)

    const pending = await window.evaluate(() => (window as any).geowork.security.listPermissions())
    const stillThere = pending.some((p: any) => p.id === permissionId)
    expect(stillThere, '拒绝后请求应移出待批列表').toBe(false)
  })

  test('安全类目直接放行无需审批', async ({ window }) => {
    const result = await window.evaluate(() =>
      (window as any).geowork.security.requestPermission('platform-info'),
    )
    expect(result.allowed, '安全类目应直接放行').toBe(true)
    expect(result.permissionId, '安全类目不应产生 permissionId').toBeFalsy()
  })
})
