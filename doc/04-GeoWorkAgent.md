# GeoWork Agent 架构规范

> **文档路径**：`doc/04-GeoWorkAgent.md`
> **适用对象**：所有参与 GeoWork 后端开发的工程师、AI 编程助手、代码审查者
> **文档定位**：Agent 系统架构规范——定义 GeoWork 的 Agent Runtime 如何设计、运行和演进
> **核心公式**：**Agent = Model + Harness**
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 作者 | 变更摘要 |
|---|---|---|---|
| v1.0 | 2026-08-11 | qwen | 初稿：三层架构、Agent 工程概念体系、两条链路现状、Agentic Loop 设计、Context/Memory/Skills/MCP/Guardrail 各学科规划、版本路线图 |
| v1.1 | 2026-08-11 | GLM | 新增第 0.1 节"整体架构设计原则"（设计宪法：6 条哲学 + 15 个学科清单 + 关系图 + 8 条不可妥协约束）；新增第 0.2 节"现状诊断"如实标注代码与文档的 8 处重大偏差；修正第 3/4/5/7/9/10/15/21/22 节中"已有"与"目标"的界限；标注死代码与并发缺陷；补全状态机/工具注册表/Planner 三者不一致问题 |
| v1.2 | 2026-08-11 | GLM | 学科清单补全 15→18（新增 Harness Engineering / Prompt Engineering / Streaming & Event Engineering）；关系图重绘（Harness 提升为最外层外壳）；第 22 节记录 4 项已拍板决策（D5 不合并+统一入口+审批分层 / D6 方案A / D7 修白名单+保留phase约束 / D8 启用 Executor） |
| v1.3 | 2026-08-11 | GLM | P0-P3 四阶段施工方案落地为独立详细设计文档（`GeoWorkAgent-P0/P1/P2/P3-Detailed-Design.md`）；第 21 节优先级表补全详细设计文档引用；新增 P0-P3 任务-学科-文档对照表；明确 P0→P1→P2→P3 串行依赖与各阶段验收边界 |
| v1.4 | 2026-08-11 | GLM | 豆包-code 审查反馈补全：P2 新增 P2-7 Browser/Computer Use（已有 browserbridge 代码接入 ToolRegistry + CDP 适配器 + 沙箱约束）；P3-3 补充 §4.5 流式提前执行（SpeculativeExecutor + ReadOnly 标记 + streamModelCall 集成）；§0.1.2 学科清单 18→19（Browser/Computer Use 作为第 19 个学科，与 Python Worker 同为执行层）；§0.1.3 关系图补入 Browser；第 21 节优先级表新增 P2-7 行 |
| v1.5 | 2026-08-11 | GLM | 千问审查 6 处硬伤 + 4 处软伤修复：P0 v0.3（idx 写死/工具名映射/ModelGateway interface/状态机转换）；P1 v0.2（审批超时/CachedTokens）；P2 v0.3（Skills 格式统一 SKILL.md）；主文档 §3.3 工具数 12→13 修正 |
| v1.6 | 2026-08-12 | Qwen | 修正 skills/ 相关事实错误：§0.1.2 #6 从 ❌ 改为 ⚠️（骨架已立）；§0.2.2 偏差 #8 更正（目录已存在）；§7 GLM 注替换为 v1.2 修正说明；§7.1 目录结构对齐实际扁平结构（SKILL.md + manifest.json）；§7.4 技能名对齐实际目录名 |
| v1.7 | 2026-08-12 | — | 新增 §24 持久化层设计（SQLite 选型 + schema + 迁移策略）；新增 §25 API 认证模型（当前无认证 + AuthMiddleware 预留）；新增 §26 配置管理（config.yaml + 环境变量 + 默认值三层覆盖） |

> **阅读约定**：本文档严格区分 **【现状】**（代码中已实现）与 **【目标】**（规划中、未实现）。凡标注 【目标】 的内容不得在代码审查时作为"已有功能"引用。qwen v1.0 的原始叙述保留在正文，GLM v1.1/v1.2/v1.3/v1.4/v1.5 的修正以 > 引用块或 【现状/目标】 标注注入。

---

## 0.1 整体架构设计原则（v1.1 新增，v1.2 补全学科清单）

> 本节是 GeoWork Agent 系统的"设计宪法"——在展开任何具体模块设计之前，先明确：我们到底要集成哪些工程学科、它们之间是什么关系、有什么不可妥协的约束。后续所有章节（1-23）都必须与本节对齐，不得违背。
>
> 本节回答的问题：**GeoWork 到底要做成一个什么样的 Agent 系统？它必须包含哪些"器官"？**

### 0.1.1 核心设计哲学

| 原则 | 含义 | 反例（禁止） |
|---|---|---|
| **Agent = Model + Harness** | 模型只负责"想"，Harness（Go Core）负责"防、量、修、记"。模型不可信，Harness 是底线。 | 把安全规则只写在 prompt 里，靠模型自觉 |
| **本地优先** | 所有 Agent 状态、记忆、工具执行都在本地 Go Core 完成；Cloud 只做 Auth/Team/Sync，不参与 Agentic Loop | 把 Agent 循环放到云端，本地只做 UI |
| **有界自主** | Agent 的自主权分级：完全自主 / 通知后执行 / 请求确认 / 禁止。破坏性操作必须有 Human-in-the-Loop | Agent 直接执行 `git push --force` 不问用户 |
| **确定性优先于灵活** | 能用 Workflow（DAG）解决的就不滥用 LLM Agent；LLM 只在"用户意图开放"时介入 | 把"每日 NDVI 监测"这种固定流程也交给 LLM 每次重新规划 |
| **可追溯 > 可执行** | 一个 Run 跑完后，必须能回放每一步的 thought/tool/observation/verification。宁可慢，不可黑箱 | 只存最终结果，不存中间轨迹 |
| **两条链路共存但统一工具入口** | aiagent（LLM 驱动）与 agent（DAG 驱动）定位不同，不合并；但工具调用必须统一走 ToolRegistry，确保权限/审计/沙箱对两者都生效 | Workflow 链路绕过 ToolRegistry 直接调 worker（当前现状，见 0.2.2 偏差 #6） |

### 0.1.2 GeoWork 必须集成的工程学科清单

> 下表是 GeoWork Agent 系统**必须集成的全部工程学科**。每个学科对应一个"器官"，缺一不可。"现状"列标注当前代码状态：✅ 已生效 / ⚠️ 已写未接线 / ❌ 未实现。详细的现状诊断见 0.2 节。
>
> **v1.2 修正**：v1.1 初版遗漏了 Harness Engineering / Prompt Engineering / Streaming & Event Engineering 三个学科，现补全为 18 项。
>
> **v1.4 修正**：v1.3 补 P2-7 Browser/Computer Use 详细设计时，漏把它作为第 19 个学科加入本清单。现补全为 19 项。Browser/Computer Use 与 #18 Python Worker 是同类——都是执行层能力，有独立工程问题（CDP 协议/会话管理/URL 沙箱/OCR），理应同等对待。

| # | 学科 | 解决什么问题 | GeoWork 对应模块 / 文件 | 文档章节 | 现状 |
|---|---|---|---|---|---|
| 1 | **Harness Engineering**（外壳工程·元学科） | 系统该**防止/量测/修正/记录**什么——所有安全规则在 Go 代码里强制，不靠 prompt 自觉 | Go Core 整体（跨 §10/§11/§16） | §0.1.1 | ⚠️ 哲学已立，规则散落各处未统一 |
| 2 | **Loop Engineering**（循环工程） | Agent 如何持续自主工作：ReAct 循环、停止条件、错误处理 | `aiagent/orchestrator.go` 的核心循环 | §4 | ❌ 当前是线性执行，非 ReAct |
| 3 | **Context Engineering**（上下文工程） | 每一步该给模型看**什么**：预算分配、压缩、隔离 | `context_builder.go` + `context_budget.go` + `repo_map.go` | §5 | ⚠️ 已写未接线 |
| 4 | **Prompt Engineering**（提示工程） | 上下文内容该**怎么组织**：指令层级、system prompt 装配、tool 描述格式、few-shot | `context_builder.go` 的 system prompt 装配 + §5.4 | §5.4 | ⚠️ 装配逻辑存在但未走 ContextBuilder |
| 5 | **Tool Use & Governance**（工具使用与治理） | Agent 如何安全调用外部工具：注册、权限、审计、沙箱 | `toolregistry/` + `sandbox/` + `permissions/` | §6 | ⚠️ aiagent 链路已接，workflow 链路绕过 |
| 6 | **Skills Engineering**（技能工程） | 可复用能力的模块化打包：技能加载、注入、隔离 | `skills/`（12 个技能目录已存在） | §7 | ⚠️ 骨架已立，加载器/注入器未实现 |
| 7 | **MCP Integration**（标准工具协议） | 标准化连接外部工具服务：QGIS/GEE/Zotero | `mcp/` | §8 | ⚠️ 框架存在，未真实运行 |
| 8 | **Memory Engineering**（记忆工程） | 跨步骤、跨会话的信息持久化与检索 | `aiagent/memory.go` + `conversation/` + `server/` | §9 | ⚠️ 只写不读 |
| 9 | **State Machine & Recovery**（状态机与恢复） | Agent 生命周期管理：状态转换、检查点、崩溃恢复 | `aiagent/state_machine.go` + `recovery.go` | §10 | ❌ 状态机白名单脱节，checkpoint 只在结束存 |
| 10 | **Sandbox & Guardrails**（沙箱与护栏） | 安全边界：文件系统隔离、危险命令拦截、注入防御 | `sandbox/` + `safety/` + `permissions/` | §11 | ⚠️ 沙箱 dev 模式全放行 |
| 11 | **Model Routing**（模型路由） | 模型选择、降级、成本控制 | `modelgateway/` | §12 | ⚠️ 仅单 provider，无路由策略 |
| 12 | **Observability & Eval**（可观测与评估） | 度量 Agent 是否做对了：轨迹、指标、评估 | `diagnostics/` + Trajectory（未实现） | §13 | ❌ 无 Trajectory |
| 13 | **Streaming & Event Engineering**（流式与事件工程） | 事件如何从 Core 流到前端：SSE 协议、事件 schema、per-run 过滤、前端 adapter | `aiagent/routes.go` 的 SSE + 前端 `streamAdapters.ts` | §19/§20 | ❌ 全局单通道，无法按 run ID 过滤 |
| 14 | **Human-in-the-Loop**（人工介入） | 何时暂停问用户、介入 UI 模式、超时处理 | `aiagent/` 的 `StateWaitingForUser`（未接） | §14 | ❌ 状态存在但执行路径不触发 |
| 15 | **Sub-agent**（子代理） | 复杂子任务隔离执行：独立上下文、结果回传 | `StartRunWithMemory`（仅注入字符串） | §15 | ❌ 非真正 Sub-agent |
| 16 | **Hooks & Lifecycle**（生命周期钩子） | 关键节点可扩展：before/after plan/tool/checkpoint | 未实现 | §16 | ❌ 未实现 |
| 17 | **Automation**（自动化） | 定时任务、工作流串联、自动恢复 | `automation/` + `tasks/scheduler.go` | §17 | ⚠️ 调度器存在，automation 未接 |
| 18 | **Python Worker**（执行层） | GEE/GDAL/QGIS/论文/报告的实际执行 | `worker/` + `workers/geo-python/` | §18 | ⚠️ 框架存在 |
| 19 | **Browser/Computer Use**（浏览器/GUI 操控） | Agent 操控浏览器/GUI：会话管理、导航、截图、OCR、网络请求、论文搜索 | `browserbridge/`（6 个 Go 文件已有，但工具未注册） | §6/P2-7 | ⚠️ 代码已有，工具未注册 |

**清单阅读规则：**
- 上表 19 个学科是 GeoWork Agent 的**完整器官清单**。新增模块必须归入其中一个学科，不得另起炉灶。
- #1 Harness Engineering 是**元学科**——它不对应单一模块，而是贯穿 #9/#10/#16 的约束哲学（安全规则在代码不在 prompt）。
- #3 Context 与 #4 Prompt 的边界：Context 管"给模型看**什么**"（预算/压缩/隔离），Prompt 管"这些内容**怎么组织**"（指令层级/格式/few-shot）。
- #12 Observability 与 #13 Streaming 的边界：Observability 管"**度量** Agent 做对了没"（轨迹/指标/评估），Streaming 管"事件**怎么传输**到前端"（SSE 协议/per-run 过滤/adapter）。
- "现状"列与 0.2 节的诊断一致：❌/⚠️ 的学科在未修复前，不得在代码审查时声称"已支持"。
- 各学科的详细设计见对应文档章节（§4-§20）。

### 0.1.3 学科之间的关系图

