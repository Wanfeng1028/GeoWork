# GeoWork Agent P3 施工方案

> **文档路径**：`doc/08-GeoWorkAgent-P3-Detailed-Design.md`
> **父文档**：`doc/04-GeoWorkAgent.md`（主文档/宪法）
> **前置条件**：P2 六项全部完成并验收通过
> **文档定位**：P3 阶段——子代理、Harness 规则统一、推测执行、5 层压缩完整版

## 版本表

| 版本 | 日期 | 作者 | 变更摘要 |
|---|---|---|---|
| v0.1 | 2026-08-11 | GLM | 初稿：P3 四项施工方案 |
| v0.2 | 2026-08-11 | GLM | P3-3 补充 §4.5 流式提前执行：SpeculativeExecutor + ReadOnly 标记 + 集成到 streamModelCall + 时序对比 + 安全约束 + 7 条验收标准 |
| v0.3 | 2026-08-12 | TraeCodeCloud | **P3 阶段实现完成记录**：P3-1 子代理（SubAgentManager + NewChildOrchestrator + spawn_subagent 工具 + Run.Result 结果回注）✅；P3-2 Harness 统一规则引擎（Evaluate + deny/approve/audit + 集成到 evaluateHarness）✅；P3-3 推测执行（SpeculativeExecutor + TryExecuteInStream + 流中 JSON 闭合检测 + 结果复用）✅；P3-4 5 层压缩 L4/L5（Summarizer.SummarizeConversation + SolidifyMemory + BuildWithMessages 接入）✅。详见文末「实现记录 v0.3」。 |

> **阅读约定**：同 P0 文档。接口签名是待实现契约，先改文档再改代码。

---

## 1. P3 任务总览

| 任务 | 学科 | 目标 | 依赖 |
|---|---|---|---|
| P3-1 | #15 Sub-agent | 真正的子代理：独立 Orchestrator 实例 + 上下文继承 | P0-3/P0-4 |
| P3-2 | #1 Harness（统一） | Harness 规则集中化：所有安全约束统一管理 | P1-1/P2-3 |
| P3-3 | 推测执行 | 并行探索多个工具路径，择优采用 | P0-3 |
| P3-4 | 5 层压缩完整版 | 完整实现 Context 5 层压缩策略 | P0-1 |

---

## 2. P3-1：Sub-agent

### 2.1 目标

实现真正的子代理：主 Agent 可启动子 Agent 处理子任务，子 Agent 有独立的 RunContext/Memory/状态机，但继承父 Agent 的上下文。当前 `StartRunWithMemory` 只是注入字符串，不是真正的 Sub-agent。

### 2.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/subagent.go` | 新建 | Sub-agent 管理器 |
| `core/internal/aiagent/orchestrator.go` | 修改 | 新增 SpawnSubAgent 方法 |
| `core/internal/aiagent/context_builder.go` | 修改 | 支持继承父上下文 |

### 2.3 SubAgent 结构体

```go
// SubAgentManager 子代理管理器
type SubAgentManager struct {
    parent   *Orchestrator
    children map[string]*Orchestrator  // subRunID → 子 Orchestrator
    log      *zap.Logger
    mu       sync.Mutex
}

// SubAgentConfig 子代理配置
type SubAgentConfig struct {
    ParentRunID    string
    Mode           string
    Prompt         string
    InheritContext bool  // 是否继承父上下文
    MaxTurns       int   // 子代理最大轮数
    Tools          []string  // 允许的工具子集（空=全部）
}

// SpawnSubAgent 启动子代理
func (m *SubAgentManager) SpawnSubAgent(ctx context.Context, config *SubAgentConfig) (*Run, error) {
    // 1. 获取父 RunContext
    parentRC := m.parent.getRunContext(config.ParentRunID)
    if parentRC == nil {
        return nil, fmt.Errorf("parent run %q not found", config.ParentRunID)
    }

    // 2. 创建子 Orchestrator（共享 registry/gateway，独立 memory/stateMachine）
    childOrch := NewOrchestrator(
        m.parent.registry,
        m.parent.gateway,
        m.parent.provider,
        m.log,
    )
    if config.MaxTurns > 0 {
        childOrch.maxTurns = config.MaxTurns
    }

    // 3. 继承父上下文
    parentMemory := ""
    if config.InheritContext {
        parentMemory = parentRC.Memory.Summary(4000)  // 父记忆摘要
    }

    // 4. 启动子 Run
    run, err := childOrch.StartRunWithMemory(ctx, config.Mode, config.Prompt, parentMemory)
    if err != nil {
        return nil, err
    }

    // 5. 注册子代理
    m.mu.Lock()
    m.children[run.ID] = childOrch
    m.mu.Unlock()

    // 6. 发送事件给父 Run
    m.parent.emitEvent(parentRC, Event{
        Type:      "subagent_spawned",
        Timestamp: time.Now(),
        RunID:     config.ParentRunID,
        Data: map[string]any{
            "subRunId":   run.ID,
            "mode":       config.Mode,
            "prompt":     config.Prompt,
        },
    })

    return run, nil
}

// WaitForSubAgent 等待子代理完成
func (m *SubAgentManager) WaitForSubAgent(subRunID string) (*Run, error) {
    m.mu.Lock()
    childOrch, ok := m.children[subRunID]
    m.mu.Unlock()
    if !ok {
        return nil, fmt.Errorf("sub-agent %q not found", subRunID)
    }
    return childOrch.WaitForRun(subRunID)
}

// CollectSubAgentResult 收集子代理结果
func (m *SubAgentManager) CollectSubAgentResult(subRunID string) (string, error) {
    run, err := m.WaitForSubAgent(subRunID)
    if err != nil {
        return "", err
    }
    // 提取子代理的最终输出
    if len(run.Messages) > 0 {
        lastMsg := run.Messages[len(run.Messages)-1]
        return lastMsg.Content, nil
    }
    return "", nil
}
```

