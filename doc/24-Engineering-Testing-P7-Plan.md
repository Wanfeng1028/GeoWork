# GeoWork 测试工程 P7 计划（打包/联调 E2E + 变异测试试点）

> **文档路径**：`doc/24-Engineering-Testing-P7-Plan.md`
> **关联文档**：`doc/16-Engineering-Testing.md`（测试规范，含 P4/P6）/ `doc/20-Engineering-E2E-Testing.md`（E2E 规范，含 P7 唯一定义）/ `doc/22-Backend-Refactor-Plan.md`（BP5/BP6 后端未决项）/ `doc/17-Engineering-Release.md`（发布与打包）
> **适用对象**：测试贡献者 + core/server/worker/apps-desktop 贡献者（含 AI 编程助手）
> **状态**：**已评审，待用户下令开工**（2026-08-17）。本计划只落档，不在用户说"开工"前动任何代码。
> **背景**：P0-P6 测试工程已完成（CI 7 job 全绿；P4 增量覆盖率门禁 + flaky 隔离；P5 OpenAPI 单一真相 + 双侧契约；P6 安全扫描三件套 + 性能基线 + HTTP 韧性）。P7 是测试工程路线图的收尾段。

---

## 0. 缺口结论（2026-08-17 评审）

P7 在 `doc/20-Engineering-E2E-Testing.md:11` 的原始定义只有一句："Electron 壳、Go core（8765）、worker（8766）目前不在 E2E 覆盖内（打包后 Electron E2E 属 P7）。"

评审结论：**直接按字面"打 release 包再跑 E2E"是本末倒置。** 当前仓库最大的测试盲区不是打包，而是 Electron 壳 ↔ Go core(8765) ↔ worker(8766) 这条集成链**完全未被测过**：

| 现状 | 覆盖情况 |
|---|---|
| Playwright E2E | 只驱动 `apps/desktop` 的 `dev:e2e`（Vite dev server @ 5173，纯 Chromium），**不启动 Electron 主进程 / Go core / worker** |
| 渲染层 `window.geowork` | 全可选链，能在纯 Chromium 渲染——因此 IPC 桥**零测试** |
| API 级 E2E | 直接打 `http://localhost:8767`（Go server），假定外部已起——**无进程编排** |
| 三进程边界（IPC / SSE-WS / 端口契约 / 审批流端到端） | **零覆盖** |

故 P7 应拆成三段，按"单位投入风险下降最大"排序，**不先碰打包**。

---

## 1. 决策与排序

| 段 | 内容 | 价值 | 前置 | 建议时机 |
|---|---|---|---|---|
| **P7-1** | 三进程联调 E2E testbed（真实 Electron dev + 真实 core/worker/server，**不打包**） | **最高**——补上最大盲区 | 无硬前置 | **现在做** |
| **P7-2** | 视觉回归落地（`toHaveScreenshot` + 基线） | 中——直供 v1.0 设计系统对齐 gate | 复用 P7-1 testbed | P7-1 后 |
| **P7-3** | 打包产物 E2E + release 流水线 | 低（v1.0 前夕才有意义） | electron-builder CI、`release.yml` | v1.0 准备期 |

交错轨道（非 P7 子任务，但与 P7 强耦合）：
- **BP5 后端事件可靠性**（doc/22 §3，未完成）——P7-1 会把 SSE resync / goroutine 泄漏 / 假工具调用 / 审计缺漏这类 bug **测出来**，建议 test-first 交错
- **变异测试试点**——三侧全净地，挑一侧 PoC

---

## 2. P7-1 三进程联调 E2E testbed（不打包）

> 目标：让 Playwright 驱动真实 Electron app + 真实 Go core + 真实 Python worker + 真实 server，验证 IPC 桥、SSE/WS、端口契约、审批流端到端。**不打包**，用 `electron` dev 模式启动。

### 2.1 testbed 架构

新建独立 Playwright project（与现有 `chromium` project 并列），用 `_electron` 启动真实 Electron 主进程，而非 Vite dev server：

```
tests/e2e/
├─ playwright.config.ts          # 新增 'electron' project（linux 用 xvfb-run）
├─ fixtures/
│  ├─ processes.fixture.ts       # 新：启动 core/worker/server 子进程，全局 setup/teardown
│  └─ electron.fixture.ts        # 新：_electron.launch(app.main)，注入 token
├─ projects/
│  └─ electron/                  # 新：只在真实壳里跑的 spec
│     ├─ ipc-bridge.spec.ts      # window.geowork API 实可达
│     ├─ approval-flow.spec.ts   # 审批 SSE 端到端（依赖 BP5）
│     └─ sandbox-real.spec.ts    # run_shell 真实落盘到 workspace
```

### 2.2 进程编排（`processes.fixture.ts`）

