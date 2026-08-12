# GeoWork Agent P1 施工方案

> **文档路径**：`doc/06-GeoWorkAgent-P1-Detailed-Design.md`
> **父文档**：`doc/04-GeoWorkAgent.md`（主文档/宪法）
> **前置条件**：P0 四项全部完成并验收通过
> **文档定位**：P1 阶段——安全加固、可观测性、人工介入、Worker 治理、恢复机制

## 版本表

| 版本 | 日期 | 作者 | 变更摘要 |
|---|---|---|---|
| v0.1 | 2026-08-11 | GLM | 初稿：P1 六项施工方案 |
| v0.2 | 2026-08-11 | GLM | 千问审查硬伤 5 修复 + 软伤 1 修复：waitForApproval 超时逻辑补全 + UsageRecord 新增 CachedTokens |
| v0.3 | 2026-08-12 | — | P1-4 新增 §5.5.1 WebSocket 双向通信（JSON-RPC 2.0 审批流）；P1-3 新增 §4.5 SSE 断线重连与事件恢复（Last-Event-ID + 环形缓冲 + state_snapshot）；P1-6 §7.5 定义 executePlanFromTurn 签名和行为；Governor 结构体补充 registry 字段；ApprovalDecision 枚举补充 denied/timeout；waitForApproval 接收者统一为 *Orchestrator；PauseRun 加幂等保护；协议规范独立为 `doc/09-GeoWork-Communication-Protocol.md` |

> **阅读约定**：同 P0 文档。接口签名是待实现契约，先改文档再改代码。

---

## 1. P1 任务总览

| 任务 | 学科 | 目标 | 依赖 |
|---|---|---|---|
| P1-1 | #10 Sandbox & Guardrails | 沙箱隔离加固 + Governor 审批流实现 | P0-2 |
| P1-2 | #12 Observability | Trajectory 记录 + Token 用量审计 | P0-1/P0-3 |
| P1-3 | #13 Streaming（完整） | SSE 事件完善 + 前端 adapter 契约 | P0-3 |
| P1-4 | #14 Human-in-the-Loop | 人工审批 + 暂停/恢复 | P1-1 |
| P1-5 | #18 Python Worker | Worker 治理 + 资源限制 | P0-2 |
| P1-6 | #9 Recovery | Checkpoint 完善断点续传 | P0-3 |

---

## 2. P1-1：Sandbox & Guardrails

### 2.1 目标

实现真正的沙箱隔离（文件系统边界 + 进程资源限制）和 Governor 审批流（critical 操作需 user approval）。

### 2.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/toolregistry/registry.go` | 修改 | `Execute` 新增 `ExecutionMode` 参数 + Governor 审批 |
| `core/internal/aiagent/governor.go` | 新建 | Governor 实现 |
| `core/internal/toolregistry/builtin_tools.go` | 修改 | `write_file`/`run_shell`/`run_python` 加沙箱路径检查 |

### 2.3 Governor 结构体

