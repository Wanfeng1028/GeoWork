# GeoWork 文档导航

> 10 分钟读完这份指南，知道"改什么代码 → 读什么文档"。

## 文档层级

```
Level 0 — 宪法（极少改动）
├── AGENT.md                              ← 全局约束 + 路由表 + 纪律
└── 01-GeoWorkFrontend-Design-System.md      ← 视觉宪法（色值/圆角/组件规格）

Level 1 — 规范（按阶段更新）
├── 03-GeoWorkFrontend-Engineering-Standards.md  ← 前端代码规范（状态管理/API/测试/性能）
├── 09-GeoWork-Communication-Protocol.md         ← 前后端通信协议（SSE + WebSocket）
└── 10~19-Engineering-*.md                      ← 各领域工程规范（见下表）

Level 2 — 施工图（每个 P 阶段更新）
├── 02-GeoWorkFrontend-Design-System-Detailed.md  ← 视觉施工（F0-FP3）
├── 05~08-GeoWorkAgent-P0~P3-Detailed-Design.md ← 后端施工（接口签名/伪码/验收）
└── 19-Engineering-Implementation-Plan.md          ← 工程化施工（E0-E2）

Level 3 — 记录（持续追加）
├── CHANGELOG.md
└── ADR/                                       ← 架构决策记录
```

## 按模块索引

| 你要改的 | 先读这个 | 再读这个 |
|---|---|---|
| **任何代码** | `AGENT.md` | 下面对应的行 |
| 前端 UI | 设计系统 | 施工计划 + 工程规范 |
| 前端状态/API | 工程规范 §1-2 | TypeScript 规范 |
| Go Core | 04-GeoWorkAgent.md | P0-P3 对应阶段文档 |
| Go Core 通信 | 通信协议 | P1 §4.5（SSE）+ §5.5.1（WS） |
| Python Worker | 对应技能的 SKILL.md | — |
| CI/CD | 11-Engineering-CI-CD.md | 10-Engineering-Git-Workflow.md |
| 安全相关 | 12-Engineering-Security.md | — |
| 测试 | 16-Engineering-Testing.md | 工程规范 §3 |

## Engineering 文档速查

| 文档 | 一句话 |
|---|---|
| `10-Engineering-Git-Workflow.md` | 分支策略 + commit 规范 + PR 模板 |
| `11-Engineering-CI-CD.md` | GitHub Actions pipeline + 环境管理 + 门禁规则 |
| `12-Engineering-Security.md` | Electron 安全 + CSP + XSS + IPC 规范 + 依赖审计 |
| `13-Engineering-TypeScript.md` | tsconfig 配置 + strict 模式 + 运行时校验 |
| `14-Engineering-ESLint-Prettier.md` | oxlint 规则 + Prettier + import 排序 + import 边界 |
| `15-Engineering-API-Contract.md` | REST 规范 + 错误码 + SSE 事件类型 + 版本管理 |
| `16-Engineering-Testing.md` | 测试分层 + MSW mock + Playwright + 跨平台 |
| `17-Engineering-Release.md` | SemVer + CHANGELOG + Feature Flags + 打包发布 |
| `18-Engineering-Monitoring.md` | Sentry 错误上报 + Electron 性能指标 + 埋点 |

## 阅读顺序建议

**新加入项目的 AI 助手**：

1. `AGENT.md`（5 分钟）— 知道规矩
2. 你负责模块对应的文档（5 分钟）— 知道规范
3. 当前 P 阶段的施工图（10 分钟）— 知道要做什么

**不需要全读**。14+ 份文档全部加载到上下文会浪费 token。按 `AGENT.md §3` 路由表只读你需要的。

## P0 开工前 TODO 看板

### 决策原则

按"什么时候做"分为四档，每个 TODO 给出明确决策和理由。

---

## 第一档：P0 开工前必须完成（阻塞项）

这些不做，P0 写出来的代码就没有质量保障，或者架构地基不稳。