- 启动 `server`（Gin 8767，临时 SQLite，`GEOWORK_AUTO_REGISTER_ENABLED=true`，放宽限流——复用现 e2e-smoke 的 env 模式）
- 启动 `core`（geowork-runtime 8765，注入 `GEOWORK_WORKER_TOKEN`）
- 启动 `worker`（uvicorn 8766，`GEOWORK_INSECURE_NO_AUTH=1` 或配同 token）
- **健康门**：每个进程 ready 后才进入测试（轮询 `/health` 或对应探活端口）——参考 `scripts/worker_smoke_contract.py` 的轮询模式
- **teardown**：逆序 kill + 端口回收 + workspace 清理

### 2.3 Electron 启动（`electron.fixture.ts`）

- `_electron.launch({ args: ['.'] })` 启动 dev 模式 Electron 主进程（`apps/desktop`）
- 从环境读 token 注入 `process.env.GEOWORK_WORKER_TOKEN`，让主进程透传给 core
- CI Linux 用 `xvfb-run`；Windows 原生（已有 `e2e-smoke-windows` runner 模式可复用）

### 2.4 复用的现有基建

- `data-testid` 锚点体系（doc/20 §2.2）、`AppShellPage` / `ChatComposerPage` 两个 PO、`auth.fixture.ts`——可直接用
- CI 启动 server 的 env 模式（现 e2e-smoke 已验证）
- worker 的 `GEOWORK_INSECURE_NO_AUTH` 旁路（d9c4967 已修好）

### 2.5 开工前要补的缺口

- **PO 层补齐**：现仅 shell+composer 两个 PO；settings / workspace / artifact / diff / permission 都裸写 locator。且 `tests/e2e/helpers/app-helpers.ts` 还在用 `waitForTimeout(2000)/(500)` 硬等待 + 类选择器（`.left-sidebar` / `.geo-composer`），与 PO 的 `data-testid` 风格冲突。**P7-1 前先补这几个 PO、把 helpers 收敛进 PO**，否则联调 spec 会复制粘贴一堆脆弱定位。
- **进程契约脚本已有**（`scripts/worker_smoke_contract.py`、`scripts/core_worker_contract.py`）——testbed 的进程启动逻辑可参考其健康轮询模式。

### 2.6 CI 影响

- 新增 job `e2e-electron`（ubuntu + xvfb，可选再加 windows），只跑 `projects/electron/` 下的 spec，标 `@integration`
- **遵守用户约束**：本地不跑 Playwright，只推远端验证
- 成本：比现 e2e-smoke 重（多起 Electron + 3 个后端进程），预计 3-4 分钟
- **触发策略**：用 `workflow_dispatch` + schedule（nightly），或 `paths` 过滤只在 `core/**`、`apps/desktop/electron/**`、`tests/e2e/projects/electron/**` 变更时跑——**不上每次 push**，避免拖慢 PR 反馈

### 2.7 验收

- 至少 3 个端到端 spec 绿：IPC 桥可达、审批 SSE 一次往返、`run_shell` 真实落盘可读
- CI job 在 ubuntu + windows 都过
- `doc/20` §1 更新：三进程"不在 E2E 覆盖内" → "已覆盖（dev 模式）"

---

## 3. BP5 交错（与 P7-1 test-first）

P7-1 几乎一定会**测出 BP5 描述的那类 bug**。doc/22 §1 原则 4 已点明：前端 Session 的 SSE resync 依赖 BP5 的事件可靠性。建议做法：**P7-1 先行**，把 BP5 当"被 P7-1 测出来的待修项"逐个修，而非闭门造 BP5 再补测试。每个子项配一个能复现的 P7-1 spec（红 → 修 → 绿），天然 test-first。

BP5 子项（按 doc/22）：
- SSE 断连 resync（前端 Session 重连后不丢消息）
- goroutine 泄漏审计（长跑后 process 数不涨）
- 假工具调用识别（orchestrator 不被伪 `tool_result` 欺骗）
- 事件审计日志完整

BP6（网关接线与演示代码清算）可更靠后，不阻塞 P7。

---

## 4. P7-2 视觉回归落地

doc/16 §4 写了完整策略但**零实现**（无 `toHaveScreenshot`、无 `tests/snapshots/`）。是 v1.0 gate"设计系统全页面对齐"最直接的验收手段，成本低。

- **基线范围**：4 个关键页面 × 明暗 2 套——`/new-task` 空/有对话、`/settings`、`/tasks`
- **生成方式**：`npx playwright test --update-snapshots` 首次存基线（需用户本地放行一次，或 CI 跑一次 commit 基线）
- **CI 对比**：`e2e-smoke` job 加一步对比，超阈值 fail
- **阈值**：`maxDiffPixelRatio: 0.01`（容字体抗锯齿差异）；Windows runner 需单独基线（字体不同）
- **避坑**：对"每次都变"的页面（带时间戳/动态数据）要反复红——先用 `locator.screenshot()` 钉到稳定容器，而非整页截图

