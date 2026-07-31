import { test, expect } from '@playwright/test'

/**
 * 认证流程 E2E 测试
 *
 * 测试 GeoWork Cloud API 的认证相关接口。
 * 需要 cloud server 运行在 API_BASE_URL（默认 http://localhost:8080）。
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'

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
      // 401 或 404 均可接受（取决于是否隐藏用户存在信息）
      expect([401, 404]).toContain(res.status())
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

  test.describe('完整登录流程（如已注册测试账号）', () => {
    test('登录成功后可访问 /api/auth/me', async ({ request }) => {
      // 尝试登录（如果自动注册开启或测试账号已存在）
      const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { email: 'test@geowork.local', password: 'Test@123456' },
      })

      const { access_token } = await loginRes.json()
      expect(access_token).toBeTruthy()

      // 用 token 访问 /me
      const meRes = await request.get(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      expect(meRes.status()).toBe(200)
      const user = await meRes.json()
      expect(user).toHaveProperty('email')
    })
  })
})