```
         ┌──────────────────────────────────────────────────┐
         │  Harness Engineering（元学科 §0.1.1）              │  ← 外壳：防止/量测/修正/记录
         │  所有安全规则在 Go 代码强制，不靠 prompt 自觉        │
         └──────────────────────────────────────────────────┘
                                  │ 包裹一切
                                  ▼
                    ┌─────────────────┐
                    │  Loop Engineering│  ← Agent 的心脏
                    │   (§4) ReAct    │
                    └────────┬────────┘
                             │ 每一轮循环调用
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────────┐ ┌──────────┐ ┌───────────────┐
     │ Context Eng    │ │ Tool Use │ │  Memory Eng   │
     │ (§5) 给模型看  │ │ (§6) 调用 │ │ (§9) 记住     │
     │ 什么           │ │ 外部能力  │ │  跨步骤信息    │
     └───────┬────────┘ └────┬─────┘ └───────┬───────┘
             │               │               │
        ┌────┴────┐     ┌────┴────┐          │
        ▼         │     ▼         ▼          │
 ┌──────────┐    │ ┌──────────┐ ┌────────┐   │
 │ Prompt   │    │ │ Skills   │ │  MCP   │   │
 │ Eng (§5.4│    │ │ (§7)     │ │ (§8)   │   │
 │ 怎么组织 │    │ │ 可复用包  │ │ 标准协议│   │
 └──────────┘    │ └──────────┘ └────────┘   │
             │   │                          │
             ▼   ▼                          ▼
     ┌─────────────────────────────────────────────┐
     │            Harness 层（Go Core 实体）         │
     ├─────────────────────────────────────────────┤
     │ State Machine (§10) │ Sandbox (§11) │ Hooks (§16) │
     │ Recovery (§10)      │ Guardrails   │ Audit       │
     └─────────────────────┴──────────────┴─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐ ┌───────────┐ ┌──────────────┐
     │ Model Routing│ │Automation │ │ Python Worker│
     │ (§12)        │ │ (§17)     │ │ (§18)        │
     └──────────────┘ └───────────┘ └──────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌──────────────────┐          ┌──────────────────┐
     │ Browser/Computer │          │  Observability   │
     │ Use (§6/P2-7)    │          │  & Eval (§13)    │
     │ 浏览器/GUI 操控   │          │  度量做对了没     │
     │ CDP/会话/截图/OCR│          │  Trajectory      │
     └──────────────────┘          └──────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌──────────────────┐          ┌──────────────────┐
     │  Streaming &     │          │  （回注到 Loop）  │
     │  Event Eng       │          │  事件→Memory→    │
     │  (§19/§20)       │          │  下一轮 Context   │
     │  SSE/per-run     │          │                  │
     └──────────────────┘          └──────────────────┘
```

**关系要点：**
- **Harness 是外壳**（最外层）：它包裹一切，代表"安全规则在代码不在 prompt"的元约束。State Machine / Sandbox / Guardrails / Hooks / Audit 是它在各层的具体实现。
- **Loop 是心脏**：没有真正的 ReAct 循环，其他学科都是摆设。这是 P0 中的 P0。
- **Context / Tool / Memory 是循环的三条支柱**：每轮循环都要"组装上下文→调工具→存记忆"。
- **Prompt 是 Context 的组织层**：Context 决定"给什么"，Prompt 决定"怎么排版/分层/注入指令"。
- **Harness 层（实体）是安全底线**：状态机、沙箱、护栏、审计——不依赖模型自觉，由代码强制。
- **Observability 与 Streaming 是两个出口**：前者度量"做得对不对"，后者负责"事件怎么传给前端"。两者都是横切层，但职责不同。
- **Python Worker 与 Browser/Computer Use 是执行层的双支柱**（v1.4 补）：前者执行 Python 代码（GEE/GDAL/QGIS），后者操控浏览器/GUI（CDP/截图/OCR/论文搜索）。两者都是 Agent 调用的外部能力，但工程问题不同——Python Worker 管进程池/超时/资源，Browser 管会话/URL 沙箱/CDP 协议。

### 0.1.4 设计约束与不可妥协项

以下约束在架构演进中**不可妥协**，任何 PR 若违背则不予合并：

| # | 约束 | 理由 |
|---|---|---|
| 1 | Harness 层（Go Core）必须实现所有安全护栏，不得只写在 prompt 里 | 模型不可信，prompt 可被绕过 |
| 2 | 所有工具调用（无论 aiagent 还是 workflow 链路）必须经 ToolRegistry + Governor | 绕过即安全漏洞（当前 workflow 违背此条） |
| 3 | Orchestrator 的状态/记忆/事件通道必须 per-run，不得单例共享 | 并发安全是底线 |
| 4 | 每个 Run 必须有完整 Trajectory（thought/tool/observation/verification） | 可追溯是核心卖点 |
| 5 | 破坏性操作（delete/overwrite/git push）必须 Human-in-the-Loop | 有界自主 |
| 6 | 外部数据（文件内容/API 返回/网页）必须标记 UNTRUSTED，不得作为指令执行 | 注入防御 |
| 7 | 明暗主题、本地优先——Agent 状态不依赖云端即可运行 | 离线可用 |
| 8 | 新增模块必须归入 0.1.2 清单中的某个学科，不得另起炉灶 | 防止架构腐化 |

---

## 0.2 现状诊断与诚实评估（v1.1）

> 本节由 GLM 在通读 `core/internal/aiagent/`、`core/internal/agent/`、`core/internal/toolregistry/` 全部源码后撰写。目的是把 v1.0 文档中过于乐观的"现状描述"拉回事实。

### 0.2.1 一句话定性

**当前代码是一个"有 Agentic 骨架但无 Agentic 灵魂"的玩具原型**：文件结构完整、类型定义齐全，但核心循环不是 ReAct、状态机会误杀合法工具、上下文工程被旁路、记忆只写不读、两条链路完全割裂。距离 v1.0 文档描述的"Agent = Model + Harness"还有本质差距。

### 0.2.2 八处重大偏差（文档 vs 代码）

| # | v1.0 文档声称 | 代码实际 | 严重度 |
|---|---|---|---|
| 1 | "基于 ReAct + Plan-then-Execute 混合模式"的 Agentic Loop | `executePlan` 一次性生成全量计划后线性执行；"LLM feedback"拿到回复后只打 Debug 日志就丢弃，不影响后续步骤；`Executor` 类（解析 tool_calls）是**死代码**，从未被 Orchestrator 调用 | 🔴 致命 |
| 2 | 状态机"严格定义工具在各状态下的允许范围" | `run_python`/`run_shell` 不在任何状态的 Tools 白名单，且无状态设置 `ShellAllowed: true` → Planner 生成的所有 Python/Shell 步骤会被状态机拒绝；状态机还引用注册表里不存在的工具（`apply_patch`/`edit_by_anchor`/`edit_by_range`/`test`/`build`/`lint`/`planner`/`model`） | 🔴 致命 |
| 3 | Orchestrator 管理 Run 生命周期 | `currentState`/`currentRunID`/`memory` 均为单例字段，两个 Run 并发执行会互相踩踏；`eventCh` 是全局单通道，SSE 无法按 run ID 过滤 | 🔴 致命 |
| 4 | ContextBuilder + ContextBudget + RepoMap + Summarizer 协同工作 | `executePlan` 自己拼 `chatHistory`，**从不调用 ContextBuilder**，预算约束/工具结果摘要/RepoMap 在执行路径上全是死代码 | 🔴 致命 |
| 5 | Memory 管理短期对话历史 + 工具结果摘要 + 重要文件追踪 | `Append`/`AppendToolResult` 有调用，但 `Summary()` 从不调用 → 记忆**只写不读**，永不回注上下文 | 🟠 严重 |
| 6 | 两条链路"共享 ToolRegistry" | `agent/` workflow 直接调 `worker.Client`，**不走 ToolRegistry/Governor/状态机**；两条链路完全割裂 | 🟠 严重 |
| 7 | Checkpoint"每 5 次工具调用后"持久化 | `saveCheckpoint` 只在 `executePlan` 的 defer 里调一次（结束时），中途失败无检查点可恢复 | 🟠 严重 |
| 8 | "官方技能清单（v0.4.x）"列了 12 个技能 | `skills/` 目录已存在（12 个技能），但加载器/注入器未实现，清单命名与实际目录半数不一致 | 🟡 中等 |

### 0.2.3 死代码清单（v1.1 标注）

以下代码在当前执行路径上**从未被调用**，在重构时需明确处理（接入或删除）：

| 文件 | 状态 | 说明 |
|---|---|---|
| `aiagent/executor.go` | 死代码 | `ParseModelResponse`/`ParseResponse` 从未被 Orchestrator 调用 |
| `aiagent/context_builder.go` 的 `Build`/`BuildWithMessages` | 死代码 | Orchestrator 不走 ContextBuilder |
| `aiagent/context_budget.go` 的 `Enforce` | 死代码 | 预算约束从未在执行路径生效 |
| `aiagent/repo_map.go` | 死代码 | 从未注入上下文 |
| `aiagent/tool_result_summarizer.go` | 半死 | 仅 Memory.AppendToolResult 内部用了 `summarizeStderr`，主上下文路径不用 |
| `aiagent/memory.go` 的 `Summary`/`Messages` | 死代码 | 只写不读 |

### 0.2.4 给 qwen 的反馈

qwen v1.0 的架构**蓝图**是好的——Context/Harness/Loop/Skills/Memory/Guardrail 的学科划分、5 层压缩、Hooks、Trajectory 这些方向都对。问题在于**第 3 节"现有架构现状"把蓝图当成了现状**。一份架构规范文档如果让新工程师误以为"Agentic Loop 已实现""状态机已生效""技能已存在"，会导致他们在错误的基础上继续搭建，最终积重难返。

v1.1 的修正原则：
1. **如实标注**：现状是什么就写什么，目标是什么就标 【目标】
2. **先治已死**：在加新功能前，先把死代码接入或删除，把状态机/工具表/Planner 三者对齐
3. **单 Run 跑通再谈并发**：当前连单 Run 的 ReAct 循环都没跑通，谈 Sub-agent/Memory 持久化为时过早

---

## 1. 产品定位

GeoWork 是面向 GIS、遥感和地理空间工作流的本地优先桌面 AI Agent 工作台。

用户通过自然语言描述任务，Agent 自主规划、调用工具、执行分析、生成结果，全程可追溯、可中断、可恢复。

GeoWork 不是一个"加了 AI 对话框的 GIS 工具"，而是一个**以 Agent 为核心、以地理空间工具集为能力边界的智能体系统**。

### 1.1 三层架构

| 层级 | 技术栈 | 职责 |
| --- | --- | --- |
| Desktop（呈现层） | Electron + React + TypeScript + Ant Design v6 | UI 渲染、用户交互、对话流展示、地图可视化 |
| Go Core（Harness 层） | Go runtime + HTTP API + SSE | Agentic Loop 编排、工具治理、状态机、上下文管理、安全护栏、模型路由 |
| Python Worker（执行层） | Python FastAPI | GEE 工作流、GDAL/QGIS 处理、论文解析、报告生成、NDVI 分析 |

### 1.2 目录结构与职责映射

```text
GeoWork/
├── apps/desktop/          # Desktop 层（Renderer + Main + Preload）
├── core/                  # Go Core Runtime（Harness 核心）
│   ├── cmd/               # 入口（geowork-runtime, geowork-api）
│   └── internal/
│       ├── agent/         # Workflow 链路（DAG 确定性编排）
│       ├── aiagent/       # AI Agent 链路（LLM 驱动自主执行）
│       ├── api/           # HTTP API 层
│       ├── artifacts/     # 生成产物管理
│       ├── automation/    # 定时任务、自动循环
│       ├── browserbridge/ # 浏览器/GUI 操控桥
│       ├── conversation/  # 对话历史管理
│       ├── diagnostics/   # 诊断、日志
│       ├── diff/          # 文件差异对比
│       ├── eino/          # Cloudwego Eino AI 框架集成
│       ├── events/        # SSE 事件流
│       ├── file/          # 文件操作
│       ├── idgen/         # 唯一标识生成
│       ├── knowledge/     # 知识检索、RAG
│       ├── mcp/           # MCP 连接器
│       ├── modelgateway/  # 模型路由
│       ├── permissions/   # 权限校验
│       ├── plugins/       # 插件体系
│       ├── runtime/       # 运行时管理
│       ├── safety/        # 安全护栏
│       ├── sandbox/       # 沙箱策略
│       ├── storage/       # 存储层
│       ├── tasks/         # 任务状态机
│       ├── toolregistry/  # 工具注册表
│       ├── tools/         # 工具执行
│       ├── worker/        # Python Worker 通信桥
│       └── workspace/     # 工作目录管理
├── server/                # Cloud Server（Auth/Team/Sync）
├── workers/geo-python/    # Python Worker（执行层）
├── skills/                # 技能包（Skills Engineering）
├── mcp/                   # MCP 连接器配置
├── plugins/               # 插件体系
├── marketplace/           # 插件市场配置
└── doc/                   # 文档
```

---

## 2. Agent 工程概念体系

GeoWork 的设计基于以下 Agent 工程学科。每个学科对应 Go Core 中的一个或多个模块。

| 学科 | 关注问题 | GeoWork 对应模块 |
| --- | --- | --- |
| Context Engineering | 每一步该给模型看什么信息 | `aiagent/context_builder.go` + `context_budget.go` |
| Harness Engineering | 系统该防止、量测、修正什么 | `core/` 整体 |
| Loop Engineering | 如何让 Agent 持续自主工作 | `aiagent/orchestrator.go` + `automation/` |
| Skills Engineering | 可复用能力的模块化打包 | `skills/` |
| Memory Engineering | 跨会话记忆的持久化与检索 | `aiagent/memory.go` + `server/` |
| Guardrail Engineering | 安全、策略、有界自主 | `sandbox/` + `permissions/` + `safety/` |
| Eval Engineering | 度量 Agent 是否做对了 | `diagnostics/` + 验证 Hook |
| Inference Engineering | 模型选择、路由、成本控制 | `modelgateway/` |
| Tool Use / Function Calling | Agent 调用外部工具 | `toolregistry/` + `tools/` |
| MCP | 标准化工具连接协议 | `mcp/` |

