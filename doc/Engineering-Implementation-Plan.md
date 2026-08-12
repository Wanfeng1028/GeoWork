# GeoWork 工程化施工计划

> **文档路径**：`doc/Engineering-Implementation-Plan.md`
> **关联文档**：`AGENT.md` §15（文档治理）/ 各 `Engineering-*.md` 规范
> **文档定位**：9 份工程规范的落地排期——什么时候做、谁来做、做完怎么验收
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：E0-E2 三阶段工程化施工计划 |

---

## 1. 阶段总览

```
E0（基础设施）──→ E1（质量门禁）──→ E2（可观测性）
  约 3 天              约 2 天            约 2 天
```

| 阶段 | 目标 | 前置条件 |
|---|---|---|
| E0 | 代码规范落地（lint/format/tsconfig/CI pipeline） | 无 |
| E1 | 测试基础设施（集成测试 + E2E 框架 + 视觉回归） | E0 |
| E2 | 可观测性（错误上报 + 性能监控 + Feature Flags） | E0 |

---

## 2. E0：基础设施（约 3 天）

| # | 任务 | 对应规范 | 预计工时 | 验收标准 |
|---|---|---|---|---|
| E0-1 | 创建 `oxlintrc.json`，补充安全相关规则 | `Engineering-ESLint-Prettier.md` §2 | 0.5 天 | `npm run lint` 无 error |
| E0-2 | 引入 Prettier + `.prettierrc` | `Engineering-ESLint-Prettier.md` §3 | 0.5 天 | `npx prettier --check src/` 通过 |
| E0-3 | tsconfig 开启 `strict: true`（第一阶段：用 `@ts-expect-error` 标记暂时修不了的） | `Engineering-TypeScript.md` §1.3 | 0.5 天 | `tsc --noEmit` 无未标记的错误 |
| E0-4 | 创建 `.github/workflows/pr-check.yml`（前端 build + lint + test + Go build + test） | `Engineering-CI-CD.md` §2 | 1 天 | PR 触发 CI，门禁生效 |
| E0-5 | 创建 `.env.example` | `Engineering-CI-CD.md` §3 | 0.5 天 | 新开发者照着配环境能跑起来 |

### E0 验收

- [ ] CI pipeline 在 PR 上自动运行
- [ ] lint + build + test 全部通过才能合并
- [ ] tsconfig `strict: true` 开启（有 `@ts-expect-error` 标记的除外）
- [ ] Prettier 格式化全项目

---

## 3. E1：测试基础设施（约 2 天）

| # | 任务 | 对应规范 | 预计工时 | 验收标准 |
|---|---|---|---|---|
| E1-1 | 引入 MSW（Mock Service Worker），创建基础 handlers | `Engineering-Testing.md` §3 | 0.5 天 | API 测试不依赖真实后端 |
| E1-2 | 为核心 Store 补集成测试（taskSidebarStore + appearanceStore） | `Engineering-Testing.md` §2 | 0.5 天 | Store 测试覆盖所有 action |
| E1-3 | 配置 Playwright + 基础截图对比 | `Engineering-Testing.md` §4 | 1 天 | `/new-task` 空状态截图基线生成 |

### E1 验收

- [ ] Store 测试全部通过
- [ ] Playwright 截图对比在 CI 中运行
- [ ] MSW mock 覆盖主要 API 端点

---

## 4. E2：可观测性（约 2 天）

| # | 任务 | 对应规范 | 预计工时 | 验收标准 |
|---|---|---|---|---|
| E2-1 | 前端全局错误捕获（`window.onerror` + `unhandledrejection`） | `Engineering-Monitoring.md` §1.4 | 0.5 天 | 未捕获异常被记录 |
| E2-2 | 创建 `src/shared/featureFlags.ts` | `Engineering-Release.md` §6 | 0.5 天 | `isFeatureEnabled()` 读写正常 |
| E2-3 | Sentry 初始化 + DSN 配置 | `Engineering-Monitoring.md` §1.2 | 1 天 | 生产环境错误上报到 Sentry |

### E2 验收

- [ ] 生产环境错误自动上报
- [ ] 开发环境不上报（走 console.error）
- [ ] Feature Flag 可通过 localStorage 开关

---

## 5. 依赖关系

```
E0-1 ──┐
E0-2 ──┤
E0-3 ──┼──→ E0-4 (CI) ──→ E1-3 (Playwright in CI)
E0-5 ──┘
              E0 ──→ E1-1 ──→ E1-2
              E0 ──→ E2-1 ──→ E2-3
              E0 ──→ E2-2
```

E0 内部任务可并行。E1/E2 依赖 E0 完成（需要 CI pipeline 和 lint 基础）。

---

## 6. 与 P 阶段的关系

| 工程化阶段 | 对应的 Agent P 阶段 | 说明 |
|---|---|---|
| E0 | P0 施工期间并行 | 基础设施不阻塞功能开发 |
| E1 | P1 施工前完成 | P1 的审批流/WS 需要集成测试覆盖 |
| E2 | P1 施工期间并行 | 可观测性独立于功能开发 |