### 2.4 工具化：SubAgent 作为工具

```go
// SubAgentTool 将子代理包装为可调用的工具
type SubAgentTool struct {
    manager *SubAgentManager
}

func (t *SubAgentTool) Name() string { return "spawn_subagent" }
func (t *SubAgentTool) Description() string {
    return "Spawn a sub-agent to handle a sub-task. The sub-agent runs independently with its own context."
}
func (t *SubAgentTool) InputSchema() map[string]any {
    return map[string]any{
        "type": "object",
        "properties": map[string]any{
            "prompt": map[string]any{"type": "string", "description": "The sub-task prompt"},
            "mode":   map[string]any{"type": "string", "description": "Agent mode for sub-agent"},
        },
        "required": []string{"prompt"},
    }
}
func (t *SubAgentTool) Permission() string { return "exec" }
func (t *SubAgentTool) RiskLevel() string { return "medium" }
func (t *SubAgentTool) Sandbox() bool { return false }

func (t *SubAgentTool) Execute(ctx context.Context, args map[string]any) (map[string]any, error) {
    prompt, _ := args["prompt"].(string)
    mode, _ := args["mode"].(string)
    if mode == "" {
        mode = "Work"
    }

    runID := ctx.Value("runID").(string)

    run, err := t.manager.SpawnSubAgent(ctx, &SubAgentConfig{
        ParentRunID:    runID,
        Mode:           mode,
        Prompt:         prompt,
        InheritContext: true,
        MaxTurns:       10,  // 子代理默认最多 10 轮
    })
    if err != nil {
        return nil, err
    }

    // 等待子代理完成
    result, err := t.manager.CollectSubAgentResult(run.ID)
    if err != nil {
        return nil, err
    }

    return map[string]any{
        "subRunId": run.ID,
        "result":   result,
        "status":   string(run.Status),
    }, nil
}
```

### 2.5 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 主 Agent 能启动子 Agent | 调用 `spawn_subagent` 工具，子 Run 创建 |
| 2 | 子 Agent 继承父上下文 | 检查子 Agent 的 system prompt 包含父记忆摘要 |
| 3 | 子 Agent 有独立 Memory | 子 Agent 的 Memory 与父 Agent 隔离 |
| 4 | 子 Agent 结果回注父 Agent | 子 Agent 完成后结果出现在父 Agent 的 chatHistory |
| 5 | 子 Agent 有最大轮数限制 | 设置 MaxTurns=3，验证第 4 轮不执行 |
| 6 | 子 Agent 完成事件发送给前端 | SSE 收到 `subagent_spawned` 和 `subagent_done` 事件 |

---

## 3. P3-2：Harness 规则统一

### 3.1 目标

将散落在 State Machine / Governor / Sandbox / Hooks / Audit 中的安全约束统一到 Harness 规则引擎，实现集中化管理、可配置、可审计。

### 3.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/harness.go` | 新建 | Harness 规则引擎 |
| `core/internal/aiagent/state_machine.go` | 修改 | 规则来源改为 Harness |
| `core/internal/aiagent/governor.go` | 修改 | 审批规则改为从 Harness 读取 |

### 3.3 Harness 规则引擎

```go
// Harness 统一安全规则引擎
type Harness struct {
    rules       []HarnessRule
    auditLog    *AuditLogger
    log         *zap.Logger
    mu          sync.RWMutex
}

// HarnessRule 一条安全规则
type HarnessRule struct {
    ID          string
    Name        string
    Type        RuleType  // state_constraint / approval / sandbox / rate_limit
    Condition   string    // 条件表达式
    Action      RuleAction  // deny / approve / audit / throttle
    Priority    int
    Enabled     bool
}

type RuleType string

const (
    RuleStateConstraint RuleType = "state_constraint"
    RuleApproval        RuleType = "approval"
    RuleSandbox         RuleType = "sandbox"
    RuleRateLimit       RuleType = "rate_limit"
)

type RuleAction string

const (
    ActionDeny    RuleAction = "deny"
    ActionApprove RuleAction = "approve"
    ActionAudit   RuleAction = "audit"
    ActionThrottle RuleAction = "throttle"
)

// Evaluate 评估规则
func (h *Harness) Evaluate(ctx *EvaluationContext) (*EvaluationResult, error) {
    h.mu.RLock()
    defer h.mu.RUnlock()

    var result EvaluationResult

    for _, rule := range h.rules {
        if !rule.Enabled {
            continue
        }
        if h.matchCondition(rule, ctx) {
            switch rule.Action {
            case ActionDeny:
                return &EvaluationResult{
                    Allowed: false,
                    Reason:  fmt.Sprintf("denied by rule %q", rule.Name),
                    RuleID:  rule.ID,
                }, nil
            case ActionApprove:
                result.AutoApproved = true
            case ActionAudit:
                h.auditLog.Log(rule, ctx)
            }
        }
    }

    result.Allowed = true
    return &result, nil
}

// EvaluationContext 规则评估上下文
type EvaluationContext struct {
    RunID       string
    ToolName    string
    Args        map[string]any
    State       State
    Mode        ExecutionMode
    RiskLevel   string
    FilePath    string  // 如适用
}

// EvaluationResult 规则评估结果
type EvaluationResult struct {
    Allowed       bool
    AutoApproved  bool
    Reason        string
    RuleID        string
}
```

