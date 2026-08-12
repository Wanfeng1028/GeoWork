# GeoWork Agent P0 施工方案

> **文档路径**：`doc/GeoWorkAgent-P0-Detailed-Design.md`
> **父文档**：`doc/GeoWorkAgent.md`（主文档/宪法）
> **适用对象**：参与 GeoWork 后端 P0 阶段开发的工程师、AI 编程助手
> **文档定位**：P0 四项任务的施工级设计——接口签名、数据结构、白名单表、循环伪码、验收标准
> **核心原则**：某个任务的设计没写完（接口+数据流+验收三样），不能动那个任务的代码

## 版本表

| 版本 | 日期 | 作者 | 变更摘要 |
|---|---|---|---|
| v0.1 | 2026-08-11 | GLM | 初稿：版本表 + 阅读约定 + 第 1 节任务依赖图 + P0-2 状态机三者对齐完整设计 |
| v0.2 | 2026-08-11 | GLM | 补全 P0-1 接线死代码 + P0-3 per-run 化 + P0-4 ReAct 循环完整设计；P0 四项施工方案全部完成 |
| v0.3 | 2026-08-11 | GLM | 千问审查硬伤 1/2/4/6 修复：idx 写死→tc.Index + workflow→ToolRegistry 动态注册方案 + ModelGateway interface 定义 + ReAct 状态机转换逻辑补全（inferStateFromTool）|

> **阅读约定**：本文档是施工图纸，不是宪法。所有接口签名、结构体定义、白名单表都是**待实现的契约**，代码实现时必须对齐。如发现契约无法实现（如 Go 语法限制、循环依赖），先改本文档再改代码，不得私自偏离。

---

## 1. 任务依赖图与执行顺序

### 1.1 依赖关系

```
P0-2（状态机三者对齐）─────→ P0-1（接线死代码）─────→ P0-4（ReAct 循环）
  状态机白名单对齐              ContextBuilder 接入         模型驱动工具选择
  workflow 走 ToolRegistry      Memory 回注                Executor 启用
  Governor 审批分层             预算执行生效
                                │
                                ├─── P0-3（per-run 化）可与 P0-1 并行
                                │    RunContext 隔离
                                │    SSE per-run 过滤
                                │
                                └───→ P0-4 依赖 P0-3（ReAct 循环需要 per-run 状态）
```

### 1.2 执行顺序

| 顺序 | 任务 | 可否并行 | 前置条件 |
|---|---|---|---|
| 1 | P0-2 状态机三者对齐 | 独立先行 | 无 |
| 2 | P0-1 接线死代码 | — | P0-2 完成（状态机不再误杀工具） |
| 2 | P0-3 per-run 化 | 与 P0-1 并行 | 无（不依赖 P0-1/P0-2） |
| 3 | P0-4 ReAct 循环 | — | P0-1 + P0-3 都完成 |

### 1.3 "设计写完"的判定标准

每个 P0 任务的设计必须包含以下三样，缺一不可动代码：

| 要素 | 说明 |
|---|---|
| **接口签名** | 涉及的结构体定义、方法签名、参数类型 |
| **数据流** | 数据从哪来、经过什么处理、到哪去（伪码或流程图） |
| **验收标准** | 怎么算"做完了"——可执行的检查项 |

---

## 2. P0-2：状态机三者对齐

### 2.1 目标

修复状态机白名单与工具注册表的脱节，使 Planner 生成的工具调用不再被状态机误杀。同时让 workflow 链路接入 ToolRegistry，实现统一工具入口 + 审批分层（D5/D7 决策）。

### 2.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/state_machine.go` | 修改 | 重写 `allowed` 白名单，对齐注册表 |
| `core/internal/toolregistry/builtin_tools.go` | 不改 | 以注册表为真相源，状态机对齐它 |
| `core/internal/aiagent/orchestrator.go` | 修改 | `executeStep` 的状态机检查逻辑调整 |
| `core/internal/agent/runner.go` | 修改 | `callWorker` 改为走 ToolRegistry |
| `core/internal/agent/engine.go` | 修改 | 注入 ToolRegistry 依赖 |

### 2.3 注册表真相源（13 个工具）

以下为 `builtin_tools.go` 中**实际注册**的工具，状态机白名单必须以此为准：

| 工具名 | Permission | RiskLevel | Sandbox | 说明 |
|---|---|---|---|---|
| `read_file` | read | low | no | 读文件 |
| `write_file` | write | medium | yes | 写文件 |
| `list_files` | read | low | no | 列目录 |
| `search_workspace` | read | low | no | 搜索工作区 |
| `run_python` | exec | high | yes | 执行 Python |
| `run_shell` | exec | high | yes | 执行 Shell |
| `create_artifact` | write | medium | no | 创建产物 |
| `delete_file` | delete | high | no | 删除文件 |
| `git_commit` | exec | critical | no | git commit |
| `git_push` | exec | critical | no | git push |
| `run_git_add` | exec | medium | no | git add |
| `run_git_reset` | exec | critical | yes | git reset（--hard 阻止） |
| `scan_folder` | read | medium | no | 递归扫描 |

### 2.4 新状态机白名单（D7 决策落地）

> **设计原则**：
> 1. 每个 phase 允许该 phase 合理需要的工具（粗粒度，不误杀）
> 2. 危险操作（`git_push` / `delete_file` / `run_git_reset`）不放白名单，走 Governor 审批流
> 3. `ShellAllowed` 在 Editing/Verifying 为 true（`run_python` 在这两个阶段合理）
> 4. Planning 阶段不调工具（Planner 是内部组件，不是注册表工具）

| 状态 | Tools 白名单 | ReadAllowed | WriteAllowed | ShellAllowed | 理由 |
|---|---|---|---|---|---|
| `StateIdle` | — | false | false | false | 空闲 |
| `StatePlanning` | — | false | false | false | 规划不调工具，Planner 是内部组件 |
| `StateInspecting` | `read_file`, `list_files`, `search_workspace`, `scan_folder` | true | false | false | 只读探查 |
| `StateEditing` | `read_file`, `write_file`, `list_files`, `create_artifact`, `run_python`, `git_commit`, `run_git_add` | true | true | true | 写+Python+git add/commit |
| `StateVerifying` | `read_file`, `list_files`, `run_python`, `run_shell` | true | false | true | 验证需要运行测试/脚本 |
| `StateWaitingForUser` | — | false | false | false | 等待用户 |
| `StateRecovering` | `read_file`, `list_files` | true | false | false | 恢复时只读 |
| `StateFailed` | — | false | false | false | 失败 |
| `StateCompleted` | — | false | false | false | 完成 |

**不放任何白名单的工具（走 Governor 审批）**：

| 工具 | 原因 |
|---|---|
| `delete_file` | 危险操作，需 user approval |
| `git_push` | 推送到远端，需 user approval |
| `run_git_reset` | critical risk，需 user approval |

### 2.5 需要从白名单删除的不存在工具

| 状态 | 当前白名单中的幽灵工具 | 处理 |
|---|---|---|
| `StatePlanning` | `planner`, `model` | 删除（Planner 是内部组件，不是注册表工具） |
| `StateEditing` | `apply_patch`, `edit_by_anchor`, `edit_by_range` | 删除（注册表中不存在） |
| `StateVerifying` | `test`, `build`, `lint` | 删除（注册表中不存在，未来可新增） |

### 2.6 状态机代码改动

#### 2.6.1 `NewStateMachine()` 白名单重写

```go
// 修改前（state_machine.go 第 77-101 行）
sm.allowed[StatePlanning] = AllowedToolSet{
    Tools:       []string{"planner", "model"},  // ← 幽灵工具
    ReadAllowed: true,
}
sm.allowed[StateEditing] = AllowedToolSet{
    Tools:        []string{"apply_patch", "write_file", "edit_by_anchor", "edit_by_range", "read_file"},  // ← 3 个幽灵
    ReadAllowed:  true,
    WriteAllowed: true,
}
sm.allowed[StateVerifying] = AllowedToolSet{
    Tools:       []string{"test", "build", "lint", "read_file"},  // ← 3 个幽灵
    ReadAllowed: true,
}

// 修改后
sm.allowed[StatePlanning] = AllowedToolSet{
    // Planning 不调工具，Planner 是内部组件
    ReadAllowed:  false,
    WriteAllowed: false,
    ShellAllowed: false,
}
sm.allowed[StateInspecting] = AllowedToolSet{
    Tools:       []string{"read_file", "list_files", "search_workspace", "scan_folder"},
    ReadAllowed: true,
}
sm.allowed[StateEditing] = AllowedToolSet{
    Tools:        []string{"read_file", "write_file", "list_files", "create_artifact", "run_python", "git_commit", "run_git_add"},
    ReadAllowed:  true,
    WriteAllowed: true,
    ShellAllowed: true,  // ← 关键修复：允许 run_python
}
sm.allowed[StateVerifying] = AllowedToolSet{
    Tools:        []string{"read_file", "list_files", "run_python", "run_shell"},
    ReadAllowed:  true,
    ShellAllowed: true,  // ← 关键修复：允许 run_shell
}
```

