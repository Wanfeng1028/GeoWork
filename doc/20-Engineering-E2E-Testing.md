# GeoWork E2E 测试工程规范

> 版本 v1.1 · 2026-08-17 · 适用范围：`tests/e2e/`（Playwright）与 `apps/desktop/src`（data-testid 锚点）
>
> v1.1 变更：P7-1 落地三进程联调 E2E（§1 更新 + 新增 §7 Electron 联调拓扑）。

## 1. 测试拓扑

E2E 套件位于仓库根 `tests/e2e/`（独立 npm 包 `@geowork/e2e`），**不在** `apps/desktop` 内。分两层：

- **渲染层**（`playwright.config.ts`）：`webServer` 启动 `apps/desktop` 的 `dev:e2e`（`vite.e2e.config.ts`，纯渲染进程 Vite dev server，端口 5173）。**不启动 Electron / Go core / Python worker**——渲染代码对 `window.geowork` 全部可选链，可在纯 Chromium 渲染。API 级用例直接对 `API_BASE_URL`（默认 `http://localhost:8767`，Go 云端）发请求，假定服务已在运行。
- **三进程联调层**（`playwright.electron.config.ts`，P7-1）：启动真实 Electron 壳 + 真实 Go core（8765）+ 真实 Python worker（8766）+ cloud server（8767），验证 IPC 桥 / 审批流 / 沙箱真实执行。详见 §7。打包产物 E2E 属 P7-3（v1.0 前夕）。

## 2. data-testid 约定

### 2.1 命名规则

- 全小写 kebab-case：`data-testid="chat-composer-send"`。
- 结构：`<区域>-<元素>[-<变体>]`，区域用组件语义名（`sidebar`、`chat-composer`、`right-workspace-panel`）。
- 列表/动态项用值后缀：`mode-option-${opt.key}`、`sidebar-segment-${value}`。
- 共享组件不硬编码 testid，暴露 `testId` 前缀 prop（见 `CapsuleTabs`），由使用方传入。
- testid 只加在**测试需要定位**的元素上，不是每个 DOM 节点都加。

### 2.2 现有锚点清单

| testid | 位置 | 说明 |
|---|---|---|
| `app-shell` | `shell/AppShell.tsx` 根 | 应用就绪信号 |
| `sidebar` | `shell/AppShell.tsx` aside | 左侧栏 |
| `sidebar-task-list` | `shell/AppShell.tsx` | 侧栏任务列表（有任务时） |
| `sidebar-settings` | `shell/AppShell.tsx` | 设置按钮 |
| `sidebar-segment-tasks` / `sidebar-segment-channels` | `shell/AppShell.tsx`（CapsuleTabs） | 侧栏分段切换 |
| `main-workspace` | `shell/AppShell.tsx` main | 主工作区 |
| `right-workspace-panel` | `shell/RightWorkspacePanel.tsx` | 右侧工作台（展开态） |
| `right-workspace-expand` | `shell/RightWorkspacePanel.tsx` | 浏览器模式收起态的展开按钮 |
| `chat-composer` | `pages/NewTask/components/ChatComposer.tsx` 根 | 输入区容器 |
| `chat-composer-input` | 同上 TextArea | 输入框 |
| `chat-composer-mode` | 同上 | 模式切换按钮 |
| `mode-option-<key>` | 同上下拉项 | key ∈ general/spatial/cartography/paper/query/remote-sensing |
| `chat-composer-send` / `chat-composer-stop` | 同上 | 发送/停止按钮（流式时互斥） |

### 2.3 选择器优先级

1. `page.getByTestId('...')` —— 首选。
2. `page.getByRole(...)` —— testid 不适用时（如语义化断言）。
3. 文本选择器 `getByText` —— 仅限稳定文案。
4. **禁止** `[class*="..."]` 模糊 class 选择器与硬编码 CSS module 类名（CSS module 类名带 hash，重构即碎）。
5. **禁止** `waitForTimeout` 做同步等待，用 `expect(...).toBeVisible()` / `waitFor` 的自动等待。

## 3. Page Objects

- 位置：`tests/e2e/pages/`，每页一个类，构造注入 `Page`。
- Page Object 只暴露**语义方法**（`openSettings()`、`sendMessage(text)`），内部持有 locator；spec 不直接写选择器。
- 旧 `helpers/app-helpers.ts` 为过渡层，新代码一律走 Page Object。

## 4. Fixtures