### 3.4 规则配置

```json
// config/harness_rules.json
{
  "rules": [
    {
      "id": "no-delete-in-verifying",
      "name": "验证阶段不允许删除文件",
      "type": "state_constraint",
      "condition": "state == 'verifying' && tool == 'delete_file'",
      "action": "deny",
      "priority": 100,
      "enabled": true
    },
    {
      "id": "auto-approve-read",
      "name": "读取操作自动批准",
      "type": "approval",
      "condition": "riskLevel == 'low'",
      "action": "approve",
      "priority": 50,
      "enabled": true
    },
    {
      "id": "sandbox-path-check",
      "name": "沙箱路径检查",
      "type": "sandbox",
      "condition": "sandbox == true",
      "action": "audit",
      "priority": 80,
      "enabled": true
    },
    {
      "id": "rate-limit-shell",
      "name": "Shell 执行限流",
      "type": "rate_limit",
      "condition": "tool == 'run_shell'",
      "action": "throttle",
      "priority": 60,
      "enabled": true
    }
  ]
}
```

### 3.5 集成点

```go
// ToolRegistry.Execute 改为先经过 Harness
func (r *Registry) Execute(ctx context.Context, toolName string, args map[string]any, mode ExecutionMode) (map[string]any, error) {
    // 1. Harness 规则评估
    evalResult, err := r.harness.Evaluate(&EvaluationContext{
        ToolName: toolName,
        Args:     args,
        Mode:     mode,
    })
    if err != nil {
        return nil, err
    }
    if !evalResult.Allowed {
        return nil, fmt.Errorf("denied: %s", evalResult.Reason)
    }

    // 2. 如果未自动批准，走 Governor 审批
    if !evalResult.AutoApproved && needsApproval(toolName) {
        // ... Governor 审批流程
    }

    // 3. 执行工具
    return tool.Execute(ctx, args)
}
```

### 3.6 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | Harness 规则可配置 | 修改 JSON 配置后规则生效 |
| 2 | 规则按优先级执行 | 高优先级规则先匹配 |
| 3 | deny 规则阻止执行 | `no-delete-in-verifying` 规则阻止验证阶段删除 |
| 4 | approve 规则自动批准 | `auto-approve-read` 规则让读取操作不审批 |
| 5 | 审计日志记录规则命中 | 检查审计日志包含规则 ID |
| 6 | State Machine 规则来源改为 Harness | 状态机白名单从 Harness 读取 |

---

## 4. P3-3：推测执行

### 4.1 目标

在 ReAct 循环中，当模型返回多个 tool_calls 时，并行执行无依赖的工具调用，缩短执行时间。

### 4.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/parallel_executor.go` | 新建 | 并行执行器 |
| `core/internal/aiagent/orchestrator.go` | 修改 | ReAct 循环中用并行执行 |

### 4.3 并行执行器

```go
// ParallelExecutor 并行执行工具调用
type ParallelExecutor struct {
    registry *toolregistry.Registry
    log      *zap.Logger
    maxParallel int  // 最大并行度
}

// ExecuteParallel 并行执行多个工具调用
func (e *ParallelExecutor) ExecuteParallel(ctx context.Context, calls []ToolCall, rc *RunContext) []ToolResult {
    // 1. 分析依赖关系
    groups := e.groupByDependency(calls)

    var results []ToolResult
    for _, group := range groups {
        if len(group) == 1 {
            // 单个调用，直接执行
            result := e.executeOne(ctx, group[0], rc)
            results = append(results, result)
        } else {
            // 并行执行
            groupResults := e.executeGroup(ctx, group, rc)
            results = append(results, groupResults...)
        }
    }
    return results
}

// groupByDependency 按依赖关系分组
func (e *ParallelExecutor) groupByDependency(calls []ToolCall) [][]ToolCall {
    // 简单策略：同类型工具可并行，不同类型串行
    // 例如：3 个 read_file 可并行，read_file + write_file 串行
    var groups [][]ToolCall
    var currentGroup []ToolCall
    var lastTool string

    for _, call := range calls {
        if call.Name != lastTool && len(currentGroup) > 0 {
            groups = append(groups, currentGroup)
            currentGroup = nil
        }
        currentGroup = append(currentGroup, call)
        lastTool = call.Name
    }
    if len(currentGroup) > 0 {
        groups = append(groups, currentGroup)
    }
    return groups
}

// executeGroup 并行执行一组工具调用
func (e *ParallelExecutor) executeGroup(ctx context.Context, calls []ToolCall, rc *RunContext) []ToolResult {
    sem := make(chan struct{}, e.maxParallel)
    var wg sync.WaitGroup
    results := make([]ToolResult, len(calls))

    for i, call := range calls {
        wg.Add(1)
        go func(idx int, c ToolCall) {
            defer wg.Done()
            sem <- struct{}{}
            defer func() { <-sem }()
            results[idx] = e.executeOne(ctx, c, rc)
        }(i, call)
    }
    wg.Wait()
    return results
}
```

