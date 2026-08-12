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

---

## 8. 跨平台测试

Electron 跑在 Windows / macOS / Linux 上。以下维度需要跨平台验证。

### 8.1 CI 平台矩阵

| 平台 | CI 跑？ | 说明 |
|---|---|---|
| Windows | **必须** | 主要开发和使用环境 |
| macOS | P2 | 用户量较小，但字体渲染差异大 |
| Linux | P3 | 开发环境偶尔用 |

当前 CI 只跑 Ubuntu（GitHub Actions 默认）。Windows 测试由开发者本地验证。

### 8.2 平台敏感点

| 维度 | 风险 | 处理方式 |
|---|---|---|
| 字体 | `PingFang SC` 仅 macOS，Windows 回退 `Microsoft YaHei`，行高可能不同 | CSS 字体栈写明回退链：`'Microsoft YaHei', 'PingFang SC', sans-serif` |
| 路径分隔符 | `\` vs `/` | 代码中统一用 `path.join()` / `path.resolve()`，禁止字符串拼接路径 |
| 快捷键 | `Cmd` vs `Ctrl` | Electron 的 `accelerator` 自动处理（`CmdOrCtrl+K`） |
| 行尾符 | CRLF vs LF | `.gitattributes` 统一 `* text=auto`（待创建） |
| node-pty | 编译依赖平台原生模块 | `electron-rebuild` 在目标平台执行 |

### 8.3 视觉验收

- 明暗模式截图验收**至少在 Windows 上跑一遍**（主要用户环境）
- 字体渲染差异允许 1-2px 的行高偏差，不允许布局错位