#### 2.6.2 `ToolIsAllowed()` fallback 修正

当前 fallback 只覆盖 4 类工具，需补全 `create_artifact` / `git_*` / `scan_folder`：

```go
// 修改前（第 199-209 行）只覆盖了 4 类
switch toolName {
case "read_file", "list_files", "search_workspace":
    return tools.ReadAllowed
case "write_file", "apply_patch", "edit_by_anchor", "edit_by_range", "delete_file":
    return tools.WriteAllowed
case "run_shell", "run_python":
    return tools.ShellAllowed
case "network_request", "browser_control":
    return tools.NetworkAllowed
}

// 修改后：fallback 只在 Tools 白名单为空时生效
// 白名单非空时，不在白名单里的工具一律 false（已由上面的 for 循环返回）
// 所以 fallback 只处理白名单为空的状态（Idle/Planning/WaitingForUser/Failed/Completed）
// 这些状态全部返回 false，无需 switch
```

> **注意**：当前 `ToolIsAllowed` 的逻辑是"先查白名单，不在白名单就查 fallback switch"。这个逻辑本身没问题，问题在于白名单引用了不存在的工具 + ShellAllowed 永不为 true。修复白名单后，fallback 的 switch 可以保留但实际不会被命中（因为所有有工具的状态都有非空白名单）。

### 2.7 workflow 接入 ToolRegistry（D5 决策落地）

#### 2.7.1 当前问题

`agent/runner.go` 的 `callWorker()` 直接调 `worker.Client.RunTool()`，绕过 ToolRegistry/Governor/状态机。

#### 2.7.2 改动方案

> **【v0.3 修正 — 千问审查硬伤 2】**：v0.2 直接把 `toolName` 传给 `registry.Execute()`，但 workflow 的 `toolName` 是 Python Worker 的 API 名（如 `research.openalex.search`、`geo.gdal.inspect_dataset`、`geo.gee.generate_ndvi_script`），**不是** ToolRegistry 里注册的 13 个内置工具名（如 `read_file`、`run_python`）。直接传会导致 `registry.Execute` 找不到工具。补充动态注册方案。

**Python Worker 工具名现状**（从 `agent/planner.go` 提取）：

| Python Worker 工具名 | 命名空间 | 说明 |
|---|---|---|
| `task.parse` | task | 任务解析 |
| `research.openalex.search` | research | 论文搜索 |
| `geo.office.write_report` | geo.office | 报告生成 |
| `geo.gdal.inspect_dataset` | geo.gdal | GDAL 数据检查 |
| `geo.gee.generate_ndvi_script` | geo.gee | GEE NDVI 脚本生成 |

这些工具名采用 `category.subcategory.action` 命名空间格式，与 ToolRegistry 的 13 个内置工具（扁平命名如 `read_file`）完全不同。

**方案：动态注册 Python Worker 工具到 ToolRegistry**

系统启动时，从 Python Worker 获取工具列表，动态注册到 ToolRegistry：

```go
// worker/client.go 新增 ListTools 方法
func (c *Client) ListTools(ctx context.Context) ([]WorkerToolDef, error) {
    // 调用 Python Worker 的 /tools API 获取工具列表
    resp, err := c.http.Get(c.baseURL + "/tools")
    // ...
}

type WorkerToolDef struct {
    Name        string         `json:"name"`         // 如 "research.openalex.search"
    Description string         `json:"description"`
    InputSchema map[string]any `json:"input_schema"`
    RiskLevel   string         `json:"risk_level"`   // low/medium/high
}

// 启动时注册到 ToolRegistry
func RegisterWorkerTools(ctx context.Context, registry *toolregistry.Registry, workerClient *worker.Client) error {
    tools, err := workerClient.ListTools(ctx)
    if err != nil {
        return fmt.Errorf("list worker tools: %w", err)
    }
    for _, t := range tools {
        toolName := t.Name  // 如 "research.openalex.search"
        // 闭包捕获 toolName
        registry.Register(toolregistry.NewBuilder(toolName).
            Description(t.Description).
            InputSchema(t.InputSchema).
            Permission("exec").
            RiskLevel(t.RiskLevel).
            Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
                // 转发到 Python Worker
                return workerClient.RunTool(ctx, toolName, args)
            }).
            Build())
    }
    return nil
}
```

**callWorker 改动**：

```go
// Runner 结构体新增 registry 字段
type Runner struct {
    worker   *worker.Client
    registry *toolregistry.Registry  // ← 新增
    log      *zap.Logger
}

// callWorker 改为走 ToolRegistry
func (r *Runner) callWorker(ctx context.Context, node *WorkflowNode) error {
    toolName := firstString(node.Config["tool"], node.Config["toolName"], node.Config["workerTool"])
    if toolName == "" {
        toolName = node.Name
    }
    payload := extractPayload(node.Config)

    // 通过 ToolRegistry 执行（自动获得权限校验 + 审计日志 + 沙箱标记）
    // toolName 是 Python Worker 的工具名（如 "research.openalex.search"），
    // 已在启动时动态注册到 ToolRegistry
    result, err := r.registry.Execute(ctx, toolName, payload)
    // ... 后续处理不变
}
```

**验收标准补充**：
- Python Worker 启动后，ToolRegistry 包含 `research.openalex.search` 等动态注册的工具
- workflow 调用 `callWorker("research.openalex.search", ...)` 时，命中 ToolRegistry 而非直接调 worker.Client

#### 2.7.3 审批分层（D5 决策）

| 链路 | Governor 审批 | 审计日志 | 沙箱 |
|---|---|---|---|
| aiagent（LLM 驱动） | **mandatory**（critical 操作必须 user approval） | mandatory | mandatory |
| workflow（DAG 驱动） | **optional**（用户设计时已授权，只对 critical 操作审批） | mandatory | mandatory |

> **实现方式**：ToolRegistry 的 `Execute` 方法新增 `ExecutionMode` 参数（`ModeAutonomous` / `ModeDeterministic`），Governor 根据 mode 决定是否强制审批。

#### 2.7.4 Engine 注入 ToolRegistry

```go
// engine.go 的 Engine 结构体新增 registry
type Engine struct {
    runs    map[string]*Run
    runner  *Runner
    log     *zap.Logger
    registry *toolregistry.Registry  // ← 新增
}

// NewEngine 新增 registry 参数
func NewEngine(log *zap.Logger, registry *toolregistry.Registry) *Engine {
    return &Engine{
        runs:     make(map[string]*Run),
        runner:   NewRunner(registry, log),  // ← 传给 Runner
        log:      log,
        registry: registry,
    }
}
```

### 2.8 数据流

```
用户输入 → Planner.Plan() 生成 Steps
  → for each Step:
      → Orchestrator.executeStep(step)
          → StateMachine.ToolIsAllowed(currentState, step.Tool)
              → 查白名单（已对齐注册表）→ 允许/拒绝
          → 如果允许:
              → ToolRegistry.Execute(ctx, step.Tool, step.Args)
                  → Governor 检查权限（aiagent 链路强制审批，workflow 链路只审计）
                  → 执行工具
                  → 返回结果
          → 如果拒绝:
              → 标记 step.status = "rejected"
              → 记录原因
```

### 2.9 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 状态机白名单不含任何注册表不存在的工具 | 遍历 `sm.allowed` 的所有 Tools，每个都能在 `builtin_tools.go` 找到 |
| 2 | `run_python` 在 StateEditing 和 StateVerifying 被允许 | 写测试：`sm.ToolIsAllowed(StateEditing, "run_python")` 返回 true |
| 3 | `run_shell` 在 StateVerifying 被允许 | 写测试：`sm.ToolIsAllowed(StateVerifying, "run_shell")` 返回 true |
| 4 | `delete_file` 在所有状态被拒绝（走 Governor） | 写测试：所有状态 `ToolIsAllowed` 返回 false |
| 5 | `git_push` 在所有状态被拒绝（走 Governor） | 同上 |
| 6 | workflow 链路的 `callWorker` 走 ToolRegistry | 写测试：mock Registry.Execute，验证 workflow 调用时命中 |
| 7 | workflow 的 critical 操作仍走审批 | 手动测试：workflow 执行 `delete_file` 时触发审批 |
| 8 | aiagent 链路的 critical 操作走审批 | 手动测试：aiagent 执行 `git_push` 时触发审批 |
| 9 | 状态机 transition 表不变 | 现有的 14 个 transition 全部保留，无新增无删除 |

---

## 3. P0-1：接线死代码

### 3.1 目标

将 6 个死代码模块接入执行路径：ContextBuilder / ContextBudget / RepoMap / Memory.Summary() / ToolResultSummarizer / Executor。使上下文组装、预算控制、记忆回注真正生效，为 P0-4 ReAct 循环打基础。