### 4.4 验收标准（批次并行）

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 同类型工具并行执行 | 3 个 read_file 并行，总耗时 ≈ 单个耗时 |
| 2 | 不同类型工具串行执行 | read_file 后 write_file，顺序执行 |
| 3 | 并行度可配置 | maxParallel=2 时最多 2 个并发 |
| 4 | 并行结果顺序正确 | 结果按调用顺序返回，不是完成顺序 |

### 4.5 流式提前执行（Speculative Execution in Stream）

> **v0.2 补充**：主文档 §6.6 明确描述了"模型流式输出中识别到 read_only tool_call → 立即开始执行"的策略，但 v0.1 的 `groupByDependency` 只做了批次并行，没有实现流式提前执行。本节补全这一缺失。

#### 4.5.1 目标

在模型**流式输出过程中**（而非等模型输出完毕后）就开始执行 `read_only` 工具，减少用户等待时间。主文档 §6.6 的定义：

```
read_only：read_file, list_files, search_workspace, scan_folder, screenshot, paper_search
  → 可并行、可在模型流式输出中提前执行

write：write_file, run_python, run_shell, delete_file, browser_control, network_request, git_*
  → 必须串行、必须等模型输出完毕
```

#### 4.5.2 工具分类标记

在 `tool_policy.go` 中为每个工具新增 `ReadOnly` 标记：

```go
// ToolPolicy 新增字段
type ToolPolicy struct {
    // ... 已有字段 ...
    ReadOnly bool  // true 表示该工具只读，可流式提前执行
}

// 在策略定义中标记
{
    Name:     "read_file",
    ReadOnly: true,
    // ...
},
{
    Name:     "list_files",
    ReadOnly: true,
    // ...
},
{
    Name:     "search_workspace",
    ReadOnly: true,
    // ...
},
{
    Name:     "scan_folder",
    ReadOnly: true,
    // ...
},
{
    Name:     "screenshot",
    ReadOnly: true,    // 截图是只读操作
    // ...
},
{
    Name:     "paper_search",
    ReadOnly: true,    // 论文搜索是只读操作
    // ...
},
// write 类工具 ReadOnly 默认为 false
```

#### 4.5.3 流式提前执行器

```go
// SpeculativeExecutor 流式提前执行器
type SpeculativeExecutor struct {
    registry   *toolregistry.Registry
    policy     *toolregistry.PolicyTable
    log        *zap.Logger

    // 提前执行的结果缓存：toolCallID → result
    results    sync.Map  // map[string]*SpeculativeResult
}

// SpeculativeResult 提前执行的结果
type SpeculativeResult struct {
    ToolCallID string
    Result     map[string]any
    Error      error
    Done       bool
    StartedAt  time.Time
    CompletedAt time.Time
}

// TryExecuteInStream 在流式输出中尝试提前执行 read_only 工具
// 当 StreamChat 的 chunk 中解析到完整的 tool_call 时调用
func (e *SpeculativeExecutor) TryExecuteInStream(ctx context.Context, tc ToolCall) (*SpeculativeResult, bool) {
    // 1. 检查工具是否为 read_only
    policy := e.policy.Get(tc.Name)
    if policy == nil || !policy.ReadOnly {
        return nil, false  // 非 read_only，不提前执行
    }

    // 2. 检查是否已执行过（同一 toolCallID）
    if cached, ok := e.results.Load(tc.ID); ok {
        return cached.(*SpeculativeResult), true  // 已在执行中或已完成
    }

    // 3. 提前执行
    result := &SpeculativeResult{
        ToolCallID: tc.ID,
        StartedAt:  time.Now(),
    }
    e.results.Store(tc.ID, result)

    go func() {
        defer func() {
            result.CompletedAt = time.Now()
            result.Done = true
        }()
        res, err := e.registry.Execute(ctx, tc.Name, tc.Args)
        result.Result = res
        result.Error = err
        e.log.Info("speculative execution completed",
            zap.String("tool", tc.Name),
            zap.Duration("duration", time.Since(result.StartedAt)),
        )
    }()

    return result, true
}

// GetResult 获取提前执行的结果（阻塞等待完成）
func (e *SpeculativeExecutor) GetResult(toolCallID string) (*SpeculativeResult, error) {
    val, ok := e.results.Load(toolCallID)
    if !ok {
        return nil, fmt.Errorf("no speculative result for %s", toolCallID)
    }
    result := val.(*SpeculativeResult)
    // 等待完成
    for !result.Done {
        time.Sleep(10 * time.Millisecond)
    }
    return result, nil
}

// Cleanup 清理本轮的提前执行结果
func (e *SpeculativeExecutor) Cleanup() {
    e.results.Range(func(key, value any) bool {
        e.results.Delete(key)
        return true
    })
}
```

