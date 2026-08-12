> **⚠️ 本文档已归档（v1.1 快照），仅供历史比对。活文档为 `doc/04-GeoWorkAgent.md`（当前 v1.6）。**

## 一、GeoWork 现有 Agent 架构总览

GeoWork 的 Agent 系统已有多层实现，并非从零开始规划。根据代码现状，存在两条并行的 Agent 链路：

### 1.1 AI Agent 链路（`core/internal/aiagent/`）

这是面向 **LLM 驱动的自主任务执行** 的完整链路：

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
|------|------|
| `orchestrator.go` | 主循环控制器，管理 Run 生命周期、事件发布、状态机驱动 |
| `planner.go` | 将用户意图分解为 Step 计划，支持 LLM 生成与关键词 fallback |
| `executor.go` | 解析模型响应中的工具调用（OpenAI native +  legacy XML），构建消息历史 |
| `memory.go` |  bounded 对话历史（max 20 条）、工具结果摘要（max 5 条）、重要文件追踪 |
| `state_machine.go` | 9 种状态 + 14 种事件，严格定义工具在各状态下的允许范围 |
| `context_builder.go` | 组装 system prompt + tool definitions + repo map + 历史消息 |
| `context_budget.go` | token/字符预算约束（MaxPromptTokens=32k, MaxMessages=20 等） |
| `tool_result_summarizer.go` | 工具输出压缩：error 行优先 + head/tail 截断 + 截断指示器 |
| `recovery.go` | 检查点持久化到 `%TEMP%/geowork/checkpoints/`，支持 load/cleanup |
| `repo_map.go` | 仓库结构轻量快照，排除 node_modules/.git 等，供 LLM 感知项目布局 |
| `routes.go` | HTTP 路由：run 增删查 + SSE 事件流 + 检查点列表 |

**Mode 配置（5 种模式）：**

| Mode | 系统提示 | 可用工具 | MaxSteps |
|------|---------|---------|---------|
| Work | GIS 研究助手 | read_file, write_file, list_files, search_workspace, create_artifact | 20 |
| Code | 代码助手 | + run_shell, run_python | 30 |
| Paper | 论文助手 | read_file, write_file, list_files, search_workspace, create_artifact | 15 |
| Analysis | 空间分析助手 | + run_python | 25 |
| Write | 写作助手 | read_file, write_file, list_files, create_artifact | 15 |

### 1.2 Agent Workflow 链路（`core/internal/agent/`）

这是面向 **工作流编排** 的轻量引擎：

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
|------|------|
| `engine.go` | 拓扑排序执行引擎，管理 Workflow 运行生命周期 |
| `runner.go` | 执行单个节点（start/process/agent/output/condition），调用 Python Worker |
| `planner.go` | Workflow 级别的计划定义 |
| `workflow_store.go` | 工作流的持久化存储 |
| `eino_adapter.go` | Cloudwego Eino 适配器，将 ToolRegistry 暴露给 Eino 框架 |

---

## 二、两条链路的定位与关系

| 维度 | AI Agent 链路 | Workflow 链路 |
|------|--------------|--------------|
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

---

## 三、ToolRegistry 工具治理体系

GeoWork 的工具系统采用 **注册表 + 治理器 + 审计日志** 三层架构：