### 3.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/context_builder.go` | 修改 | `Build()` 返回类型改为 `[]modelgateway.ChatMessage` |
| `core/internal/aiagent/executor.go` | 修改 | 删除 `ChatMessage` 类型定义，统一用 `modelgateway.ChatMessage` |
| `core/internal/aiagent/orchestrator.go` | 修改 | `executePlan` 用 ContextBuilder 替换手写 chatHistory |
| `core/internal/aiagent/memory.go` | 不改 | `Summary()` / `AppendToolResult()` 已存在，只需调用 |
| `core/internal/aiagent/context_budget.go` | 不改 | `Enforce()` 已存在，只需调用 |
| `core/internal/aiagent/tool_result_summarizer.go` | 不改 | `SummarizeToolResult` 已被 `EnforceToolResults` 调用 |
| `core/internal/aiagent/repo_map.go` | 不改 | `FormatAsContext()` 已存在，只需在 ContextBuilder 里启用 |

### 3.3 对话历史管理

#### 3.3.1 ChatMessage 类型统一（关键）

当前有两个 `ChatMessage` 类型定义，不兼容：

| 位置 | 定义 | 问题 |
|---|---|---|
| `aiagent/executor.go:13` | `type ChatMessage struct { Role, Content string }` | aiagent 包内部用 |
| `modelgateway/openai_compatible.go:18` | `type ChatMessage struct { Role, Content string }` | gateway 用 |

**方案**：删除 `aiagent.ChatMessage`，全包统一用 `modelgateway.ChatMessage`。

```go
// executor.go 删除以下定义（第 12-16 行）
// type ChatMessage struct {
//     Role    string `json:"role"`
//     Content string `json:"content"`
// }

// 全包改用 modelgateway.ChatMessage
// 所有 []ChatMessage 改为 []modelgateway.ChatMessage
```

**影响范围**：`context_builder.go` / `executor.go` / `context_budget.go` / `memory.go` 中的所有 `ChatMessage` 引用改为 `modelgateway.ChatMessage`。

#### 3.3.2 对话消息数据结构

```go
// 统一后的对话消息结构（modelgateway 包）
type ChatMessage struct {
    Role    string `json:"role"`    // system / user / assistant / tool
    Content string `json:"content"`
}

// ToolCall 已在 orchestrator.go 定义，保留不变
type ToolCall struct {
    ID       string                 `json:"id"`
    Name     string                 `json:"name"`
    Args     map[string]any         `json:"args"`
    Stdout   string                 `json:"stdout,omitempty"`
    Stderr   string                 `json:"stderr,omitempty"`
    Result   map[string]any         `json:"result,omitempty"`
    Error    string                 `json:"error,omitempty"`
    Duration int64                  `json:"duration,omitempty"`
}
```

#### 3.3.3 多轮对话截断规则

由 `BudgetAwareBuilder.EnforceMessages()` 实现（已存在，`context_budget.go:75`）：
- 保留第一条（system message）
- 保留最后 `MaxMessages-1` 条
- 中间部分丢弃

#### 3.3.4 角色标记管理

| 角色 | 何时产生 | 说明 |
|---|---|---|
| `system` | ContextBuilder.Build() | System Prompt + Memory.Summary() + RepoMap |
| `user` | 用户输入 + LLM 反馈回复 | executePlan 里把 LLM reply 作为 user 消息回注 |
| `assistant` | 模型响应 + 步骤执行结果 | 当前 executePlan 把 step result 作为 assistant 消息 |
| `tool` | 工具执行结果 | Executor.AppendToolResult() 产生 |

### 3.4 ContextBuilder.Build() 接入 executePlan

#### 3.4.1 当前问题

`orchestrator.executePlan()` 第 252-272 行手写 chatHistory 拼接：

```go
// 当前代码（要替换）
var chatHistory []modelgateway.ChatMessage
if o.gateway != nil {
    config, _ := modeConfigs[run.Mode]
    systemContent := config.Prompt + "\nYou are executing a plan..."
    if run.parentMemory != "" {
        systemContent += "\n\nInherited parent conversation context:\n" + run.parentMemory
    }
    chatHistory = append(chatHistory, modelgateway.ChatMessage{
        Role: "system", Content: systemContent,
    })
    chatHistory = append(chatHistory, modelgateway.ChatMessage{
        Role: "user", Content: run.Prompt,
    })
}
```

ContextBuilder.Build() 从未被调用。

#### 3.4.2 改动方案

```go
// 修改后：用 ContextBuilder 替换手写拼接
func (o *Orchestrator) executePlan(ctx context.Context, run *Run) {
    // 1. 用 Memory.Summary() 生成记忆字符串
    memorySummary := o.memory.Summary(2000)  // ← 接线点 1：Memory 生效
    if run.parentMemory != "" {
        memorySummary = run.parentMemory + "\n\n" + memorySummary
    }

    // 2. 用 ContextBuilder 组装上下文（含 system prompt + repo map + tool defs）
    budgetResult := o.contextBld.BuildWithMessages(
        run.Mode, run.Prompt, memorySummary,
        nil,  // existingMessages，首次为空
    )
    chatHistory := budgetResult.Messages
    tools := budgetResult.Tools  // ← 工具定义也由 ContextBuilder 从注册表拉取

    // 3. 执行循环
    for i, step := range run.Plan {
        // ... 执行 step ...
        o.executeStep(ctx, run, &step)

        // 4. 工具结果回注 Memory + chatHistory
        o.memory.AppendToolResult(step.Tool, step.Result, "")  // ← 接线点 2：Memory 记录工具结果

        chatHistory = append(chatHistory, modelgateway.ChatMessage{
            Role:    "assistant",
            Content: fmt.Sprintf("Step %d (%s) tool=%s status=%s", i+1, step.Title, step.Tool, step.Status),
        })

        // 5. 每轮循环前执行预算控制
        budgetResult = o.contextBld.BuildWithMessages(
            run.Mode, run.Prompt, memorySummary,
            chatHistory,  // 传入已有历史
        )
        chatHistory = budgetResult.Messages  // ← 接线点 3：预算裁剪生效
    }
}
```

#### 3.4.3 ContextBuilder.Build() 签名改动

```go
// 修改前（context_builder.go:55）
func (cb *ContextBuilder) Build(mode, prompt, memory string) (messages []ChatMessage, tools []ToolDef)

// 修改后：返回 modelgateway.ChatMessage
func (cb *ContextBuilder) Build(mode, prompt, memory string) (messages []modelgateway.ChatMessage, tools []ToolDef)
```

### 3.5 Token 预算执行机制

#### 3.5.1 预算配置（已存在，不改）

```go
// context_budget.go:22
func DefaultContextBudget() ContextBudget {
    return ContextBudget{
        MaxPromptTokens:      32000,
        ReservedOutputTokens: 4096,
        MaxToolResultChars:   8000,
        MaxMessages:          20,
        MaxFilesPerTurn:      5,
        MaxToolCallsPerTurn:  5,
    }
}
```

#### 3.5.2 执行流程

```
每轮循环：
  chatHistory 增长
  → BuildWithMessages(chatHistory) 调用
    → BudgetAwareBuilder.Enforce(messages, tools)
      → EnforceMessages: 超过 MaxMessages(20) 条 → 保留 system + 最近 19 条
      → EnforceToolResults: tool 消息超 8000 字符 → SummarizeToolResult 裁剪
      → trimForTokens: token 估算超 32000-4096 → 保留 system + user + 最近 3 条
    → 返回 BudgetResult{ Messages, Tools, Truncated, ToolCallsThisTurn }
  → chatHistory = budgetResult.Messages  ← 裁剪后的历史
```

#### 3.5.3 "超了怎么裁"规则

| 触发条件 | 裁剪策略 | 保留 |
|---|---|---|
| 消息数 > 20 | `EnforceMessages` | system + 最近 19 条 |
| tool 消息 > 8000 字符 | `EnforceToolResults` → `SummarizeToolResult` | 错误行优先 + head/tail |
| token 估算 > 27904 | `trimForTokens` | system + first user + 最近 3 条 |

### 3.6 Memory.Summary() 回注点

#### 3.6.1 当前问题

`Memory.Summary()` 已实现（`memory.go:104`），但从未被调用。Memory 只写不读。

#### 3.6.2 接入点

在 `executePlan` 开头，作为 system prompt 的一部分注入：

```go
// executePlan 开头
memorySummary := o.memory.Summary(2000)
// → 传入 ContextBuilder.BuildWithMessages(mode, prompt, memorySummary, ...)
// → ContextBuilder.Build() 把 memory 拼入 system prompt
```

#### 3.6.3 Memory 读写时序

