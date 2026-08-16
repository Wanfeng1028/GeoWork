# Changelog

> **状态：活跃维护**
> 本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## 格式规范

### 分类

- `Added` — 新功能
- `Changed` — 对现有功能的变更
- `Deprecated` — 即将移除的功能
- `Removed` — 移除的功能
- `Fixed` — 对现有功能的修复
- `Security` — 安全相关修复

---

## [Unreleased]

### Fixed — BP1 装配止血：agent 端到端真正可写可执行（doc/22，2026-08-17 · ZCode）
- **修复生产装配断层（F1，致命）**：orchestrator 构造 toolCtx 只注入 runID、全仓库无人调用 `WithPolicy`，导致真实装配下 write_file/run_python/run_shell/delete_file 全部 "permission denied"——agent 只能读。新增 `aiagent.DefaultDesktopPolicy()`（D-B1：full 级，critical 工具仍走审批+Harness）并经 `WithPermissionPolicy` 接入 main.go 与每次工具调用的 ctx
- **修复高风险检查语义 bug**：`CheckPermission(ctx, name)` 传工具名，永远匹配不上按权限类（read/write/exec）键控的 Actions 表；改为 `CheckPermission(ctx, t.Permission())`
- **run_shell 沙箱最小止血（F5）**：命令串内嵌绝对路径（POSIX 与 Windows 盘符形态）逐一过 `validateSandboxPath`（`rm -rf /` 根路径用例覆盖）；run_shell/run_python 的 `cmd.Dir` 钉在运行 workspace（新增 `toolregistry.WithWorkspacePath` ctx 注入）
- **修复 retryRequest (nil,nil) 返回（F3，崩溃级）**：最后一次尝试为可重试状态时返回明确错误而非让调用方解引用 nil response
- **新增生产装配 E2E 测试**：`assembly_e2e_test.go` 复刻 main.go 装配链（builtin 工具+沙箱根+策略+Harness+PolicyTable+workspace），write_file 真实落盘/沙箱逃逸拒绝/命令扫描三测——**先红后绿**验证（无策略时复现"文件静默未写"生产症状）；现有 orchestrator 测试只注册无权限 read 工具、恰好绕开此路径的系统性盲区由此补上

### Removed — 删除第二套死代码 API 客户端，统一前端请求入口（2026-08-16 · ZCode）
- 删除 `apps/desktop/src/utils/apiClient.ts`（318 行零引用死代码）：默认指向无服务监听的 `localhost:8080`、按 `{ok, data, error}` 信封解包与 Go Core 裸 JSON 响应不兼容、鉴权读取全前端无人写入的 `access_token`、无 SSE 能力——留着必被未来开发（尤其 AI 辅助编码）误 import，是一颗"接口全部连不上"的地雷
- `shared/api/client.ts` 成为唯一 HTTP 入口（底层 `coreApi.ts` 负责 token，见下条 Security）：apiGet/apiPost/apiPut/apiDelete/apiPatch 签名不变、新增可选 `RequestOptions`（`timeoutMs` 超时覆盖、`signal` 外部取消）；`ApiError` 三分类 `kind = timeout | network | http`，`network` 可用于触发本地缓存降级、`http` 自动解析 core 业务错误码（`core/internal/api/errors.go`）
- 测试：`api.test.ts` 新增 5 用例（超时 / 网络不可达 / 业务码 / 外部取消 / 不限时），前端 75/75 全绿；契约文档 `doc/15` 升 v1.1（新增 §2.5 前端统一客户端约定）