| TODO                    | 决策                | 理由                                                         |
| ----------------------- | ------------------- | ------------------------------------------------------------ |
| `oxlintrc.json` 待创建  | **立即做，30 分钟** | 没有 lint 配置 = 没有代码质量底线。P0 开始写代码的第一天就需要它 |
| Prettier 待引入         | **立即做，15 分钟** | 格式化不统一会在第一个 PR 就产生无意义 diff。和 oxlint 配合：oxlint 管逻辑，Prettier 管格式 |
| `lint-staged` 待配置    | **立即做，10 分钟** | 没有 pre-commit hook，lint 规则形同虚设。三个文件一起配：`.lintstagedrc.json` + `package.json` scripts + husky（或 simple-git-hooks） |
| `typecheck` 脚本待配置  | **立即做，5 分钟**  | `package.json` 加一行 `"typecheck": "tsc --noEmit"`。CI 的 typecheck job 依赖这个 |
| 路径别名待配置          | **立即做，15 分钟** | P0 会大量写 import，如果路径别名没配好，第一天就会出现 `../../../../` 地狱。`tsconfig.json` + `vite.config.ts` 同步配 |
| `errors.go` 待创建      | **立即做，20 分钟** | Go Core 的错误处理是 P0 ReAct 循环的基础。没有统一错误结构，前端收到的错误格式会混乱 |
| `.gitattributes` 待创建 | **立即做，2 分钟**  | 一行 `* text=auto eol=lf`。不做的话 Windows 上 clone 一次就全是 CRLF diff |



**总计约 1.5 小时，全部是配置类工作，不涉及业务逻辑。**

---

## 第二档：P0 期间顺手完成（不阻塞但越早越好）

这些在 P0 开发过程中会自然遇到，遇到了就顺手做掉。

| TODO                                        | 决策                                                         | 触发时机                                                     |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `strict: true` 分阶段开启                   | **P0 第一周开 `strictNullChecks`，P0 结束时开全量 `strict`** | 写第一个 API 调用时就会遇到 null 问题。分两步：先 `strictNullChecks`（影响最大、收益最大），稳定后再开 `noUncheckedIndexedAccess` |
| IPC `types.ts` 待创建                       | **P0 中第一次需要 IPC 通信时创建**                           | 如果 P0 的 ReAct 循环不涉及 IPC（前端直连 Go Core），可以推迟到 P1。但 `src/shared/ipc/types.ts` 的文件结构应该现在就建好（空文件 + 注释说明用途） |
| `timeout_per_tool` / `timeout_total` 值待定 | **P0 实现 Orchestrator 时定**                                | 建议初始值：`timeout_per_tool = 60s`（单个工具调用）、`timeout_total = 300s`（整个 Run）。这两个值不需要精确，先跑通再调 |
| `.env.example` 待创建                       | **P0 中第一次需要环境变量时创建**                            | 内容就是当前实际用到的变量 + 注释。不要提前猜测未来需要什么变量 |
| `check_doc_links.py` 待编写                 | **P0 结束、第一次执行文档新鲜度检查时写**                    | AGENT.md §15.5 规定了每 P 阶段结束做文档检查，这个脚本就是那个检查的自动化。P0 期间文档不会大改，手动检查一次就够 |



---

## 第三档：P1 阶段做（有明确的前置条件）

这些依赖 P1 的功能需求，提前做没有意义。

| TODO                         | 决策                                               | 前置条件                                                     |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| §22.2 待决策项 D1-D4         | **P1 开工前一周决策**                              | 需要先看 P0 跑通后的实际瓶颈是什么，再决定 D1-D4 的方向。现在决策 = 猜测 |
| Hooks 依赖选择（07 P2 文档） | **推迟到 P2 开工时决策**                           | P2 是 Browser/Computer Use，离现在太远。技术选型到那时候可能有更好的选项 |
| DOMPurify 待引入             | **P1 实现审批 UI 时引入**                          | 审批弹窗需要渲染 Agent 生成的 reason 文本，这时候才有 XSS 风险。P0 没有用户输入渲染场景 |
| `sandbox` 加固待实施         | **P1 实现 Human-in-the-Loop 时做**                 | 审批流意味着 Agent 可以执行危险操作，这时候 sandbox 才有意义。P0 的 ReAct 循环是只读的（或受限的） |
| `X-Request-ID` 待实现        | **P1 实现 WebSocket 时顺手做**                     | WS 连接建立后需要 trace ID 来关联请求链路。和 WS Session Manager 一起实现 |
| `featureFlags.ts` 待创建     | **P1 有第一个需要灰度的功能时创建**                | P0 没有灰度需求（只有一个用户 = 你自己）。P1 的审批流如果需要 A/B 测试才创建 |
| Pre-commit hooks 完善        | **P1 有第二个开发者（包括第二个 AI agent）时完善** | 当前只有你 + 一个 AI，lint-staged 够了。多人时才需要更复杂的 hook（commit message 校验、分支保护等） |



