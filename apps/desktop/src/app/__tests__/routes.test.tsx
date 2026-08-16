// @vitest-environment node
/**
 * 路由级代码分割冒烟测试（doc/23 A5）。
 *
 * 每个路由的 lazy() 必须能解析出 Component——动态导入路径写错、
 * 页面导出改名这类问题在构建期不报错、运行期才白屏，这里钉住。
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('react-router', () => ({
  createBrowserRouter: (routes: unknown) => routes,
  Navigate: () => null,
}))

/* AppShell 是静态导入的壳（拉整棵 shell 树），本测试只关心路由表 */
vi.mock('../../shell/AppShell', () => ({ AppShell: () => null }))

import { router } from '../routes'

interface LazyRoute {
  path?: string
  index?: boolean
  lazy?: () => Promise<{ Component: unknown }>
}

describe('routes 懒加载（A5，doc/23）', () => {
  const children = (router as unknown as { children: LazyRoute[] })[0].children

  it('所有页面路由均声明 lazy（无静态页面导入回潮）', () => {
    expect(children.length).toBeGreaterThan(0)
    for (const route of children) {
      expect(route.lazy, `route ${route.path ?? '(index)'} 缺少 lazy`).toBeTypeOf('function')
    }
  })

  it('每个 lazy() 均解析出 Component', async () => {
    for (const route of children) {
      const mod = await route.lazy!()
      expect(mod.Component, `route ${route.path ?? '(index)'} 未解析出 Component`).toBeTruthy()
    }
  })
})