```go
package aiagent

// ExecutionMode 区分自主执行和确定性执行
type ExecutionMode int

const (
    ModeAutonomous    ExecutionMode = iota  // LLM 驱动，critical 需审批
    ModeDeterministic                       // workflow 驱动，只审计
)

// Governor 管理工具执行权限和审批
type Governor struct {
    log         *zap.Logger
    registry    *toolregistry.Registry     // v0.4 修正：补充 registry 字段（审查发现缺失）
    pendingApps map[string]*ApprovalRequest  // runID → 待审批请求
    mu          sync.Mutex
}

// ApprovalRequest 代表一个待审批的操作
type ApprovalRequest struct {
    ID        string
    RunID     string
    ToolName  string
    Args      map[string]any
    RiskLevel string
    CreatedAt time.Time
    Decision  ApprovalDecision  // pending / approved / rejected
    Reason    string
}

type ApprovalDecision string

const (
    ApprovalPending  ApprovalDecision = "pending"
    ApprovalApproved ApprovalDecision = "approved"
    ApprovalRejected ApprovalDecision = "rejected"
    ApprovalDenied   ApprovalDecision = "denied"    // v0.4 补充：用户主动拒绝
    ApprovalTimeout  ApprovalDecision = "timeout"   // v0.4 补充：超时自动拒绝
)

// CheckPermission 检查工具是否允许执行
func (g *Governor) CheckPermission(runID, toolName string, args map[string]any, mode ExecutionMode) (*ApprovalRequest, error) {
    tool := g.registry.Get(toolName)
    if tool == nil {
        return nil, fmt.Errorf("tool %q not registered", toolName)
    }

    // 非 critical 操作直接放行
    if tool.RiskLevel() != "critical" {
        return nil, nil  // 无需审批
    }

    // critical 操作
    if mode == ModeDeterministic {
        // workflow 链路：只记录审计，不强制审批
        g.log.Info("critical tool in deterministic mode, audit only",
            zap.String("tool", toolName),
            zap.String("runID", runID),
        )
        return nil, nil
    }

    // autonomous 链路：critical 必须审批
    req := &ApprovalRequest{
        ID:        idgen.NewPrefixed("apr_"),
        RunID:     runID,
        ToolName:  toolName,
        Args:      args,
        RiskLevel: tool.RiskLevel(),
        CreatedAt: time.Now(),
        Decision:  ApprovalPending,
    }

    g.mu.Lock()
    g.pendingApps[req.ID] = req
    g.mu.Unlock()

    return req, nil  // 返回审批请求，调用方等待
}

// ResolveApproval 处理审批决策
func (g *Governor) ResolveApproval(reqID string, decision ApprovalDecision, reason string) error {
    g.mu.Lock()
    defer g.mu.Unlock()

    req, ok := g.pendingApps[reqID]
    if !ok {
        return fmt.Errorf("approval request %q not found", reqID)
    }

    req.Decision = decision
    req.Reason = reason
    return nil
}
```

### 2.4 沙箱路径检查

```go
// 工具执行前的路径安全检查
func validateSandboxPath(path string, allowedRoots []string) error {
    absPath, err := filepath.Abs(path)
    if err != nil {
        return fmt.Errorf("invalid path: %w", err)
    }

    for _, root := range allowedRoots {
        absRoot, _ := filepath.Abs(root)
        if strings.HasPrefix(absPath, absRoot) {
            return nil  // 在允许范围内
        }
    }

    return fmt.Errorf("path %q outside sandbox roots %v", path, allowedRoots)
}
```

### 2.5 ToolRegistry.Execute 改动

```go
// 修改后：新增 ExecutionMode 参数
func (r *Registry) Execute(ctx context.Context, toolName string, args map[string]any, mode aiagent.ExecutionMode) (map[string]any, error) {
    tool, ok := r.tools[toolName]
    if !ok {
        return nil, fmt.Errorf("tool %q not found", toolName)
    }

    // 1. 沙箱路径检查（对涉及路径的工具）
    if tool.Sandbox() {
        if pathArg, ok := args["path"].(string); ok {
            if err := validateSandboxPath(pathArg, r.allowedRoots); err != nil {
                return nil, err
            }
        }
    }

    // 2. Governor 权限检查
    approvalReq, err := r.governor.CheckPermission(
        ctx.Value("runID").(string),
        toolName, args, mode,
    )
    if err != nil {
        return nil, err
    }

    // 3. 如果需要审批，等待
    if approvalReq != nil {
        if err := r.waitForApproval(ctx, approvalReq); err != nil {
            return nil, fmt.Errorf("approval denied: %w", err)
        }
    }

    // 4. 执行工具
    result, err := tool.Execute(ctx, args)

    // 5. 审计日志
    r.auditLog(ctx, toolName, args, result, err)

    return result, err
}
```

#### 2.5.1 waitForApproval 实现（v0.2 新增 — 千问审查硬伤 5）

> **【v0.2 修正 — 千问审查硬伤 5】**：v0.1 的 `waitForApproval` 被调用但从未定义实现，且没有超时逻辑。主文档 §14.3 说"用户 5 分钟未响应 → 任务自动暂停"，但 P1 设计里没有把这个超时写进 `waitForApproval`。如果用户永远不响应，goroutine 会永远阻塞。v0.2 补全。