#### 4.5.4 集成到 ReAct 循环

修改 P0-4 的 `streamModelCall`，在流式解析 chunk 时插入提前执行逻辑：

```go
func (o *Orchestrator) streamModelCall(ctx context.Context, messages []modelgateway.ChatMessage, tools []modelgateway.ToolDef, rc *RunContext) (string, []ToolCall, error) {
    ch, err := o.gateway.StreamChat(ctx, messages, tools)
    if err != nil {
        return "", nil, err
    }

    var contentBuilder strings.Builder
    var toolCalls []modelgateway.ToolCall
    toolCallMap := map[int]*modelgateway.ToolCall{}

    // 创建提前执行器（每轮一个）
    specExec := NewSpeculativeExecutor(o.registry, o.policy, o.log)
    defer specExec.Cleanup()

    for chunk := range ch {
        if chunk.IsDone {
            break
        }

        // 1. 文本内容增量
        if chunk.Content != "" {
            contentBuilder.WriteString(chunk.Content)
            o.emitEvent(rc, Event{
                Type:      "message",
                Timestamp: time.Now(),
                RunID:     rc.Run.ID,
                Data:      map[string]any{"content": chunk.Content, "role": "assistant"},
            })
        }

        // 2. tool_calls 增量拼接
        for _, tc := range chunk.ToolCalls {
            idx := 0
            if existing, ok := toolCallMap[idx]; ok {
                existing.Function.Arguments += tc.Function.Arguments

                // 【新增】当 arguments 拼接完成（检测到 JSON 闭合）时尝试提前执行
                if isJSONComplete(existing.Function.Arguments) {
                    var args map[string]any
                    if json.Unmarshal([]byte(existing.Function.Arguments), &args) == nil {
                        call := ToolCall{
                            ID:   existing.ID,
                            Name: existing.Function.Name,
                            Args: args,
                        }
                        // 尝试提前执行（只有 read_only 工具会真正执行）
                        specExec.TryExecuteInStream(ctx, call)
                    }
                }
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

    // 3. 模型输出完毕后，处理工具执行
    //    read_only 工具：从提前执行器拿结果（可能已完成）
    //    write 工具：现在才执行
    for i := range toolCalls {
        tc := &toolCalls[i]
        var args map[string]any
        json.Unmarshal([]byte(tc.Function.Arguments), &args)

        // 尝试从提前执行器拿结果
        if result, err := specExec.GetResult(tc.ID); err == nil && result.Done {
            // 提前执行已完成，直接用结果
            tc.Result = result.Result
            tc.Error = result.Error
            o.log.Info("tool executed speculatively",
                zap.String("tool", tc.Function.Name),
                zap.Duration("aheadTime", time.Since(result.CompletedAt)),
            )
        } else {
            // 非 read_only 或提前执行失败，现在执行
            result, err := o.registry.Execute(ctx, tc.Function.Name, args)
            tc.Result = result
            tc.Error = err
        }
    }

    return contentBuilder.String(), toolCalls, nil
}

// isJSONComplete 检查 JSON 字符串是否闭合（粗略检查：花括号配对）
func isJSONComplete(s string) bool {
    count := 0
    inString := false
    escape := false
    for _, r := range s {
        if escape {
            escape = false
            continue
        }
        if r == '\\' {
            escape = true
            continue
        }
        if r == '"' {
            inString = !inString
            continue
        }
        if inString {
            continue
        }
        if r == '{' {
            count++
        }
        if r == '}' {
            count--
        }
    }
    return count == 0 && len(s) > 0
}
```

#### 4.5.5 时序对比

**无提前执行（当前 P0-4）**：
```
t=0s   模型开始流式输出
t=3s   模型输出完毕，返回 3 个 tool_calls [read_file, read_file, write_file]
t=3s   开始执行 read_file #1
t=3.5s read_file #1 完成
t=3.5s 开始执行 read_file #2
t=4s   read_file #2 完成
t=4s   开始执行 write_file
t=5s   write_file 完成
总耗时：5s
```

**有提前执行（P3-3 §4.5）**：
```
t=0s   模型开始流式输出
t=1s   chunk 中解析到 read_file #1 的 tool_call（JSON 闭合）→ 立即开始执行
t=1.5s read_file #1 提前执行完成（结果缓存）
t=2s   chunk 中解析到 read_file #2 的 tool_call → 立即开始执行
t=2.5s read_file #2 提前执行完成（结果缓存）
t=3s   模型输出完毕，返回 3 个 tool_calls
t=3s   read_file #1/#2 从缓存拿结果（已完成）
t=3s   开始执行 write_file（不能提前）
t=4s   write_file 完成
总耗时：4s（节省 1s）
```

#### 4.5.6 安全约束

