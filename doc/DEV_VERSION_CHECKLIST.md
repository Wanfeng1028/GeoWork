# 开发版验收清单

> **状态：更新中**
> 本清单用于在每次开发版发布前，系统性检查以下内容。
> 当前版本：v0.6.0-dev（doc/21 六阶段重构 + doc/23/25/26 收官，2026-08-17；v0.6 现代化施工见 doc/27）
> 更新时间：2026-08-19 · 更新者：ZCode（doc/27 第 0 周纠偏：联调状态改实、F2-2 模板分发废弃、CSS 收敛目标改纪律、已知限制补真实债）

## 总体进度

| 阶段 | 状态 | 完成日期 | 执行者 |
|---|---|---|---|
| E0 基础设施 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F0 基础落地 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F1-1 Lucide 全站替换 | ✅ 完成 | 2026-08-13 | TraeCode AI Agent |
| F1-2 反馈三件套 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F1-3 全页面对齐 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F2-1 布局骨架 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F2-2 页面架构 | ⏳ 部分完成 | — | ErrorBoundary 包裹 + About 页已落地；~~AppShell 按路由分发 A/B/C/D 模板~~ **已废弃**（doc/27/ADR-003：模板分发是页面思维，与 chat-first 背道而驰），替换为"AppShell 拆分至 <15KB"（doc/27 W4-2） |
| F2-4 6 主题下线 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| FP3 品牌化 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| Gemini 胶囊风格统一 | ✅ 完成 | 2026-08-14 | — |
| 提交门禁（husky/commitlint/lint-staged） | ✅ 完成 | 2026-08-15 | ZCode |
| 样式纪律（原 FP3-2/CSS 收敛） | ⏳ 持续 | — | 目标改纪律：禁止新增游离于 token 的样式，存量随改造收敛（doc/27 W4-3：cssVar 开启 + !important 并入 Button token） |

---

## 一、功能 completeness（对应 P 阶段验收标准）

### F0 验收（已完成）

- [x] F0-1 任务对话页贴完成态截图（明暗各一张），能复现 §7.2 刻度 — ⏳ 待人工截图
- [x] F0-2 主题下拉里不出现 illustration/glass/bootstrap
- [x] F0-3 全站搜 `9999px` 仅命中胶囊风格组件（CapsuleTabs/CapsuleTag + ChatComposer/UsageModal/GlobalSearchModal 胶囊样式 + index.css 全局胶囊样式，共 6 处，2026-08-15 核实）
- [x] F0-4 stylelint 规则生效，PR 里有 lint pass 记录

### F1 验收

- [ ] 页面截图对比 F0-1 基线，视觉无回流 — ⏳ 待截图对比
- [x] 全局 grep `@ant-design/icons` 命中 0 — ✅ F1-1 已完成（2026-08-13）
- [ ] 骨架屏复用在 4 个以上页面调用 — ⏳ 当前仅 NewTaskPage/WorkspacePage 2 处使用（2026-08-15 核实）
- [x] stylelint 规则已配置

### F2 验收

- [ ] ~~5 个路由都走对应模板，且 padding/max-width 全部对齐 §7.3~~ **已废弃**（doc/27/ADR-003：模板分发废弃，替换为 AppShell 拆分至 <15KB，见 doc/27 W4-2）
- [ ] 右侧工作面板拖拽 320–960 有吸附，收起后宽度残影为 0 — ⏳ 待人工验证（规格已按代码现状修正，见 doc/02）
- [ ] 设置页 640px 居中截图与 §7.3 模板 D 完全一致 — ⏳ 待截图
- [x] 控制台 `localStorage.getItem('appearance')` 输入错值时页面塌到 editorial，无报错

### E0 验收

- [x] CI pipeline 在 PR 上自动运行（`.github/workflows/pr-check.yml` 已创建并推送）
- [x] lint + build + test 全部通过才能合并（CI 门禁配置就位）
- [x] tsconfig `strict: true` 开启
- [x] Prettier 格式化配置就位

---

## 二、文档同步更新

- [x] CHANGELOG.md 已更新
- [x] DEV_VERSION_CHECKLIST.md 已更新
- [x] doc/02 施工图进度已标记
- [x] doc/19 工程计划进度已标记
- [x] AGENT.md 任务记录已更新

---

## 三、测试覆盖率

- [ ] 前端单元测试覆盖率达标 — ⏳ 待补充（当前 vitest 配置已有，需编写测试）
- [ ] 集成测试（MSW）就位 — ⏳ 待 E1 阶段执行
- [ ] E2E 测试（Playwright）就位 — ⏳ 待 E1 阶段执行

---

## 四、安全审计