```go
// waitForApproval 等待用户审批，带超时和自动暂停
// v0.4 修正：接收者统一为 *Orchestrator（审查发现原文 Runner/Registry 不一致）
// Orchestrator 持有 Governor 和 RunContext，是唯一合理的接收者
func (o *Orchestrator) waitForApproval(ctx context.Context, req *ApprovalRequest) error {
    // 1. 发送审批请求事件给前端
    r.emitEvent(Event{
        Type:      "approval_request",
        Timestamp: time.Now(),
        RunID:     req.RunID,
        Data: map[string]any{
            "approvalId": req.ID,
            "toolName":   req.ToolName,
            "args":       req.Args,
            "riskLevel":  req.RiskLevel,
        },
    })

    // 2. 创建超时 timer（主文档 §14.3：5 分钟）
    timeout := 5 * time.Minute
    timer := time.NewTimer(timeout)
    defer timer.Stop()

    // 3. 等待审批结果或超时
    for {
        select {
        case <-ctx.Done():
            // 上下文取消（如 Run 被主动停止）
            r.governor.ResolveApproval(req.ID, ApprovalDenied, "context cancelled")
            return fmt.Errorf("approval cancelled: %w", ctx.Err())

        case <-timer.C:
            // 超时：自动暂停 Run（主文档 §14.3）
            r.governor.ResolveApproval(req.ID, ApprovalTimeout, "5min timeout")
            r.emitEvent(Event{
                Type:      "approval_timeout",
                Timestamp: time.Now(),
                RunID:     req.RunID,
                Data: map[string]any{
                    "approvalId": req.ID,
                    "toolName":   req.ToolName,
                    "timeout":    timeout.String(),
                },
            })
            // 将 Run 状态改为 Paused，等待用户恢复
            r.pauseRun(req.RunID, "approval timeout for "+req.ToolName)
            return fmt.Errorf("approval timeout after %s for tool %s", timeout, req.ToolName)

        case decision := <-req.DecisionCh:
            // 用户做出了决策
            switch decision.Decision {
            case ApprovalApproved:
                r.emitEvent(Event{
                    Type:      "approval_resolved",
                    Timestamp: time.Now(),
                    RunID:     req.RunID,
                    Data: map[string]any{
                        "approvalId": req.ID,
                        "decision":   "approved",
                    },
                })
                return nil

            case ApprovalDenied:
                r.emitEvent(Event{
                    Type:      "approval_resolved",
                    Timestamp: time.Now(),
                    RunID:     req.RunID,
                    Data: map[string]any{
                        "approvalId": req.ID,
                        "decision":   "denied",
                        "reason":     decision.Reason,
                    },
                })
                return fmt.Errorf("approval denied: %s", decision.Reason)

            default:
                return fmt.Errorf("unknown approval decision: %s", decision.Decision)
            }
        }
    }
}

// pauseRun 将 Run 暂停（等待用户恢复）
func (r *Runner) pauseRun(runID, reason string) {
    r.mu.Lock()
    defer r.mu.Unlock()
    if run, ok := r.runs[runID]; ok {
        run.Status = StatusPaused
        run.UpdatedAt = time.Now()
        r.emitEvent(Event{
            Type:      "run_paused",
            Timestamp: time.Now(),
            RunID:     runID,
            Data:      map[string]any{"reason": reason},
        })
    }
}
```

**ApprovalRequest 结构体补充**（v0.2 新增 DecisionCh）：

```go
type ApprovalRequest struct {
    ID          string
    RunID       string
    ToolName    string
    Args        map[string]any
    RiskLevel   string
    CreatedAt   time.Time
    Decision    ApprovalDecision  // pending/approved/denied/timeout
    DecisionCh  chan ApprovalResult  // ← v0.2 新增：用户决策通过此 channel 传递
}

type ApprovalResult struct {
    Decision  ApprovalDecision
    Reason    string
    ResolvedBy string  // user ID
}
```

**超时行为表**：

| 场景 | 行为 | 事件 |
|---|---|---|
| 用户 5 分钟内批准 | 继续执行工具 | `approval_resolved(approved)` |
| 用户 5 分钟内拒绝 | 返回错误，模型收到拒绝消息 | `approval_resolved(denied)` |
| 用户 5 分钟未响应 | Run 自动暂停，等待用户恢复 | `approval_timeout` + `run_paused` |
| 上下文取消（Run 停止） | 审批取消 | `approval_cancelled` |

### 2.6 审批 API

