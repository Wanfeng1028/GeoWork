# GeoWork 通用垂直领域 Agent 升级方案

> 目标：把 GeoWork 从「脚手架 + 演示」升级为一个真正可用的、面向 GIS/遥感的垂直领域智能体（对标 Codex / CoWork / QoderWork / Trae SOLO），能够在自然语言驱动下自主规划、调用真实地理空间工具、验证结果并交付产物。
>
> 本文所有结论均基于对当前代码的实读证据（文件路径 + 关键行），非泛泛而谈。

---

## 一、执行摘要

### 1.1 现状一句话定级
- **后端有骨架、有真实 GIS 能力，但"大脑"是假的、"接线"是断的。**
- Python Worker 的 GIS/遥感能力大多是**真实实现**（rasterio/gdal/geopandas/ee）；
- Go Core 有两套并存且**互不连通**的 agent 系统；
- 承担"智能体大脑"的 `aiagent` 编排器**不是真正的 agent loop**，而是一个"静态计划执行器"；
- 前端聊天链路**全部走 mock**，SSE/WebSocket 适配器是空壳，端到端未打通。

### 1.2 与目标（Codex/Trae SOLO 类）的核心差距
| 能力维度 | Codex/Trae SOLO 类标准 | GeoWork 现状 | 差距等级 |
|---|---|---|---|
| Agentic Loop（模型动态决定下一步工具调用） | ✅ 原生 tool-calling 循环 | ❌ 预生成固定计划后线性执行 | 🔴 阻断级 |
| 工具结果回灌模型 | ✅ 完整结果进上下文 | ❌ 只存 "result: N keys" | 🔴 阻断级 |
| 领域工具可被 LLM 调用 | ✅ | ❌ GIS 工具只在另一套 DAG 引擎里 | 🔴 阻断级 |
| 前后端流式打通 | ✅ SSE/流式 | ❌ 前端 mock，SSE 未实现 | 🔴 阻断级 |
| 真实沙箱隔离 | ✅ 容器/进程隔离 | ⚠️ 有 `Sandbox(true)` 标记但直接裸跑 | 🟠 高 |
| 变更验证/回滚 | ✅ diff/checkpoint/测试门禁 | ⚠️ 有 checkpoint/patch，门禁静默变绿 | 🟠 高 |
| 领域 Skill/MCP 可执行 | ✅ | ⚠️ Skill/plugin 目前是描述文档 | 🟠 高 |
| 上下文/记忆管理 | ✅ 预算+检索+压缩 | ⚠️ 有 budget/memory 框架，未接入主循环 | 🟡 中 |

### 1.3 建议的改造主线（后文展开）
1. **收敛双轨** → 统一为"LLM 编排器 + 工具"单一架构；
2. **把假循环换成真 agentic loop**（原生 tool-calling）；
3. **把 GIS Worker 的 25+ 能力注册为 LLM 可调用工具**；
4. **打通前端 SSE 流式链路**（替换 mock）；
5. **补齐沙箱、验证门禁、领域 Skill 执行、记忆检索**。

---

## 二、对标：这类 Agent 的能力模型

Codex / Trae SOLO / Qoder 这类"通用编码/任务智能体"共享一套骨架，GeoWork 要做 GIS 垂直版就必须先补齐这套骨架，再叠加领域能力：

**通用骨架（必须有）**
1. **Agentic Loop**：`while(未完成){ 模型看上下文 → 决定调用哪个工具/或回答 → 执行 → 结果回灌上下文 }`，由模型而非预设脚本决定下一步。
2. **工具层**：文件读写、shell、代码执行、检索、diff/patch、git，全部以统一 schema 暴露给模型（function calling）。
3. **上下文工程**：仓库地图（repo map）、预算裁剪、工具结果摘要、长期记忆检索。
4. **执行安全**：状态机（读/写/执行分级）、权限审批、真实沙箱、可回滚 checkpoint。
5. **验证闭环**：改动后自动 build/test/lint，失败即重规划。
6. **流式交付**：SSE/WS 把思考、工具调用、产物实时推给前端，人可在关键点审批。

**GIS 垂直叠加（差异化护城河）**
7. **地理空间工具族**：栅格裁剪/重投影/NDVI/DEM/COG、矢量缓冲/裁剪/融合、GEE 脚本生成、制图导出。
8. **数据源连接器**：PostGIS、GEE、影像目录、文献（OpenAlex/Zotero）。
9. **领域 Skill**：NDVI 时序、土地分类、城市扩张、DEM 地形分析等"配方"，可被 agent 直接执行。
10. **地理可视化产物**：地图（MapLibre/deck.gl）、图表（ECharts）、报告（docx）。