```
executePlan 开始
  → o.memory.Summary(2000)  ← 读：生成记忆摘要注入 context
  → 循环执行 steps
    → 每个 step 执行后
      → o.memory.AppendToolResult(tool, stdout, stderr)  ← 写：记录工具结果
      → o.memory.Append("assistant", stepResult)  ← 写：记录对话历史
  → 循环结束
  → o.memory.SetTaskSummary(run.Prompt)  ← 写：记录任务摘要
```

### 3.7 RepoMap 接入

#### 3.7.1 当前问题

`ContextBuilder.WithRepoMap()` 已存在（`context_builder.go:43`），但 Orchestrator 从未调用它。

#### 3.7.2 接入点

```go
// NewOrchestrator 里（orchestrator.go:148 附近）
o.contextBld = NewContextBuilder(log, registry)
o.contextBld.WithBudget(o.budget)
// 新增：如果有工作区路径，启用 RepoMap
if workspacePath != "" {
    repoMap := NewRepoMap(workspacePath)
    o.contextBld.WithRepoMap(repoMap)
}
```

> **注意**：`NewOrchestrator` 当前不接收 workspacePath，需要新增参数或通过 setter 注入。

### 3.8 数据流

```
用户输入
  → Memory.Summary(2000) 生成记忆摘要
  → ContextBuilder.BuildWithMessages(mode, prompt, memorySummary, history)
    → Build(mode, prompt, memory)
      → Planner.BuildSystemPrompt(mode, memory)  生成 system prompt
      → RepoMap.FormatAsContext(50)  生成项目结构（如果启用）
      → registry.List() 拉取工具定义
    → BudgetAwareBuilder.Enforce(messages, tools)  预算裁剪
    → 返回 BudgetResult{Messages, Tools}
  → gateway.Chat(ctx, messages, tools, stream)  模型调用
  → Executor.ParseModelResponse(content)  解析 tool_calls
  → 执行工具
  → Memory.AppendToolResult(tool, stdout, stderr)  记录结果
  → Memory.Append("assistant", result)  记录对话
  → 下一轮循环
```

### 3.9 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | `aiagent.ChatMessage` 类型定义已删除 | `grep -r "type ChatMessage" core/internal/aiagent/` 只在 modelgateway 包找到 |
| 2 | ContextBuilder.Build() 返回 `[]modelgateway.ChatMessage` | 编译通过 + 签名检查 |
| 3 | executePlan 不再手写 chatHistory 拼接 | 代码审查：第 252-272 行的手写拼接被 ContextBuilder 调用替换 |
| 4 | Memory.Summary() 在 executePlan 开头被调用 | 日志或断点验证 |
| 5 | Memory.AppendToolResult() 在每个 step 后被调用 | 执行一个 step 后检查 `memory.lastToolResults` 非空 |
| 6 | BudgetAwareBuilder.Enforce() 在每轮循环前被调用 | 日志验证 `budgetResult.Truncated` 在长对话时为 true |
| 7 | ToolResultSummarizer 被间接调用（通过 EnforceToolResults） | 构造超 8000 字符的 tool result，验证被裁剪 |
| 8 | RepoMap 在有工作区路径时启用 | ContextBuilder.Build() 返回的 messages 包含 repo map system 消息 |
| 9 | Executor.BuildMessages() 可用（P0-4 前置） | 调用返回正确的 `[]modelgateway.ChatMessage` |

---

## 4. P0-3：per-run 化

### 4.1 目标

将 Orchestrator 的单例状态字段（`currentState` / `currentRunID` / `memory` / `eventCh`）改为 per-run 隔离，使多个 Run 可以并发执行互不干扰。同时给 SSE 事件加 `RunID` 字段，支持前端按 run 过滤（D6 决策：方案 A `map[runID]*RunContext`）。

### 4.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/orchestrator.go` | 修改 | 新增 `RunContext` 结构体；`currentState`/`memory`/`eventCh` 迁入 RunContext |
| `core/internal/aiagent/routes.go` | 修改 | SSE handler 新增 `run_id` 查询参数过滤 |
| `core/internal/aiagent/orchestrator.go` | 修改 | `Event` 结构体新增 `RunID` 字段 |
| `core/internal/aiagent/executor.go` | 不改 | 无 per-run 状态 |

### 4.3 RunContext 结构体定义

```go
// RunContext 封装单个 Run 的可变状态，实现 per-run 隔离
type RunContext struct {
    Run         *Run
    State       State           // ← 从 Orchestrator.currentState 迁入
    Memory      *Memory         // ← 从 Orchestrator.memory 迁入（改为 per-run）
    EventCh     chan Event      // ← 从 Orchestrator.eventCh 迁入（改为 per-run）
    Cancel      context.CancelFunc  // 用于停止该 Run
}

// Orchestrator 结构体改动
type Orchestrator struct {
    registry      *toolregistry.Registry
    gateway       *modelgateway.OpenAICompatibleClient
    providerID    string
    provider      *modelgateway.ModelProvider
    planner       *Planner
    contextBld    *ContextBuilder
    recovery      *Recovery
    stateMachine  *StateMachine
    eventSink     EventSink
    log           *zap.Logger
    budget        ContextBudget
    maxTurns      int

    mu            sync.Mutex
    runs          map[string]*Run           // 已有
    running       map[string]bool           // 已有
    runContexts   map[string]*RunContext    // ← 新增：per-run 状态隔离
    // 删除：currentState / currentRunID / memory / eventCh
}
```

### 4.4 map 并发保护

```go
// 获取或创建 RunContext（线程安全）
func (o *Orchestrator) getRunContext(runID string) *RunContext {
    o.mu.Lock()
    defer o.mu.Unlock()
    return o.runContexts[runID]
}

// 创建 RunContext
func (o *Orchestrator) createRunContext(run *Run, ctx context.Context) (context.Context, *RunContext) {
    runCtx, cancel := context.WithCancel(ctx)
    rc := &RunContext{
        Run:     run,
        State:   StatePlanning,
        Memory:  NewMemory(),              // ← per-run Memory
        EventCh: make(chan Event, 128),    // ← per-run EventCh
        Cancel:  cancel,
    }
    o.mu.Lock()
    o.runContexts[run.ID] = rc
    o.mu.Unlock()
    return runCtx, rc
}

// 清理 RunContext（Run 结束时调用）
func (o *Orchestrator) removeRunContext(runID string) {
    o.mu.Lock()
    defer o.mu.Unlock()
    if rc, ok := o.runContexts[runID]; ok {
        close(rc.EventCh)
        delete(o.runContexts, runID)
    }
}
```

### 4.5 Orchestrator 方法改动

#### 4.5.1 StartRunWithMemory

```go
func (o *Orchestrator) StartRunWithMemory(ctx context.Context, mode, prompt, parentMemory string) (*Run, error) {
    run := &Run{
        ID:           idgen.NewPrefixed("run_"),
        Mode:         mode,
        Prompt:       prompt,
        Status:       StatusPending,
        CreatedAt:    time.Now(),
        UpdatedAt:    time.Now(),
        parentMemory: parentMemory,
        done:         make(chan struct{}),
    }

    o.mu.Lock()
    o.runs[run.ID] = run
    o.running[run.ID] = true
    o.mu.Unlock()

    // 创建 per-run context
    runCtx, rc := o.createRunContext(run, ctx)

    // 状态机 transition: idle -> planning
    if _, _, err := o.stateMachine.Next(StateIdle, MachineEventStart); err != nil {
        o.log.Error("state machine transition failed", zap.Error(err))
    } else {
        rc.State = StatePlanning  // ← 写入 RunContext，不再是 o.currentState
    }

    run.Status = StatusRunning
    o.emitEvent(rc, Event{
        Type:      "plan",
        Timestamp: time.Now(),
        RunID:     run.ID,  // ← 新增 RunID
        Data:      map[string]any{"runId": run.ID, "prompt": prompt, "mode": mode, "state": string(rc.State)},
    })

    plan, err := o.planner.Plan(mode, prompt)
    if err != nil {
        run.Status = StatusFailed
        o.removeRunContext(run.ID)
        close(run.done)
        return run, err
    }

    run.Plan = plan
    run.UpdatedAt = time.Now()

    go o.executePlan(runCtx, run, rc)  // ← 传入 rc

    return run, nil
}
```

#### 4.5.2 executePlan / executeStep 签名改动

```go
// 所有内部方法新增 *RunContext 参数
func (o *Orchestrator) executePlan(ctx context.Context, run *Run, rc *RunContext)
func (o *Orchestrator) executeStep(ctx context.Context, run *Run, step *Step, rc *RunContext)
func (o *Orchestrator) transitionState(event MachineEvent, reason string, rc *RunContext)
func (o *Orchestrator) emitEvent(rc *RunContext, event Event)
```

### 4.6 Event 结构体改动

```go
// 修改前（orchestrator.go:87）
type Event struct {
    Type      string                 `json:"type"`
    Timestamp time.Time              `json:"timestamp"`
    Data      map[string]any         `json:"data,omitempty"`
}

// 修改后：新增 RunID 字段
type Event struct {
    Type      string                 `json:"type"`
    Timestamp time.Time              `json:"timestamp"`
    RunID     string                 `json:"runId"`           // ← 新增
    Data      map[string]any         `json:"data,omitempty"`
}
```

