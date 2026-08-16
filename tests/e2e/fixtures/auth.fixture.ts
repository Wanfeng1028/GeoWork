import { test as base, expect, type APIRequestContext } from '@playwright/test'

/**
 * 认证 fixture — 为需要登录态的 API 用例提供已鉴权的 request 上下文。
 *
 * 依赖 cloud server 以 GEOWORK_AUTO_REGISTER_ENABLED=true 运行：
 * fixture 通过 POST /api/auth/login 触发自动注册（未知邮箱 + 合法密码即建号），
 * 拿到 access_token 后注入 Authorization header。
 *
 * 服务器不可达或未开启自动注册时，fixture 会显式失败（而非静默跳过），
 * 与 api-integration.spec.ts 的断言纪律一致。
 *
 * 用法：
 *   import { test } from '../fixtures/auth.fixture'
 *   test('...', async ({ authedRequest }) => { ... })
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8767'

// 固定测试账号：密码满足 ValidatePassword（≥8 位、含字母、含数字）。
const TEST_EMAIL = 'e2e-fixture@example.com'
const TEST_PASSWORD = 'E2eFixture123'

export interface AuthFixtures {
  /** 已携带 Bearer token 的 request 上下文 */
  authedRequest: APIRequestContext
  /** 裸 access_token（需要手动组 header 的场景） */
  accessToken: string
}

export const test = base.extend<AuthFixtures>({
  // worker 级：整个 worker 进程只注册/登录一次，复用 token。
  accessToken: [
    async ({ playwright }, use) => {
      const bootstrap = await playwright.request.newContext({ baseURL: API_BASE })
      const res = await bootstrap.post('/api/auth/login', {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
      })

      if (res.status() !== 200) {
        const body = await res.text().catch(() => '')
        throw new Error(
          `[auth fixture] 登录/自动注册失败 (HTTP ${res.status()})。` +
            `请确认 cloud server 已在 ${API_BASE} 运行且 GEOWORK_AUTO_REGISTER_ENABLED=true。` +
            `响应: ${body}`,
        )
      }

      const { access_token } = await res.json()
      if (!access_token) {
        throw new Error('[auth fixture] 登录响应缺少 access_token')
      }
      await bootstrap.dispose()
      await use(access_token)
    },
    { scope: 'worker' },
  ],

  authedRequest: [
    async ({ playwright, accessToken }, use) => {
      const ctx = await playwright.request.newContext({
        baseURL: API_BASE,
        extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
      })
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],
})

export { expect, API_BASE, TEST_EMAIL, TEST_PASSWORD }