---

## 3. 架构现状（v1.1 修正：如实标注）

> ⚠️ v1.0 标题为"现有架构现状"但多处把目标当现状。v1.1 保留原文，在每个关键声明后以 `> 【GLM 注】` 标注代码实际情况。

### 3.1 两条并行 Agent 链路

GeoWork 当前存在两条 Agent 执行链路，各有不同定位：

#### AI Agent 链路（`core/internal/aiagent/`）

面向 **LLM 驱动的自主任务执行**：

```
用户请求
│
▼
Orchestrator（编排器）
│
├─▶ Planner（计划生成）── LLM 生成执行计划 / fallback 关键词匹配
│
├─▶ ContextBuilder（上下文组装）── 系统提示 + 工具定义 + 历史消息 + RepoMap
│
├─▶ Executor（步骤执行）── 按计划依次调用 ToolRegistry
│
├─▶ Memory（记忆管理）── 短期对话历史 + 工具结果摘要 + 重要文件追踪
│
├─▶ StateMachine（状态机）── idle → planning → inspecting → editing → verifying → completed/failed
│
└─▶ Recovery（检查点）── 运行状态持久化，支持恢复
```

**核心文件清单：**

| 文件 | 职责 |
| --- | --- |
| `orchestrator.go` | 主循环控制器，管理 Run 生命周期、事件发布、状态机驱动 |
| `planner.go` | 将用户意图分解为 Step 计划，支持 LLM 生成与关键词 fallback |
| `executor.go` | 解析模型响应中的工具调用（OpenAI native + legacy XML），构建消息历史 |
| `memory.go` | bounded 对话历史（max 20 条）、工具结果摘要（max 5 条）、重要文件追踪 |
| `state_machine.go` | 9 种状态 + 14 种事件，严格定义工具在各状态下的允许范围 |
| `context_builder.go` | 组装 system prompt + tool definitions + repo map + 历史消息 |
| `context_budget.go` | token/字符预算约束（MaxPromptTokens=32k, MaxMessages=20 等） |
| `tool_result_summarizer.go` | 工具输出压缩：error 行优先 + head/tail 截断 + 截断指示器 |
| `recovery.go` | 检查点持久化到 `%TEMP%/geowork/checkpoints/`，支持 load/cleanup |
| `repo_map.go` | 仓库结构轻量快照，排除 node_modules/.git 等，供 LLM 感知项目布局 |
| `routes.go` | HTTP 路由：run 增删查 + SSE 事件流 + 检查点列表 |

> **【GLM 注 — 执行路径真相】**
>
> 上表列出的文件都**存在且可编译**，但"职责"列描述的是**设计意图**，不是执行路径上的**实际行为**。以下文件在 `Orchestrator.executePlan` 的执行路径上**从未被调用**：
>
> | 文件 | 实际状态 |
> |---|---|
> | `executor.go` | **死代码**。`ParseModelResponse`/`ParseResponse` 从未被 Orchestrator 调用。Orchestrator 直接用 `registry.Execute(ctx, step.Tool, args)` 执行预规划的工具，不解析模型返回的 tool_calls。 |
> | `context_builder.go` | **死代码**。`Build`/`BuildWithMessages` 从未被 Orchestrator 调用。Orchestrator 在 `executePlan` 内自己拼 `chatHistory`。 |
> | `context_budget.go` | **死代码**。`Enforce` 从未在执行路径生效。 |
> | `repo_map.go` | **死代码**。从未注入上下文。 |
> | `memory.go` 的 `Summary()`/`Messages()` | **死代码**。`Append`/`AppendToolResult` 有调用（写入），但 `Summary()` 从不调用（不读）→ 记忆只写不读。 |
>
> 这意味着：**上下文工程、预算约束、工具结果摘要、RepoMap、记忆回注——在当前代码中全部不生效**。它们是"写好了但没接线"的孤儿模块。

| Mode | 系统提示 | 可用工具 | MaxSteps |
| --- | --- | --- | --- |
| Work | GIS 研究助手 | read_file, write_file, list_files, search_workspace, create_artifact | 20 |
| Code | 代码助手 | + run_shell, run_python | 30 |
| Paper | 论文助手 | read_file, write_file, list_files, search_workspace, create_artifact | 15 |
| Analysis | 空间分析助手 | + run_python | 25 |
| Write | 写作助手 | read_file, write_file, list_files, create_artifact | 15 |

#### Workflow 链路（`core/internal/agent/`）

面向**工作流编排**的确定性执行引擎：

```
Workflow（DAG）
│
▼
Engine（拓扑排序 + 执行调度）
│
├─▶ Runner（节点执行器）── 通过 worker.Client 调用 Python Worker
│
└─▶ WorkflowStore（工作流持久化）
```

**核心文件清单：**

| 文件 | 职责 |
| --- | --- |
| `engine.go` | 拓扑排序执行引擎，管理 Workflow 运行生命周期 |
| `runner.go` | 执行单个节点（start/process/agent/output/condition），调用 Python Worker |
| `planner.go` | Workflow 级别的计划定义 |
| `workflow_store.go` | 工作流的持久化存储 |
| `eino_adapter.go` | Cloudwego Eino 适配器，将 ToolRegistry 暴露给 Eino 框架 |

### 3.2 两条链路的定位与关系

| 维度 | AI Agent 链路 | Workflow 链路 |
| --- | --- | --- |
| **定位** | LLM 驱动的自主任务执行 | 预定义工作流的确定性执行 |
| **触发方式** | 自然语言 prompt → Planner 生成计划 | 结构化 workflow 定义 → Engine 拓扑排序 |
| **工具调用** | 通过 ToolRegistry → Governor 权限管控 → 工具执行 | 通过 Worker Client → Python Worker API |
| **状态管理** | StateMachine（9 状态生命周期） | Engine 内部运行状态 |
| **上下文** | ContextBuilder + ContextBudget + RepoMap + Memory | Workflow 节点间数据传递 |
| **事件机制** | EventSink → SSE 流式输出 | 无（同步执行） |
| **容错** | Recovery 检查点 + 状态机降级 | Runner 重试（max 3 次 transient error） |

**两条链路共享：**
- `ToolRegistry` — 统一的工具注册与权限管控
- `modelgateway` — LLM 调用通道
- `idgen` — ID 生成器

> **【GLM 注 — "共享"不成立】**
>
> 上表声称两条链路"共享 ToolRegistry"，但代码实际：
> - `aiagent/` 链路：Orchestrator 持有 `*toolregistry.Registry`，通过 `registry.Execute()` 调用工具 ✅
> - `agent/` workflow 链路：`Runner.callWorker()` 直接调 `worker.Client.RunTool()`，**完全不经过 ToolRegistry/Governor/状态机** ❌
>
> 也就是说 workflow 链路的工具调用没有权限校验、没有审计日志、没有沙箱标记。两条链路在工具治理层面是**割裂**的，不是"共享"的。

### 3.3 ToolRegistry 工具治理体系

GeoWork 的工具系统采用 **注册表 + 治理器 + 审计日志** 三层架构：

```
ToolRegistry
│
├─▶ Governor（治理器）── 调用频次控制 + 审批状态追踪
│   └─▶ GovernorPolicy（策略）── 允许/拒绝/需审批
│
├─▶ AuditLog（审计日志）── 每次调用的参数、结果、耗时、是否通过治理
│
├─▶ Permission（权限检查）── read/write/exec/delete 四级权限
│
├─▶ Policy（高风险工具策略）── high-risk 工具需显式 permission policy
│
└─▶ Sandbox（沙箱隔离）── 高风险工具的沙箱执行标记
```

**已注册的 12 个内置工具：**

| 工具名 | 权限 | 风险等级 | 沙箱 | 说明 |
| --- | --- | --- | --- | --- |
| `read_file` | read | low | - | 读取文件内容 |
| `write_file` | write | medium | yes | 写入文件 |
| `list_files` | read | low | - | 列出目录内容 |
| `search_workspace` | read | low | - | glob 模式搜索 |
| `run_python` | exec | high | yes | 执行 Python 脚本 |
| `run_shell` | exec | critical | yes | 执行 Shell 命令 |
| `create_artifact` | write | medium | - | 创建项目制品 |
| `delete_file` | delete | high | yes | 删除文件 |
| `git_commit` | exec | high | yes | Git 提交 |
| `git_push` | exec | critical | yes | **默认策略阻止** |
| `run_git_add` | exec | high | yes | Git 暂存 |
| `run_git_reset` | exec | critical | yes | **--hard 显式阻止** |
| `scan_folder` | read | medium | - | 递归扫描文件夹 |

> **【GLM 注 — 状态机与工具表不一致】**
>
> 上面 13 个工具是 ToolRegistry 中**真实注册**的（v1.4 修正：v1.0 误写为 12 个，实际 13 个，`scan_folder` 被漏数）。但 `state_machine.go` 的 `AllowedToolSet.Tools` 白名单引用了以下**注册表中不存在的工具名**：
>
> | 状态机引用的工具 | 注册表中是否存在 | 问题 |
> |---|---|---|
> | `apply_patch` | ❌ 不存在 | 状态机 StateEditing 允许它，但注册表没有此工具 |
> | `edit_by_anchor` | ❌ 不存在 | 同上 |
> | `edit_by_range` | ❌ 不存在 | 同上 |
> | `test` / `build` / `lint` | ❌ 不存在 | StateVerifying 允许它们，但注册表没有 |
> | `planner` / `model` | ❌ 不存在 | StatePlanning 允许它们，但它们不是注册表工具 |
>
> 反过来，注册表中存在的 `run_python`/`run_shell`/`git_commit`/`git_push`/`run_git_add`/`run_git_reset`/`delete_file`/`scan_folder`/`create_artifact` **全部不在任何状态的 Tools 白名单中**。
>
> `ToolIsAllowed()` 的 fallback 逻辑本应兜底（检查 ReadAllowed/WriteAllowed/ShellAllowed），但**没有任何状态设置 `ShellAllowed: true`**，所以 `run_python`/`run_shell` 在所有状态下都会被拒绝。
>
> **结论：Planner 生成 `run_python` 步骤 → 状态机拒绝 → 步骤标记 rejected。这是致命的链路断裂。**

### 3.4 前端接入现状

| 文件 | 职责 |
| --- | --- |
| `apps/desktop/electron/ipc/runtimeIpc.ts` | 前端 → Core HTTP 代理 |
| `apps/desktop/src/pages/NewTask/components/streamAdapters.ts` | 流式适配器（mock + real） |
| `core/internal/api/agent_handler.go` | Agent 相关 HTTP handler |
| `core/internal/api/conversation_handler.go` | 对话 CRUD + SSE 端点 |

当前状态：Core 侧的 Agent API（orchestrator/routes）已完整实现，前端 NewTask 页已有 stream adapter 框架，但存在"最后一公里"接线工作。

---

## 4. Agentic Loop（核心循环）

> **【GLM 注 — 本节为目标设计，非现状】**
>
> v1.0 本节描述的"ReAct + Plan-then-Execute 混合模式"是**目标架构**，当前代码**未实现**。实际代码行为见 4.1 之后的 `【现状】` 块。

### 4.1 循环结构（【目标】）

GeoWork 的 Agent 执行基于 **ReAct + Plan-then-Execute 混合模式**：

```
用户输入
  → 意图理解（Intent Classification）
  → 任务规划（Planning）—— Planner 生成 Step 列表
  → [循环开始]
      → 选择工具 / 技能（Tool Selection）
      → 执行工具（Tool Execution）—— 经 Governor 权限校验
      → 观察结果（Observation）
      → 验证结果（Verification）
      → 判断：
          ├─ 未完成 → 回到"选择工具"
          ├─ 需要确认 → 暂停，等待用户（Human-in-the-Loop）
          ├─ 失败 → 重试 / 回退 / 报告错误
          └─ 完成 → 生成最终输出
  → [循环结束]
  → 结果呈现 + 工作流记录
```

### 4.1.1 实际代码行为（【现状】，v1.1 新增）

当前 `Orchestrator.executePlan` 的真实行为是**一次性规划 + 线性执行**，不是 ReAct：

```
用户输入
  → Planner.Plan() 一次性生成全部 Step（LLM 或关键词 fallback）
  → for each step in plan:
      → 检查状态机是否允许该工具（多数 exec 工具会被拒绝，见 3.3）
      → registry.Execute(step.Tool, step.Args)   // 不经模型决策
      → 把结果格式化为 "Step N (title) tool=X status=Y result=Z" 塞进 chatHistory
      → 调一次 gateway.Chat() 拿 LLM 回复  // ← 回复只打 Debug 日志，不影响后续步骤
  → 结束，存 checkpoint
```

**与目标 ReAct 循环的本质差距：**

| 维度 | 目标（4.1） | 现状（4.1.1） |
|---|---|---|
| 谁选工具 | 模型根据 observation 决定下一步用什么工具 | Planner 一次性预分配，模型不参与 |
| 能否改计划 | 每轮可 replan | 计划固定，不可改 |
| observation 用途 | 驱动下一步决策 | 塞进 chatHistory 但 LLM 回复被丢弃 |
| 停止条件 | 模型自主判断完成 | 跑完 plan 列表或 maxTurns |
| 验证 | 每步有 verification hook | 无 |

