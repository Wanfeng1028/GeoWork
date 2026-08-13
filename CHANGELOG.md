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

### Fixed
- `orchestrator.go` `ExecutionMode` int→string 转换 vet 警告（改用 `.String()`）

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