```
ToolRegistry
  │
  ├─▶ Governor（治理器）── 调用频次控制 + 审批状态追踪
  │     └─▶ GovernorPolicy（策略）── 允许/拒绝/需审批
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
|--------|------|---------|------|------|
| `read_file` | read | low | - | 读取文件内容 |
| `write_file` | write | medium | yes | 写入文件 |
| `list_files` | read | low | - | 列出目录内容 |
| `search_workspace` | read | low | - |  glob 模式搜索 |
| `run_python` | exec | high | yes | 执行 Python 脚本 |
| `run_shell` | exec | critical | yes | 执行 Shell 命令 |
| `create_artifact` | write | medium | - | 创建项目制品 |
| `delete_file` | delete | high | yes | 删除文件 |
| `git_commit` | exec | high | yes | Git 提交 |
| `git_push` | exec | critical | yes | **默认策略阻止** |
| `run_git_add` | exec | high | yes | Git 暂存 |
| `run_git_reset` | exec | critical | yes | **--hard 显式阻止** |
| `scan_folder` | read | medium | - | 递归扫描文件夹 |

---

## 四、前端接入现状

前端通过 IPC 桥接与 Core 通信，相关文件：

| 文件 | 职责 |
|------|------|
| `apps/desktop/electron/ipc/runtimeIpc.ts` | 前端 → Core HTTP 代理 |
| `apps/desktop/src/pages/NewTask/components/streamAdapters.ts` | 流式适配器（mock + real） |
| `core/internal/api/agent_handler.go` | Agent 相关 HTTP handler |
| `core/internal/api/conversation_handler.go` | 对话 CRUD + SSE 端点 |

**当前状态：** Core 侧的 Agent API（orchestrator/routes）已完整实现，前端 NewTask 页已有 stream adapter 框架，但 `.qoder/specs` 指出仍存在"最后一公里"接线工作。

---

## 五、模块规划

基于上述代码现状，GeoWork 的 Agent 系统模块如下：

```
core/
├── aiagent/                          # AI Agent 链路（LLM 驱动）
│   ├── orchestrator.go               # 编排器 —— 主循环 + Run 管理
│   ├── planner.go                    # 计划器 —— LLM/fallback 生成步骤
│   ├── executor.go                   # 执行器 —— 解析工具调用 + 消息构建
│   ├── memory.go                     # 记忆 —— bounded 对话历史 + 工具摘要
│   ├── state_machine.go              # 状态机 —— 9 状态 + 14 事件
│   ├── context_builder.go            # 上下文组装 —— prompt + tools + history
│   ├── context_budget.go             # 预算管理 —— token/消息/文件预算约束
│   ├── tool_result_summarizer.go     # 输出压缩 —— error 优先 + head/tail
│   ├── recovery.go                   # 检查点 —— 持久化 + 恢复
│   ├── repo_map.go                   # 仓库地图 —— 项目结构快照
│   ├── routes.go                     # HTTP 路由 —— run 管理 + SSE
│   └── [其他配套文件]
│
├── agent/                            # Workflow 链路（确定性编排）
│   ├── engine.go                     # 工作流引擎 —— 拓扑排序
│   ├── runner.go                     # 节点执行器 —— Worker 调用 + 重试
│   ├── planner.go                    # 工作流计划定义
│   ├── workflow_store.go             # 工作流持久化
│   └── eino_adapter.go               # Eino 框架适配器
│
├── toolregistry/                     # 工具注册与治理
│   ├── registry.go                   # 注册表 —— 工具 CRUD + Execute
│   ├── builtin_tools.go              # 12 个内置工具
│   ├── tool.go                       # Tool 接口定义
│   ├── governor.go                   # 治理器 —— 调用频次 + 审批
│   ├── audit_log.go                  # 审计日志
│   ├── permissions.go                # 权限检查框架
│   ├── tool_policy.go                # 高风险工具策略
│   ├── journal.go                    # 操作日志
│   ├── checkpoint.go                 # 工具级检查点
│   ├── rollback.go                   # 回滚机制
│   └── [其他配套文件]
│
├── modelgateway/                     # LLM 调用通道
├── idgen/                            # ID 生成器
└── worker/                           # Python Worker 客户端
```

---

## 六、架构演进路线

| 阶段 | 目标 | 关键动作 |
|------|------|---------|
| **当前** | 单体 Agent 底座已就绪 | Core 接线 + 前端集成（见 `.qoder/specs`） |
| **短期** | 前端真实接入 | NewTask stream adapter 切换 real + 降级 mock |
| **中期** | 工具生态扩展 | 新增 GIS 专用工具（坐标转换、空间查询等，迁移自 `workers/geo-python`） |
| **长期** | 多 Agent 协作 | 当独立域 > 5 时，评估将 AI Agent 链路拆分为 Planner/Executor/Memory 独立 Agent |

---

## 七、待决策事项

| # | 事项 | 当前状态 | 建议 |
|---|------|---------|------|
| 1 | 前端真实接入时序 | 已有实施计划（`.qoder/specs`） | 按 Phase 1-6 逐步执行 |
| 2 | GIS 专用工具迁移 | `workers/geo-python` 已有 GIS API | 评估是否需要注册为 ToolRegistry 工具 |
| 3 | Eino 适配器启用 | `eino_adapter.go` 已就绪 | 按 Cloudwego 集成进度启用 |
| 4 | 多 Agent 触发条件 | 当前为单体 Orchestrator | 工具数 > 15 时启动评估 |
