import { test, expect } from '@playwright/test'
import { test as authTest } from './fixtures/auth.fixture'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 *
 * OpenAPI 契约（P5）：端点清单读取 server/internal/api/testdata/openapi.json
 * （单一事实源，由 server 侧 TestOpenAPISpecInSync 保证与代码一致）。
 */

const here = dirname(fileURLToPath(import.meta.url))
const specPath = resolve(here, '../../server/internal/api/testdata/openapi.json')
const endpointSpec = JSON.parse(readFileSync(specPath, 'utf-8')) as {
  paths: Record<string, Record<string, { operationId: string }>>
}

// 展开为 (method, path, operationId) 平面清单。
const specEndpoints: Array<{ method: string; path: string; operationId: string }> = []
for (const [path, ops] of Object.entries(endpointSpec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    specEndpoints.push({ method: method.toUpperCase(), path, operationId: op.operationId })
  }
}

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

  // CRUD 用例依赖已登录态：由 fixtures/auth.fixture.ts 通过
  // GEOWORK_AUTO_REGISTER_ENABLED=true 的自动注册登录提供 authedRequest。
  authTest.describe('CRUD 操作（需登录）', () => {
    authTest('创建和获取 Model Provider', async ({ authedRequest }) => {
      const create = await authedRequest.post('/api/model/providers', {
        data: {
          id: 'e2e-provider',
          name: 'E2E Provider',
          base_url: 'http://localhost:11434/v1',
          api_key: 'sk-e2e-test-key',
        },
      })
      expect(create.status()).toBe(201)
      const created = await create.json()
      expect(created.api_key).toBe('***') // 密钥必须脱敏返回

      const list = await authedRequest.get('/api/model/providers')
      expect(list.status()).toBe(200)
      const providers = await list.json()
      expect(Array.isArray(providers)).toBe(true)
      expect(providers.some((p: { name: string }) => p.name === 'E2E Provider')).toBe(true)
    })

    authTest('列出 Teams', async ({ authedRequest }) => {
      const res = await authedRequest.get('/api/teams')
      expect(res.status()).toBe(200)
      const teams = await res.json()
      expect(Array.isArray(teams)).toBe(true)
    })

    authTest('获取 Usage Summary', async ({ authedRequest }) => {
      const res = await authedRequest.get('/api/usage/summary')
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(typeof body).toBe('object')
    })

    authTest('获取 Billing Plan', async ({ authedRequest }) => {
      const res = await authedRequest.get('/api/billing/plan')
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(typeof body).toBe('object')
    })
  })

  // OpenAPI 契约（P5）：spec 中的每个端点必须在真实 server 上存在。
  // 无认证探测的合法结果是 401（保护路由）/ 400/422（公开路由参数校验）
  // / 200（公开读），404 意味着 spec 与部署的路由表漂移——正是要拦的缺陷。
  // 路径参数替换为哑值（:id → 1）；POST 不带 body，公开端点只会得到参数
  // 校验错误，不会产生副作用。
  test.describe('OpenAPI 契约 — spec 端点存在性（非 404）', () => {
    for (const ep of specEndpoints) {
      test(`${ep.method} ${ep.path} [${ep.operationId}]`, async ({ request }) => {
        const concretePath = ep.path.replace(/:[A-Za-z]+/g, '1')
        const res = await request.fetch(`${API_BASE}${concretePath}`, {
          method: ep.method,
        })
        expect(
          res.status(),
          `${ep.operationId}: spec 声明存在但返回 404，路由表与 openapi.json 漂移`,
        ).not.toBe(404)
      })
    }
  })
})