---

## 三、当前架构全景与关键问题（含证据）

### 3.1 双轨 Agent 架构割裂 🔴
存在两套 agent，彼此不通：

- **`core/internal/agent`（DAG 工作流引擎）**：[engine.go](file:///e:/code/javascript/project/GeoWork/core/internal/agent/engine.go) 用 Kahn 拓扑排序执行 workflow 节点，通过 `worker.Client` 调用**真实 GIS Worker**。这是目前真正能干 GIS 活的路径，但它是"确定性工作流"，不是对话式智能体。
- **`core/internal/aiagent`（LLM 编排器）**：[orchestrator.go](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/orchestrator.go) 挂在 `/api/agent/runs`（见 [routes.go](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/routes.go)），有 planner/state_machine/memory/context_budget，但它的工具集里**没有任何 GIS 工具**，也不调用 `worker.Client`。

**后果**：会"对话规划"的没有 GIS 能力；有 GIS 能力的不会"对话规划"。二者从未在一条链路里协作。

### 3.2 `aiagent` 不是真正的 Agent Loop，而是"静态计划执行器" 🔴
证据在 [planner.go](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/planner.go) 与 [orchestrator.go](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/orchestrator.go)：

- `Planner.Plan()` 让 LLM **一次性吐出固定 steps 列表**（title/tool/args），随后 `executePlan()` 线性跑完。模型**无法根据中间结果改变后续动作**。
- 所谓"自适应反馈"是**装饰性**的：`orchestrator.go` 第 274–292 行把历史发给 LLM，但回复只 `o.log.Debug("LLM feedback received")`，**从不用于修改计划或决定下一步工具**。
- 调用模型时是 `o.gateway.Chat(llmCtx, chatHistory, nil, false)`——**第三个参数 `nil` 意味着根本没把工具 schema 传给模型**，所以模型无从发起 tool call。
- **LLM 超时仅 5 秒**（planner.go 第 123 行、orchestrator.go 第 280 行），真实模型规划/推理经常超时 → 频繁跌回关键词匹配的 `fallbackPlan`。
- `fallbackPlan` 生成的"GIS 步骤"是**占位脚本**：`{"script": "print('Planning GIS workflow...')"}`（planner.go 第 219/229/238 行），跑了等于没跑。

### 3.3 工具结果被丢弃，没有反馈闭环 🔴
[orchestrator.go](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/orchestrator.go) 第 372–373 行：
```
step.Status = "completed"
step.Result = fmt.Sprintf("result: %d keys", len(result))
```
工具的**真实输出内容被扔掉**，只留"有几个 key"。memory 里也只记 `"Tool X completed successfully"`（第 385 行）。模型后续推理拿不到任何真实数据 → 无法基于结果做决策，等于"盲跑"。

### 3.4 GIS 能力与 LLM Agent 未打通 🔴
- Worker 侧能力真实且丰富：[worker/client.go](file:///e:/code/javascript/project/GeoWork/core/internal/worker/client.go) 封装了 25+ 端点（`/tools/gdal/inspect-dataset`、`/tools/gee/search-dataset`、clip/reproject/merge/dissolve/ndvi…），Python 侧 `workers/geo-python/app/api/gis.py`、`ndvi.py`、`gee/__init__.py` 用 rasterio/gdal/geopandas/ee **真实实现**（库缺失时优雅降级为占位）。
- 但 `aiagent` 的工具注册表 [builtin_tools.go](file:///e:/code/javascript/project/GeoWork/core/internal/toolregistry/builtin_tools.go) 只有通用工具（read/write/list/search/run_python/run_shell/git…），**没有一个 `geo.*` 工具**去调用 Worker。
- 于是即便修好 loop，模型也"够不着"GIS 能力。

### 3.5 前端全 mock，端到端断链 🔴
- 前端聊天默认适配器是 `mockStreamAdapter`，且 `activeAdapter = mockStreamAdapter`；`sseStreamAdapter`/`websocketStreamAdapter` 直接 `throw new Error('... not implemented yet')`（见 subagent 勘察：`apps/desktop/src` 的 stream 适配器）。
- Workspace（地图）、DataCenter、Skills、Connectors 等页面是**路由占位 / mock 数据**。
- **结论**：用户在前端发消息 → 走的是前端假流式，根本没到 Go Core。真实链路 `前端 → Core → Worker` 未打通。

### 3.6 沙箱 / 权限名不副实 🟠
[builtin_tools.go](file:///e:/code/javascript/project/GeoWork/core/internal/toolregistry/builtin_tools.go)：
- `run_python`（第 203 行）/`run_shell`（第 239 行）标了 `.Sandbox(true)`，但实现是**直接 `exec.CommandContext` 裸跑**，没有任何隔离、资源限制、路径限制。
- 二者恒定返回 `"stderr": "", "exit": 0`（第 211–215、248–252 行），**丢失真实 stderr 和退出码**，模型/前端无法判断脚本是否真失败。
- `create_artifact`（第 278 行）返回空 id，**不落盘、不注册**；`run_git_add`（第 410 行）是空桩返回 `{"staged":0}`。

### 3.7 验证门禁静默变绿 🟠
`scripts/check_all.py`：工具缺失时 `run()` 在 `FileNotFoundError` 分支 `return not required`（即视为通过），Go/node_modules 缺失时 SKIP 但不改 ok，最终照打"passed"。**CI 假绿**会让 agent 的"验证"步骤失去意义。

### 3.8 上下文/记忆是"半成品，未接线" 🟡
`aiagent` 有 `context_budget.go` / `context_builder.go` / `memory.go` / `repo_map.go`，设计不错，但主循环 `executePlan` 里**几乎没用它们**做真正的上下文组装与检索——它们是"备而未用"。

### 3.9 领域资产仅描述、不可执行 🟠
- `skills/*/manifest.json`（如 [ndvi-timeseries](file:///e:/code/javascript/project/GeoWork/skills/ndvi-timeseries/manifest.json)）声明了 `required_tools: geo.gee.search_dataset` 等，但这些 tool id **在工具注册表里并不存在**。Skill 是"愿景描述"，没有执行绑定。
- `plugins/`（postgis/qgis/zotero/openalex）、`mcp/connectors.json` 同理，多为清单，未接入 agent 可调用路径。

---

## 四、目标架构（To-Be）

```
┌─────────────────────────────────────────────────────────────┐
│  Desktop (Electron + React)                                  │
│  Chat / Map(MapLibre+deck.gl) / DataCenter / Tasks / Approve │
└───────────────▲───────────────────────────┬─────────────────┘
                │ SSE 事件流(thinking/tool/  │ REST: /api/agent/runs
                │ delta/artifact/approve)    ▼
┌───────────────┴─────────────────────────────────────────────┐
│  Go Core —— 单一 Agent 运行时                                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Agent Loop │→ │ Tool Registry │→│ 通用工具: fs/shell/py │  │
│  │ (真 tool-  │  │ (function     │  │ git/patch/checkpoint  │  │
│  │  calling)  │← │  calling)     │  │──────────────────────│  │
│  └─────┬──────┘  └──────────────┘  │ 地理工具: geo.raster.*│  │
│        │                            │ geo.vector.* geo.gee.*│  │
│  ┌─────▼──────┐  ┌──────────────┐  │ geo.map.* (→Worker)   │  │
│  │Context Eng.│  │ Safety/State │  └───────────┬───────────┘  │
│  │repo map/预 │  │ 机/权限/沙箱 │              │              │
│  │算/记忆检索 │  │ /审批        │              │              │
│  └────────────┘  └──────────────┘              │              │
└────────────────────────────────────────────────┼─────────────┘
                                                  │ HTTP
                                    ┌─────────────▼─────────────┐
                                    │ Python GIS Worker(FastAPI) │
                                    │ rasterio/gdal/geopandas/ee │
                                    │ 沙箱脚本执行 / 制图 / 报告 │
                                    └────────────────────────────┘
```

**核心原则**
- 只保留**一个**智能体入口（`aiagent` 编排器）；DAG `agent` 引擎降级为"可选的确定性 workflow 模板"，或作为 agent 的一个内部工具（`run_workflow`）。
- 所有能力（含 GIS）**统一以 tool schema 暴露**给模型，由模型在 loop 中动态调用。
- 事件流是唯一的前后端契约。

---

## 五、实现方案（分阶段）

> 排期建议：P0–P1 是"让它真的跑起来"，P2–P3 是"让 GIS 能力可用且可见"，P4–P5 是"垂直护城河 + 生产化"。每个阶段都可独立交付、独立验收。

### Phase 0：收敛与止血（1 周）
目标：消除"假绿""双轨困惑"，为重构清场。
1. **修复 `check_all.py`**：工具缺失应 `FAIL` 或显式 `SKIPPED (not passed)`，绝不计入 passed；退出码区分"全过 / 有跳过 / 有失败"。
2. **明确双轨定位**：在 README/AGENT.md 标注 `agent`（DAG）与 `aiagent`（LLM）的边界，冻结 DAG 引擎的新增功能，后续只增强 `aiagent`。
3. **修 `run_python`/`run_shell` 返回值**：真实回填 `stdout`、`stderr`、`exit`（用 `exec.ExitError` 取 code），不再恒定 0。
4. **清理误导性桩**：`create_artifact`、`run_git_add` 要么实现、要么明确报 "not implemented" 而非静默成功。

### Phase 1：真正的 Agentic Loop（2–3 周）🔴 最高优先
目标：把"静态计划执行器"换成"模型驱动的 tool-calling 循环"。这是整个项目的**分水岭**。

**1.1 改造 `Orchestrator.executePlan` → `runAgentLoop`**（`core/internal/aiagent/orchestrator.go`）
- 循环结构：
  ```
  messages = [system(含 repo map/记忆), user(prompt)]
  for turn in 1..maxTurns:
      resp = gateway.Chat(ctx, messages, toolSchemas, stream=true)   // 关键：传入 toolSchemas，非 nil
      if resp 无 tool_calls:  // 模型给出最终回答
          emit(message); break
      for tc in resp.tool_calls:
          result = registry.Execute(ctx, tc.Name, tc.Args)
          messages += assistant(tool_call) + tool(role="tool", 完整结果摘要)  // 结果回灌
          emit(tool_call 事件)
  ```
- **删除 5s 超时**，改为可配置（规划类 60–120s），支持流式，避免跌回 fallback。
- **保留但重构 planner**：planner 从"生成固定步骤"改为"生成初始 TODO / 高层计划"（供前端展示 + 引导模型），执行仍由 loop 主导。
- **上下文回灌**：`tool` 消息里放**真实结果的智能摘要**（复用现有 `tool_result_summarizer.go`），替换 `"result: %d keys"`。

**1.2 gateway 已支持 tool-calling，直接用**
- [openai_compatible.go](file:///e:/code/javascript/project/GeoWork/core/internal/modelgateway/openai_compatible.go) 的 `Chat/StreamChat` 已支持 `tools []ToolDef` 与解析 `tool_calls`（第 40/80/294 行）。只需：
  - 在 registry 增加 `ToolDefs() []ToolDef`，把每个工具的 InputSchema 转成 OpenAI function schema；
  - loop 里把 `ToolDefs()` 传进去。

**1.3 状态机与权限接入 loop**
- 现有 `state_machine.go` 的读/写/执行分级要在**每次 tool_call 前**校验（现在只在 `executeStep` 里校验，逻辑保留即可），越权则拒绝并把拒绝原因回灌给模型让它换路。

**验收**：给一句"读 X 文件，改 Y，跑测试"，模型能自主完成"读→改→跑→看结果→修"的多轮闭环，且每步真实结果进上下文。

### Phase 2：GIS 能力工具化（2 周）🔴
目标：让 LLM agent 能直接调用 Worker 的真实地理空间能力。

**2.1 新增 `geo_tools.go`（`core/internal/toolregistry/`）**
把 `worker.Client` 的端点逐个包装成工具，命名对齐 skill 里已声明的 id：

| 工具 id | 对应 Worker 端点 | 说明 |
|---|---|---|
| `geo.raster.metadata` | `/tools/gdal/inspect-dataset` | 栅格元数据 |
| `geo.raster.clip` | `/tools/gis/clip` | 栅格裁剪 |
| `geo.raster.reproject` | `/tools/gis/reproject` | 重投影 |
| `geo.raster.ndvi` | `/tools/ndvi/analyze` | NDVI 计算 |
| `geo.vector.buffer/clip/dissolve` | `/tools/gis/*` | 矢量处理 |
| `geo.gee.search_dataset` | `/tools/gee/search-dataset` | GEE 数据集搜索 |
| `geo.gee.generate_ndvi_script` | `/tools/gee/*` | GEE 脚本生成 |
| `geo.map.layout_export` | `/tools/map/*` | 制图导出 |
| `geo.office.write_report` | `/tools/office/*` | 报告生成 |
| `geo.papers.openalex_search` | `/tools/papers/openalex-search` | 文献检索 |

- 每个工具：定义清晰 InputSchema（供模型理解参数）、Permission、RiskLevel、超时（GIS 任务需较长，Worker Client 的 20s 超时要按端点上调/可配）。
- 依赖注入：Registry 需要持有 `*worker.Client`（在 `main.go` 组装时传入）。

**2.2 Worker 侧补强**
- 统一错误契约：库缺失/失败时返回**结构化错误**（而非静默占位数据），让 agent 能识别"需要装 gdal"。
- 长任务：大栅格处理走异步任务 + 轮询/事件，避免 HTTP 超时。

**2.3 让 Skill 可执行**
- 实现 Skill 加载器：读 `skills/*/manifest.json`，校验 `required_tools` 是否都已注册；把 Skill 作为"高层工具/提示模板"注入 agent（例如 `run_skill(id, params)` → 展开为一串 geo.* 工具调用的引导 prompt）。

**验收**：对 agent 说"算一下这幅影像 2019–2024 的 NDVI 时序并出报告"，它能依次 `geo.gee.search_dataset → geo.raster.ndvi → geo.map.* → geo.office.write_report` 并产出 docx/png。

### Phase 3：前端接线（2 周）🔴
目标：干掉 mock，前端吃真实 SSE 事件。

**3.1 实现 `sseStreamAdapter`**（`apps/desktop/src/.../stream`）
- 连接 `POST /api/agent/runs` 起 run，再订阅 `GET /api/agent/events/stream`（已存在，见 routes.go 第 28 行）。
- 把后端事件（`plan/step_start/step_done/message/tool_call/state_change/error/done`）映射为前端 `onStatus/onDelta/onToolCall/onWorkflow/onDone`。
- 切换 `activeAdapter = sseStreamAdapter`（保留 mock 作为离线 demo 开关）。

**3.2 事件契约对齐**
- 后端 `emitEvent` 目前事件类型与前端期望字段需对齐（建议定义共享的事件 TS 类型 + Go struct，出一份 `EVENTS.md` 契约）。
- 补 `artifact` 事件：工具产出文件时推送 `{id,name,path,mime}`，前端在"产物区/地图/预览"渲染。

**3.3 地图与产物可视化落地**
- Workspace 页接入 MapLibre GL + deck.gl，渲染 Worker 产出的 GeoJSON/COG/栅格切片；
- 报告/图表用现有 docx/png 产物直接预览。

**验收**：前端发一句自然语言，实时看到"思考→工具调用→产物出现在地图/报告区"，全链路无 mock。

### Phase 4：领域垂直强化（持续）🟠
1. **数据源连接器可用化**：PostGIS（空间 SQL 查询工具）、GEE（认证托管）、影像目录扫描、Zotero/OpenAlex 文献。
2. **12 个领域 Skill 逐个打通**（dem-terrain / land-cover / urban-expansion / water-ndwi / lst-retrieval …），每个都要有"输入→工具链→产物"的端到端样例与回归测试。
3. **领域系统提示词**：把 `modeConfigs`（planner.go 第 25 行）升级为真正的领域人设 + 工具使用规范 + 安全边界，而非一句话。
4. **地理专用记忆**：把项目数据集、坐标系、常用区域等沉淀进 `memory`，并在 loop 里检索注入。

### Phase 5：可靠性与安全（与 P1–P4 并行）🟠
1. **真沙箱**：`run_python`/`run_shell` 用独立进程 + 工作目录限制 + 超时 + 资源限制；条件允许上容器（Docker/gVisor）。至少要做到路径白名单、禁止逃逸工作区。
2. **权限审批闭环**：高危工具（delete/git_push/shell）触发前端审批卡，人点确认再执行（对齐 Trae SOLO 的"关键点人类确认"）。
3. **变更验证门禁**：编辑代码后自动 build/test/lint，失败结果回灌模型触发重规划；门禁不可静默变绿（见 P0）。
4. **checkpoint/回滚**：现有 `checkpoint.go`/`rollback.go`/`journal.go` 接入 loop，支持"一键回到工具调用前"。
5. **可观测**：结构化日志 + run 轨迹落库，便于 `/better-harness` 之类的会话复盘（当前 session 证据稀疏，正是因为轨迹未持久化）。

---

## 六、关键代码改造清单（文件级速查）

| 文件 | 改造动作 | 优先级 |
|---|---|---|
| `core/internal/aiagent/orchestrator.go` | `executePlan`→真 tool-calling `runAgentLoop`；结果回灌；删 5s 超时 | 🔴 P1 |
| `core/internal/aiagent/planner.go` | planner 降级为"初始高层计划"；超时可配；删占位脚本；modeConfigs 升级为领域提示词 | 🔴 P1 |
| `core/internal/toolregistry/registry.go` | 新增 `ToolDefs()` 输出 OpenAI function schema | 🔴 P1 |
| `core/internal/toolregistry/geo_tools.go`（新增） | 包装 `worker.Client` 25+ 端点为 `geo.*` 工具 | 🔴 P2 |
| `core/internal/toolregistry/builtin_tools.go` | 修 run_python/run_shell 返回值；实现或明示 create_artifact/run_git_add | 🟠 P0/P5 |
| `core/cmd/geowork-runtime/main.go` | 给 Registry 注入 `worker.Client`；组装 geo 工具 | 🔴 P2 |
| `apps/desktop/src/.../stream/*` | 实现 `sseStreamAdapter`，切换 activeAdapter | 🔴 P3 |
| `apps/desktop/src/pages/Workspace/*` | 接入 MapLibre/deck.gl 渲染真实产物 | 🟠 P3 |
| `workers/geo-python/app/api/*` | 统一结构化错误；长任务异步化 | 🟠 P2 |
| `scripts/check_all.py` | 缺工具不得计入 passed；退出码分级 | 🟠 P0 |
| Skill 加载器（新增，Go 侧） | 解析 manifest、校验工具、`run_skill` | 🟠 P2 |

---

## 七、里程碑与验收标准

| 里程碑 | 交付物 | 验收标准（可演示） |
|---|---|---|
| M1（P0+P1） | 真 agent loop | "读→改→跑测试→修"多轮自主闭环，结果真实进上下文，CI 不再假绿 |
| M2（P2） | GIS 工具化 | 自然语言驱动完成一条真实遥感分析链，产出 docx/png |
| M3（P3） | 端到端打通 | 前端无 mock，实时看到思考/工具/产物；地图渲染真实图层 |
| M4（P4+P5） | 垂直 + 生产化 | ≥6 个领域 Skill 端到端可用；高危操作有审批；有沙箱与回滚 |

---

## 八、风险与建议

1. **不要在旧的"静态计划执行器"上打补丁**——它的模型是错的（预设步骤 vs 动态决策），补丁只会越补越乱。直接按 P1 重写 loop。
2. **双轨必须收敛**，否则每个新功能都要问"加在哪套里"，长期熵增。建议 `aiagent` 为主，DAG 作为其内部 `run_workflow` 工具。
3. **GIS 长任务与 HTTP 超时**是隐藏地雷（Worker Client 现在 20s），务必在 P2 一并解决（异步任务）。
4. **沙箱是安全底线**：一旦前端打通、agent 能跑任意 python/shell，裸跑等于把用户机器暴露给模型，P5 的沙箱不可延后到最后。
5. **先窄后宽**：优先打通"NDVI 时序"这一条黄金链路（数据→计算→制图→报告）作为样板，再横向复制到其他 11 个 Skill，比同时铺开更快见效。

---

### 附：现状证据索引（便于复核）
- 假循环 / 结果丢弃：[orchestrator.go 第 274–292、372–385 行](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/orchestrator.go)
- 未传工具 schema / 5s 超时：[planner.go 第 111–124 行](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/planner.go)
- 占位 GIS 脚本：[planner.go 第 204–248 行](file:///e:/code/javascript/project/GeoWork/core/internal/aiagent/planner.go)
- 通用工具无 GIS / 裸跑 / 假 exit：[builtin_tools.go](file:///e:/code/javascript/project/GeoWork/core/internal/toolregistry/builtin_tools.go)
- gateway 已支持 tool-calling：[openai_compatible.go 第 40、80、294 行](file:///e:/code/javascript/project/GeoWork/core/internal/modelgateway/openai_compatible.go)
- Worker 真实端点：[worker/client.go](file:///e:/code/javascript/project/GeoWork/core/internal/worker/client.go)
- DAG 引擎（另一轨）：[agent/engine.go](file:///e:/code/javascript/project/GeoWork/core/internal/agent/engine.go)
