import { test, expect } from '@playwright/test'

/**
 * API 集成 E2E 测试
 *
 * 测试 GeoWork Cloud API 的健康检查、公开接口与认证矩阵。
 * 需要 cloud server 运行在 API_BASE_URL（默认 http://localhost:8767，
 * 与 server/cmd/geowork-api/main.go 的默认端口一致）。
 *
 * 断言纪律（P0）：
 * - 每个断言都有明确的失败语义，禁止 "接受 500/503" 式的宽泛断言。
 * - 服务器不可达时测试应当失败（连接错误），而不是静默通过。
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8767'

test.describe('API 集成测试', () => {
  test.describe('健康检查', () => {
    test('GET /health 返回 200 且 status 为 ok', async ({ request }) => {
      const res = await request.get(`${API_BASE}/health`)
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
      expect(body).toHaveProperty('version')
    })
  })

  test.describe('Marketplace 公开接口（无需认证）', () => {
    // 这些接口在 server/internal/api/routes.go 中注册为公开 GET，
    // 返回数组。若服务器在运行，必须返回 200 + 数组；否则测试应失败。
    const publicListRoutes = [
      '/api/marketplace/plugins',
      '/api/marketplace/skills',
      '/api/marketplace/connectors',
    ]

    for (const path of publicListRoutes) {
      test(`GET ${path} 返回 200 且为数组`, async ({ request }) => {
        const res = await request.get(`${API_BASE}${path}`)
        expect(res.status()).toBe(200)
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      })
    }
  })

  test.describe('需认证接口 — 无 token 时返回 401', () => {
    const protectedRoutes: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/api/account/profile' },
      { method: 'GET', path: '/api/usage/summary' },
      { method: 'GET', path: '/api/billing/plan' },
      { method: 'GET', path: '/api/teams' },
      { method: 'GET', path: '/api/sync/state' },
      { method: 'GET', path: '/api/channels' },
      { method: 'GET', path: '/api/rbac/roles' },
      { method: 'GET', path: '/api/model/providers' },
    ]

    for (const route of protectedRoutes) {
      test(`${route.method} ${route.path} 无 token 返回 401`, async ({ request }) => {
        const res = await request.fetch(`${API_BASE}${route.path}`, {
          method: route.method,
        })
        expect(res.status()).toBe(401)
      })
    }
  })

  test.describe('Crash 上报', () => {
    // server/internal/crash/service.go 要求 X-Crash-Opt-In: true 头，
    // 且字段为 app_version / os（不是 version / platform）。
    test('未开启 opt-in 时返回 403', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/crash/report`, {
        data: {
          app_version: '2.0.0-e2e',
          os: 'e2e-test',
          message: 'E2E test crash report',
          stacktrace: 'test stack trace',
        },
      })
      expect(res.status()).toBe(403)
    })

    test('开启 opt-in 且字段完整时返回 200', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/crash/report`, {
        headers: { 'X-Crash-Opt-In': 'true' },
        data: {
          app_version: '2.0.0-e2e',
          os: 'e2e-test',
          message: 'E2E test crash report',
          stacktrace: 'test stack trace',
        },
      })
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('crash report received')
    })

    test('开启 opt-in 但缺少必填字段时返回 400', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/crash/report`, {
        headers: { 'X-Crash-Opt-In': 'true' },
        data: { message: 'missing required fields' },
      })
      expect(res.status()).toBe(400)
    })
  })

  // Class B（P0 分级）：以下 CRUD 用例意图明确（验证带认证的增删查），
  // 但依赖一个已注册/已播种的测试账号才能拿到 token。在测试数据 fixture
  // 落地（P3）之前，它们无法确定性运行，故显式 skip 并保留意图，
  // 而不是用 "如有 token" 的条件分支静默通过。
  test.describe.skip('CRUD 操作（需登录）— 待 P3 测试账号 fixture', () => {
    test.skip('创建和获取 Model Provider', async () => {
      // TODO(P3): 用播种账号登录拿 token 后：
      //   GET  /api/model/providers -> 200 数组
      //   POST /api/model/providers -> 200/201
    })
    test.skip('列出 Teams', async () => {
      // TODO(P3): GET /api/teams -> 200 数组
    })
    test.skip('获取 Usage Summary', async () => {
      // TODO(P3): GET /api/usage/summary -> 200
    })
    test.skip('获取 Billing Plan', async () => {
      // TODO(P3): GET /api/billing/plan -> 200
    })
  })
})