> **v1.1 结论**：在 Agentic Loop 真正实现之前，当前系统本质上是一个"LLM 增强的脚本执行器"——LLM 只在规划阶段参与一次，执行阶段完全是确定性的。这不是 Agent，是 Workflow + LLM 前缀。

### 4.2 循环控制参数

| 参数 | 当前值 | 说明 |
| --- | --- | --- |
| MaxSteps | 15-30（按 Mode） | 单次任务最大循环次数 |
| MaxMessages | 20 | 对话历史上限 |
| MaxPromptTokens | 32,000 | 上下文 token 预算 |
| max_tool_retries | 3（Runner 级） | 单个工具调用最大重试次数 |
| timeout_per_tool | 待定 | 单个工具调用超时 |
| timeout_total | 待定 | 整个任务超时 |

### 4.3 停止条件

循环在以下任一条件满足时终止：

1. 任务完成（Agent 判断所有子目标已达成）
2. 达到 MaxSteps
3. 用户主动中断（Abort）
4. 总超时
5. 不可恢复错误（连续 3 次相同失败）
6. 安全护栏触发（Sandbox 拦截危险操作）

### 4.4 错误处理策略

```
工具调用失败：
  → 第 1 次：自动重试（相同参数）
  → 第 2 次：Agent 尝试替代方案（换工具 / 改参数）
  → 第 3 次：暂停，向用户报告错误并请求指导

上下文溢出：
  → 触发 Compress 策略（见第 5 节）
  → 如仍溢出，启动 Sub-agent 隔离执行

模型无响应：
  → Fallback 到备选模型
  → 如仍失败，保存 checkpoint，通知用户
```

---

## 5. Context Engineering（上下文工程）

上下文是有限资源。GeoWork 的 Context 管理遵循 **Write / Select / Compress / Isolate** 四策略。

### 5.1 现有实现

| 组件 | 当前能力 | 文件 |
| --- | --- | --- |
| ContextBuilder | 组装 system prompt + tool definitions + repo map + 历史消息 | `context_builder.go` |
| ContextBudget | MaxPromptTokens=32k, MaxMessages=20, 文件数限制 | `context_budget.go` |
| ToolResultSummarizer | error 行优先 + head/tail 截断 + 截断指示器 | `tool_result_summarizer.go` |
| RepoMap | 项目结构轻量快照（排除 node_modules/.git） | `repo_map.go` |

> **【GLM 注 — 上表全部为死代码】**
>
> 这四个组件的代码**存在且可编译**，但在 `Orchestrator.executePlan` 的执行路径上**从未被调用**：
> - `ContextBuilder` 虽然在 `NewOrchestrator` 中创建，但 `executePlan` 自己拼 `chatHistory`，不调 `contextBld.Build()`
> - `ContextBudget.Enforce()` 从未生效
> - `RepoMap` 从未注入上下文
> - `ToolResultSummarizer` 仅在 `Memory.AppendToolResult` 内部用了 `summarizeStderr`，主上下文路径不用
>
> 所以"现有实现"指的是"代码已写好"，不是"已在执行路径生效"。要让上下文工程真正工作，第一步是把 `executePlan` 中手写的 `chatHistory` 拼接替换为 `ContextBuilder.Build()` 调用。

### 5.2 Context Budget（上下文预算）

每次模型调用的上下文窗口按以下比例分配：

| 区域 | 预算占比 | 内容 |
| --- | --- | --- |
| System Prompt | 10-15% | 角色定义、行为规则、当前技能指令 |
| 对话历史 | 30-40% | 用户消息 + Agent 回复（压缩后） |
| 工具结果 | 20-30% | 最近 N 次工具调用的输出（裁剪后） |
| 任务状态 | 5-10% | 当前计划、进度、待办 |
| 检索内容 | 10-20% | RAG 检索结果（按需） |

### 5.3 四策略实现

**Write（外置）：**
- 大文件内容不放入上下文，只放文件路径 + 摘要
- 中间计算结果写入 scratchpad（临时文件）
- 已完成子任务的详细输出归档，只保留结论

**Select（拉取）：**
- 根据当前步骤按需拉取信息
- 工具结果只拉取与下一步相关的部分
- RAG 检索只在需要外部知识时触发
- RepoMap 只在首次规划和文件结构变化时更新

**Compress（压缩）：**

目标：实现 5 层渐进式压缩（参考 Claude Code）：

| 层级 | 策略 | 触发条件 | 实现方式 |
| --- | --- | --- | --- |
| Level 1 - Snip | 裁剪过长工具输出 | 单次输出 > N token | 保留头尾 + 中间摘要（现有 `tool_result_summarizer.go` 的雏形） |
| Level 2 - Microcompact | 压缩早期对话 | 对话超过 M 轮 | 对最早的 K 轮做摘要替换 |
| Level 3 - Collapse | 折叠已完成子任务 | 子任务完成 | 只保留结论，移除过程细节 |
| Level 4 - Autocompact | 全量摘要 | 整体接近预算 | 对整个历史做一次 LLM 摘要 |
| Level 5 - Memory Externalize | 记忆外置 | 摘要后仍超预算 | 关键信息写入外部存储，从窗口中移除 |

**Isolate（隔离）：**
- 超过 15 次工具调用的子任务交给 Sub-agent
- Sub-agent 有独立上下文窗口
- Sub-agent 完成后只向父 Agent 返回结论

### 5.4 System Prompt 组装规则

```
System Prompt = 基础角色定义（按 Mode）
              + 当前激活技能的 SKILL.md 内容（如有）
              + 用户偏好（如有）
              + 当前任务上下文摘要
              + 工具清单（只列当前 Mode 可用工具，不列全部）
```

工具清单膨胀是上下文饱和最常见的原因之一。每次只注入与当前 Mode 相关的工具描述，不全量注入。

---

## 6. Tool Use & Governance（工具使用与治理）

### 6.1 工具注册

所有工具通过 Tool Registry 统一注册：

```go
工具描述结构：
{
  Name        string   // 唯一标识
  Description string   // 一句话描述（给模型看）
  Category    string   // gis / remote_sensing / python / file / git
  Permission  string   // read / write / exec / delete
  RiskLevel   string   // low / medium / high / critical
  Sandbox     bool     // 是否需要沙箱执行
  Timeout     int      // 超时时间（秒）
  Retryable   bool     // 是否可重试
}
```

### 6.2 权限模型

每个工具声明所需权限，运行时由 Governor 校验：

| 权限 | 说明 | 示例 |
| --- | --- | --- |
| read | 读取文件/目录 | read_file, list_files, search_workspace |
| write | 写入文件 | write_file, create_artifact |
| exec | 启动子进程 | run_python, run_shell, git_commit |
| delete | 删除文件 | delete_file |

### 6.3 有界自主（Bounded Autonomy）

Agent 的自主权分级：

| 级别 | 说明 | 示例 |
| --- | --- | --- |
| 完全自主 | Agent 直接执行，无需确认 | 读取文件、运行只读分析 |
| 通知后执行 | Agent 执行后告知用户 | 创建临时文件、安装 Python 包 |
| 请求确认 | Agent 暂停等待用户确认 | 覆盖已有文件、执行写操作 |
| 禁止 | Agent 不可执行 | git_push（默认阻止）、git_reset --hard |

### 6.4 工具调用链追踪

每次工具调用生成唯一 trace_id，记录：

```json
{
  "trace_id": "string",
  "task_id": "string",
  "tool_name": "string",
  "input_params": {},
  "output_summary": "string",
  "duration_ms": 0,
  "status": "success | failed | timeout",
  "error": "string | null",
  "timestamp": "ISO8601"
}
```

### 6.5 验证 Hook（Verification）

每次工具执行完成后，自动运行验证：

```
Python Worker 执行完脚本 → 检查输出文件是否生成
QGIS 算法执行完 → 检查 CRS 一致性、要素数量
报告生成完 → 检查格式完整性
GEE 任务完 → 检查影像范围是否匹配
```

验证失败时，结果标记为 `unverified`，Agent 必须决定是否重试或告知用户。

### 6.6 推测执行（Speculative Execution）

工具分为两类：

```
read_only：read_file, list_files, search_workspace, scan_folder
  → 可并行、可在模型流式输出中提前执行

write：write_file, run_python, run_shell, delete_file
  → 必须串行、必须等模型输出完毕
```

执行策略：
- 模型流式输出中识别到 tool_call → 如果是 read_only，立即开始执行
- 模型输出完毕 → 执行剩余的 write 工具
- 这样能显著减少用户等待时间

---

## 7. Skills Engineering（技能体系）

> **【v1.2 修正 — skills/ 目录已存在】**
>
> `skills/` 目录已存在，包含 12 个技能子目录 + `official-skills.json` 索引。目录结构为**扁平式**（`SKILL.md` + `manifest.json` 直接放在技能目录下），与 v1.0 描述的双层结构不同。至少 `ndvi-timeseries` 的 SKILL.md 有实质内容，其余为骨架。加载器/注入器（Go 侧）未实现。

### 7.1 技能结构（v1.2 修正：对齐实际扁平结构）

```
skills/<skill-id>/
├── SKILL.md            # 核心提示（LLM 导向，含 frontmatter）
└── manifest.json       # 元数据：id/name/version/tags/required_tools/permissions/parameters
```

另有 `skills/official-skills.json` 作为全量技能索引。

### 7.2 技能加载规则

```
1. 技能不是全量加载——根据用户任务类型（Mode）匹配相关技能
2. 只有当 Agent 因同一原因失败两次时，才考虑加载额外技能
3. 技能内容注入 System Prompt 的"当前技能指令"区域
4. 技能之间不互相引用，保持独立
```

### 7.3 两阶段加载（目标）

```
阶段 1（启动时）：只读 frontmatter（name, description, tags, mode）
阶段 2（调用时）：加载 SKILL.md 全文

目的：避免 12 个技能全量注入导致上下文膨胀
```

### 7.4 官方技能清单（v1.2 修正：对齐实际目录名）

```
ndvi-timeseries                        # NDVI 时间序列分析
gee-sentinel2-cloudfree-composite      # Sentinel-2 无云合成
landsat-lst-retrieval                  # Landsat 地表温度反演
land-cover-classification              # 土地覆盖分类
urban-expansion-analysis               # 城市扩展分析
water-extraction-ndwi                  # 水体提取
dem-terrain-analysis                   # DEM 地形分析
paper-reading-geography                # 论文阅读（地理学）
literature-review-remote-sensing       # 文献综述（遥感）
undergraduate-experiment-report        # 本科实验报告
graduate-thesis-outline                # 研究生论文大纲
map-layout-export                      # 地图布局与导出
```

---

## 8. MCP 连接协议

### 8.1 MCP 架构

```
GeoWork Core (MCP Client)
  ├── 连接 QGIS Processing Server
  ├── 连接 GEE Python Worker
  ├── 连接 OpenAlex API
  ├── 连接 Zotero
  └── 连接用户自定义 MCP Server
```

### 8.2 传输层支持

```
stdio            # 本地进程通信（QGIS、Python Worker）
sse              # Server-Sent Events（Cloud Server）
streamable-http  # HTTP 流式（远程服务）
```

### 8.3 MCP Server 管理

```
每个 MCP Server 必须声明：
- 名称和描述
- 提供的工具列表
- 所需权限
- 健康检查端点

运行时管理：
- 启动时自动发现已注册的 MCP Server
- 定期健康检查（30s 间隔）
- 连接失败自动重连（3 次后标记为不可用）
- 用户可在 UI 中手动启用/禁用
```

---

## 9. Memory Engineering（记忆体系）

### 9.1 现有实现

当前 `memory.go` 实现：
- bounded 对话历史（max 20 条）
- 工具结果摘要（max 5 条）
- 重要文件追踪

> **【GLM 注 — Memory 只写不读】**
>
> `Memory` 的 `Append`/`AppendToolResult`/`SetTaskSummary` 在 `executeStep` 中有调用（写入），但 `Summary()`/`Messages()` **从未被调用**（不读）。也就是说记忆被写进去了，但永远不会回注到上下文里。
>
> 这意味着当前 Memory 是一个"只写黑洞"——数据进去后不参与任何后续决策。`Export()` 在 `saveCheckpoint` 时被调用（持久化），但 `Import()` 在恢复时是否被调用以回注记忆，需要确认 `recovery.go` 的 load 路径。

### 9.2 三层记忆模型（目标）

| 层级 | 生命周期 | 存储位置 | 内容 |
| --- | --- | --- | --- |
| 工作记忆 | 单次任务 | 上下文窗口内 | 当前对话、工具结果、计划 |
| 会话记忆 | 单次会话 | 内存 + SQLite | 对话历史、任务状态 |
| 长期记忆 | 跨会话 | SQLite / Cloud Sync | 用户偏好、历史任务、学习到的模式 |

### 9.3 记忆持久化

```
会话记忆：
- 本地：SQLite（server/ 模块，005_conversations.sql 迁移已存在）
- 云端：Cloud Server 同步（/api/conversations 已实现）
- localStorage key 前缀：geowork.*

长期记忆：
- 用户偏好（默认工作目录、常用 CRS、模型选择）
- 任务模板（用户保存的工作流）
- 失败模式记录（Agent 学到的"不要这样做"）
```

### 9.4 记忆检索