### 4.7 SSE per-run 过滤

#### 4.7.1 当前问题

`routes.go:77` 的 `handleStreamEvents` 从全局 `o.eventCh` 读事件，无法按 run 过滤。

#### 4.7.2 改动方案

```go
// 修改后：支持 run_id 查询参数过滤
func (r *Routes) handleStreamEvents(w http.ResponseWriter, req *http.Request) {
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    runID := req.URL.Query().Get("run_id")  // ← 新增：可选过滤参数

    // 获取事件通道（全局或 per-run）
    var ch <-chan Event
    if runID != "" {
        // 按 run 过滤：只订阅该 run 的事件
        ch = r.orchestrator.StreamEventsForRun(runID)
    } else {
        // 全局订阅：所有事件
        ch = r.orchestrator.StreamEvents()
    }

    ticker := time.NewTicker(15 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-req.Context().Done():
            return
        case e, ok := <-ch:
            if !ok {
                return
            }
            data, _ := json.Marshal(e)
            w.Write([]byte("data: "))
            w.Write(data)
            w.Write([]byte("\n\n"))
            w.(http.Flusher).Flush()
        case <-ticker.C:
            w.Write([]byte(": ping\n\n"))
            w.(http.Flusher).Flush()
        }
    }
}
```

#### 4.7.3 StreamEventsForRun 实现

```go
// 新增：按 run 订阅事件
func (o *Orchestrator) StreamEventsForRun(runID string) <-chan Event {
    o.mu.Lock()
    defer o.mu.Unlock()

    if rc, ok := o.runContexts[runID]; ok {
        return rc.EventCh  // 直接返回该 run 的 per-run 通道
    }
    // run 不存在或已结束，返回空通道
    ch := make(chan Event)
    close(ch)
    return ch
}

// 全局订阅保留（合并所有 run 的事件）
func (o *Orchestrator) StreamEvents() <-chan Event {
    o.mu.Lock()
    defer o.mu.Unlock()

    merged := make(chan Event, 256)
    go func() {
        defer close(merged)
        // 为每个活跃 run 启动一个转发 goroutine
        var wg sync.WaitGroup
        for _, rc := range o.runContexts {
            wg.Add(1)
            go func(ch <-chan Event) {
                defer wg.Done()
                for e := range ch {
                    select {
                    case merged <- e:
                    default:
                    }
                }
            }(rc.EventCh)
        }
        wg.Wait()
    }()
    return merged
}
```

### 4.8 SSE 事件 Schema

#### 4.8.1 事件类型枚举

| Type | 何时发送 | Data 字段 |
|---|---|---|
| `plan` | Run 开始、计划生成后 | `runId`, `prompt`, `mode`, `state` |
| `step_start` | 步骤开始执行 | `stepId`, `title`, `tool`, `state` |
| `step_done` | 步骤执行完成 | `stepId`, `status`, `result`, `duration` |
| `message` | LLM 响应文本 | `content`, `role` |
| `tool_call` | 工具调用 | `toolName`, `args` |
| `tool_result` | 工具返回 | `toolName`, `stdout`, `stderr`, `result` |
| `error` | 错误发生 | `error`, `stepId`（如适用） |
| `checkpoint` | Checkpoint 保存 | `runId`, `checkpointId` |
| `done` | Run 结束 | `runId`, `state`, `stepCount` |
| `state_change` | 状态机转换 | `from`, `to`, `reason` |

#### 4.8.2 SSE 行格式

```
data: {"type":"plan","timestamp":"2026-08-11T12:00:00Z","runId":"run_abc123","data":{"runId":"run_abc123","prompt":"分析这个 shapefile","mode":"Analysis","state":"planning"}}

data: {"type":"step_start","timestamp":"2026-08-11T12:00:01Z","runId":"run_abc123","data":{"stepId":"step_1","title":"读取文件","tool":"read_file","state":"inspecting"}}

data: {"type":"done","timestamp":"2026-08-11T12:00:05Z","runId":"run_abc123","data":{"runId":"run_abc123","state":"completed","stepCount":3}}
```

### 4.9 数据流

```
用户 POST /api/agent/runs
  → Orchestrator.StartRun()
    → 创建 Run + RunContext（per-run State/Memory/EventCh）
    → go executePlan(ctx, run, rc)
      → 每个事件 emitEvent(rc, event)  ← 事件带 RunID
        → rc.EventCh <- event  ← 写入 per-run 通道
        → eventSink.Publish(event.Type, runID, event.Data)  ← 转发给 SSE

前端 GET /api/agent/events/stream?run_id=run_abc123
  → StreamEventsForRun("run_abc123")
    → 返回 rc.EventCh
  → 前端只收到该 run 的事件
```

### 4.10 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | Orchestrator 不再有 `currentState` / `currentRunID` 单例字段 | `grep -r "currentState\|currentRunID" core/internal/aiagent/orchestrator.go` 无结果 |
| 2 | `RunContext` 结构体包含 State/Memory/EventCh/Cancel | 代码检查 |
| 3 | `Event` 结构体包含 `RunID` 字段 | `grep "RunID" core/internal/aiagent/orchestrator.go` 有结果 |
| 4 | 两个 Run 并发执行互不干扰 | 启动两个 Run，验证各自 State 独立变化 |
| 5 | SSE 支持 `?run_id=` 过滤 | `curl 'http://localhost:8080/api/agent/events/stream?run_id=run_xxx'` 只收到该 run 事件 |
| 6 | SSE 全局订阅仍可用（不带 run_id） | `curl 'http://localhost:8080/api/agent/events/stream'` 收到所有 run 事件 |
| 7 | Run 结束后 RunContext 被清理 | Run 完成后 `o.runContexts[runID]` 为 nil |
| 8 | StopRun 能取消指定 Run | 调用 StopRun(id) 后该 Run 的 executePlan 退出 |
| 9 | per-run Memory 隔离 | 两个 Run 的 Memory 互不污染 |

---

## 5. P0-4：ReAct 循环

### 5.1 目标

将当前"一次性规划+线性执行"改为真正的 ReAct 循环：模型返回 tool_calls → Executor 解析 → 执行工具 → 结果回注 → 下一轮模型调用。启用现有 `Executor.ParseModelResponse()`，让模型驱动工具选择（D8 决策）。

### 5.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/orchestrator.go` | 修改 | `executePlan` 改为 ReAct 循环 |
| `core/internal/aiagent/executor.go` | 不改 | `ParseModelResponse()` / `AppendToolResult()` 已存在 |
| `core/internal/aiagent/planner.go` | 修改 | `BuildSystemPrompt` 完善 5 Mode 模板 |
| `core/internal/modelgateway/openai_compatible.go` | 不改 | `StreamChat()` / `Chat()` 已存在 |
| `core/internal/modelgateway/gateway.go` | **新建** | ModelGateway interface 定义（v0.3 新增） |

### 5.2.1 ModelGateway 接口定义（v0.3 新增 — 千问审查硬伤 4）

> **【v0.3 修正 — 千问审查硬伤 4】**：v0.2 大量引用 `o.gateway.StreamChat()` 和 `o.gateway.Chat()`，但 Orchestrator 依赖的是具体类型 `*modelgateway.OpenAICompatibleClient`，不是接口。P2-5 要引入 Router 替换直接 gateway 调用时无法无缝替换。v0.3 新增 ModelGateway interface，Orchestrator 依赖接口而非具体实现。

```go
// core/internal/modelgateway/gateway.go（新建）

package modelgateway

// ModelGateway 是模型网关的抽象接口。
// Orchestrator 依赖此接口而非具体实现（OpenAICompatibleClient），
// 以便 P2-5 的 Router 可以无缝替换为多 provider 路由。
type ModelGateway interface {
    // Chat 发起非流式对话，返回完整响应
    Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error)

    // StreamChat 发起流式对话，返回 chunk 通道
    StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error)

    // ProviderID 返回当前 provider 的标识（用于审计/路由日志）
    ProviderID() string
}

// 确保 OpenAICompatibleClient 实现 ModelGateway 接口
// （编译期检查：如果接口不匹配会报错）
var _ ModelGateway = (*OpenAICompatibleClient)(nil)
```

**Orchestrator 改动**：

```go
// orchestrator.go 的 Orchestrator 结构体
type Orchestrator struct {
    // ... 已有字段 ...
    gateway ModelGateway  // ← 改为接口类型（原来是 *modelgateway.OpenAICompatibleClient）
    // ...
}

// NewOrchestrator 的参数也改为接口
func NewOrchestrator(
    registry *toolregistry.Registry,
    gateway ModelGateway,  // ← 接口类型
    provider *modelgateway.ModelProvider,
    log *zap.Logger,
) *Orchestrator {
    // ...
}
```

