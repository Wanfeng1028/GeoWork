# GeoWork 测试规范

> **文档路径**：`doc/Engineering-Testing.md`
> **关联文档**：`GeoWorkFrontend-Engineering-Standards.md`（测试策略 §3）/ `Engineering-CI-CD.md`（CI 门禁）
> **适用对象**：所有贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：升级现有测试策略，补充集成测试、视觉回归、E2E 计划、测试数据管理 |

---

## 1. 测试分层

| 层级 | 工具 | 覆盖目标 | 运行速度 |
|---|---|---|---|
| 单元测试 | Vitest + jsdom | Store / Hook / 工具函数 | < 1s |
| 组件测试 | Vitest + @testing-library/react | 组件交互逻辑 | < 3s |
| 集成测试 | Vitest + MSW | 组件 + Store + Mock API 联动 | < 5s |
| 视觉回归 | Playwright screenshot | 关键页面截图对比 | < 30s |
| E2E 测试 | Playwright | 核心用户流程 | < 2min |

---

## 2. 覆盖要求（升级）

| 层级 | 要求 |
|---|---|
| Store | **必须**有单元测试，覆盖所有 action |
| Hook | **必须**有单元测试 |
| API 客户端 | **必须**有单元测试（mock fetch/EventSource） |
| 页面组件 | 至少 1 个 smoke test + 关键交互测试 |
| 纯展示组件 | 鼓励写，不强制 |
| 集成测试 | 关键流程必须有（新建任务 → Agent 执行 → 审批 → 完成） |
| E2E | 核心路径必须有（待 Playwright 配置后实施） |

---

## 3. 集成测试规范

### 3.1 Mock API

使用 **MSW（Mock Service Worker）** 模拟 Go Core 的 HTTP + SSE 响应：

```typescript
// src/__tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/conversations', () => {
    return HttpResponse.json({ data: [], total: 0 })
  }),
  
  http.post('/api/conversations', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ data: { id: 'conv_test', ...body } }, { status: 201 })
  }),
]
```

### 3.2 测试结构

```typescript
describe('NewTaskPage', () => {
  beforeEach(() => {
    // 重置 Store 状态
    // 设置 MSW handlers
  })

  it('should render empty state', () => {
    // ...
  })

  it('should send message and show streaming response', async () => {
    // 1. 输入消息
    // 2. 点击发送
    // 3. 验证 SSE 事件被正确处理
    // 4. 验证 UI 更新
  })
})
```

---

## 4. 视觉回归测试

### 4.1 策略

使用 Playwright 对关键页面截图，与基线图片对比：

```bash
# 生成基线
npx playwright test --update-snapshots

# 对比检查
npx playwright test
```

### 4.2 覆盖页面

| 页面 | 明暗各一张 | 说明 |
|---|---|---|
| `/new-task` 空状态 | ✅ | 首页基线 |
| `/new-task` 有对话 | ✅ | 消息流基线 |
| `/settings` | ✅ | 表单页基线 |
| `/tasks` | ✅ | 列表页基线 |

### 4.3 规则

- 基线截图存入 `tests/snapshots/`
- CI 中截图对比，差异超过阈值则失败
- 更新基线必须在 PR 描述中说明原因并附截图

---

## 5. E2E 测试计划

使用 Playwright（待配置）。核心路径：

| 路径 | 步骤 | 优先级 |
|---|---|---|
| 新建任务 | 输入 → 发送 → 看到响应 | P0 |
| 审批流 | Agent 请求审批 → 弹窗 → 允许/拒绝 | P0 |
| 主题切换 | 切换暗色 → 验证全页面 | P1 |
| 设置保存 | 修改配置 → 保存 → 刷新验证 | P1 |
| 右面板 | 打开/关闭/拖拽调宽 | P2 |

---

## 6. 测试数据管理

- 禁止在测试中硬编码真实数据
- Mock 数据集中在 `src/__tests__/fixtures/` 目录
- 每个 fixture 文件对应一个领域：`conversations.ts`、`tasks.ts`、`workspaces.ts`
- Fixture 使用工厂函数生成，支持覆盖默认值：

```typescript
// src/__tests__/fixtures/conversations.ts
export function createConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: `conv_${Math.random().toString(36).slice(2)}`,
    title: 'Test Conversation',
    messages: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}
```

---

## 7. 禁止

- 禁止测试依赖网络请求或真实 Electron IPC
- 禁止测试间共享可变状态
- 禁止 `@ts-ignore` 绕过测试里的类型错误
- 禁止用 `setTimeout` 等待异步操作——用 `waitFor` / `findBy` 查询