```
新任务开始时：
1. 加载用户偏好
2. 检索与当前任务相似的历史任务（如有）
3. 检索相关失败模式记录
4. 将检索结果注入 Context 的"任务状态"区域
```

### 9.5 记忆隔离

```
不同工作区的记忆互相隔离
不同用户的记忆互相隔离（团队协作场景）
Sub-agent 不继承父 Agent 的全部记忆，只继承任务相关摘要
悬浮辅助对话继承父对话的任务上下文摘要（已实现：StartRunWithMemory）
```

---

## 10. State Machine & Recovery（状态机与恢复）

### 10.1 现有状态机

9 种状态 + 14 种事件（`state_machine.go`）：

> **【GLM 注 — 状态机有三个致命问题】**
>
> 1. **工具白名单与注册表脱节**：状态机引用 `apply_patch`/`edit_by_anchor`/`edit_by_range`/`test`/`build`/`lint`/`planner`/`model`，这些工具在 `builtin_tools.go` 中**不存在**；而注册表中真实存在的 `run_python`/`run_shell`/`git_commit` 等不在任何状态的白名单里。
>
> 2. **ShellAllowed 永不为 true**：`AllowedToolSet` 的 fallback 分支依赖 `ShellAllowed` 放行 `run_python`/`run_shell`，但 9 个状态里**没有一个**设置 `ShellAllowed: true`。所以所有 exec 类工具在所有状态下都会被 `ToolIsAllowed()` 返回 false → 步骤被标记 `rejected`。
>
> 3. **状态在 Run 间共享**：`Orchestrator.currentState` 是单例字段，不是 per-run 的。如果 Run A 处于 `StateEditing` 时 Run B 启动并把状态切到 `StatePlanning`，Run A 的后续步骤会用错误的状态做权限判断。
>
> **v1.1 建议**：状态机在修复上述三个问题之前，不应被视为"安全护栏"。当前的 `ToolIsAllowed` 检查要么删除（让 Governor 做权限），要么修正白名单与注册表对齐。

```
idle → planning → inspecting → editing → verifying → completed
                                                    → failed
                                                    → paused
                                                    → recovered
```

### 10.2 任务生命周期（目标）

```
created → planning → executing → [分支]
  ├─ waiting_confirmation → executing（用户确认后继续）
  ├─ paused → executing（用户恢复）/ cancelled（用户放弃）
  ├─ completed（成功）
  └─ failed → retry / cancelled
```

### 10.3 状态转换规则

```
created → planning：      用户提交任务
planning → executing：    计划生成完毕，开始执行
executing → waiting_confirmation：遇到高危操作或需要用户决策
waiting_confirmation → executing：用户确认
executing → paused：      用户主动暂停 / 系统资源不足
paused → executing：      用户恢复
executing → completed：   所有子目标达成
executing → failed：      不可恢复错误
failed → executing：      用户选择重试（从 checkpoint 恢复）
任何状态 → cancelled：    用户取消
```

### 10.4 Checkpoint 机制

现有实现：持久化到 `%TEMP%/geowork/checkpoints/`

> **【GLM 注 — Checkpoint 触发时机不实】**
>
> 下方"每 5 次工具调用后"是**目标**，不是现状。代码中 `saveCheckpoint` 只在 `executePlan` 的 defer 里调用一次（即整个 plan 执行完毕后）。中途失败的 Run **没有检查点可恢复**。`recovery.go` 的 `Save`/`Load`/`List` 接口存在，但 `executePlan` 没有在循环中调用 `Save`。

### 10.5 Recovery 规则

```
有 checkpoint 时：
  → 恢复后任务状态为 paused（用户决定继续/放弃）
  → 恢复 = 回到最近 checkpoint 的状态
  → 恢复 ≠ 完成

无 checkpoint 时：
  → 返回 no_checkpoint
  → 不修改任务状态
  → 用户可选择重新开始
```

---

## 11. Sandbox & Guardrails（沙箱与护栏）

### 11.1 沙箱策略

现有实现（`sandbox/`）：

```
文件系统：
- AllowedPaths 为空（dev 模式）→ 允许所有路径
- AllowedPaths 非空 → 只允许指定目录及子目录
- 路径判断支持 / 和 \\ 分隔符

命令执行：
- 阻止危险命令：rm -rf /, sudo, mkfs, fdisk, format
- Windows 优先 pwsh，fallback cmd
- macOS/Linux 使用 bash

网络：
- 工具声明 network 权限后才允许外发请求
- 请求目标记录在审计日志中
```

### 11.2 Guardrails 实现位置

```
Guardrails 必须在 Harness 层（Go Core）实现，不能只写在 Prompt 里：
- 输入过滤：用户输入注入检测
- 工具网关：调用前权限校验（Governor）
- 输出验证：结果格式和范围检查
- 审计管道：所有操作记录日志（AuditLog）
```

### 11.3 Prompt Injection 防御

```
外部数据（文件内容、API 返回、网页内容）标记为 UNTRUSTED：
- 不作为指令执行
- 不触发工具调用
- 不修改 Agent 行为
- 只作为参考信息注入上下文
```

### 11.4 Guardian AI（目标）

对于规则引擎无法判断的灰色地带操作，引入 AI 审批：

```
第一级：规则引擎（快，确定性）
  → 文件路径检查、危险命令拦截、权限声明校验
  → 现有 Governor + Policy 已覆盖

第二级：AI 审批（慢，但更智能）
  → 对于规则无法判断的操作，调用轻量模型评估
  → 例如："这个 Python 脚本会修改用户数据吗？"
  → 实现位置：新增 guardian/ 模块
```

---

## 12. Model Routing（模型路由）

### 12.1 现有实现

`modelgateway/` 已实现基础的 LLM 调用通道。

### 12.2 路由策略（目标）

```
按任务复杂度路由：
- 简单问答 / 信息查询 → 轻量模型（快、便宜）
- 任务规划 / 代码生成 → 中等模型
- 复杂推理 / 多步分析 → 强模型

按任务类型（Mode）路由：
- Code 模式 → 擅长代码的模型
- Paper 模式 → 长上下文模型
- Work/Analysis → 默认模型
```

### 12.3 Fallback 策略

```
主模型无响应（>30s）→ 切换到备选模型
备选模型也失败 → 保存 checkpoint，通知用户
模型返回格式错误 → 重试一次（加 format 提示）→ 仍失败则降级处理
```

### 12.4 成本控制

```
每次任务记录 token 消耗
用户可设置单次任务 token 上限
接近上限时 Agent 主动告知用户
支持按模型分别设置预算
```

---

## 13. Observability & Evaluation（可观测性与评估）

### 13.1 全链路追踪（目标）

每个任务生成完整执行轨迹（Trace）：

```json
{
  "task_id": "string",
  "user_input": "string",
  "plan": [],
  "iterations": [
    {
      "step": 1,
      "thought": "string",
      "tool_call": { "name": "string", "params": {} },
      "observation": "string",
      "verification": "pass | fail",
      "duration_ms": 0,
      "tokens_used": 0
    }
  ],
  "final_output": "string",
  "total_duration_ms": 0,
  "total_tokens": 0,
  "status": "completed | failed | cancelled"
}
```

### 13.2 前端呈现

```
对话流中：
- 每轮工具调用显示为可折叠卡片
- 卡片包含：工具名、耗时、状态（成功/失败）
- 展开可查看详细输入/输出

任务面板中：
- Checklist 形式的步骤进度
- 每步状态：pending / running / done / failed
- 总耗时和 token 消耗
```

### 13.3 评估指标（Eval）

```
任务完成率：成功完成 / 总任务数
平均循环次数：完成任务所需的平均 iteration 数
工具调用成功率：成功调用 / 总调用数
用户中断率：用户主动中断 / 总任务数
平均恢复次数：每个任务的平均 retry 次数
```

---

## 14. Human-in-the-Loop（人工介入）

### 14.1 介入点

```
必须介入：
- 覆盖/删除用户文件
- 执行网络写入操作
- 任务计划确认（首次）
- 预算超限

可选介入（用户可配置）：
- 每个子任务完成后
- 工具调用前
- 模型切换时
```

### 14.2 介入 UI 模式

在对话流中插入确认卡片（不是弹窗）：

```
┌─────────────────────────────────────┐
│ ⚠️ 即将执行写操作                    │
│ 目标：output/buffer_result.geojson   │
│ 操作：覆盖已有文件                    │
│                                     │
│ [确认执行]  [跳过此步]  [取消任务]    │
└─────────────────────────────────────┘
```

### 14.3 超时处理

```
用户 5 分钟未响应 → 任务自动暂停（paused）
暂停后 24 小时未恢复 → 发送提醒
暂停后 7 天未恢复 → 自动归档
```

---

## 15. Sub-agent & Multi-agent（子代理）

### 15.1 现有实现

悬浮辅助对话（`FloatingAssistant`）已实现：
- `orchestrator.go` 新增 `StartRunWithMemory`，注入父对话上下文
- `conversation` 增加 `parentId` 字段及迁移
- `conversation_handler` 构建父对话近期消息作为 memory

> **【GLM 注 — 不是真正的 Sub-agent】**
>
> `StartRunWithMemory` 只是把父对话的近期消息拼成一个字符串，注入到新 Run 的 system prompt 里。这不是 Sub-agent——没有独立上下文窗口隔离、没有结果回传协议、没有并行执行。它本质上是一个"带着前情提要的新对话"。
>
> 真正的 Sub-agent 需要：独立 Orchestrator 实例、独立 Memory、独立状态机、完成后只向父 Agent 返回 summary。当前架构的 `Orchestrator` 是单例（currentState/currentRunID/memory 共享），无法支持真正的 Sub-agent。

### 15.2 Sub-agent 触发条件（目标）

```
- 子任务预计超过 15 次工具调用
- 需要独立上下文空间（避免污染主对话）
- 并行执行多个独立子任务
```

### 15.3 Sub-agent 上下文规则

```
Sub-agent 继承：
- 任务目标描述
- 相关数据引用（文件路径，不是文件内容）
- 必要的约束条件

Sub-agent 不继承：
- 完整对话历史
- 其他子任务的中间结果
- 用户的闲聊内容
```

### 15.4 结果回传

```json
{
  "status": "completed | failed",
  "summary": "一段话总结",
  "artifacts": [],
  "key_findings": [],
  "errors": []
}
```

---

## 16. Hooks & Lifecycle（生命周期钩子）

### 16.1 设计目标

在 Agent 执行的每个关键节点暴露 Hook 接口，允许外部逻辑插入。

### 16.2 Hook 事件清单（目标）

| Hook | 触发时机 | 用途 |
| --- | --- | --- |
| `before_plan` | Planner 开始规划前 | 注入额外上下文 |
| `after_plan` | 计划生成完毕 | 验证计划合理性 |
| `before_tool_call` | 工具执行前 | 权限校验、参数修改 |
| `after_tool_call` | 工具执行后 | 结果验证、日志记录 |
| `on_error` | 错误发生时 | 自动恢复、通知 |
| `on_state_change` | 状态机转换时 | 前端通知、审计 |
| `before_checkpoint` | 保存检查点前 | 清理临时数据 |
| `after_checkpoint` | 保存检查点后 | 通知前端 |
| `on_task_complete` | 任务完成时 | 生成摘要、清理 |
| `on_task_fail` | 任务失败时 | 错误报告、建议 |

### 16.3 Hook 注册与执行

```
Hook 注册：
- 系统内置 Hook（审计、验证）—— 不可禁用
- 插件 Hook —— 通过 plugins/ 注册
- 用户自定义 Hook —— 通过配置文件

Hook 执行规则：
- 同步执行，超时 5s 自动跳过
- Hook 失败不阻塞主流程（除非是安全类 Hook）
- Hook 的执行结果记录到 Trajectory
```

---

## 17. Loop Engineering & Automation（自动化）

### 17.1 定时任务

```
支持 cron 表达式定义定时工作流：
- 每日 NDVI 监测
- 每周数据同步
- 自定义触发条件

定时任务执行时：
- 使用与手动任务相同的 Agentic Loop
- 无 Human-in-the-Loop（除非配置了审批）
- 执行结果记录到任务历史
- 失败时通知用户
```

### 17.2 工作流串联

```
多个任务可串联为工作流（现有 Workflow 链路已支持 DAG）：
Task A 的输出 → Task B 的输入
支持条件分支：如果 A 结果满足 X，执行 B，否则执行 C
支持并行：A 和 B 同时执行，C 等待两者完成
```

### 17.3 自动恢复

```
定时任务失败时：
- 第 1 次失败：自动重试（延迟 5 分钟）
- 第 2 次失败：自动重试（延迟 30 分钟）
- 第 3 次失败：标记为 failed，通知用户
```

---

## 18. Python Worker（执行层）

### 18.1 现有结构

```
workers/geo-python/
├── app/                    # FastAPI 应用入口
│   └── main.py             # 服务启动
├── services/               # 业务逻辑
│   ├── gee/                # Google Earth Engine 工作流
│   ├── gdal/               # GDAL 处理
│   ├── qgis/               # QGIS 算法调用
│   ├── paper/              # 论文解析
│   ├── report/             # 报告生成
│   └── ndvi/               # NDVI 分析
├── tools/                  # 工具实现（供 Core 调用）
├── validation.py           # 结果验证
├── exceptions.py           # 异常定义
└── pyproject.toml          # 依赖管理
```

### 18.2 与 Core 的通信