- 位置：`tests/e2e/fixtures/`，用 Playwright `test.extend` 扩展。
- 需要登录态的用例通过 fixture 注入测试账号（seed 到 server SQLite 或走注册 API），不在 spec 里硬编码凭据。
- 需要任务/会话数据的用例用 localStorage seed（渲染层数据在 localStorage）或 core API seed。

## 5. CI

- `pr-check.yml` 的 `e2e-smoke` job：安装 `tests/e2e` 依赖 + Playwright Chromium，跑 `@smoke` 标签子集。
- 完整套件不在 PR 门禁（耗时），smoke 失败即阻断。
- Windows runner 覆盖渲染层差异（P3-5）。

## 6. 标签

- `@smoke`：最小冒烟（应用启动、布局可见、输入可用），CI PR 必跑。
- `@integration`：三进程联调用例（P7-1），只在 `e2e-electron` workflow 跑，不进 PR 门禁。
- 其余按域自由组织（`@auth`、`@task` 等），本地全量跑。

## 7. Electron 三进程联调拓扑（P7-1）

渲染层 E2E 对 `window.geowork` 全可选链，**IPC 桥 / 审批状态机 / 沙箱真实执行从未被测过**——这是 P7-1 补的最大盲区。联调层用独立配置 `playwright.electron.config.ts`（与渲染层分离，`workers: 1`）。

### 7.1 进程编排（`fixtures/processes.fixture.ts`，worker 级）

在 Electron 启动前预启三进程，全部 `GEOWORK_INSECURE_NO_AUTH=1`（token 铸造/注入路径由单测覆盖，联调层聚焦集成链本身）：

| 进程 | 端口 | 启动方式 | 健康门 |
|---|---|---|---|
| cloud server | 8767 | `GEOWORK_SERVER_BIN` 预构建二进制（CI）或 `go run`（本地） | `GET /health` |
| Go core | 8765 | `GEOWORK_CORE_BIN` 预构建二进制或 `go run ./cmd/geowork-runtime` | `GET /api/diagnostics/health` |
| Python worker | 8766 | `python -m uvicorn app.main:app` | `GET /health` |

- **端口冲突 fail fast**：预启前探测 8765/8766/8767，被 dev 进程占用即报错，避免打错目标。
- **Electron 跳过自启**：主进程 `startRuntime()` 检测到 8765/8767 已占用走 `isPortInUse` 分支标记 running，直接连接预启进程（生产代码显式支持的"外部进程"模式）。core 的 worker 自启同理——`main.go` 检测 8766 已占用则附着而非重复 spawn（P7-1 新增，镜像 runtime.ts 的 isPortInUse）。
- **teardown**：逆序 kill（Windows 用 `taskkill /T /F` 杀进程树），清理临时 workspace 与 SQLite。

### 7.2 Electron 启动（`fixtures/electron.fixture.ts`）

`_electron.launch()` 加载 `electron-vite build` 产物（`apps/desktop/out/main/main.js`），不设 `ELECTRON_RENDERER_URL` → 走 `loadFile(../renderer/index.html)` 测真实生产渲染路径。等待 `[data-testid="app-shell"]` 就绪。

### 7.3 用例（`projects/electron/`，`@integration`）

| spec | 覆盖 |
|---|---|
| `ipc-bridge.spec.ts` | `window.geowork` 由 preload 注入；`runtime.health()/getStatus()/checkHealth()` 经 IPC 到达 core 并返回正确状态 |
| `approval-flow.spec.ts` | Electron 安全审批状态机：危险类目请求→待批→批准→缓存放行 / 拒绝移除 / 安全类目直接放行 |
| `sandbox-real.spec.ts` | `runCommand` 经 IPC 启动进程、捕获 stdout、真实 workspace 落盘、被封锁命令（sudo）拒绝 |

### 7.4 CI（`.github/workflows/e2e-electron.yml`）

重且慢（~5min），**不进每次 push 的 PR 门禁**：nightly 兜底 + `workflow_dispatch` 手动 + `paths` 过滤（`core/**`、`apps/desktop/electron/**`、`workers/geo-python/app/**`、`tests/e2e/projects/electron/**` 等变更时随 push 跑）。步骤：build Electron app → 预构建 Go 二进制 → 装 worker 轻量子集 → `xvfb-run` 跑联调 E2E → 上传 Playwright report + testbed 进程日志。

### 7.5 本地运行

```bash
cd apps/desktop && npm run build          # 先产出 out/
cd tests/e2e && npx playwright test -c playwright.electron.config.ts
```

需 Go 1.26+ / Python 3.11+ 在 PATH。进程日志写 `tests/e2e/.testbed-*.log`（已 gitignore）。
