import { test, expect } from '@playwright/test'

/**
 * 认证流程 E2E 测试
 *
 * 测试 GeoWork Cloud API 的认证相关接口。
 * 需要 cloud server 运行在 API_BASE_URL（默认 http://localhost:8767，
 * 与 server/cmd/geowork-api/main.go 的默认端口一致）。
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8767'

test.describe('认证流程测试', () => {
  test.describe('登录接口 POST /api/auth/login', () => {
    test('缺少 email 字段返回 400', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/login`, {
        data: { password: 'test123' },
      })
      expect(res.status()).toBe(400)
    })

    test('缺少 password 字段返回 400', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: 'user@example.com' },
      })
      expect(res.status()).toBe(400)
    })

    test('无效邮箱格式返回 400', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: 'not-an-email', password: 'test123' },
      })
      expect(res.status()).toBe(400)
    })

    test('错误密码返回 401', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: 'nonexistent@example.com', password: 'wrongpassword' },
      })
      // Login 对未知邮箱（未开启自动注册）与错误密码统一返回 401，
      // 不泄露用户是否存在。
      expect(res.status()).toBe(401)
    })
  })

  test.describe('登出接口 POST /api/auth/logout', () => {
    test('无 token 请求登出返回 401', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/logout`)
      expect(res.status()).toBe(401)
    })
  })

  test.describe('Token 刷新接口 POST /api/auth/refresh', () => {
    test('无 body 请求刷新返回 400', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/refresh`)
      expect(res.status()).toBe(400)
    })

    test('无效 refresh_token 返回 401', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/auth/refresh`, {
        data: { refresh_token: 'invalid-token-value' },
      })
      expect(res.status()).toBe(401)
    })
  })

  test.describe('获取当前用户 GET /api/auth/me', () => {
    test('无 Authorization header 返回 401', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/auth/me`)
      expect(res.status()).toBe(401)
    })

    test('无效 Bearer token 返回 401', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: 'Bearer invalid-token' },
      })
      expect(res.status()).toBe(401)
    })
  })

  // Class B（P0 分级）：完整登录流程需要一个已播种的测试账号，或服务器开启
  // GEOWORK_AUTO_REGISTER_ENABLED。两者默认都不保证，因此该用例无法确定性运行。
  // 显式 skip 并保留意图，待 P3 测试账号 fixture 落地后启用。
  test.describe.skip('完整登录流程 — 待 P3 测试账号 fixture', () => {
    test.skip('登录成功后可访问 /api/auth/me', async () => {
      // TODO(P3): 播种账号后：
      //   POST /api/auth/login -> 200 + access_token
      //   GET  /api/auth/me (Bearer token) -> 200 + user.email
    })
  })
})