```
GET  /api/agent/approvals/{runId}     获取待审批列表
POST /api/agent/approvals/{reqId}/approve  批准
POST /api/agent/approvals/{reqId}/reject   拒绝
```

### 2.7 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | critical 工具在 autonomous 模式触发审批 | 执行 `git_push` 时返回 ApprovalRequest |
| 2 | critical 工具在 deterministic 模式只审计 | workflow 执行 `git_push` 时不阻塞 |
| 3 | 沙箱路径检查生效 | `write_file` 写入沙箱外路径时拒绝 |
| 4 | 审批 API 可用 | `GET /api/agent/approvals/run_xxx` 返回待审批列表 |
| 5 | 审批通过后工具执行 | `POST /approvals/{id}/approve` 后工具继续执行 |
| 6 | 审批拒绝后工具不执行 | `POST /approvals/{id}/reject` 后工具返回错误 |
| 7 | 审计日志记录所有工具调用 | 检查日志文件包含 tool/args/result/error |

---

## 3. P1-2：Observability

### 3.1 目标

实现 Trajectory（执行轨迹）记录和 Token 用量审计，让每次 Run 可追溯、可分析。

### 3.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/trajectory.go` | 新建 | Trajectory 记录器 |
| `core/internal/modelgateway/usage_meter.go` | 修改 | Token 用量持久化 |
| `core/internal/aiagent/orchestrator.go` | 修改 | ReAct 循环中记录 Trajectory |

### 3.3 Trajectory 结构体

```go
// Trajectory 记录一次 Run 的完整执行轨迹
type Trajectory struct {
    RunID     string
    StartTime time.Time
    EndTime   time.Time
    Turns     []TurnRecord
}

// TurnRecord 记录单轮 ReAct 循环
type TurnRecord struct {
    TurnIndex   int
    Timestamp   time.Time
    InputMessages []modelgateway.ChatMessage  // 发给模型的消息
    ModelResponse string                       // 模型返回的文本
    ToolCalls   []ToolCallRecord
    TokenUsage  *UsageInfo
    Duration    time.Duration
}

// ToolCallRecord 记录单次工具调用
type ToolCallRecord struct {
    ToolName  string
    Args      map[string]any
    Result    map[string]any
    Error     string
    Duration  time.Duration
    Approved  bool  // 是否经过审批
}
```

### 3.4 Trajectory 记录器

```go
type TrajectoryRecorder struct {
    log       *zap.Logger
    storage   TrajectoryStorage
}

// TrajectoryStorage 存储接口（可换 JSON 文件 / SQLite / 内存）
type TrajectoryStorage interface {
    Save(traj *Trajectory) error
    Load(runID string) (*Trajectory, error)
    List(limit int) ([]*Trajectory, error)
}

// Record 在 ReAct 循环中调用
func (r *TrajectoryRecorder) Record(runID string, turn TurnRecord) {
    // 追加到 Run 的 Trajectory
}
```

### 3.5 Token 用量审计

```go
// usage_meter.go 扩展
type UsageRecord struct {
    RunID         string
    ProviderID    string
    Model         string
    PromptTokens  int
    CompletionTokens int
    CachedTokens  int  // ← v0.2 新增（千问审查软伤 1）：prompt cache 命中的 token 数
    TotalTokens   int
    EstimatedCost float64
    Timestamp     time.Time
}

// UsageMeter 持久化记录
type UsageMeter struct {
    log     *zap.Logger
    records []UsageRecord
    mu      sync.Mutex
}

func (m *UsageMeter) Record(runID string, usage *UsageInfo) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.records = append(m.records, UsageRecord{
        RunID:         runID,
        PromptTokens:  usage.PromptTokens,
        CompletionTokens: usage.CompletionTokens,
        TotalTokens:   usage.TotalTokens,
        Timestamp:     time.Now(),
    })
}
```

### 3.6 审计 API

```
GET /api/agent/trajectory/{runId}    获取 Run 的完整轨迹
GET /api/agent/usage/{runId}         获取 Run 的 Token 用量
GET /api/agent/usage/summary         获取全局用量统计
```