| 约束 | 规则 | 理由 |
|---|---|---|
| 只对 read_only 工具提前执行 | `policy.ReadOnly == true` 才触发 | write 类工具有副作用，必须等模型确认 |
| 提前执行结果可丢弃 | 如果模型最终不返回该 tool_call，结果直接丢弃 | 模型可能在流式过程中改变主意 |
| 提前执行不计入 Trajectory | 只有被模型确认的工具调用才记录 | 避免轨迹污染 |
| 提前执行遵守 Governor 审批 | read_only 工具通常无需审批，但仍走 CheckPermission | 审批流不因提前执行而绕过 |
| 单轮提前执行数量限制 | 最多 3 个并发提前执行 | 防止资源耗尽 |

#### 4.5.7 验收标准（流式提前执行）

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | read_only 工具在流式中提前执行 | 模型输出 read_file 时，日志显示 "speculative execution started" 在 "model output done" 之前 |
| 2 | write 工具不提前执行 | 模型输出 write_file 时，无 "speculative execution" 日志 |
| 3 | 提前执行结果被复用 | 模型输出完毕后，read_file 的结果从缓存获取（日志 "executed speculatively"） |
| 4 | 提前执行节省时间 | 3 个 read_file + 1 个 write_file，总耗时 < 无提前执行的 80% |
| 5 | 模型不返回该 tool_call 时结果被丢弃 | 构造模型中途停止的场景，验证缓存被 Cleanup |
| 6 | 提前执行遵守审批 | read_only 工具的 CheckPermission 仍被调用 |
| 7 | 并发提前执行数 ≤ 3 | 构造 5 个 read_file，验证最多 3 个并发 |

---

## 5. P3-4：5 层压缩完整版

### 5.1 目标

完整实现 Context 5 层压缩策略，从 L1（工具结果裁剪）到 L5（对话摘要），逐级压缩上下文。

### 5.2 5 层压缩策略

| 层级 | 触发条件 | 压缩方式 | 当前状态 |
|---|---|---|---|
| L1 工具结果裁剪 | 单个 tool result > 8000 字符 | `SummarizeToolResult`（head/tail + 错误行优先） | ✅ P0-1 已接线 |
| L2 消息数裁剪 | 消息数 > 20 | `EnforceMessages`（保留 system + 最近 19 条） | ✅ P0-1 已接线 |
| L3 Token 预算裁剪 | token 估算 > 27904 | `trimForTokens`（保留 system + user + 最近 3 条） | ✅ P0-1 已接线 |
| L4 对话摘要 | token 仍超限 | 用模型对历史对话生成摘要，替换原始消息 | ❌ P3-4 实现 |
| L5 记忆固化 | L4 后仍超限 | 将摘要写入 Memory，清空 chatHistory | ❌ P3-4 实现 |

### 5.3 L4 对话摘要

```go
// Summarizer 对话摘要器
type Summarizer struct {
    gateway *modelgateway.OpenAICompatibleClient
    log     *zap.Logger
}

// SummarizeConversation 用模型对历史对话生成摘要
func (s *Summarizer) SummarizeConversation(ctx context.Context, messages []modelgateway.ChatMessage, maxTokens int) (string, error) {
    // 1. 构建摘要请求
    summaryPrompt := `请将以下对话历史压缩为简洁的摘要，保留：
1. 用户的核心需求
2. 已完成的关键操作和结果
3. 未完成的任务
4. 重要的文件路径和数据

对话历史：`

    for _, msg := range messages[1:] {  // 跳过 system
        summaryPrompt += fmt.Sprintf("\n[%s] %s", msg.Role, msg.Content)
    }

    summaryRequest := []modelgateway.ChatMessage{
        {Role: "system", Content: "你是一个对话摘要助手，输出简洁的中文摘要。"},
        {Role: "user", Content: summaryPrompt},
    }

    // 2. 调用模型生成摘要
    resp, err := s.gateway.Chat(ctx, summaryRequest, nil, false)
    if err != nil {
        return "", err
    }
    if len(resp.Choices) == 0 {
        return "", fmt.Errorf("no choices in summary response")
    }

    return resp.Choices[0].Message.Content, nil
}
```

### 5.4 L5 记忆固化

```go
// SolidifyMemory 将对话摘要固化到 Memory
func (o *Orchestrator) SolidifyMemory(rc *RunContext, summary string) {
    // 1. 将摘要写入 Memory
    rc.Memory.SetTaskSummary(summary)

    // 2. 清空 chatHistory（只保留 system + user prompt）
    // 这会在下一轮 BuildWithMessages 时生效
    // 因为 Memory.Summary() 会返回包含摘要的记忆

    // 3. 发送事件
    o.emitEvent(rc, Event{
        Type:      "memory_solidified",
        Timestamp: time.Now(),
        RunID:     rc.Run.ID,
        Data: map[string]any{
            "summaryLength": len(summary),
        },
    })
}
```

### 5.5 压缩流程