**P2-5 Router 的接入点**：P2-5 的 Router 只需实现 ModelGateway 接口，即可替换 OpenAICompatibleClient：

```go
// P2-5 的 Router 实现 ModelGateway 接口
type Router struct {
    providers map[string]ModelGateway  // providerID → gateway
    rules     []RoutingRule
}

func (r *Router) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDef, stream bool) (*ChatCompletionResponse, error) {
    gw := r.selectProvider(messages)
    return gw.Chat(ctx, messages, tools, stream)
}

func (r *Router) StreamChat(ctx context.Context, messages []ChatMessage, tools []ToolDef) (<-chan StreamChunk, error) {
    gw := r.selectProvider(messages)
    return gw.StreamChat(ctx, messages, tools)
}

func (r *Router) ProviderID() string {
    return "router"  // 或当前选中的 provider ID
}
```

### 5.3 API 请求构建

#### 5.3.1 请求体格式（OpenAI Chat Completion 兼容）

```go
// modelgateway.ChatCompletionRequest（已存在，不改）
type ChatCompletionRequest struct {
    Model       string          `json:"model"`
    Messages    []ChatMessage   `json:"messages"`
    Tools       []ToolDef       `json:"tools,omitempty"`
    Stream      bool            `json:"stream"`
    Seed        *int            `json:"seed,omitempty"`
    Temperature *float64        `json:"temperature,omitempty"`
    MaxTokens   int             `json:"max_tokens,omitempty"`
}
```

#### 5.3.2 messages 数组构建规则

```go
messages := []modelgateway.ChatMessage{
    {Role: "system", Content: systemPrompt},     // 第 1 条：system prompt（稳定，命中缓存）
    {Role: "system", Content: repoMapContext},   // 第 2 条：项目结构（如启用 RepoMap）
    {Role: "user",   Content: userPrompt},       // 第 3 条：用户输入
}
// 追加对话历史（由 BudgetAwareBuilder 裁剪）
messages = append(messages, historyMessages...)
// 追加工具执行结果（role=tool）
messages = append(messages, toolResultMessages...)
```

#### 5.3.3 tools 数组构建规则

```go
// 从 ToolRegistry 拉取，顺序固定（命中缓存）
tools := []modelgateway.ToolDef{}
for _, t := range registry.List() {  // ← List() 返回顺序必须稳定
    tools = append(tools, modelgateway.ToolDef{
        Type: "function",
        Function: modelgateway.ToolFunction{
            Name:        t.Name(),
            Description: t.Description(),
            Parameters:  t.InputSchema(),
        },
    })
}
```

#### 5.3.4 请求参数配置

| 参数 | 值 | 理由 |
|---|---|---|
| `temperature` | `0.7` | 允许一定创造性，不过于确定 |
| `max_tokens` | `4096` | 与 `ReservedOutputTokens` 一致 |
| `stream` | `true` | 启用流式输出 |
| `seed` | 不设 | 避免部分 provider 不支持 |

### 5.4 System Prompt 模板（5 Mode）

#### 5.4.1 模板结构

```
[角色定义]
你是 GeoWork 的 {mode_role}。

[能力边界]
你可以调用以下工具：{tool_list}
你不能：访问互联网、执行未注册的工具、绕过沙箱限制。

[行为规范]
1. 先思考再行动，每轮只调用必要的工具。
2. 工具结果返回后，判断是否需要继续调用工具。
3. 任务完成时，用自然语言总结结果，不再调用工具。
4. 遇到错误时，尝试调整参数重试，最多 3 次后报告失败。

[记忆上下文]
{memory_summary}

[项目结构]
{repo_map}
```

#### 5.4.2 5 Mode 角色定义

| Mode | 角色定义 | 允许工具 | MaxSteps |
|---|---|---|---|
| `Work` | GIS 研究助手，分析地理空间数据并生成报告 | `read_file`, `write_file`, `list_files`, `search_workspace`, `create_artifact` | 20 |
| `Code` | 代码助手，编写/调试/管理代码 | `read_file`, `write_file`, `run_shell`, `run_python`, `search_workspace`, `create_artifact` | 30 |
| `Paper` | 论文助手，搜索/阅读/撰写学术论文 | `read_file`, `write_file`, `list_files`, `search_workspace`, `create_artifact` | 15 |
| `Analysis` | 空间分析助手，分析地理空间数据并生成洞察 | `read_file`, `run_python`, `list_files`, `search_workspace`, `create_artifact` | 25 |
| `Write` | 写作助手，撰写文档/报告/演示文稿 | `read_file`, `write_file`, `list_files`, `create_artifact` | 15 |

#### 5.4.3 BuildSystemPrompt 实现

```go
// planner.go 新增/修改
func (p *Planner) BuildSystemPrompt(mode, memory string) string {
    config, ok := modeConfigs[mode]
    if !ok {
        config = modeConfigs["Work"]
    }

    prompt := fmt.Sprintf(`你是 GeoWork 的 %s

[能力边界]
你可以调用以下工具：%s
你不能：访问互联网、执行未注册的工具、绕过沙箱限制。

[行为规范]
1. 先思考再行动，每轮只调用必要的工具。
2. 工具结果返回后，判断是否需要继续调用工具。
3. 任务完成时，用自然语言总结结果，不再调用工具。
4. 遇到错误时，尝试调整参数重试，最多 3 次后报告失败。`,
        config.Prompt,
        strings.Join(config.Tools, ", "),
    )

    if memory != "" {
        prompt += "\n\n[记忆上下文]\n" + memory
    }

    return prompt
}
```

### 5.5 流式响应解析

#### 5.5.1 当前 StreamChunk 结构（已存在）

```go
// modelgateway/openai_compatible.go:91
type StreamChunk struct {
    Content   string
    ToolCalls []ToolCall
    IsDone    bool
    Usage     *UsageInfo
}

// ToolCall（流式 delta）—— v0.3 修正：新增 Index 字段
// OpenAI 流式格式中，每个 tool_call delta 带 index 字段表示它属于第几个 tool_call
// 当模型一次返回多个 tool_calls 时（如同时调 read_file 和 list_files），
// 必须按 index 分别拼接，否则所有 delta 会混到同一个 tool_call 上
type ToolCall struct {
    Index    int          // ← 新增：delta 的 index（OpenAI 流式协议字段）
    ID       string
    Type     string
    Function ToolFunctionCall
}
```

> **【v0.3 修正 — 千问审查硬伤 1】**：v0.2 的 `idx := 0` 写死了 index，导致多 tool_call 时参数拼错。OpenAI 流式 delta 中每个 tool_call 带 `index` 字段，必须用 `tc.Index` 而非硬编码 0。

#### 5.5.2 chunk 拼接规则

流式响应中，`tool_calls` 是**增量拼接**的（delta 模式）：

```go
// ReAct 循环中的流式处理
func (o *Orchestrator) streamModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef, rc *RunContext) (string, []ToolCall, error) {
    ch, err := o.gateway.StreamChat(ctx, messages, tools)
    if err != nil {
        return "", nil, err
    }

    var contentBuilder strings.Builder
    var toolCalls []modelgateway.ToolCall
    toolCallMap := map[int]*modelgateway.ToolCall{}  // 按 index 增量拼接

    for chunk := range ch {
        if chunk.IsDone {
            break
        }

        // 1. 文本内容增量
        if chunk.Content != "" {
            contentBuilder.WriteString(chunk.Content)
            // 实时发送给前端
            o.emitEvent(rc, Event{
                Type:      "message",
                Timestamp: time.Now(),
                RunID:     rc.Run.ID,
                Data:      map[string]any{"content": chunk.Content, "role": "assistant"},
            })
        }

        // 2. tool_calls 增量拼接
        for _, tc := range chunk.ToolCalls {
            idx := tc.Index  // ← v0.3 修正：用 delta 的 index，不再写死 0
            if existing, ok := toolCallMap[idx]; ok {
                // 增量拼接 arguments
                existing.Function.Arguments += tc.Function.Arguments
            } else {
                // 新 tool_call
                toolCallMap[idx] = &modelgateway.ToolCall{
                    ID:   tc.ID,
                    Type: tc.Type,
                    Function: modelgateway.ToolFunctionCall{
                        Name:      tc.Function.Name,
                        Arguments: tc.Function.Arguments,
                    },
                }
            }
        }
    }

    // 收集所有 tool_calls
    for i := 0; i < len(toolCallMap); i++ {
        if tc, ok := toolCallMap[i]; ok {
            toolCalls = append(toolCalls, *tc)
        }
    }

    return contentBuilder.String(), toolCalls, nil
}
```

#### 5.5.3 解析 tool_calls

```go
// 使用 Executor.ParseModelResponse 解析（已存在，executor.go:96）
// 但流式模式下我们已经直接拿到 ToolCall 结构，不需要再解析
// ParseModelResponse 主要用于非流式 fallback
executor := NewExecutor()
toolCalls, plainContent := executor.ParseModelResponse(responseContent)
```