### 3.7 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 每个 Run 有 Trajectory 记录 | `GET /api/agent/trajectory/run_xxx` 返回非空 |
| 2 | Trajectory 包含每轮的 input/output/tool_calls | 检查 TurnRecord 字段完整 |
| 3 | Token 用量被记录 | `GET /api/agent/usage/run_xxx` 返回 prompt/completion tokens |
| 4 | 用量统计可聚合 | `GET /api/agent/usage/summary` 返回全局总量 |
| 5 | Trajectory 可持久化 | 重启后仍可查询历史 Run 的轨迹 |

---

## 4. P1-3：Streaming 完整设计

### 4.1 目标

完善 SSE 事件协议，定义前端 adapter 契约，支持流式输出、工具调用进度、状态变更通知。

### 4.2 SSE 事件协议（完善版）

基于 P0-3 定义的事件类型，补充字段和语义：

| 事件类型 | Data 字段 | 前端行为 |
|---|---|---|
| `plan` | `runId, prompt, mode, state, plan[]` | 显示计划概要 |
| `step_start` | `stepId, title, tool, state` | 显示步骤开始 |
| `step_done` | `stepId, status, result, duration` | 更新步骤状态 |
| `message` | `content, role, isDelta` | 追加到对话流（delta=true 时增量） |
| `tool_call` | `toolName, args, callId` | 显示工具调用卡片 |
| `tool_result` | `toolName, stdout, stderr, result, callId` | 更新工具卡片 |
| `error` | `error, stepId, fatal` | 显示错误（fatal=true 时终止） |
| `checkpoint` | `runId, checkpointId` | 保存检查点通知 |
| `done` | `runId, state, stepCount, totalTokens` | 标记 Run 完成 |
| `state_change` | `from, to, reason` | 更新状态指示器 |
| `approval_request` | `reqId, runId, toolName, args, riskLevel` | 弹出审批弹窗 |
| `usage` | `runId, promptTokens, completionTokens, totalTokens` | 更新 Token 计数 |

### 4.3 前端 Adapter 契约

```typescript
// 前端 streamAdapters.ts 的契约
interface SSEEvent {
  type: EventType
  timestamp: string
  runId: string
  data: EventData
}

type EventType =
  | 'plan' | 'step_start' | 'step_done'
  | 'message' | 'tool_call' | 'tool_result'
  | 'error' | 'checkpoint' | 'done'
  | 'state_change' | 'approval_request' | 'usage'

// 前端必须处理所有事件类型，default 分支忽略
function handleSSEEvent(event: SSEEvent) {
  switch (event.type) {
    case 'message':
      appendToConversation(event.data.content, event.data.isDelta)
      break
    case 'tool_call':
      showToolCard(event.data)
      break
    case 'approval_request':
      showApprovalDialog(event.data)
      break
    // ...
  }
}
```

### 4.4 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 所有 12 种事件类型都能正确发送 | 遍历触发每种事件，SSE 均收到 |
| 2 | `message` 事件支持 delta 增量 | 流式输出时前端逐步显示文字 |
| 3 | `approval_request` 能触发前端弹窗 | 手动测试 critical 操作 |
| 4 | `usage` 事件携带 token 用量 | 检查 data 字段 |
| 5 | 前端 adapter 处理所有事件类型 | 代码审查无 default 忽略 |

### 4.5 断线重连与事件恢复（v0.3 新增）

#### 4.5.1 心跳与超时

| 参数 | 值 | 说明 |
|---|---|---|
| 服务端 ping 间隔 | 15s | 已有（P0-3 §4.2） |
| 客户端超时判定 | 45s（3 次 ping 未收到） | 超过则视为断连 |
| 重连策略 | 指数退避：1s → 2s → 4s → 8s → 最大 30s | 前端 `EventSource` 默认行为 |

#### 4.5.2 Last-Event-ID 机制

每个 SSE 事件携带递增的 `id` 字段（使用 Run 内的序号，非全局）：

```
event: message
id: run_abc:42
data: {"content": "hello", "role": "assistant", "isDelta": true}
```

前端断线重连时，`EventSource` 自动在请求头带上 `Last-Event-ID: run_abc:42`。

后端收到带 `Last-Event-ID` 的连接请求时：

```go
func (h *Handler) handleStreamEvents(w http.ResponseWriter, req *http.Request) {
    lastID := req.Header.Get("Last-Event-ID")
    if lastID != "" {
        // 从该 Run 的事件缓冲中重放丢失的事件
        runID, seq := parseLastEventID(lastID)
        replayEvents := h.orchestrator.GetEventBuffer(runID, seq+1)
        for _, e := range replayEvents {
            fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", e.ID, e.Type, e.Data)
        }
        w.(http.Flusher).Flush()
    }
    // 然后正常进入 SSE 推送循环
}
```