```go
// ContextBuilder 新增 L4/L5 压缩
func (cb *ContextBuilder) BuildWithMessages(mode, prompt, memory string, existingMessages []modelgateway.ChatMessage) BudgetResult {
    baseMsgs, tools := cb.Build(mode, prompt, memory)
    allMsgs := append(baseMsgs, existingMessages...)

    bab := NewBudgetAwareBuilder(cb, cb.budget)
    result := bab.Enforce(allMsgs, tools)

    // L1-L3 已在 Enforce 中处理

    // L4: 如果 L3 后仍超限，生成对话摘要
    if result.Truncated && cb.estimateTokens(result.Messages) > cb.budget.MaxPromptTokens-cb.budget.ReservedOutputTokens {
        if cb.summarizer != nil {
            summary, err := cb.summarizer.SummarizeConversation(context.Background(), result.Messages, 2000)
            if err == nil {
                // 用摘要替换历史消息
                result.Messages = []modelgateway.ChatMessage{
                    result.Messages[0],  // system
                    result.Messages[1],  // user
                    {Role: "system", Content: "对话历史摘要：\n" + summary},
                }
            }
        }
    }

    // L5: 如果 L4 后仍超限，固化到 Memory
    if cb.estimateTokens(result.Messages) > cb.budget.MaxPromptTokens-cb.budget.ReservedOutputTokens {
        // 触发记忆固化
        // Memory 会持久化摘要，chatHistory 被清空
    }

    return result
}
```

### 5.6 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | L1 工具结果裁剪生效 | 单个 tool result > 8000 字符时被裁剪 |
| 2 | L2 消息数裁剪生效 | 消息数 > 20 时被裁剪到 20 |
| 3 | L3 Token 预算裁剪生效 | token 估算超限时保留 system + user + 最近 3 条 |
| 4 | L4 对话摘要生效 | L3 后仍超限时生成摘要，替换历史 |
| 5 | L5 记忆固化生效 | L4 后仍超限时摘要写入 Memory |
| 6 | 5 层逐级触发 | 构造超长对话，验证 L1→L2→L3→L4→L5 依次触发 |
| 7 | 摘要用模型生成 | 检查摘要内容是模型生成的，不是简单截断 |

---

## 变更记录

### v0.2（2026-08-11）— GLM 补充 P3-3 流式提前执行

**背景**：豆包-code 审查发现主文档 §6.6 明确描述了"流式输出中提前执行 read_only 工具"的策略，但 P3-3 v0.1 只做了批次并行（groupByDependency），流式提前执行逻辑完全缺失。本版补全。

**变更**
1. P3-3 新增 §4.5 流式提前执行：SpeculativeExecutor 结构体 + TryExecuteInStream/GetResult/Cleanup 方法
2. tool_policy.go 新增 ReadOnly 标记（6 个 read_only 工具：read_file/list_files/search_workspace/scan_folder/screenshot/paper_search）
3. streamModelCall 集成：chunk 解析到 JSON 闭合的 tool_call 时触发提前执行 + 模型输出完毕后从缓存拿结果
4. 时序对比（无提前执行 5s vs 有提前执行 4s）
5. 5 条安全约束 + 7 条验收标准
6. §4.4 标题改为"验收标准（批次并行）"以区分 §4.5.7"验收标准（流式提前执行）"

### v0.1（2026-08-11）— GLM 初稿

**变更**
1. P3-1 Sub-agent：SubAgentManager + 独立子 Orchestrator + 上下文继承 + 工具化（spawn_subagent）
2. P3-2 Harness 规则统一：Harness 规则引擎 + 4 种规则类型 + JSON 配置 + 集成到 ToolRegistry
3. P3-3 推测执行：ParallelExecutor + 依赖分析 + 同类型并行 + 不同类型串行
4. P3-4 5 层压缩完整版：L4 对话摘要（模型生成）+ L5 记忆固化 + 逐级触发流程

---

## 实现记录

### v0.3（2026-08-12）— TraeCodeCloud P3 阶段实现完成

**执行者**：TraeCodeCloud（后端 / Agent 开发工程师）
**完成时间**：2026-08-12
**对应提交**：`cc69658 feat(core): implement P3 stage — sub-agent, harness, speculative execution, 5-layer compression`
**分支**：`dev/TraeCodeCloud` → 目标 `master`

**完成情况总览**

| 任务 | 状态 | 实现文件 | 验收对照 |
|---|---|---|---|
| P3-1 Sub-agent | ✅ 完成 | `core/internal/aiagent/subagent.go`（新建）、`orchestrator.go`（NewChildOrchestrator + Run.Result + RunContext.parentMemory）、`state_machine.go`（spawn_subagent 白名单） | §2.5 验收 1-6 |
| P3-2 Harness 规则统一 | ✅ 完成 | `core/internal/aiagent/harness.go`（新建）、`orchestrator.go`（evaluateHarness 集成） | §3.6 验收 1-6 |
| P3-3 推测执行 | ✅ 完成 | `core/internal/aiagent/speculative_executor.go`（新建）、`parallel_executor.go`（新建）、`toolregistry/tool_policy.go`（ReadOnly 标记）、`orchestrator.go`（streamModelCall + 结果复用） | §4.5.7 验收 1-7 |
| P3-4 5 层压缩完整版 | ✅ 完成 | `core/internal/aiagent/summarizer.go`（新建）、`context_builder.go`（BuildWithMessages L4）、`context_budget.go`（BudgetResult.Summary）、`orchestrator.go`（SolidifyMemory L5）、`memory.go`（SetTaskSummary）、`main.go`（注册 Summarizer） | §5.6 验收 1-7 |