### 5.6 ReAct 循环伪码

```go
func (o *Orchestrator) executePlan(ctx context.Context, run *Run, rc *RunContext) {
    defer func() {
        rc.State = StateCompleted
        o.emitEvent(rc, Event{Type: "done", ...})
        o.removeRunContext(run.ID)
        close(run.done)
    }()

    // 1. 初始化上下文
    memorySummary := rc.Memory.Summary(2000)
    if run.parentMemory != "" {
        memorySummary = run.parentMemory + "\n\n" + memorySummary
    }

    // 2. ReAct 循环
    turnCount := 0
    var chatHistory []modelgateway.ChatMessage

    for {
        // 2.1 检查停止条件
        if turnCount >= o.maxTurns {
            o.log.Warn("max turns reached", zap.Int("turns", turnCount))
            break
        }
        if ctx.Err() != nil {
            o.log.Info("context cancelled", zap.Error(ctx.Err()))
            break
        }

        // 2.2 组装上下文（ContextBuilder + 预算裁剪）
        budgetResult := o.contextBld.BuildWithMessages(
            run.Mode, run.Prompt, memorySummary, chatHistory,
        )
        messages := budgetResult.Messages
        tools := budgetResult.Tools

        // 2.3 状态机 transition: -> planning（每轮重新决策）
        o.transitionState(MachineEventPlanReady, "react turn", rc)

        // 2.4 调用模型（流式）
        content, toolCalls, err := o.streamModelCall(ctx, messages, tools, rc)
        if err != nil {
            o.log.Error("model call failed", zap.Error(err))
            rc.State = StateFailed
            o.emitEvent(rc, Event{Type: "error", Data: map[string]any{"error": err.Error()}})
            break
        }

        // 2.5 记录 assistant 响应
        chatHistory = append(chatHistory, modelgateway.ChatMessage{
            Role: "assistant", Content: content,
        })
        rc.Memory.Append("assistant", content)

        // 2.6 判断是否结束
        if len(toolCalls) == 0 {
            // 模型没有调用工具 → 任务完成
            o.log.Info("task completed, no more tool calls")
            break
        }

        // 2.7 执行工具调用
        for _, tc := range toolCalls {
            // 2.7.0 根据工具类型推断状态转换（v0.3 新增 — 千问审查硬伤 6）
            //
            // 【v0.3 修正 — 千问审查硬伤 6】
            // v0.2 的 ReAct 循环只有 PlanReady 和 InspectDone 两个 transition，
            // 缺少根据工具类型推断状态转换的逻辑。
            // 9 个状态之间的转换规则（§10.3）：planning → inspecting → editing → verifying
            // ReAct 循环中由 Harness 根据工具类型推断（不是模型决定）：
            //   - read_only 工具（read_file/list_files/search_workspace/scan_folder/screenshot）→ Inspecting
            //   - write 类工具（write_file/run_python/run_shell/delete_file/git_*）→ Editing
            //   - 验证类工具（无内置验证工具，由模型在 prompt 中声明完成验证时）→ Verifying
            targetState := o.inferStateFromTool(tc.Function.Name)
            if targetState != rc.State && targetState != StateIdle {
                o.transitionTo(targetState, fmt.Sprintf("tool %s requires %s", tc.Function.Name, targetState), rc)
            }

            // 2.7.1 状态机检查
            if !o.stateMachine.ToolIsAllowed(rc.State, tc.Function.Name) {
                o.emitEvent(rc, Event{Type: "error", Data: map[string]any{
                    "error": fmt.Sprintf("tool %q not allowed in state %s", tc.Function.Name, rc.State),
                }})
                // 记录拒绝结果，让模型知道
                chatHistory = append(chatHistory, modelgateway.ChatMessage{
                    Role: "tool", Content: fmt.Sprintf("Error: tool %q not allowed", tc.Function.Name),
                })
                continue
            }

            // 2.7.2 解析参数
            var args map[string]any
            json.Unmarshal([]byte(tc.Function.Arguments), &args)

            // 2.7.3 执行工具
            o.transitionState(MachineEventInspectDone, "executing tool", rc)
            result, err := o.registry.Execute(ctx, tc.Function.Name, args)

            // 2.7.4 记录工具结果
            toolContent := ""
            if err != nil {
                toolContent = fmt.Sprintf("Error: %s", err.Error())
            } else {
                resultJSON, _ := json.Marshal(result)
                toolContent = string(resultJSON)
            }

            chatHistory = append(chatHistory, modelgateway.ChatMessage{
                Role: "tool", Content: toolContent,
            })

            // 2.7.5 记录到 Memory
            rc.Memory.AppendToolResult(tc.Function.Name, toolContent, "")

            // 2.7.6 发送事件
            o.emitEvent(rc, Event{
                Type: "tool_result",
                RunID: rc.Run.ID,
                Data: map[string]any{
                    "toolName": tc.Function.Name,
                    "result":   result,
                    "error":    err,
                },
            })
        }

        turnCount++
    }

    // 3. 记录任务摘要
    rc.Memory.SetTaskSummary(run.Prompt)
}
```

#### 5.6.1 inferStateFromTool 工具→状态推断（v0.3 新增 — 千问审查硬伤 6）

```go
// inferStateFromTool 根据工具名推断应该处于哪个状态
// ReAct 循环中由 Harness 根据工具类型推断状态转换（不是模型决定）
func (o *Orchestrator) inferStateFromTool(toolName string) State {
    switch toolName {
    // read_only 工具 → Inspecting（检查/读取阶段）
    case "read_file", "list_files", "search_workspace", "scan_folder",
         "screenshot", "paper_search":
        return StateInspecting

    // write 类工具 → Editing（编辑/执行阶段）
    case "write_file", "run_python", "run_shell", "delete_file",
         "git_commit", "git_push", "run_git_add", "run_git_reset",
         "create_artifact",
         "browser_control", "network_request":  // P2-7 的浏览器操控也算编辑
        return StateEditing

    // 无内置验证工具
    // 当模型在 prompt 中声明"任务完成，进行验证"时，
    // 由 transitionTo(StateVerifying) 手动触发
    default:
        // 动态注册的 Python Worker 工具（如 research.openalex.search）
        // 默认归为 Inspecting（读取/分析类）
        if strings.Contains(toolName, "search") || strings.Contains(toolName, "inspect") {
            return StateInspecting
        }
        if strings.Contains(toolName, "write") || strings.Contains(toolName, "generate") {
            return StateEditing
        }
        return StateIdle  // 未知工具，不触发状态转换
    }
}

// transitionTo 直接转换到目标状态（带日志和事件）
func (o *Orchestrator) transitionTo(target State, reason string, rc *RunContext) {
    oldState := rc.State
    rc.State = target
    o.log.Info("state transition",
        zap.String("from", string(oldState)),
        zap.String("to", string(target)),
        zap.String("reason", reason),
        zap.String("runId", rc.Run.ID),
    )
    o.emitEvent(rc, Event{
        Type:      "state_transition",
        Timestamp: time.Now(),
        RunID:     rc.Run.ID,
        Data: map[string]any{
            "from":   string(oldState),
            "to":     string(target),
            "reason": reason,
        },
    })
}
```

**状态转换规则表**（ReAct 循环中的完整转换逻辑）：

| 当前状态 | 工具类型 | 目标状态 | 触发条件 |
|---|---|---|---|
| Planning | 任何 | Inspecting | 模型返回第一个 tool_call |
| Inspecting | read_only 工具 | Inspecting | 保持（读取操作不改状态） |
| Inspecting | write 类工具 | Editing | 写入/执行操作触发编辑态 |
| Editing | write 类工具 | Editing | 保持（连续编辑） |
| Editing | read_only 工具 | Inspecting | 切回检查态（如读取执行结果） |
| 任何 | 模型声明"验证" | Verifying | 模型在 content 中声明验证完成 |
| Verifying | 模型声明"完成" | Completed | 模型不再调用工具 |

**模型如何声明验证**：System Prompt 中告知模型"完成任务后，在回复中包含 `<verify>` 标签表示进入验证阶段"。Orchestrator 解析 content 中的 `<verify>` 标签触发 Verifying 状态。

### 5.7 Executor 接入点

#### 5.7.1 D8 决策落地

启用现有 `Executor.ParseModelResponse()`，用于非流式 fallback 场景：

```go
// 当流式调用失败时，降级为非流式
func (o *Orchestrator) fallbackModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef) (string, []ToolCall, error) {
    resp, err := o.gateway.Chat(ctx, messages, tools, false)
    if err != nil {
        return "", nil, err
    }
    if len(resp.Choices) == 0 {
        return "", nil, fmt.Errorf("no choices in response")
    }

    content := resp.Choices[0].Message.Content

    // 用 Executor 解析 tool_calls
    executor := NewExecutor()
    toolCalls, plainContent := executor.ParseModelResponse(content)

    return plainContent, toolCalls, nil
}
```

