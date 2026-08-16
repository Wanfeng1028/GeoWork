# GeoWork 测试规范

> **文档路径**：`doc/16-Engineering-Testing.md`
> **关联文档**：`03-GeoWorkFrontend-Engineering-Standards.md`（测试策略 §3）/ `11-Engineering-CI-CD.md`（CI 门禁）
> **适用对象**：所有贡献者（含 AI 编程助手）
> **最后更新**：2026-08-17

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：升级现有测试策略，补充集成测试、视觉回归、E2E 计划、测试数据管理 |
| v1.1 | 2026-08-17 | P4：新增 §9 增量覆盖率门禁（50%）、§10 Flaky 测试隔离（30 天期限） |
| v1.2 | 2026-08-17 | P6：新增 §11 非功能测试（安全扫描三件套、性能基线、HTTP 韧性加固） |

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

---

## 9. 增量覆盖率门禁（P4）

> 工具：`scripts/ci/go_diff_coverage.py`；接入：`.github/workflows/pr-check.yml` 的 `core-check` / `server-check`。

### 9.1 规则

| 项 | 定义 |
|---|---|
| 门禁对象 | 本次 push（基线 `github.event.before`，本地回退 `HEAD~1`）新增的 **Go 可执行行** |
| 分母 | 新增行中落在 coverprofile 任一语句块内的行；注释 / 空行 / 非可执行行不进分母 |
| 分子 | 其中被至少一个 `count > 0` 块覆盖的行 |
| 阈值 | **50%**，低于即 CI 失败 |
| 豁免 | `_test.go` 新增行不计入；无新增可执行行按 100% 放行；基线无法解析（shallow clone）跳过并告警 |

### 9.2 为什么是增量而不是全量

存量代码覆盖率不足是历史债，用全量阈值会把所有提交挡在门外；增量门禁保证**新债不产生**，存量覆盖率随重写和补测单调上升。

### 9.3 破门时的处理

- CI 日志会列出未覆盖的 `文件:行` 清单，按清单补测试后重推。
- 确属无法测试的胶水代码（如 `main.go` 的启动装配），优先重构出可测函数；实在不行的，在提交说明里写明原因，由维护者确认。

---

## 10. Flaky 测试隔离（P4）

> 清单：`scripts/ci/flaky-quarantine.txt`；CI 把非注释行用 `\|` 拼接传给 `go test -skip`。

### 10.1 判定

同一提交两次 CI run 结果不一致（一绿一红）即判定 flaky；本地无法复现不是反驳理由（CI 机器调度 / IO 时序不同）。

### 10.2 隔离流程

1. 在 `flaky-quarantine.txt` 加一行测试全名（或 `/` 正则片段），行尾附 `# TODO(issue号)`；
2. 当天建 issue 记录复现证据（两次 run 的链接）与初判根因；
3. 隔离的测试不再参与 CI 与覆盖率门禁，但**代码保留**，方便修复。

### 10.3 期限

隔离超过 **30 天**未修复的，从清单移除并删除测试——一个长期不可信的测试比没有测试更糟（它消耗每次失败的排查时间）。

### 10.4 预防

- 测试禁止依赖真实时间（`time.Now` 注入）、网络、并发调度顺序；
- 需要等待的用 channel / `context.Done()` 语义，禁止 `time.Sleep` 轮询（教训见 sandbox `monitorProcess`：终态写入必须在 `cancel()` 之前）。

---

## 11. 非功能测试（P6）

### 11.1 安全扫描（CI 门禁）

| 扫描 | 位置 | 失败条件 |
|---|---|---|
| `govulncheck`（core / server） | core-check / server-check | 代码**实际调用**的依赖漏洞（require 但未调用仅提示） |
| `npm audit --omit=dev --audit-level=high` | frontend-check | 生产依赖高危及以上 |
| `pip-audit` | worker-check | CI 环境内已知漏洞包 |

规则：

- stdlib 漏洞靠 CI 的 `go-version` 跟进补丁版本兜底（当前 1.26.6+），不靠代码改动；
- 扫描红了先升级补丁版本；无法升级的（breaking）在提交说明里给出豁免理由与修复计划；
- dev 依赖漏洞不挡 CI（不进产物），但每周人工看一次 `npm audit` 全量输出。

### 11.2 性能基线

- **benchmark（精确基线）**：server 侧 `internal/{auth,rbac,sync}/bench_test.go`，覆盖 bcrypt（登录主导开销）、权限矩阵（鉴权热路径）、同步 payload 校验（批量同步逐条开销）。CI 不设阈值（runner 波动大），改动这些路径后本地跑 `go test -bench=. -run='^$' ./internal/...` 对比。
- **延迟冒烟（防灾难退化）**：E2E 断言 `/health` 响应 < 2s——只拦"中间件死循环/锁争用"级退化，不做精确测量。

### 11.3 HTTP 韧性

- 两个 Go 服务（server:8767 / core:8765）显式配置 `ReadHeaderTimeout`（10s，防 slowloris 慢头发连接）与 `IdleTimeout`（120s，回收空闲连接）；
- **禁止给这两个服务设 `WriteTimeout`**——`/api/model/stream`（SSE）与 core 的 WebSocket 是长连接，写超时会切断流式响应；
- server 停机走 `srv.Shutdown`（10s 宽限）后再关 SQLite，避免在途请求写已关闭的 DB。