---

## 5. 变异测试试点

三侧全净地（无 stryker / gremlins / mutmut / go-mutesting）。**不要三侧一起上**——挑一侧 PoC，验证 ROI 再扩。

### 5.1 推荐先做 JS 侧（Stryker + vitest）

理由：
- 前端已有 98 个 vitest 测试 + v8 覆盖率 + `scripts/check_frontend_boundaries.mjs` 边界守护，是最成熟的可变异靶场
- `@stryker-js/vitest-runner` 与现有 vitest 直接对接，配置量最小
- 前端 store/session 层（`modelProviderStore`、`shared/session/`）逻辑纯、隔离好，变异结果信噪比高
- **PoC 范围**：只跑 `src/shared/session/` + `src/__tests__/modelProviderStore.test.ts` 对应源文件，**不全量**

### 5.2 Go 侧备选（gremlins）

core 的 `permissions/` + `safety/guardrails` 是安全关键路径，变异价值最高，但 gremlins 工具链成熟度低于 stryker、Go 变异跑得慢。建议 JS 试点成功后再评估。

### 5.3 Python 侧（mutmut）

worker 逻辑多为 IO/字符串处理，变异 ROI 最低，最后再说。

### 5.4 CI 策略

变异测试慢，**绝不上 push 触发**。用 nightly 或 `workflow_dispatch`，结果只报告 mutation score，**不设硬门禁**——先观察 2-4 周看分数是否稳定可信，再决定要不要 gate。

---

## 6. P7-3 打包产物 E2E + release 流水线（v1.0 前夕）

只有真要发版时才有意义。前置全缺：无 `release.yml`、无 electron-builder CI、`doc/17 §4.3` 自动更新是 TODO、`doc/11 §5` 部署流水线是 TODO。

- 建 `release.yml`（tag 触发）：electron-builder 出 win/mac 产物 + 上传 GitHub Release
- P7-3 E2E：下载 release artifact → 启动打包后的 .exe/.app → 跑 P7-1 的 spec 子集（验证打包后路径 / 签名 / 内置资源没破坏）
- electron-updater 接入（doc/17 §4.3）

**现在不做**。v0.5.x-dev 阶段打包验证是纯成本。

---

## 7. 路线图编号缺口（P3/P5）

调研发现 `doc/16` 版本表 v1.0 → v1.1(P4) → v1.2(P6)，**P3 和 P5 从未在测试文档里定义过**。这不是疏漏就是被别的命名空间占了（doc/04 的后端 P0-P3、doc/21 的前端 P1-P6 都叫 P，极易混淆）。

**建议**：P7-1 开工时在 doc/16 版本表补一行说明，**正式声明编号不连续**（强凑 P3/P5 反而制造虚假规划感）——例如"P3/P5 保留未用；测试工程阶段以实际交付的 P4/P6/P7 为准"。

---

## 8. 暂不做（纪律）

- **不全量变异测试**：慢、吵、信噪比低，先 PoC 一侧
- **不上 visual regression 全页面**：只钉 4 个关键页
- **不现在建 release 流水线**：v0.5.x-dev 没有发版需求
- **不在 push 触发重 E2E job**：P7-1 的 electron job 用 nightly / paths 过滤
- **不碰 `apps/desktop_backup_old/`**：旧前端备份，非活跃，别被误导

---

## 9. 验收标准 & 文档同步义务

按 `AGENT.md §15.3`（代码与文档同周期同步），P7 每段完成后须同步：

| 完成 | 须更新 |
|---|---|
| P7-1 | `doc/20` §1（三进程覆盖状态）、`doc/16` §5 E2E 计划、`AGENT.md §14` 施工记录、`CHANGELOG.md [Unreleased]` |
| P7-2 | `doc/16` §4（视觉回归从策略→已落地）、同上 |
| P7-3 | `doc/17` §4.3（自动更新 TODO 状态）、`doc/11` §5（部署流水线）、`doc/20` §1、同上 |

**推荐执行顺序（TL;DR）**：

1. P7-1：补 PO 层 → 建三进程 testbed fixture → 3 个端到端 spec → CI electron job（nightly/paths 触发）
2. BP5（交错）：P7-1 测出的 SSE/泄漏/假工具逐个 test-first 修
3. P7-2：4 页视觉回归基线 + CI 对比
4. 变异试点：Stryker + vitest，钉 session/modelProviderStore，nightly 报分数不门禁
5. P7-3：v1.0 前夕再建 `release.yml` + 打包产物 E2E