#### 5.7.2 Executor.AppendToolResult 使用

```go
// 在 ReAct 循环中，工具执行后用 Executor 追加结果到消息历史
executor := NewExecutor()
chatHistory = executor.AppendToolResult(chatHistory, ToolCall{
    Name: tc.Function.Name,
    Args: args,
    Stdout: toolContent,
    Error: errMsg,
})
```

### 5.8 停止条件

| 条件 | 行为 | 说明 |
|---|---|---|
| 模型不返回 tool_calls | 循环结束，任务完成 | 模型认为任务完成 |
| `turnCount >= maxTurns` | 循环结束，标记 completed | 防止无限循环 |
| `ctx.Err() != nil` | 循环结束 | 用户取消 / 超时 |
| 模型返回 `finish_reason: "stop"` | 循环结束 | 模型主动停止 |
| 连续 3 次工具调用失败 | 循环结束，标记 failed | 防止反复失败 |

### 5.9 Replan 触发

当前 ReAct 循环**不需要显式 replan**——模型每轮重新决策，天然支持 replan：

| 场景 | 当前行为（线性执行） | ReAct 行为 |
|---|---|---|
| 工具失败 | step 标记 failed，继续下一步 | 模型看到失败结果，自己决定重试/换工具/放弃 |
| 用户中途修改需求 | 不支持 | 下一轮模型看到新输入，自动调整 |
| 发现计划有误 | 不支持 | 模型根据工具结果自行调整方向 |

### 5.10 Prompt Caching 策略

#### 5.10.1 目标

让 system prompt 和 tool definitions 稳定命中 provider 的 prompt cache，减少 token 消耗。

#### 5.10.2 策略

| 元素 | 稳定化措施 | 说明 |
|---|---|---|
| System Prompt | 前半部分固定（角色+能力+行为规范） | 只有 `[记忆上下文]` 和 `[项目结构]` 变动 |
| Tool Definitions | `registry.List()` 返回顺序固定 | 按注册顺序，不按字母排序 |
| 对话历史 | 只在尾部追加 | 不插入/重排已有消息 |
| Memory Summary | 放在 system prompt 末尾 | 前缀稳定，后缀变动 |

#### 5.10.3 消息顺序保证

```go
// 固定顺序：system → repo_map → user → history → tool_results
messages := []modelgateway.ChatMessage{
    {Role: "system", Content: systemPrompt},      // 稳定前缀
    {Role: "system", Content: repoMapContext},    // 半稳定（项目结构不常变）
    {Role: "user",   Content: userPrompt},        // 固定
}
messages = append(messages, chatHistory...)        // 尾部追加
```

### 5.11 数据流

```
ReAct 循环开始
  → ContextBuilder.BuildWithMessages() 组装上下文
  → gateway.StreamChat() 流式调用模型
    → 每个 chunk:
      → 文本 delta → emitEvent("message") → 前端实时看到
      → tool_calls delta → 增量拼接
  → 模型返回完成
    → 无 tool_calls → 任务完成，break
    → 有 tool_calls → 继续
  → for each tool_call:
    → StateMachine.ToolIsAllowed() 检查
    → ToolRegistry.Execute() 执行
    → 结果回注 chatHistory (role=tool)
    → Memory.AppendToolResult() 记录
  → 下一轮循环
```

### 5.12 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | `executePlan` 是 ReAct 循环，不是线性执行 | 代码审查：循环条件是 `len(toolCalls) > 0`，不是 `for i, step := range run.Plan` |
| 2 | 模型返回 tool_calls 时被执行 | 手动测试：模型返回 `read_file` 调用，验证文件被读取 |
| 3 | 模型不返回 tool_calls 时循环结束 | 手动测试：模型返回纯文本，验证 Run 状态变为 completed |
| 4 | 流式文本实时发送给前端 | SSE 收到 `type: "message"` 事件 |
| 5 | tool_calls 增量拼接正确 | 构造多 chunk 的 tool_call 响应，验证拼接后 args 完整 |
| 6 | Executor.ParseModelResponse 在非流式 fallback 时被调用 | mock StreamChat 失败，验证 fallback 路径 |
| 7 | maxTurns 生效 | 设置 maxTurns=2，验证第 3 轮不执行 |
| 8 | 工具失败后模型能自行决策 | 手动测试：read_file 不存在的路径，验证模型下一轮调整策略 |
| 9 | System Prompt 前 3 段稳定（命中缓存） | 对比两次请求的 system prompt，前缀一致 |
| 10 | 5 个 Mode 的 System Prompt 正确生成 | 遍历 5 Mode，验证角色定义和工具列表 |

---

## 变更记录

### v0.3（2026-08-11）— GLM 千问审查硬伤修复

**背景**：千问审查发现 6 处硬伤，其中 4 处在 P0 文档（硬伤 1/2/4/6）。本版修复全部 4 处。

**变更**
1. **硬伤 1 修复**（§5.5.1-5.5.2）：`idx := 0` → `idx := tc.Index`，StreamChunk.ToolCall 新增 `Index int` 字段。OpenAI 流式 delta 中每个 tool_call 带 index 字段，写死 0 会导致多 tool_call 时参数拼错。
2. **硬伤 2 修复**（§2.7.2）：workflow → ToolRegistry 的工具名映射。Python Worker 的工具名（如 `research.openalex.search`）与 ToolRegistry 的 13 个内置工具名不同，补充动态注册方案（`RegisterWorkerTools` + `ListTools`）。
3. **硬伤 4 修复**（§5.2.1）：ModelGateway interface 定义。Orchestrator 原来依赖具体类型 `*OpenAICompatibleClient`，改为依赖接口 `ModelGateway`，以便 P2-5 Router 无缝替换。
4. **硬伤 6 修复**（§5.6.1）：ReAct 循环中状态机转换逻辑补全。新增 `inferStateFromTool` 函数根据工具类型推断状态（read_only→Inspecting，write→Editing），新增 `transitionTo` 函数，新增状态转换规则表。

**待补（软伤，不阻塞开工）**
- 软伤 2：§5.4 指令优先级层级（system > skill > user preference）未定义
- 软伤 4：测试策略（mock modelgateway 的方案）未补

### v0.1（2026-08-11）— GLM 初稿

**变更**
1. 新建文档，版本表 + 阅读约定
2. 第 1 节：任务依赖图与执行顺序（P0-2→P0-1→P0-4，P0-3 与 P0-1 并行）
3. 第 2 节：P0-2 状态机三者对齐完整设计
   - 注册表真相源（13 个工具）
   - 新状态机白名单表（9 个状态 × 允许工具 × 4 个 Allowed 标志）
   - 需删除的 8 个幽灵工具
   - 状态机代码改动（白名单重写 + fallback 修正）
   - workflow 接入 ToolRegistry（Runner/Engine 改动 + 审批分层）
   - 数据流图
   - 9 条验收标准

### v0.2（2026-08-11）— GLM 补全 P0-1/3/4

**变更**
1. 第 3 节：P0-1 接线死代码完整设计
   - ChatMessage 类型统一（删除 aiagent.ChatMessage，全包用 modelgateway.ChatMessage）
   - ContextBuilder.Build() 接入 executePlan（替换手写 chatHistory）
   - Token 预算执行机制（EnforceMessages/EnforceToolResults/trimForTokens 三级裁剪）
   - Memory.Summary() 回注点 + 读写时序
   - RepoMap 接入
   - 数据流图 + 9 条验收标准
2. 第 4 节：P0-3 per-run 化完整设计
   - RunContext 结构体定义（State/Memory/EventCh/Cancel）
   - map 并发保护（createRunContext/getRunContext/removeRunContext）
   - Orchestrator 方法签名改动（所有内部方法新增 *RunContext 参数）
   - Event 结构体新增 RunID 字段
   - SSE per-run 过滤（?run_id= 查询参数 + StreamEventsForRun）
   - SSE 事件 Schema（10 种事件类型 + 行格式示例）
   - 数据流图 + 9 条验收标准
3. 第 5 节：P0-4 ReAct 循环完整设计
   - API 请求构建（messages/tools 数组构建规则 + 参数配置）
   - System Prompt 模板（5 Mode 角色定义 + BuildSystemPrompt 实现）
   - 流式响应解析（StreamChunk + tool_calls delta 增量拼接 + streamModelCall 实现）
   - ReAct 循环伪码（完整 for 循环 + 停止条件 + 工具执行 + 结果回注）
   - Executor 接入点（ParseModelResponse 非流式 fallback + AppendToolResult）
   - 停止条件（5 种）+ Replan 触发（天然支持，无需显式）
   - Prompt Caching 策略（system prompt 稳定化 + tools 顺序固定 + 消息尾部追加）
   - 数据流图 + 10 条验收标准

**P0 施工方案全部完成，可进入代码实现阶段**