```
Go Core (worker.Client) → HTTP → Python Worker (FastAPI)

通信协议：
- 同步调用：POST /tools/{tool_name}  → JSON 响应
- 异步调用：POST /tasks → 返回 task_id → GET /tasks/{id} 轮询
- 健康检查：GET /health（目标新增）
```

### 18.3 目标新增

```
workers/geo-python/
├── app/
│   ├── main.py
│   ├── health.py           # 🆕 健康检查端点
│   └── config.py           # 配置管理
├── sandbox/                # 🆕 Python 执行沙箱
├── telemetry.py            # 🆕 执行指标上报
└── ...
```

---

## 19. 开发规范

### 19.1 工程纪律

```
- 小步提交，每次 commit 只做一件事
- 类型安全：Go 侧不使用 interface{} 绕过类型检查
- 构建验收：每次修改后 go build ./... 必须通过
- 不自动执行 Git 操作（除非用户明确要求）
- 不擅自安装新依赖
```

### 19.2 AI 编程助手工作流

```
修改代码前：
1. 阅读本文件 + doc/Agent 架构对比与模块规划.md
2. 阅读当前任务直接相关的源文件
3. 输出：理解 → 修改范围 → 方案 → 验收方式
4. 等待用户确认后再改代码

修改代码后：
1. 汇报修改/新增了哪些文件
2. 说明完成了什么、没做什么
3. 确认 go build 通过
4. 说明需要用户验收的地方
```

### 19.3 Mock 优先原则

```
当前阶段（v0.5.x-dev，开发预览版）：
- 前端使用 mock 数据，标记为 DevBadge
- 不发送假 API 请求
- 需要真实接口时，先设计 adapter 层

后续阶段（v0.5.0+）：
- 逐步替换 mock 为真实 Go API
- adapter 层保持不变，只切换数据源
```

---

## 20. 版本演进路线

| 版本 | 重点 |
| --- | --- |
| v0.1–v0.4（已封存） | demo 探索版：基础架构搭建、原型验证 |
| v0.5.x-dev（当前） | 开发预览版：Agentic Loop 基础、State Machine、Context Budget 初版、Sandbox dev 策略、悬浮辅助对话、会话云端同步 |
| v0.5.0 | 完整 5 层 Compaction、Hooks 事件系统、MCP 真实运行、MapLibre 接入、Eval 基础 |
| v0.6.0 | Memory 持久化、Sub-agent 成熟、工作流串联、定时任务、Trajectory 记录 |
| v1.0 | 生产级安全隔离、Guardian AI、完整计费、团队协作、多模型路由成熟、可观测性平台 |

---

## 21. 模块实现优先级

> **【GLM 注 — 优先级需重构】**
>
> v1.0 的 P0 是"Context Compaction 5 层"和"Hooks"，但这些是在**现有死代码都没接线**的前提下规划的。连基础的 ReAct 循环都没跑通，谈 5 层压缩为时过早。v1.1 调整优先级如下，v1.3 为每项任务补全了独立详细设计文档。

