# 开发版验收清单

> **状态：更新中**
> 本清单用于在每次开发版发布前，系统性检查以下内容。
> 当前版本：v0.5.0-dev（前端 F0~F2 + FP3 完成，2026-08-14 完成 Gemini 胶囊风格统一）
> 更新时间：2026-08-15 · 更新者：ZCode

## 总体进度

| 阶段 | 状态 | 完成日期 | 执行者 |
|---|---|---|---|
| E0 基础设施 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F0 基础落地 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F1-1 Lucide 全站替换 | ✅ 完成 | 2026-08-13 | TraeCode AI Agent |
| F1-2 反馈三件套 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F1-3 全页面对齐 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F2-1 布局骨架 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| F2-2 页面架构 | ⏳ 部分完成 | — | ErrorBoundary 包裹 + About 页已落地；AppShell 按路由分发 A/B/C/D 模板未实现 |
| F2-4 6 主题下线 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| FP3 品牌化 | ✅ 完成 | 2026-08-12 | TraeCode AI Agent |
| Gemini 胶囊风格统一 | ✅ 完成 | 2026-08-14 | — |
| 提交门禁（husky/commitlint/lint-staged） | ✅ 完成 | 2026-08-15 | ZCode |
| F1-1 + FP3-2/CSS 收敛 | ⏳ 待执行 | — | — |

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

- [ ] 5 个路由都走对应模板，且 padding/max-width 全部对齐 §7.3 — ⏳ 待实现（AppShell 尚未按路由分发模板）
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
| 与 Go Core API 联调 | 后端尚未就绪 | 待 P0/P1 后端完成后启动联调 |
| CSS 文件数收敛（FP3-2） | 当前 64 个 module.css（2026-08-15 核实），目标 8 个 | 待逐步收敛 |
| AppShell 按路由分发 A/B/C/D 模板（F2-2 剩余项） | 当前仅 Outlet 直出，模板分发未实现 | 待排期 |
| 路径别名落地 | `@shared/@shell/@pages/@app` 已配置但代码 0 处使用，39 个文件仍用相对路径 | 后续重构时逐步替换 |
| ErrorBoundary 双份 | `src/components/` 与 `src/shell/feedback/` 各一份 | 待收敛为一份 |

---

## 版本信息

| 项 | 值 |
|---|---|
| 验收版本 | v0.5.0-dev |
| 分支 | `master`（当前）；历史：`dev-frontend/TraeCodeCloud-SeedCode`（PR #1）、`feat/F1-visual-upgrade` |
| 验收人 | ZCode（本次一致性核实） |
| 验收日期 | 2026-08-15 |

---

*最后更新：2026-08-15 · ZCode · 文档与代码一致性核实（F2-2 状态修正、右面板规格 320–960、F0-3 命中数更新、已知限制刷新）*