#### 4.5.3 事件缓冲

每个 Run 在 `RunContext` 中维护环形缓冲区（最近 500 个事件）：

```go
type EventBuffer struct {
    events []BufferedEvent
    maxLen int  // 500
    mu     sync.RWMutex
}

type BufferedEvent struct {
    Seq  int    // Run 内递增序号
    Type string
    Data string
}
```

- 缓冲区满时覆盖最旧的事件
- Run 结束后缓冲区保留 60s 再清理（给断线重连留窗口）
- 如果丢失的事件已超出缓冲范围（断线太久），后端发送 `state_snapshot` 事件（当前 Run 状态 + 最近 5 条消息摘要），前端据此重建 UI

#### 4.5.4 重连后状态同步

重连后前端必须：

1. 收到 `state_snapshot`（如果有）→ 重建 Run 状态
2. 收到 `state_change` → 更新状态指示器
3. 如果 Run 已完成（`done` 事件在缓冲期内发出）→ 直接显示最终结果

---

## 5. P1-4：Human-in-the-Loop

### 5.1 目标

实现暂停/恢复和人工审批，让用户能在 Run 执行过程中介入。

### 5.2 暂停/恢复

```go
// RunContext 新增字段
type RunContext struct {
    // ... 已有字段
    Paused      bool
    PauseCh     chan struct{}  // 暂停时阻塞，恢复时 close 重开
}

// PauseRun 暂停指定 Run
func (o *Orchestrator) PauseRun(runID string) error {
    rc := o.getRunContext(runID)
    if rc == nil {
        return fmt.Errorf("run %q not found", runID)
    }
    // v0.4 修正：防止连续调用覆盖 PauseCh（审查发现并发安全问题）
    if rc.Paused {
        return nil  // 已经暂停，幂等返回
    }
    rc.Paused = true
    rc.PauseCh = make(chan struct{})
    o.transitionState(MachineEventSystemPause, "user paused", rc)
    return nil
}

// ResumeRun 恢复指定 Run
func (o *Orchestrator) ResumeRun(runID string) error {
    rc := o.getRunContext(runID)
    if rc == nil {
        return fmt.Errorf("run %q not found", runID)
    }
    rc.Paused = false
    close(rc.PauseCh)  // 解除阻塞
    o.transitionState(MachineEventSystemResume, "user resumed", rc)
    return nil
}
```

### 5.3 ReAct 循环中的暂停检查

```go
// 在 ReAct 循环每轮开始时检查
if rc.Paused {
    o.emitEvent(rc, Event{Type: "state_change", Data: map[string]any{"to": "waiting_for_user"}})
    <-rc.PauseCh  // 阻塞直到恢复
}
```

### 5.4 审批集成

审批已在 P1-1 的 Governor 中实现，这里补充 ReAct 循环的集成：

```go
// 工具执行前检查审批
approvalReq, err := o.governor.CheckPermission(rc.Run.ID, toolName, args, ModeAutonomous)
if approvalReq != nil {
    // 发送审批请求事件给前端
    o.emitEvent(rc, Event{
        Type: "approval_request",
        Data: map[string]any{
            "reqId": approvalReq.ID,
            "toolName": toolName,
            "args": args,
            "riskLevel": approvalReq.RiskLevel,
        },
    })
    // 等待审批
    if err := o.waitForApproval(ctx, approvalReq); err != nil {
        // 用户拒绝
        chatHistory = append(chatHistory, modelgateway.ChatMessage{
            Role: "tool", Content: "Error: user denied the tool call",
        })
        continue
    }
}
```

### 5.5 API

```
POST /api/agent/runs/{id}/pause    暂停
POST /api/agent/runs/{id}/resume   恢复
GET  /api/agent/approvals/{runId}  待审批列表
POST /api/agent/approvals/{id}/approve  批准
POST /api/agent/approvals/{id}/reject   拒绝
```

### 5.5.1 WebSocket 双向通信（v0.3 新增）

> 完整协议规范见 `doc/09-GeoWork-Communication-Protocol.md`

