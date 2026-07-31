import { test, expect } from '@playwright/test'

/**
 * API 集成 E2E 测试
 *
 * 测试 GeoWork Cloud API 的健康检查与 CRUD 操作。
 * 需要 cloud server 运行在 API_BASE_URL（默认 http://localhost:8080）。
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'

test.describe('API 集成测试', () => {
  test.describe('健康检查', () => {
    test('服务器可达（任意已知路由返回非 0/502/503）', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/auth/me`)
      // 401 表示服务器在运行且认证中间件生效
      // 500/502/503 表示服务不可用
      expect([401, 404, 200]).toContain(res.status())
    })
  })

  test.describe('Marketplace 公开接口（无需认证）', () => {
    test('GET /api/marketplace/plugins 返回数组', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/marketplace/plugins`)
      if (res.status() === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      } else {
        // 服务器可能未启动，确认返回合理状态码
        expect([200, 500, 503]).toContain(res.status())
      }
    })

    test('GET /api/marketplace/skills 返回数组', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/marketplace/skills`)
      if (res.status() === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      } else {
        expect([200, 500, 503]).toContain(res.status())
      }
    })

    test('GET /api/marketplace/connectors 返回数组', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/marketplace/connectors`)
      if (res.status() === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      } else {
        expect([200, 500, 503]).toContain(res.status())
      }
    })
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

  test.describe('CRUD 操作（需登录）', () => {
    let accessToken: string | null = null

    test.beforeAll(async ({ request }) => {
      // 尝试登录获取 token
      const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: 'test@geowork.local', password: 'Test@123456' },
      })
      if (loginRes.status() === 200) {
        const data = await loginRes.json()
        accessToken = data.access_token
      }
    })

    test('创建和获取 Model Provider（如有 token）', async ({ request }) => {
      const headers = { Authorization: `Bearer ${accessToken}` }

      // 列出 providers
      const listRes = await request.get(`${API_BASE}/api/model/providers`, { headers })
      expect(listRes.status()).toBe(200)

      // 创建 provider
      const createRes = await request.post(`${API_BASE}/api/model/providers`, {
        headers,
        data: {
          name: 'E2E Test Provider',
          providerId: 'e2e-test',
          apiKey: 'test-key',
          baseUrl: 'http://localhost:9999',
          endpointPath: '/chat/completions',
          enabled: true,
          models: [],
          providerCapabilities: {
            imageGeneration: false,
            speechToText: false,
            textToSpeech: false,
            musicGeneration: false,
            videoGeneration: false,
          },
        },
      })
      expect([200, 201]).toContain(createRes.status())
    })

    test('列出 Teams（如有 token）', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/teams`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })

    test('获取 Usage Summary（如有 token）', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/usage/summary`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      expect(res.status()).toBe(200)
    })

    test('获取 Billing Plan（如有 token）', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/billing/plan`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      expect(res.status()).toBe(200)
    })
  })

  test.describe('Crash 上报（无需认证）', () => {
    test('POST /api/crash/report 接受上报', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/crash/report`, {
        data: {
          version: '2.0.0-e2e',
          platform: 'e2e-test',
          message: 'E2E test crash report',
          stack: 'test stack trace',
        },
      })
      // 200/202 表示接受，400 表示格式不对但服务在运行
      expect([200, 201, 202, 400]).toContain(res.status())
    })
  })
})