- [x] `.oxlintrc.json` 安全规则已补充（no-eval / no-implied-eval / no-debugger 等）
- [ ] 依赖安全扫描 — ⏳ 待 CI 中集成
- [ ] 前端敏感信息检查 — ⏳ 待执行

---

## 五、已知限制 / 推迟项

| 项目 | 原因 | 计划 |
|---|---|---|
| 视觉基线截图 | 需要桌面环境实际运行 | 人工在本地启动后截图存档 |
| ~~与 Go Core API 联调｜后端尚未就绪~~ **已过期作废**（2026-08-19 纠偏） | 后端早已就绪且部分域已联调并受契约测试保护 | 联调状态按域见下表 |
| CSS 样式纪律（原 FP3-2 数值目标） | "64→8 个 module.css"数值目标不现实也无收益 | 改为纪律：禁止新增游离于 token 的样式，存量随改造收敛（doc/27 W4-3） |
| ~~AppShell 按路由分发 A/B/C/D 模板（F2-2 剩余项）~~ **已废弃** | 模板分发是页面思维，与 chat-first 背道而驰（doc/27/ADR-003） | 替换为"AppShell 拆分至 <15KB"（doc/27 W4-2） |
| 路径别名落地 | `@shared/@shell/@pages/@app` 已配置但代码 0 处使用，39 个文件仍用相对路径 | 后续重构时逐步替换 |
| ErrorBoundary 双份 | `src/components/` 与 `src/shell/feedback/` 各一份 | doc/27 W4-1 删除死代码那份 |
| diff 审批闸断链 | ReviewPanel 调的 `/api/security/diff` GET/approve/reject/apply-all 只存在于未挂载的 `core/internal/diff` 包，运行时 404 | doc/27 W2-2 + ADR-002 |
| 悬空 CSS 变量 | CSS Modules 92 处引用 `var(--ant-color-*)`，ConfigProvider 未开 cssVar | doc/27 W4-3 |
| 假快捷键 | 菜单印着 Ctrl+F/Ctrl+Shift+F 标签，全局 keydown 零实现 | doc/27 W3-1 |
| 全局搜索死条目 | GlobalSearchModal 硬编码 19 条静态数据，含已下线的 theme-preview 路由 | doc/27 W3-2 |
| 41 处占位文案 | "后续接入/敬请期待"类假承诺散布于 Extensions/MobileControl/NewTask | doc/27 W4-1 随白名单清场 |
| Extensions 四页 mock | Skills/MCP/Connectors/Experts 全走 localStorage，后端端点未接 | doc/27 W2-1/W2-3 分诊 |
| 版本三口径悬案 | 治理文档已归一 v0.6.x-dev（AGENT.md §1 / README / 本清单），但 `apps/desktop/package.json` 的 version 仍是 `2.0.0`（AboutPage 大概率读它，对外展示 2.0.0） | v1.0 发版前统一：package.json 改回与治理口径一致或明确拆分（产品版本 vs 包版本），W1 期间顺手核实 AboutPage 数据源 |

### 与 Go Core API 联调状态（按域，2026-08-19 核实）

| 域 | 状态 | 说明 |
|---|---|---|
| conversations（CRUD + SSE） | ✅ 已联调 | Session 对象层消费，契约测试钉住（desktop_contract_test.go） |
| agent runs（GET 单条轮询）+ approvals | ✅ 已联调 | doc/21 D2 确认执行 + 审批卡闭环 |
| /api/db/tasks CRUD | ✅ 已联调 | TasksPage + taskStore，契约测试钉住 |
| workspaces tree/read | ✅ 已联调 | FileTreePanel 经 IPC |
| agent runs 全套（list/pause/resume/stop/delete）+ checkpoints + usage + trajectory | ❌ 后端就绪、前端零消费 | doc/27 第 1 周（金矿域） |
| diff 审批闸（/api/security/diff 系列） | ❌ 断链 | 前端调未挂载端点，doc/27 W2-2 |
| skills/mcp/plugins/experts/settings/models | ❌ 后端就绪（skills 数据源为硬编码，需先接线 Loader）、前端走 localStorage | doc/27 第 2 周 |

---

## 版本信息

| 项 | 值 |
|---|---|
| 验收版本 | v0.6.0-dev |
| 分支 | `master`（当前）；历史：`dev-frontend/TraeCodeCloud-SeedCode`（PR #1）、`feat/F1-visual-upgrade` |
| 验收人 | ZCode（本次一致性核实） |
| 验收日期 | 2026-08-19 |

---

*最后更新：2026-08-19 · ZCode · doc/27 第 0 周纠偏（联调状态按域改实、F2-2 模板分发废弃、CSS 收敛改纪律、已知限制补入 diff 断链/悬空变量/假快捷键/死条目/占位文案/Extensions mock 六项真实债）*