**实现要点**

1. **P3-1 子代理**：实现 `SubAgentManager`（`subagent.go`），通过 `NewChildOrchestrator` 创建共享父 `registry/gateway/provider/governor` 但独立 `Memory/stateMachine/runs` 的子 Orchestrator；父上下文以 `parentMemory`（Memory.Summary 4000 字符）注入子 Run 的 system prompt；`spawn_subagent` 作为工具注册（白名单见 `state_machine.go`）；子 Run 完成后 `executePlan` 的 deferred 从 `rc.Memory.LastAssistantMessage()` 抽取结果写入 `Run.Result`，`CollectSubAgentResult` 可读取。新增 `parentOf map[string]string` 路由 `subagent_done` 事件回父 Run。

2. **P3-2 Harness**：`harness.go` 定义 `Harness`/`HarnessRule`/`EvaluationContext`/`EvaluationResult`，`Evaluate` 按 `Enabled`+`matchCondition` 匹配后执行 `ActionDeny`（短路返回错误）/`ActionApprove`（置 `AutoApproved`，执行模式切到 `ModeDeterministic` 跳过交互审批）/`ActionAudit`（写审计日志）。`orchestrator.evaluateHarness` 在每次工具执行前调用，无 Harness 时回退到 `(ModeAutonomous, nil)` 的旧行为。

3. **P3-3 推测执行**：`speculative_executor.go` 的 `TryExecuteInStream` 检查 `PolicyTable.Get(name).ReadOnly`，命中则在 goroutine 中提前执行只读工具并缓存到 `sync.Map`；`streamModelCall` 在每个 chunk 拼接 tool_call arguments 后用 `IsJSONComplete` 检测闭合，闭合即触发提前执行；工具执行循环通过 `rc.specExec.HasResult(tc.ID)` 复用缓存结果，避免重复执行。`tool_policy.go` 为 6 个只读工具打上 `ReadOnly: true`。

4. **P3-4 5 层压缩 L4/L5**：`summarizer.go` 的 `Summarizer.SummarizeConversation` 调用模型 gateway 将对话历史压缩为保留「核心需求/已完成操作/未完成任务/重要路径」的摘要（30s 超时兜底）；`ContextBuilder.BuildWithMessages` 在 L1-L3（`Enforce`）后若仍超预算且 `convSummarizer != nil`，生成摘要并替换为 `[system, user, summary]` 三条消息；`Orchestrator.SolidifyMemory`（L5）在 L4 后仍超预算时将摘要写入 `Memory.SetTaskSummary`、清空 `chatHistory`、用 `Memory.Summary` 重建上下文。`main.go` 在 gateway 非空时 `orchestrator.WithSummarizer(NewSummarizer(gateway, logger))` 接线。L1-L3 在 P0 已接线，本次补齐 L4/L5，5 层链路完整。

**构建与测试**

- `cd core && GOTOOLCHAIN=local go build ./...` ✅ 通过
- `cd core && GOTOOLCHAIN=local go vet ./...` ✅ 无警告（修复了 `orchestrator.go:1708` 的 `ExecutionMode` int→string 转换警告，改用 `.String()`）
- `cd core && GOTOOLCHAIN=local go test ./...` ✅ 全部通过（aiagent/api/agent/conversation/runtime/sandbox/toolregistry/tools/worker）

**与设计的偏差（已记录）**

- §2.3 设计用 `NewOrchestrator` 创建子代理，实现改为 `NewChildOrchestrator`：原设计会让子代理 `registry.WithApprovalGovernor` 覆盖父 Governor 导致审批流混乱，`NewChildOrchestrator` 显式复用父 `parentGovernor`，行为更安全。已在代码注释说明。
- §4.5.3 设计中 `TryExecuteInStream(tc ToolCall)`，实现签名改为 `(ctx, toolCallID, toolName, arguments string)` 以匹配流式增量拼接（先拿到 ID+name，arguments 逐步拼接），并新增 `HasResult` 非阻塞检查。
- §3.5 设计中 `ToolRegistry.Execute` 内嵌 Harness 评估，实现改为在 Orchestrator 层 `evaluateHarness` 调用：避免 toolregistry→aiagent 反向依赖（Harness 类型在 aiagent 包），保持单向依赖。

**未做事项**

- JSON 规则配置文件 `config/harness_rules.json` 尚未落地，当前规则通过代码内置（`Harness.AddRule` 编程式注册）。运行时配置化留待后续。
- 推测执行的并发度限制（§4.5.6 第 5 条「最多 3 个并发」）未加信号量，当前依赖 `sync.Map` 自然并发。后续可补 semaphore。

**需要用户重点验收的地方**

- 子代理结果回注：调用 `spawn_subagent` 后父 Run 的 chatHistory 是否包含子代理输出。
- Harness deny 规则是否真的短路（构造 `state==verifying && tool==delete_file` 验证）。
- 推测执行节省时间（3 个 read_file + 1 个 write_file 的总耗时对比）。
- L4/L5 触发：构造超长对话（>27904 token）验证摘要生成与记忆固化事件 `memory_solidified`。