### Security — Electron 侧安全加固 + runtime token 对接（2026-08-16 · ZCode）
- **P1-8a openExternal 协议白名单**：`shell:openExternal` / `desktop:openExternal` 此前对任意 URL 直接放行，被注入的渲染进程可用 `file://`、自定义协议唤起本地程序。新增 `url-guard.ts`，仅放行 `https:` / `http:` / `mailto:`
- **P1-8b apiKey 迁 safeStorage**：模型供应商 API Key 此前以明文存于 localStorage（XSS 可读、LevelDB 文件可直接翻出）。新增 `secret-store.ts`（Electron safeStorage，OS 级加密：Windows DPAPI / macOS Keychain / Linux libsecret），密文存 `userData/secrets.json`；`modelProviderStore` 写入时剥离明文、读取时经内存缓存回填，应用启动时自动迁移遗留明文并预热缓存；删除 provider 时同步清理 secret
- **P0-4 对接（Go 侧见 2d0dd62）**：Electron 主进程铸造随机 token（`runtime-token.ts`），经 `GEOWORK_RUNTIME_TOKEN` 注入 Go runtime 子进程；主进程 IPC 代理与健康检查自动携带 `X-GeoWork-Token`；渲染进程新增 `coreApi.ts`（`coreFetch` 带 header、`coreEventSource` 带 `?token=` query），替换 4 个文件里 8 处裸 `fetch`/`EventSource` 直连；`GEOWORK_INSECURE_NO_AUTH=1` 时全链路降级为无鉴权（仅开发态）
- 顺带修复：typecheck 3 处既有 TS6133（未使用变量）、lint 2 处既有 eqeqeq error（`== null` 改等价严格比较），`npm run typecheck` / `oxlint` 恢复全绿

### Fixed — Orchestrator 执行核心去重与修复（2026-08-15 · ZCode）
- **修复 resume 崩溃**：`ResumeFromCheckpoint` 复用已关闭的 `run.done`，`executePlanFromTurn` 收尾再次 close 导致 `panic: close of closed channel`（goroutine 内无 recover，直接崩进程）。现在 resume 前重新创建 done channel
- **修复 hook 分叉**：`executePlanFromTurn` 缺失 `OnRunStart` / `OnTurnStart` / `OnRunEnd` 三个生命周期钩子，恢复的 run 会静默绕过 per-turn 限流/审计。两个循环体合并为单一 `executePlan(ctx, run, rc, chatHistory, startTurn, resumed)`，删除 350 行重复代码
- **工具输出校验**：`OutputSchema` 此前只作为 API 元数据展示、从不校验。现在 `Registry.Execute` 对声明了 OutputSchema 的工具强制执行结构校验（type/properties/required/items 子集，零新依赖），违规输出被拒绝并记入审计日志；无 schema 的动态工具（Python Worker）不受影响
- **CI 修复**：`pr-check.yml` 的 core-check 使用 Go 1.21，无法构建 `go 1.25.0` 模块（每个 PR 必挂），已改为 1.25

### Added — Orchestrator 测试覆盖（2026-08-15 · ZCode）
- 新增 `orchestrator_test.go`：scripted gateway mock + 4 个测试（maxTurns 停止条件、无工具调用正常结束、完整 hook 序列、resume 路径 hook 行为 + 无 panic）
- 新增 `output_schema_test.go`：校验器单元测试 + Registry.Execute 集成测试（拒绝违规 / 接受合规 / 无 schema 跳过），共 8 个测试

### Added — 前端 Gemini 胶囊风格统一（2026-08-14，master）
- 三个主题 primary 色统一为 Gemini 蓝 `#3186ff`（`f16497c`）
- 全局蓝色按钮统一为 Gemini 胶囊渐变风格（`index.css` 全局样式）（`58a2de8`、`5256c86`、`5262580`、`22b3652`、`f832d3f`）
- ChatComposer 输入框重做为 Gemini 胶囊风格 + 多行输入适配 + 发送按钮圆角胶囊（`5a596a2`、`f8b0e7f`、`32afc2e`）
- Shell 组件（UsageModal / GlobalSearchModal）统一为 Gemini 胶囊风格（`8bd9098`、`7a2e743`）
- CapsuleTabs 修复指示器切换飞出问题 + resize 监听类型修正 + 切换平滑动画（`321e65c`、`04d6990`、`12a75ec`、`100eb48`、`985f736`、`ab4ae25`）
- AppShell / TitleBar / MainWorkspace 布局逻辑优化，右侧工作面板完善，连接器页响应式布局（`2e7de69`、`210200b`、`8355035`、`284351f`、`aa810c2`、`2f36f63`、`19cb2fe`、`b4ad995`、`a41304c`、`92ebc7f`）