HTTP 审批 API 作为降级通道保留。主通道升级为 WebSocket（JSON-RPC 2.0）：

**架构**：SSE 继续负责只读事件流，WebSocket 负责双向控制信令。核心原则——SSE 负责"Agent 告诉你它在干什么"，WebSocket 负责"Agent 问你怎么办"。

**连接**：`ws://127.0.0.1:{port}/api/ws?runId={runId}`

**P1 Method**：

| Method | 方向 | 用途 |
|---|---|---|
| `approval/request` | Server → Client | Agent 暂停，请求用户审批 |
| `approval/response` | Client → Server | 用户回复 allow/deny |
| `run/abort` | Client → Server | 用户紧急终止当前 Run |
| `run/status` | Server → Client | 推送 Run 状态变更 |

**后端新增文件**：`core/internal/api/ws_handler.go` + `ws_session.go` + `ws_protocol.go`

**前端新增文件**：`src/shared/api/wsClient.ts` + `wsProtocol.ts`

**Orchestrator 改动**：`StateWaitingForUser` 分支从 HTTP 轮询改为 `wsSession.SendRequestAndWait()` 阻塞等待，超时 5 分钟自动 deny。

### 5.6 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 暂停后 Run 停止执行 | `POST /pause` 后无新事件 |
| 2 | 恢复后 Run 继续执行 | `POST /resume` 后事件恢复 |
| 3 | critical 操作触发审批 | 执行 `delete_file` 时前端收到 `approval_request` |
| 4 | 审批通过后工具执行 | `POST /approve` 后工具结果返回 |
| 5 | 审批拒绝后模型收到拒绝消息 | 下一轮模型看到 "user denied" |

---

## 6. P1-5：Python Worker 治理

### 6.1 目标

规范 Python Worker 的资源限制、超时、进程管理，防止失控脚本影响系统。

### 6.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/worker/client.go` | 修改 | 新增超时/资源限制 |
| `core/internal/worker/pool.go` | 新建 | Worker 进程池管理 |

### 6.3 Worker 配置

```go
type WorkerConfig struct {
    MaxProcesses    int           // 最大并发进程数（默认 4）
    Timeout         time.Duration // 单次执行超时（默认 30s）
    MemoryLimitMB   int           // 内存限制（默认 512MB）
    WorkDir         string        // 工作目录（沙箱内）
    PythonPath      string        // Python 可执行文件路径
}

type WorkerPool struct {
    config  WorkerConfig
    workers []*WorkerProcess
    mu      sync.Mutex
    available chan *WorkerProcess
}

// Execute 在 Worker 池中执行 Python 代码
func (p *WorkerPool) Execute(ctx context.Context, code string, timeout time.Duration) (string, string, error) {
    // 1. 获取空闲 worker
    worker := <-p.available
    defer func() { p.available <- worker }()

    // 2. 设置超时
    execCtx, cancel := context.WithTimeout(ctx, timeout)
    defer cancel()

    // 3. 执行
    stdout, stderr, err := worker.Run(execCtx, code)
    return stdout, stderr, err
}
```

### 6.4 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | Worker 有超时限制 | 执行 `while True` 脚本，30s 后被终止 |
| 2 | Worker 池限制并发 | 4 个 worker 时第 5 个请求等待 |
| 3 | Worker 在沙箱目录执行 | 脚本 `os.getcwd()` 返回沙箱路径 |
| 4 | Worker 崩溃后自动重启 | 杀死 worker 进程后池中补充新进程 |

---

## 7. P1-6：Recovery & Checkpoint

### 7.1 目标

完善 Checkpoint 机制：每 N 步自动保存（不只是结束时），支持断点续传。

### 7.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/recovery.go` | 修改 | Checkpoint 频率 + 续传逻辑 |
| `core/internal/aiagent/orchestrator.go` | 修改 | ReAct 循环中定期 Checkpoint |

### 7.3 Checkpoint 策略

| 触发条件 | 行为 |
|---|---|
| 每 5 次 tool 调用 | 自动保存 Checkpoint |
| Run 暂停时 | 保存 Checkpoint |
| Run 结束时 | 保存最终 Checkpoint |
| 异常崩溃 | 从最近 Checkpoint 恢复 |