| 优先级 | 任务编号 | 模块 | 原因 | 详细设计文档 |
| --- | --- | --- | --- | --- |
| **P0（立即）** | P0-2 | 状态机/工具表/Planner 三者对齐 | 当前 `run_python` 被状态机误杀，链路是断的 | [`05-GeoWorkAgent-P0-Detailed-Design.md` §2](./05-GeoWorkAgent-P0-Detailed-Design.md) |
| **P0（立即）** | P0-1 | 接线死代码：ContextBuilder/Memory/Executor 接入 executePlan | 不接线，所有上下文工程都是纸上谈兵 | [`05-GeoWorkAgent-P0-Detailed-Design.md` §3](./05-GeoWorkAgent-P0-Detailed-Design.md) |
| **P0（立即）** | P0-3 | Orchestrator per-run 化 | currentState/currentRunID/memory 改为 per-run，否则并发必崩 | [`05-GeoWorkAgent-P0-Detailed-Design.md` §4](./05-GeoWorkAgent-P0-Detailed-Design.md) |
| **P0（立即）** | P0-4 | 实现 ReAct 循环（模型驱动工具选择） | 这是"Agent"的定义性特征，没有它就不是 Agent | [`05-GeoWorkAgent-P0-Detailed-Design.md` §5](./05-GeoWorkAgent-P0-Detailed-Design.md) |
| **P1（本版本）** | P1-1 | Sandbox & Guardrails（Governor + 审批流） | critical 操作必须 Human-in-the-Loop | [`06-GeoWorkAgent-P1-Detailed-Design.md` §2](./06-GeoWorkAgent-P1-Detailed-Design.md) |
| **P1（本版本）** | P1-2 | Observability（Trajectory + Token 审计） | 可追溯性是核心卖点 | [`06-GeoWorkAgent-P1-Detailed-Design.md` §3](./06-GeoWorkAgent-P1-Detailed-Design.md) |
| **P1（本版本）** | P1-3 | SSE per-run 过滤 + 12 种事件 Schema | 当前全局单通道，前端无法只看自己的 Run | [`06-GeoWorkAgent-P1-Detailed-Design.md` §4](./06-GeoWorkAgent-P1-Detailed-Design.md) |
| **P1（本版本）** | P1-4 | Human-in-the-Loop（暂停/恢复/审批集成） | 状态存在但执行路径不触发 | [`06-GeoWorkAgent-P1-Detailed-Design.md` §5](./06-GeoWorkAgent-P1-Detailed-Design.md) |
| **P1（本版本）** | P1-5 | Python Worker 治理（进程池/超时/资源限制） | 防止失控脚本影响系统 | [`06-GeoWorkAgent-P1-Detailed-Design.md` §6](./06-GeoWorkAgent-P1-Detailed-Design.md) |
| **P1（本版本）** | P1-6 | Recovery & Checkpoint（每 5 步保存 + 断点续传） | 不是只在结束时存 | [`06-GeoWorkAgent-P1-Detailed-Design.md` §7](./06-GeoWorkAgent-P1-Detailed-Design.md) |
| **P2（下版本）** | P2-1 | Skills Engineering（技能注册/加载/注入） | 可复用能力的模块化打包 | [`07-GeoWorkAgent-P2-Detailed-Design.md` §2](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P2（下版本）** | P2-2 | MCP Integration（标准工具协议） | 标准化连接 QGIS/GEE/Zotero | [`07-GeoWorkAgent-P2-Detailed-Design.md` §3](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P2（下版本）** | P2-3 | Hooks & Lifecycle（6 个钩子点） | 需要 Agentic Loop 先跑通才有挂钩点 | [`07-GeoWorkAgent-P2-Detailed-Design.md` §4](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P2（下版本）** | P2-4 | Automation（定时任务/事件触发） | 工作流串联与自动恢复 | [`07-GeoWorkAgent-P2-Detailed-Design.md` §5](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P2（下版本）** | P2-5 | Model Routing（多 provider 路由 + 降级 + 成本控制） | 规则引擎先做，AI 审批后做 | [`07-GeoWorkAgent-P2-Detailed-Design.md` §6](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P2（下版本）** | P2-6 | Eval 评估体系（质量评分 + 回归测试） | 让 Agent 行为可度量可比较 | [`07-GeoWorkAgent-P2-Detailed-Design.md` §7](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P2（下版本）** | P2-7 | Browser/Computer Use（接入已有 browserbridge + CDP + 沙箱） | 已有代码但未注册为工具，又是死代码 | [`07-GeoWorkAgent-P2-Detailed-Design.md` §8](./07-GeoWorkAgent-P2-Detailed-Design.md) |
| **P3（远期）** | P3-1 | Sub-agent（独立子 Orchestrator + 上下文继承） | 复杂子任务隔离执行 | [`08-GeoWorkAgent-P3-Detailed-Design.md` §2](./08-GeoWorkAgent-P3-Detailed-Design.md) |
| **P3（远期）** | P3-2 | Harness 规则统一（规则引擎 + JSON 配置） | 安全约束集中管理 | [`08-GeoWorkAgent-P3-Detailed-Design.md` §3](./08-GeoWorkAgent-P3-Detailed-Design.md) |
| **P3（远期）** | P3-3 | 推测执行（批次并行 + 流式提前执行 read_only） | 独立工具调用并行加速 + 流式中提前执行减少等待 | [`08-GeoWorkAgent-P3-Detailed-Design.md` §4](./08-GeoWorkAgent-P3-Detailed-Design.md) |
| **P3（远期）** | P3-4 | 5 层压缩完整版（L4 对话摘要 + L5 记忆固化） | 基础不牢不碰这些 | [`08-GeoWorkAgent-P3-Detailed-Design.md` §5](./08-GeoWorkAgent-P3-Detailed-Design.md) |

### 21.1 阶段依赖与验收边界（v1.3 新增）

```
P0（接线+对齐+per-run+ReAct）  ← Agent 的"能跑起来"基线
  │  验收：ReAct 循环跑通，模型可驱动工具，并发不崩
  ▼
P1（安全+可观测+人工介入+恢复）  ← Agent 的"可控可追溯"层
  │  验收：critical 操作有审批，Trajectory 可回放，可断点续传
  ▼
P2（技能+MCP+Hooks+自动化+路由+评估）  ← Agent 的"可扩展可度量"层
  │  验收：技能可加载，MCP 可连外部工具，Eval 可评分
  ▼
P3（子代理+Harness统一+推测执行+5层压缩）  ← Agent 的"高级能力"层
     验收：子代理可隔离执行，5 层压缩逐级触发
```

**依赖规则：**
- P0 四项任务内部有依赖：P0-2（状态机对齐）→ P0-1（接线死代码）→ P0-4（ReAct），P0-3（per-run）可与 P0-1 并行
- P1 所有任务依赖 P0 完成（ReAct 循环跑通才有挂载点）
- P2 所有任务依赖 P1 完成（安全约束就位才能扩展外部能力）
- P3 所有任务依赖 P2 完成（评估体系就位才能验证高级能力的效果）
- **跨阶段不得跳跃**：例如不能在 P0 未完成时直接做 P2 的 Hooks（没有循环就没有钩子点）

---

## 22. 决策记录与待决策事项

### 22.1 已决策项（v1.1 拍板，影响 P0）

以下 4 项经 qwen + GLM 讨论、用户拍板，作为 P0 实施的约束前提，不再变更：

| # | 事项 | 决策 | 理由 | 影响的 P0 |
|---|---|---|---|---|
| D5 | 两条链路是否合并 | **不合并 + 统一工具入口 + 审批分层** | aiagent（LLM 驱动）与 agent（DAG 驱动）定位不同，合并会牺牲确定性场景可控性。但 workflow 必须改走 ToolRegistry 统一入口。**审批分层**（采纳 qwen 建议）：Governor 审批流对 aiagent mandatory，对 workflow optional（只强制审计日志+沙箱标记），因为 workflow 是用户设计并保存的确定性流程，信任级别高于 LLM 自主调用 | P0-2 范围 |
| D6 | Orchestrator per-run 化方案 | **方案 A：`map[runID]*RunContext`** | Orchestrator 保持单例，内部用 map 隔离每个 Run 的 state/memory/events。改动小，API 层不用大改，可后续演进到 Factory 模式 | P0-3 |
| D7 | 状态机去留 | **修白名单 + 保留 phase 约束**（不降级） | 采纳 qwen 观点：状态机的 phase-based 约束（如"验证阶段不允许写文件"）Governor 的 read/write/exec/delete 四级权限表达不了。问题在实现（白名单脱节）不在概念。P0-2 对齐白名单与注册表、补 ShellAllowed，状态机继续做 phase-based 工具约束 | P0-2 |
| D8 | Executor 启用 | **启用现有 Executor** | `ParseModelResponse` 逻辑已写好，P0-4 时接入 Orchestrator。可能需小幅重构但不大动。这是 ReAct 循环的前提 | P0-4 |

> **决策变更追踪**：D7 经历过一次修正。GLM v1.1 初稿建议"降级为 advisory"，经 qwen 指出 phase 约束的价值后，用户拍板为"修白名单+保留 phase 约束"。原"降级"建议已废弃。

### 22.2 待决策项（不影响 P0，后续再定）

| # | 事项 | 当前状态 | 建议 |
| --- | --- | --- | --- |
| 1 | 前端真实接入时序 | 已有实施计划 | 按 Phase 1-6 逐步执行 |
| 2 | GIS 专用工具迁移 | `workers/geo-python` 已有 GIS API | 评估是否需要注册为 ToolRegistry 工具 |
| 3 | Eino 适配器启用 | `eino_adapter.go` 已就绪 | 按 Cloudwego 集成进度启用 |
| 4 | 多 Agent 触发条件 | 当前为单体 Orchestrator | 工具数 > 15 时启动评估 |

---

## 23. 文档维护规则

本文件是 Agent 架构的长期规范文档。

**允许写入：**
- 架构设计原则
- 模块职责定义
- 接口契约
- 状态转换规则
- 安全策略
- 版本演进方向

**禁止写入：**
- 某次 bug 的修复记录
- 临时任务指令
- 当前开发进度
- 具体文件的修改提醒

短期任务、bug 修复、下一步计划写在 issue 或单独的任务文档中。

---

## 24. 持久化层设计（v1.7 新增）

### 24.1 存储选型

采用 **SQLite** 作为本地持久化引擎（单文件、无外部依赖、Go 生态成熟）。

| 数据 | 存储位置 | 说明 |
|---|---|---|
| Run 历史 | SQLite `runs` 表 | 重启后可查历史 |
| Trajectory | SQLite `trajectories` 表 | 每步工具调用的完整记录 |
| Checkpoint | SQLite `checkpoints` 表 | 断点续传数据 |
| UsageRecord | SQLite `usage_records` 表 | Token 用量审计 |
| Conversation | SQLite `conversations` 表 | 对话历史 |

### 24.2 Schema（核心表）

```sql
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL,           -- work/code/paper/analysis/write
    state TEXT NOT NULL,          -- running/completed/failed/paused
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_tokens INTEGER DEFAULT 0,
    metadata JSON                 -- 扩展字段
);

CREATE TABLE trajectories (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    turn_index INTEGER NOT NULL,
    tool_name TEXT,
    tool_args JSON,
    tool_result JSON,
    model_input JSON,             -- 该轮的 messages 快照
    model_output JSON,            -- 该轮的 model response
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    turn_index INTEGER NOT NULL,
    state TEXT NOT NULL,
    chat_history JSON NOT NULL,
    memory_snapshot JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usage_records (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    cached_tokens INTEGER DEFAULT 0,
    model_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 24.3 迁移策略

- Schema 版本管理：`schema_version` 表记录当前版本号
- 每次 schema 变更通过 migration 文件（`migrations/001_initial.sql`）递增
- 启动时检查版本，自动执行未应用的 migration

### 24.4 文件位置

SQLite 数据库文件位于用户数据目录：

| OS | 路径 |
|---|---|
| Windows | `%APPDATA%/GeoWork/geowork.db` |
| macOS | `~/Library/Application Support/GeoWork/geowork.db` |
| Linux | `~/.local/share/GeoWork/geowork.db` |

---

## 25. API 认证模型（v1.7 新增）

### 25.1 当前阶段

**无认证**。所有 API 端点仅限本地访问（`127.0.0.1`）。

理由：GeoWork 是桌面应用，Go Core 只监听 localhost，不暴露到网络。同一台机器上的进程都可以调用 API，这与本地开发工具（如 Docker Desktop、VS Code Server）的行为一致。

### 25.2 安全边界

- Go Core 绑定 `127.0.0.1:8765`，**禁止**绑定 `0.0.0.0`
- Electron 的 `contextIsolation: true` + `nodeIntegration: false` 确保渲染进程不能直接访问 Go Core
- 所有前端请求通过 preload 暴露的 `api` 命名空间中转

### 25.3 未来演进（团队协作时）

当支持多用户协作时，引入 token-based 认证：

```go
// AuthMiddleware 预留接口（当前为空实现）
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 当前阶段：直接放行
        // 未来：从 Authorization header 提取 token，验证后注入 user context
        next.ServeHTTP(w, r)
    })
}
```

所有 API handler 通过 `AuthMiddleware` 包装，未来启用认证只需改中间件实现。

---

## 26. 配置管理（v1.7 新增）

### 26.1 配置层级

```
代码常量（编译时确定）
  ↓ 被覆盖
配置文件 config.yaml（部署时确定）
  ↓ 被覆盖
环境变量（运行时确定）
```

优先级：环境变量 > 配置文件 > 代码默认值

### 26.2 配置文件

`config.yaml`（位于用户数据目录，与 SQLite 同目录）：

```yaml
# GeoWork 配置

# 模型网关
model:
  default_provider: "openai"
  max_prompt_tokens: 32000
  max_messages: 20
  prompt_cache_ttl: 300  # 秒

# Agent 行为
agent:
  max_turns: 50
  max_consecutive_failures: 3
  approval_timeout: 300  # 秒

# Worker
worker:
  base_url: "http://127.0.0.1:8766"
  timeout: 30            # 秒
  memory_limit_mb: 512

# SSE
sse:
  heartbeat_interval: 15  # 秒
  event_buffer_size: 500

# 沙箱
sandbox:
  root_dir: ""  # 空 = 使用系统临时目录
  allow_network: false
```

### 26.3 Go 侧配置加载

```go
type Config struct {
    Model   ModelConfig   `yaml:"model"`
    Agent   AgentConfig   `yaml:"agent"`
    Worker  WorkerConfig  `yaml:"worker"`
    SSE     SSEConfig     `yaml:"sse"`
    Sandbox SandboxConfig `yaml:"sandbox"`
}

func LoadConfig() (*Config, error) {
    cfg := defaultConfig()  // 代码默认值
    
    // 尝试读取 config.yaml
    configPath := getConfigPath()
    if data, err := os.ReadFile(configPath); err == nil {
        yaml.Unmarshal(data, cfg)
    }
    
    // 环境变量覆盖（GEOWORK_MODEL_MAX_TOKENS 等）
    applyEnvOverrides(cfg)
    
    return cfg, nil
}
```

### 26.4 环境变量命名

格式：`GEOWORK_{SECTION}_{KEY}`，全大写，下划线分隔。

示例：`GEOWORK_MODEL_MAX_PROMPT_TOKENS=64000`、`GEOWORK_AGENT_MAX_TURNS=100`

---

## 变更记录

### v1.1（2026-08-11）— GLM 现状诊断与诚实化

**背景**：qwen v1.0 的架构蓝图方向正确，但第 3 节"现有架构现状"把目标当现状，多处描述与代码实际行为不符。新工程师若据此在错误基础上继续搭建，会积重难返。v1.1 的核心使命是**拉齐文档与代码的真相**。

**变更**

1. **新增版本表**（文件顶部），记录每次迭代的作者与摘要，参考 `前端设计系统.md` 的治理格式
2. **新增第 0.1 节"整体架构设计原则"**（设计宪法）：
   - 0.1.1 核心设计哲学（6 条原则 + 反例）
   - 0.1.2 必须集成的 15 个工程学科清单（含现状标注 ✅/⚠️/❌）
   - 0.1.3 学科关系图（Loop 为心脏，Context/Tool/Memory 为三支柱，Harness 为底线，Observability 横切）
   - 0.1.4 设计约束与不可妥协项（8 条，PR 违背不予合并）
3. **新增第 0.2 节"现状诊断与诚实评估"**（原 v1.1 的第 0 节重编号）：
   - 一句话定性当前代码为"有骨架无灵魂的玩具原型"
   - 列出文档 vs 代码的 **8 处重大偏差**（4 致命 / 3 严重 / 1 中等）
   - 标注 **6 个死代码模块**（executor/context_builder/context_budget/repo_map/tool_result_summarizer/memory.Summary）
   - 给 qwen 的反馈：蓝图好但现状描述不实
4. **第 3 节修正**：
   - 标题改为"架构现状（v1.1 修正：如实标注）"
   - 在 AI Agent 文件清单后注入执行路径真相表（5 个死代码模块）
   - 在"两条链路共享"后标注"共享不成立"（workflow 绕过 ToolRegistry）
   - 在工具清单后标注状态机与注册表的 8 个不一致工具名
5. **第 4 节修正**：
   - 标注"本节为目标设计，非现状"
   - 新增 4.1.1"实际代码行为"，用伪码展示真实的一次性规划+线性执行
   - 新增目标 vs 现状对比表（5 个维度）
6. **第 5 节修正**：标注 ContextBuilder/Budget/RepoMap/Summarizer 在执行路径上全部为死代码
7. **第 7 节修正**：标注 `skills/` 目录不存在，全部为目标；7.4 标题改为"【目标】，非 v0.4.x 现状"
8. **第 9 节修正**：标注 Memory 只写不读（Summary/Messages 从不调用）
9. **第 10 节修正**：标注状态机三个致命问题（白名单脱节 / ShellAllowed 永不为 true / 状态在 Run 间共享）；标注 Checkpoint"每 5 次"为目标，实际只在结束时存一次
10. **第 15 节修正**：标注 StartRunWithMemory 不是真正的 Sub-agent
11. **第 21 节优先级重构**：P0 从"5 层压缩/Hooks"改为"接线死代码/三者对齐/per-run 化/实现 ReAct"
12. **第 22 节补充**：对"两条链路是否合并"给出明确意见（不合并但统一工具入口）；新增待决策项 6/7/8（per-run 化 / 状态机降级 / Executor 启用）

**废弃**

- v1.0 第 3 节标题"现有架构现状"中"现有"一词的乐观暗示 → 改为"架构现状（v1.1 修正）"
- v1.0 第 4 节将 ReAct 循环作为"已有"描述 → 改为"【目标】"
- v1.0 第 7.4 节"官方技能清单（v0.4.x）"的版本标注 → 改为"【目标】"（skills/ 目录不存在）
- v1.0 第 10.4 节"每 5 次工具调用后"checkpoint 的现状声称 → 标注为目标

**未改（保留 qwen v1.0 原文）**

- 第 1/2 节（产品定位、概念体系）：准确，无需改
- 第 6/8/11/12/13/14/16/17/18/19/20 节：目标设计保留，仅在其触及"现状"声称处加注
- 第 23 节（文档维护规则）：保留

---

### v1.2（2026-08-11）— GLM 学科补全与决策拍板

**背景**：v1.1 的 0.1.2 学科清单遗漏了 Harness Engineering（用户发现），GLM 做完整缺口审计后又发现 Prompt Engineering 和 Streaming & Event Engineering 也该独立。同时 v1.1 列的 4 项待决策经 qwen+GLM 讨论、用户拍板，需固化为决策记录。

**变更**

1. **0.1.2 学科清单补全（15→18）**：
   - 新增 #1 **Harness Engineering**（元学科）——v1.1 把它隐含在 0.1.1 哲学里，未作为表中的一行。它是"防止/量测/修正/记录"的约束哲学，贯穿 State Machine/Sandbox/Guardrails/Hooks/Audit
   - 新增 #4 **Prompt Engineering**——v1.1 把它塞在 §5.4。Context 管"给模型看什么"，Prompt 管"怎么组织"（指令层级/tool 描述格式/few-shot），是独立工程
   - 新增 #13 **Streaming & Event Engineering**——v1.1 把它隐含在 Observability。SSE 协议/事件 schema/per-run 过滤/前端 adapter 是"事件传输层"，和"度量"是两回事
   - 新增学科边界说明：Context vs Prompt、Observability vs Streaming
2. **0.1.3 关系图重绘**：
   - Harness 提升为最外层外壳（包裹一切的元学科），不再是 Harness 层实体里的一个标签
   - Prompt 作为 Context 的组织层（Context 决定"给什么"，Prompt 决定"怎么排版"）
   - Streaming 与 Observability 并列为两个出口（前者管事件传输，后者管度量）
3. **第 22 节决策记录（D5-D8 拍板）**：
   - D5 两条链路：**不合并 + 统一工具入口 + 审批分层**（workflow 审批 optional，只强制审计+沙箱）
   - D6 per-run：**方案 A `map[runID]*RunContext`**（Orchestrator 保持单例，内部 map 隔离）
   - D7 状态机：**修白名单 + 保留 phase 约束**（修正 v1.1 初稿"降级 advisory"的建议——采纳 qwen 观点，phase 约束 Governor 表达不了）
   - D8 Executor：**启用现有 `ParseModelResponse`**（P0-4 时接入 Orchestrator）
   - 新增"决策变更追踪"标注 D7 的修正过程

**废弃**

- v1.1 第 22 节"待决策项 6/7/8"的"待决策"状态 → v1.2 升级为"已决策 D5-D8"
- v1.1 0.1.2 的"15 个学科是完整器官清单"声称 → 修正为 18 个
- v1.1 GLM 对状态机"降级为 advisory"的建议 → D7 拍板为"修白名单+保留 phase 约束"

**未改**

- 0.1.1 核心设计哲学、0.1.4 不可妥协约束：v1.1 已定，v1.2 不动
- 0.2 现状诊断：v1.1 已定，v1.2 不动
- 第 3-21 节正文：v1.2 不动

---

### v1.3（2026-08-11）— GLM P0-P3 施工方案落地

**背景**：v1.2 拍板了 D5-D8 四项架构决策后，P0 的实施方向已经明确。但 v1.1/v1.2 只在主文档里写了"该做什么"，没写"具体怎么做"——接口签名、数据结构、改动文件清单、验收标准都缺失。直接让工程师照着主文档写代码会再次陷入"各人理解不同、实现各异"的混乱。v1.3 的核心使命是**把 P0-P3 四个阶段的施工方案写成可直接照着写代码的详细设计文档**。

**变更**

1. **新建 4 份独立详细设计文档**（主文档不再膨胀，详细设计拆分到子文档）：
   - [`05-GeoWorkAgent-P0-Detailed-Design.md`](./05-GeoWorkAgent-P0-Detailed-Design.md)（v0.2，1421 行）——P0 四项任务的完整施工方案
   - [`06-GeoWorkAgent-P1-Detailed-Design.md`](./06-GeoWorkAgent-P1-Detailed-Design.md)（v0.1，680 行）——P1 六项任务的完整施工方案
   - [`07-GeoWorkAgent-P2-Detailed-Design.md`](./07-GeoWorkAgent-P2-Detailed-Design.md)（v0.1，941 行）——P2 六项任务的完整施工方案
   - [`08-GeoWorkAgent-P3-Detailed-Design.md`](./08-GeoWorkAgent-P3-Detailed-Design.md)（v0.1，644 行）——P3 四项任务的完整施工方案

2. **P0 详细设计内容**（v0.1+v0.2）：
   - P0-2 状态机三者对齐：注册表真相源（13 个工具）+ 新状态机白名单表（9 状态 × 工具 × 4 标志）+ 8 个幽灵工具清理 + workflow 接入 ToolRegistry + 审批分层
   - P0-1 接线死代码：ChatMessage 类型统一（删除 aiagent.ChatMessage）+ ContextBuilder.Build() 接入 executePlan + 三级 token 预算裁剪 + Memory.Summary() 回注 + RepoMap 接入
   - P0-3 per-run 化：RunContext 结构体 + map 并发保护 + Orchestrator 方法签名改动 + SSE per-run 过滤 + 10 种事件 Schema
   - P0-4 ReAct 循环：API 请求构建 + System Prompt 模板（5 Mode）+ 流式响应解析（tool_calls delta 增量拼接）+ ReAct 循环伪码 + Executor 接入点 + Prompt Caching 策略

3. **P1 详细设计内容**：
   - P1-1 Sandbox & Guardrails：Governor 结构体 + 审批流 + 沙箱路径检查
   - P1-2 Observability：Trajectory 记录器 + Token 用量审计
   - P1-3 Streaming 完整：12 种 SSE 事件类型 + 前端 adapter 契约
   - P1-4 Human-in-the-Loop：暂停/恢复 + 审批集成
   - P1-5 Python Worker 治理：WorkerPool + 超时/资源限制
   - P1-6 Recovery：Checkpoint 每 5 步保存 + 断点续传

4. **P2 详细设计内容**：
   - P2-1 Skills Engineering：Skill 结构体 + 注册表 + 加载器 + 5 个内置技能
   - P2-2 MCP Integration：MCP 客户端 + stdio 传输 + 工具适配器
   - P2-3 Hooks & Lifecycle：6 个钩子点 + Hook 接口 + 注册机制
   - P2-4 Automation：定时任务调度器 + 事件触发器
   - P2-5 Model Routing：多 provider 路由 + 降级 + 成本控制
   - P2-6 Eval 评估体系：7 个评估指标 + 质量评分器 + 回归测试

5. **P3 详细设计内容**：
   - P3-1 Sub-agent：SubAgentManager + 独立子 Orchestrator + 上下文继承 + 工具化（spawn_subagent）
   - P3-2 Harness 规则统一：Harness 规则引擎 + 4 种规则类型 + JSON 配置
   - P3-3 推测执行：ParallelExecutor + 依赖分析 + 同类型并行 + 不同类型串行
   - P3-4 5 层压缩完整版：L4 对话摘要（模型生成）+ L5 记忆固化 + 逐级触发流程

6. **第 21 节优先级表重构**（v1.3）：
   - 原 11 行表格扩展为 20 行，每个任务分配编号（P0-1~P0-4、P1-1~P1-6、P2-1~P2-6、P3-1~P3-4）
   - 新增"详细设计文档"列，每项任务链接到对应子文档的章节
   - 新增 §21.1"阶段依赖与验收边界"：明确 P0→P1→P2→P3 串行依赖 + 各阶段验收标准 + 跨阶段不得跳跃规则

**废弃**

- v1.2 第 21 节的 11 行优先级表（无任务编号、无文档引用）→ 替换为 20 行带编号带链接的完整表

**未改**

- 0.1/0.2 节（设计宪法 + 现状诊断）：v1.1/v1.2 已定，v1.3 不动
- 第 3-20 节正文：v1.3 不动（详细设计在子文档中）
- 第 22 节决策记录：D5-D8 已拍板，v1.3 不动
- 第 23 节文档维护规则：保留

**文档结构说明**

v1.3 后，GeoWork Agent 架构文档体系形成"主文档 + 4 份子文档"的层次结构：
- **主文档**（本文件）：架构宪法 + 现状诊断 + 各学科目标设计 + 优先级与决策记录
- **P0-P3 子文档**：每个阶段的施工方案（接口签名 + 数据结构 + 改动文件 + 验收标准）

主文档回答"**做什么、为什么**"，子文档回答"**怎么做、做到什么程度**"。代码实现时以子文档为准，主文档作为架构约束的参照。

---

### v1.4（2026-08-11）— GLM 豆包-code 审查反馈补全

**背景**：豆包-code 对 v1.3 的 14 个核心模块覆盖情况做了完整审查，发现两个缺口：(1) Browser/Computer Use 模块完全没有详细设计；(2) P3-3 推测执行策略粗糙，主文档 §6.6 描述的"流式中提前执行 read_only"在 P3-3 中缺失。经核实两个缺口均真实存在，v1.4 补全。

**变更**

1. **P2 新增 P2-7 Browser/Computer Use**（`07-GeoWorkAgent-P2-Detailed-Design.md` v0.2）：
   - 现状诊断：`browserbridge/` 已有 6 个 Go 文件 + `tool_policy.go` 已有 3 个工具策略定义，但 `builtin_tools.go` 未注册——又是死代码
   - 3 个工具注册：`browser_control`(High/需审批) + `screenshot`(Medium/无需审批) + `network_request`(High/需审批)
   - 可选第 4 个工具 `paper_search`(Low/无需审批，已有 OpenAlexSearch 函数)
   - CDP 协议适配器（`cdp_adapter.go` 新建，建议用 chromedp）
   - 沙箱约束：URL 白名单 + 下载路径限制 + 截图尺寸 + 会话数量 + 超时
   - 状态机白名单对齐（StateInspecting/StateExecuting 新增 3 个工具）
   - 数据流 + 10 条验收标准

2. **P3-3 补充 §4.5 流式提前执行**（`08-GeoWorkAgent-P3-Detailed-Design.md` v0.2）：
   - `SpeculativeExecutor` 结构体：`TryExecuteInStream`/`GetResult`/`Cleanup`
   - `tool_policy.go` 新增 `ReadOnly` 标记（6 个 read_only 工具：read_file/list_files/search_workspace/scan_folder/screenshot/paper_search）
   - `streamModelCall` 集成：chunk 解析到 JSON 闭合的 tool_call 时触发提前执行 + 模型输出完毕后从缓存拿结果
   - `isJSONComplete` 辅助函数（花括号配对检测）
   - 时序对比（无提前执行 5s vs 有提前执行 4s，节省 20%）
   - 5 条安全约束（只对 read_only/结果可丢弃/不计入 Trajectory/遵守审批/并发≤3）
   - 7 条验收标准

3. **第 21 节优先级表更新**：
   - 新增 P2-7 行（Browser/Computer Use）
   - P3-3 描述更新：从"并行工具路径 + 择优采用"改为"批次并行 + 流式提前执行 read_only"

4. **§0.1.2 学科清单补全 18→19**（v1.4 修正）：
   - 新增第 19 行：Browser/Computer Use（浏览器/GUI 操控）
   - 理由：v1.3 补 P2-7 详细设计时漏把它加入学科清单，违反了 §0.1.2 自己的阅读规则"新增模块必须归入其中一个学科"。Browser/Computer Use 与 #18 Python Worker 是同类——都是执行层能力，有独立工程问题（CDP 协议/会话管理/URL 沙箱/OCR），理应同等对待
   - 阅读规则 "18 个学科" → "19 个学科"
   - 新增 v1.4 修正说明（在 v1.2 修正说明下方）

5. **§0.1.3 关系图更新**：
   - 执行层新增 Browser/Computer Use 节点（与 Observability 并列）
   - 关系要点新增："Python Worker 与 Browser/Computer Use 是执行层的双支柱"

**废弃**

- 无（v1.3 的内容全部保留，v1.4 是纯增补）

**未改**

- 0.2 节、第 3-20 节正文、第 22/23 节：v1.4 不动
- P0/P1 详细设计文档：v1.4 不动（P2-7 的状态机白名单对齐是 P0-2 的延伸，但 P0-2 文档不需要改，因为 P2-7 在自己的文档里说明了）

**审查反馈处理记录**

| 审查项 | 豆包-code 结论 | GLM 核实 | 处理 |
|---|---|---|---|
| Browser/Computer Use 无详细设计 | ❌ 缺失 | 确认：6 个 Go 文件 + 3 个策略定义但未注册 | ✅ P2-7 补全 |
| P3-3 推测执行粗糙 | ⚠️ 缺流式提前执行 | 确认：主文档 §6.6 有描述但 P3-3 没实现 | ✅ §4.5 补全 |
| P1-2 与 P2-6 关系 | ✅ 清晰 | 确认 | 无需处理 |
| P3-2 与 P1-1 边界 | ✅ 清晰但需注意版本叠加 | 确认：代码实现时处理 ToolRegistry.Execute 签名叠加 | 代码实现时注意 |
| Browser/Computer Use 不在学科清单 | （用户审查发现） | 确认：v1.3 补 P2-7 时漏加入 §0.1.2 清单，违反阅读规则 | ✅ §0.1.2 补全 18→19 + 关系图补入 |

---

### v1.5（2026-08-11）— GLM 千问审查 6 硬伤 + 4 软伤修复

**背景**：千问对 v1.4 + 4 份施工文档做了完整审查，指出 6 处硬伤（必须修才能开工）+ 4 处软伤（不阻塞开工但建议尽快补）+ 文档间不一致。v1.5 修复全部 6 处硬伤 + 软伤 1 + 不一致 2，其余软伤在对应文档变更记录中标注"待补"。

**变更**

1. **P0 文档 v0.3**（4 处硬伤）：
   - 硬伤 1（§5.5）：`idx := 0` → `idx := tc.Index`，StreamChunk.ToolCall 新增 `Index int` 字段
   - 硬伤 2（§2.7）：workflow → ToolRegistry 动态注册方案（Python Worker 工具名如 `research.openalex.search` 与内置工具名不同）
   - 硬伤 4（§5.2.1）：ModelGateway interface 定义，Orchestrator 依赖接口而非具体实现
   - 硬伤 6（§5.6.1）：`inferStateFromTool` + `transitionTo` + 状态转换规则表

2. **P1 文档 v0.2**（1 处硬伤 + 1 处软伤）：
   - 硬伤 5（§2.5.1）：`waitForApproval` 完整实现（5 分钟超时 → 自动暂停 Run + 事件）
   - 软伤 1（§3.5）：UsageRecord 新增 `CachedTokens` 字段

3. **P2 文档 v0.3**（1 处硬伤）：
   - 硬伤 3（§2.6）：Skills Loader 从 `.json` 改为 `SKILL.md + meta.json` 目录结构（与主文档 §7.1 一致）

4. **主文档修正**：
   - §3.3 工具数 12→13（v1.0 误写为 12，实际 13 个，`scan_folder` 被漏数）

**待补（软伤，不阻塞开工）**

| 软伤 | 位置 | 状态 |
|---|---|---|
| 软伤 2：指令优先级层级（system > skill > user preference） | P0 §5.4 | 待补 |
| 软伤 3：SSE 断线重连（Last-Event-ID） | P1 §4 | 待补 |
| 软伤 4：测试策略（mock modelgateway） | P0 新增章节 | 待补 |

**废弃**

- 无（v1.4 的内容全部保留，v1.5 是纯修正）

**未改**

- P3 文档：v1.5 不动（千问未指出 P3 有硬伤）
- §0.1/0.2 节、第 3-20 节正文（除 §3.3 工具数修正）、第 22/23 节：v1.5 不动

**千问审查反馈处理记录**

| 审查项 | 千问结论 | GLM 核实 | 处理 |
|---|---|---|---|
| 硬伤 1：idx 写死 | ❌ 代码级 bug | 确认：P0 §5.5.2 第 1092 行 | ✅ P0 v0.3 修复 |
| 硬伤 2：工具名映射未定义 | ❌ 设计级缺口 | 确认：Python Worker 工具名与内置工具名完全不同 | ✅ P0 v0.3 动态注册方案 |
| 硬伤 3：Skills 格式矛盾 | ❌ 文档间矛盾 | 确认：主文档 §7.1 是 SKILL.md，P2-1 是 .json | ✅ P2 v0.3 统一为 SKILL.md |
| 硬伤 4：ModelGateway 接口未定义 | ❌ 设计级缺口 | 确认：Orchestrator 依赖具体类型 | ✅ P0 v0.3 新增 interface |
| 硬伤 5：审批超时未定义 | ❌ goroutine 永远阻塞 | 确认：waitForApproval 无超时 | ✅ P1 v0.2 补全超时逻辑 |
| 硬伤 6：状态机转换不完整 | ❌ 设计级缺口 | 确认：只有 2 处 transition | ✅ P0 v0.3 补全 inferStateFromTool |
| 软伤 1：缓存命中率度量 | ⚠️ 缺 CachedTokens | 确认 | ✅ P1 v0.2 补 CachedTokens |
| 软伤 2：指令优先级 | ⚠️ 未定义 | 确认 | 待补 |
| 软伤 3：SSE 断线重连 | ⚠️ 未提 | 确认 | 待补 |
| 软伤 4：测试策略 | ⚠️ 无 mock 方案 | 确认 | 待补 |
| 不一致 2：工具数 12 vs 13 | 📝 主文档 vs P0 | 确认：主文档 §3.3 误写 12 | ✅ v1.5 修正为 13 |

---

### v1.0（2026-08-11）— qwen 初稿

原始版本，见版本表。整合了远端 04-GeoWorkAgent.md 的代码现状分析、AGENT.MD 架构规范、Agent 架构对比与模块规划的优先级排序，新增了 Hooks/Guardian AI/Trajectory/推测执行等目标模块。