### Added — 提交门禁（2026-08-15 · ZCode）
- 引入 husky + lint-staged：提交前对 `apps/desktop` 下 JS/TS 跑 oxlint + prettier，CSS 跑 stylelint --fix + prettier
- 引入 commitlint：commit type 白名单 `feat/fix/docs/style/refactor/test/chore/merge/revert`，关闭 subject-case 规则以兼容中文提交
- 新增 `.editorconfig`（2 空格缩进 + LF，与 Prettier 对齐；Python 4 空格、Go/Makefile tab）

### Added

### Added — 后端/Agent P0-P3 全阶段实现（TraeCodeCloud，2026-08-12，分支 `dev/TraeCodeCloud`）
- **P0**：ReAct 循环 + 状态机三者对齐 + per-run RunContext 隔离 + ContextBuilder 接线（L1-L3 三级裁剪）+ workflow/worker 工具改走 ToolRegistry（`e17c026`、`10f4305`）
- **P1**：ApprovalGovernor 审批流 + Trajectory/UsageMeter 可观测性 + SSE 断线重连（Last-Event-ID）+ WebSocket JSON-RPC 2.0 双向通信 + Pause/Resume + WorkerPool 资源限制 + Checkpoint 断点续传（`33883ec`）
- **P2**：Skills 体系（两阶段加载）+ MCP transport 集成 + 6 钩子点 Lifecycle + Cron Scheduler/Trigger + 多模型 Router（ModelGateway 实现 + 降级 + 成本控制）+ Eval 评估体系 + 浏览器工具/CDP/URL 沙箱（`3fb4646`）
- **P3**：Sub-agent（NewChildOrchestrator + spawn_subagent）+ Harness 统一规则引擎 + 流式推测执行（SpeculativeExecutor + ReadOnly）+ 5 层压缩完整版 L4/L5（Summarizer + SolidifyMemory）（`cc69658`）

### Changed
- AGENT.md §1 当前阶段更新为「P0-P3 后端施工全部完成，待验收」
- `doc/05-GeoWorkAgent-P0-Detailed-Design.md` 追加 v0.6 实现记录
- `doc/06-GeoWorkAgent-P1-Detailed-Design.md` 追加 v0.5 实现记录
- `doc/07-GeoWorkAgent-P2-Detailed-Design.md` 追加 v0.5 实现记录
- `doc/08-GeoWorkAgent-P3-Detailed-Design.md` 追加 v0.3 实现记录
- AGENT.md v1.4（2026-08-15 · ZCode）：§5 修改后 + §15.3 新增「代码改完必须同步文档」规则；§14 补记 2026-08-14 Gemini 胶囊化施工记录
- `doc/02` v0.4（2026-08-15 · ZCode）：右侧工作面板规格按代码现状修正为默认 380、可拖 320–960；F2-2 状态修正为部分完成（模板分发未实现）
- `doc/DEV_VERSION_CHECKLIST.md`（2026-08-15 · ZCode）：F2-2 状态修正、F0-3 命中数更新（6 处）、骨架屏复用项改回未完成（实际 2 处）、已知限制刷新

### Fixed
- `orchestrator.go` `ExecutionMode` int→string 转换 vet 警告（改用 `.String()`）
- `pr-check.yml` Go 版本 1.21 → 1.25，匹配 `core/go.mod` 的 go 1.25.0 要求（2026-08-15 · ZCode）
- `pr-check.yml` 前端 job 补 build + test 步骤：E0 记录声称 CI 含 build+test 但实际缺失，本次补齐使 CI 与文档声明一致（2026-08-15 · ZCode）

## [1.0.0] - 2026-08-12
- **E0 基础设施**（2026-08-12 · TraeCode AI Agent · 分支 `dev-frontend/TraeCodeCloud-SeedCode`）
  - 新增 `.prettierrc` / `.prettierignore` 统一代码格式
  - 新增 `.stylelintrc.json` CSS 样式检查规则
  - 更新 `.oxlintrc.json` 补充安全规则（no-debugger/no-eval/eqeqeq 等）
  - tsconfig 开启 `strict: true` + 路径别名（`@shared`/`@shell`/`@pages`/`@app`）
  - `electron.vite.config.ts` 同步路径别名
  - 新增 `.gitattributes` 统一行尾
  - 新增 `.github/workflows/pr-check.yml` CI pipeline（前端 lint+typecheck+build+test / Go core / Python worker）
  - 新增 `.env.example` 环境变量模板
  - `package.json` 新增 `typecheck` / `lint:styles` / `format` 脚本