---

## 第四档：推迟到触发条件满足时做（不排期）

这些要么依赖外部条件（用户量、团队规模），要么当前收益为零。

| TODO                                  | 决策                                  | 触发条件                                                     |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Playwright 待配置                     | **UI 稳定后（FP3 结束时）配置**       | P0-P2 期间 UI 会频繁变动，E2E 测试写了就废。等 FP3 视觉基线固定后再配 |
| E2E 测试工具最终选择                  | **同上，Playwright 大概率是最终答案** | 不需要现在"决策"，到时候 Playwright 仍然是最优选。Electron 有官方 `@playwright/test` 支持 |
| 虚拟滚动库待引入                      | **任务列表超过 100 条时引入**         | 你现在可能只有几个任务。等真正出现性能问题时再加 `@tanstack/react-virtual`，不要提前引入增加 bundle |
| 右面板 <1280px 自动收起               | **FP3 布局收尾时实现**                | 这是 UX 优化，不是功能缺失。F2 阶段做布局骨架时顺手加一个 `useMediaQuery` 就行 |
| `tokens.json` 自动化管线              | **设计系统 v2.0 时评估**              | 当前手动同步 `themes/*.ts` 完全够用。只有当设计 token 数量超过 100 个、且需要多端同步时才有自动化价值 |
| OpenAPI 自动生成                      | **API 端点超过 20 个时评估**          | 当前 API 面很小（runs/steps/tools 几个），手写 interface 比维护 OpenAPI spec 更快。等 API 稳定且数量增长后再考虑 |
| Bundle size 检查                      | **首屏 JS 接近 500KB 时配置**         | 现在项目刚起步，bundle 可能只有 200KB。等接近预算时再加 `size-limit` |
| `electron-updater` 自动更新           | **有第一个外部用户时实施**            | 你自己用不需要自动更新。等 beta 发布给其他人用时才需要       |
| 灰度机制待建                          | **同上，有外部用户时**                | 一个人的项目没有灰度需求                                     |
| `sentry.ts` / `errorHandler.ts`       | **P1 结束时引入**                     | P0 阶段你自己就是监控。P1 有了审批流和更复杂的异步逻辑后，错误上报才有价值 |
| 性能上报 / 用户埋点                   | **有 5+ 用户时**                      | 一个人的项目不需要埋点。等真正有用户反馈"慢"的时候再加       |
| `govulncheck` / `pip-audit` 集成到 CI | **第一次引入外部依赖时**              | Go 的 `govulncheck` 在 `go mod tidy` 后跑一次就行。Python worker 如果不用第三方库就不需要 `pip-audit` |
| 部署流水线                            | **有部署需求时**                      | Electron 桌面应用没有"部署"概念，只有"打包发布"。等 Release 流程跑通后再建 |



---

## 汇总：P0 开工前的 Action List

```bash
# 1. 创建 oxlintrc.json（30 min）
# 2. 安装 + 配置 Prettier（15 min）
# 3. 配置 lint-staged + simple-git-hooks（10 min）
# 4. package.json 加 typecheck 脚本（5 min）
# 5. tsconfig.json + vite.config.ts 配路径别名（15 min）
# 6. core/internal/api/errors.go 创建（20 min）
# 7. .gitattributes 创建（2 min）
# 8. tsconfig.json 开启 strictNullChecks（5 min）
# 9. src/shared/ipc/types.ts 创建空骨架（5 min）
```

**预计工时：约 2 小时。完成这些后，P0 的代码质量基础设施就绑定了。**
