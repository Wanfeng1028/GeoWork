# GeoWork E2E 测试工程规范

> 版本 v1.0 · 2026-08-16 · 适用范围：`tests/e2e/`（Playwright）与 `apps/desktop/src`（data-testid 锚点）

## 1. 测试拓扑

E2E 套件位于仓库根 `tests/e2e/`（独立 npm 包 `@geowork/e2e`），**不在** `apps/desktop` 内。

- 渲染层：`playwright.config.ts` 的 `webServer` 启动 `apps/desktop` 的 `dev:e2e`（`vite.e2e.config.ts`，纯渲染进程 Vite dev server，端口 5173）。**不启动 Electron / Go core / Python worker**——渲染代码对 `window.geowork` 全部可选链，可在纯 Chromium 渲染。
- API 级用例：直接对 `API_BASE_URL`（默认 `http://localhost:8767`，Go 云端）发请求，假定服务已在运行。
- Electron 壳、Go core（8765）、worker（8766）目前不在 E2E 覆盖内（打包后 Electron E2E 属 P7）。

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
- 其余按域自由组织（`@auth`、`@task` 等），本地全量跑。