- **F0 基础落地**（2026-08-12 · TraeCode AI Agent）
  - 主题入口收敛：`appearanceStore` 白名单改为 `editorial`/`editorial-dark`/`system`
  - 新增胶囊四件套：`CapsuleButton`/`CapsuleTabs`/`CapsuleTag`/`CapsuleGhost`
  - `AppShell.tsx` Segmented → CapsuleTabs，状态 Tag → CapsuleTag，主按钮 → CapsuleButton
  - `NewTaskPage.tsx` Segmented → CapsuleTabs，状态 Tag → CapsuleTag

- **F1-2 反馈三件套**（2026-08-12 · TraeCode AI Agent）
  - 新增 `PageSkeleton`（4 种模板变体：conversation/workspace/list/form）
  - 新增 `EmptyState`（3 档尺寸：sm/md/lg）
  - 新增 `ErrorBoundary`（运行时错误捕获 + 重试按钮）
  - 新增 `feedback/index.ts` 桶出口

- **F2-1 布局骨架**（2026-08-12 · TraeCode AI Agent）
  - 新增 `IconRail` 组件（56px 固定宽度，图标+tooltip 导航，三段式布局）

- **F1-3 全页面对齐**（2026-08-12 · TraeCode AI Agent）
  - NewTaskPage 接入 PageSkeleton conversation 加载态
  - TasksPage 接入 EmptyState 空态
  - WorkspacePage 接入 PageSkeleton + EmptyState
  - SettingsPage 新增"关于 GeoWork"导航

- **F2-2 页面架构**（2026-08-12 · TraeCode AI Agent）
  - AppShell 整体包裹 ErrorBoundary

- **F2-4 主题下线**（2026-08-12 · TraeCode AI Agent）
  - ThemePreview 路由注释下线
  - 废弃主题标注 `@deprecated`

- **FP3 品牌化**（2026-08-12 · TraeCode AI Agent）
  - 新增 `WelcomePage` 品牌落地页（6 项功能网格 + CTA）
  - 新增 `AboutPage` 产品信息页（版本/技术栈/许可证）
  - 根路径 `/` 指向 WelcomePage

### Changed

- `useAntdTheme` 只处理 3 种白名单值（editorial/editorial-dark/system），其余 fallback 到 editorial
- `appearanceStore` 默认主题从 `light` 改为 `editorial`

### Removed

- **F1-1 图标库替换**（2026-08-13 · TraeCode AI Agent · 分支 `feat/F1-visual-upgrade`）
  - 移除 `@ant-design/icons` 依赖（~60 种图标全量替换为 `lucide-react`）
  - 图标映射：Outlined 风格 → Lucide line 风格，保持语义一致
  - `spin` 属性替换为 CSS `@keyframes spin` 动画（全局 index.css）
  - 涉及 55+ 文件，覆盖 shell/、pages/Settings/、pages/Tasks/、pages/NewTask/、pages/Extensions/、pages/MobileControl/、pages/Welcome/、pages/Dashboard/、pages/ThemePreview/

### Dependency Changes

- 新增 `lucide-react ^0.469.0`
- 移除 `@ant-design/icons ^6.3.2`

---

## [0.5.0-dev] - 2026-08-11

### Added

- GeoWork v0.5.x-dev 开发预览版基线
- 前端设计系统 v1.5.1 定稿（Gemini 蓝系品牌色）
- 施工图 v0.1 初版（F0~F3 四阶段划分）
- 工程计划 v1.0 初版（E0~E2 三阶段）

---

## 相关文档

- 版本发布流程：`doc/17-Engineering-Release.md`
- 文档变更规则：`AGENT.md §15.3`

---

*最后更新：2026-08-12（TraeCodeCloud 补充 P0-P3 后端/Agent 全阶段实现记录）*
*最后更新：2026-08-12 · TraeCode AI Agent · 前端 F0~F2 + FP3 阶段完成记录*