### 7.4 Checkpoint 结构

```go
type Checkpoint struct {
    ID          string
    RunID       string
    TurnIndex   int               // ReAct 循环第几轮
    State       State             // 状态机状态
    ChatHistory []modelgateway.ChatMessage
    Memory      []byte            // Memory.Export()
    CreatedAt   time.Time
}
```

### 7.5 断点续传

```go
// ResumeFromCheckpoint 从检查点恢复 Run
func (o *Orchestrator) ResumeFromCheckpoint(checkpointID string) error {
    cp, err := o.recovery.Load(checkpointID)
    if err != nil {
        return err
    }

    run, ok := o.runs[cp.RunID]
    if !ok {
        return fmt.Errorf("run %q not found", cp.RunID)
    }

    // 恢复状态
    rc := o.createRunContext(run, context.Background())
    rc.State = cp.State

    // 恢复 Memory
    rc.Memory.Import(cp.Memory)

    // 恢复 chatHistory
    var chatHistory []modelgateway.ChatMessage = cp.ChatHistory

    // 从 Checkpoint 的 TurnIndex 处恢复 ReAct 循环
    return o.executePlanFromTurn(ctx, run, rc, chatHistory, cp.TurnIndex)
}

// executePlanFromTurn 从指定轮次恢复 ReAct 循环
// 它是 executePlan 的变体——跳过前 turnIndex 轮的对话历史（已在 chatHistory 中），
// 从第 turnIndex 轮开始继续执行。
// 与 executePlan 的区别：
//   - executePlan 从 turnIndex=0 开始
//   - executePlanFromTurn 从指定 turnIndex 开始，chatHistory 已包含之前的对话
func (o *Orchestrator) executePlanFromTurn(
    ctx context.Context,
    run *Run,
    rc *RunContext,
    chatHistory []modelgateway.ChatMessage,
    startTurn int,
) error {
    rc.TurnIndex = startTurn  // 设置起始轮次
    // 后续逻辑与 executePlan 完全一致——
    // ReAct 循环从 startTurn 开始计数，chatHistory 已包含之前所有轮次的对话
    return o.executePlanInternal(ctx, run, rc, chatHistory)
}
```

### 7.6 API

```
GET  /api/agent/checkpoints              列出所有检查点
GET  /api/agent/checkpoints/{runId}      列出 Run 的检查点
POST /api/agent/checkpoints/{id}/resume  从检查点恢复
```

### 7.7 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 每 5 次 tool 调用保存 Checkpoint | 执行 6 次工具后检查有 2 个 Checkpoint |
| 2 | 暂停时保存 Checkpoint | 暂停后检查点列表新增一条 |
| 3 | 从 Checkpoint 恢复后状态正确 | 恢复后 State/Memory/chatHistory 与 Checkpoint 一致 |
| 4 | 恢复后继续 ReAct 循环 | 恢复后模型能继续从上次位置执行 |

---

## 变更记录

### v0.2（2026-08-11）— GLM 千问审查硬伤 5 + 软伤 1 修复

**变更**
1. **硬伤 5 修复**（§2.5.1）：`waitForApproval` 完整实现。原来被调用但从未定义，且无超时逻辑。补全：5 分钟超时 → 自动暂停 Run + `approval_timeout` 事件 + `run_paused` 事件。ApprovalRequest 新增 `DecisionCh` channel。
2. **软伤 1 修复**（§3.5）：UsageRecord 新增 `CachedTokens int` 字段，用于度量 prompt cache 命中率。

**待补（软伤，不阻塞开工）**
- 软伤 3：SSE 断线重连（Last-Event-ID 或重连策略）未补

### v0.1（2026-08-11）— GLM 初稿

**变更**
1. P1-1 Sandbox & Guardrails：Governor 结构体 + 审批流 + 沙箱路径检查 + 审批 API
2. P1-2 Observability：Trajectory 记录器 + Token 用量审计 + 审计 API
3. P1-3 Streaming 完整：12 种 SSE 事件类型 + 前端 adapter 契约
4. P1-4 Human-in-the-Loop：暂停/恢复 + 审批集成 + API
5. P1-5 Python Worker 治理：WorkerPool + 超时/资源限制
6. P1-6 Recovery：Checkpoint 每 5 步保存 + 断点续传 + API
