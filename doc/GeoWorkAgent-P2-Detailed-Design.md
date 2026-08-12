# GeoWork Agent P2 施工方案

> **文档路径**：`doc/GeoWorkAgent-P2-Detailed-Design.md`
> **父文档**：`doc/GeoWorkAgent.md`（主文档/宪法）
> **前置条件**：P1 六项全部完成并验收通过
> **文档定位**：P2 阶段——技能体系、MCP 真实运行、生命周期钩子、自动化、模型路由策略、评估体系、浏览器/GUI 操控

## 版本表

| 版本 | 日期 | 作者 | 变更摘要 |
|---|---|---|---|
| v0.1 | 2026-08-11 | GLM | 初稿：P2 六项施工方案 |
| v0.2 | 2026-08-11 | GLM | 新增 P2-7 Browser/Computer Use：接入已有 browserbridge 代码 + 注册 3 个工具到 ToolRegistry + CDP 协议集成 + 沙箱约束 |
| v0.3 | 2026-08-11 | GLM | 千问审查硬伤 3 修复：P2-1 Skills Loader 从 .json 文件改为 SKILL.md + meta.json 目录结构（与主文档 §7.1 一致）+ 两阶段加载 |

> **阅读约定**：同 P0 文档。接口签名是待实现契约，先改文档再改代码。

---

## 1. P2 任务总览

| 任务 | 学科 | 目标 | 依赖 |
|---|---|---|---|
| P2-1 | #6 Skills Engineering | 技能定义/注册/加载体系 | P0-4 |
| P2-2 | #7 MCP Integration | MCP 协议真实运行 | P2-1 |
| P2-3 | #16 Hooks & Lifecycle | 执行前后/工具前后钩子 | P0-4 |
| P2-4 | #17 Automation | 定时任务/触发器/批处理 | P0-3 |
| P2-5 | #11 Model Routing（策略） | 多模型路由/降级/成本控制 | P0-4 |
| P2-6 | #12 Eval（评估体系） | 轨迹评估/质量评分/回归测试 | P1-2 |
| P2-7 | Browser/Computer Use | 接入已有 browserbridge 代码 + 注册工具到 ToolRegistry + CDP 协议 + 沙箱约束 | P0-2/P1-1 |

---

## 2. P2-1：Skills Engineering

### 2.1 目标

建立技能（Skill）定义、注册、加载体系。技能 = 一组预定义的工具组合 + System Prompt 片段 + 推荐参数，让 Agent 在特定领域（如 GIS 分析、论文写作）有开箱即用的能力包。

### 2.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/skills/` | 新建目录 | 技能定义 |
| `core/internal/aiagent/skills/registry.go` | 新建 | 技能注册表 |
| `core/internal/aiagent/skills/loader.go` | 新建 | 技能加载器 |
| `core/internal/aiagent/context_builder.go` | 修改 | Build 时注入技能 prompt |

### 2.3 Skill 结构体

```go
package skills

// Skill 定义一个领域能力包
type Skill struct {
    ID          string            // 唯一标识，如 "gis-analysis"
    Name        string            // 显示名，如 "GIS 空间分析"
    Description string            // 描述
    Tools       []string          // 推荐工具列表
    PromptSnippet string          // 注入 system prompt 的片段
    Examples    []Example         // few-shot 示例
    DefaultArgs map[string]any    // 推荐默认参数
    Version     string
}

// Example 是一个 few-shot 示例
type Example struct {
    UserInput  string
    AssistantResponse string
    ToolCalls  []string
}
```

### 2.4 技能注册表

```go
type Registry struct {
    skills map[string]*Skill
    mu     sync.RWMutex
}

func NewRegistry() *Registry {
    return &Registry{skills: make(map[string]*Skill)}
}

func (r *Registry) Register(skill *Skill) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    if _, exists := r.skills[skill.ID]; exists {
        return fmt.Errorf("skill %q already registered", skill.ID)
    }
    r.skills[skill.ID] = skill
    return nil
}

func (r *Registry) Get(id string) (*Skill, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    skill, ok := r.skills[id]
    if !ok {
        return nil, fmt.Errorf("skill %q not found", id)
    }
    return skill, nil
}

func (r *Registry) List() []*Skill {
    r.mu.RLock()
    defer r.mu.RUnlock()
    result := make([]*Skill, 0, len(r.skills))
    for _, s := range r.skills {
        result = append(result, s)
    }
    return result
}
```

### 2.5 内置技能定义

| 技能 ID | 名称 | 推荐工具 | Prompt 片段要点 |
|---|---|---|---|
| `gis-analysis` | GIS 空间分析 | `run_python`, `read_file`, `create_artifact` | 优先用 Python 做空间运算，结果保存为 artifact |
| `paper-writing` | 论文写作 | `read_file`, `write_file`, `search_workspace` | LaTeX 格式，引用规范 |
| `code-review` | 代码审查 | `read_file`, `search_workspace` | 关注安全/性能/可读性 |
| `data-cleaning` | 数据清洗 | `run_python`, `read_file`, `write_file` | Pandas 优先，缺失值处理 |
| `report-generation` | 报告生成 | `create_artifact`, `write_file` | Markdown 格式，图表嵌入 |

### 2.6 技能加载器

> **【v0.3 修正 — 千问审查硬伤 3】**：v0.2 的 Loader 从目录加载 `.json` 文件，但主文档 §7.1 定义的技能结构是**目录 + SKILL.md + meta.json**（文件系统形式）。两者不兼容。v0.3 统一为主文档格式：每个技能是一个子目录，包含 `manifest/meta.json`（元数据）和 `skill/SKILL.md`（核心提示，含 frontmatter）。

**技能目录结构**（与主文档 §7.1 一致）：

```
skills/<skill-id>/
├── manifest/
│   ├── README.md       # 面向人类的技能描述
│   └── meta.json       # 元数据：name/version/description/tags/mode/dependencies
└── skill/
    ├── SKILL.md        # 核心提示（LLM 导向，含 frontmatter）
    └── <dir>/          # 参考资料、模板、脚本
```

**两阶段加载**（与主文档 §7.3 一致）：
- 阶段 1（启动时）：只读 `meta.json` 的 frontmatter（name/description/tags/mode）→ 构建技能索引
- 阶段 2（调用时）：按需加载 `SKILL.md` 全文 → 注入 System Prompt

```go
type Loader struct {
    rootDir string  // skills/ 根目录
    log     *zap.Logger
}

// SkillMeta 是 meta.json 的结构（阶段 1 只加载这个）
type SkillMeta struct {
    ID           string   `json:"id"`           // 如 "ndvi-timeseries"
    Name         string   `json:"name"`
    Version      string   `json:"version"`
    Description  string   `json:"description"`
    Tags         []string `json:"tags"`         // 用于匹配
    Mode         string   `json:"mode"`         // 适用模式：Work/Code/Paper/Analysis/Write
    Dependencies []string `json:"dependencies"` // 依赖的其他技能 ID
}

// Skill 是完整的技能（阶段 2 加载 SKILL.md 后填充 Prompt 字段）
type Skill struct {
    Meta     SkillMeta
    Prompt   string  // SKILL.md 全文（阶段 2 才填充）
    Dir      string  // 技能目录路径
    Loaded   bool    // 是否已加载全文
}

// LoadAllMeta 阶段 1：扫描 skills/ 下所有子目录，只读 meta.json
func (l *Loader) LoadAllMeta() ([]*Skill, error) {
    entries, err := os.ReadDir(l.rootDir)
    if err != nil {
        return nil, fmt.Errorf("read skills dir: %w", err)
    }

    var skills []*Skill
    for _, entry := range entries {
        if !entry.IsDir() {
            continue
        }
        skillDir := filepath.Join(l.rootDir, entry.Name())
        metaPath := filepath.Join(skillDir, "manifest", "meta.json")

        data, err := os.ReadFile(metaPath)
        if err != nil {
            l.log.Warn("failed to read skill meta",
                zap.String("skill", entry.Name()),
                zap.Error(err))
            continue
        }

        var meta SkillMeta
        if err := json.Unmarshal(data, &meta); err != nil {
            l.log.Warn("failed to parse skill meta",
                zap.String("skill", entry.Name()),
                zap.Error(err))
            continue
        }

        skills = append(skills, &Skill{
            Meta: meta,
            Dir:  skillDir,
        })
    }
    return skills, nil
}

// LoadFullContent 阶段 2：按需加载某个技能的 SKILL.md 全文
func (l *Loader) LoadFullContent(skill *Skill) error {
    skillMDPath := filepath.Join(skill.Dir, "skill", "SKILL.md")
    data, err := os.ReadFile(skillMDPath)
    if err != nil {
        return fmt.Errorf("read SKILL.md for %s: %w", skill.Meta.ID, err)
    }
    skill.Prompt = string(data)
    skill.Loaded = true
    return nil
}
```

### 2.7 ContextBuilder 集成

```go
// ContextBuilder 新增 skills 字段
type ContextBuilder struct {
    // ... 已有字段
    skills *skills.Registry
}

// Build 时注入技能 prompt
func (cb *ContextBuilder) Build(mode, prompt, memory string) ([]modelgateway.ChatMessage, []ToolDef) {
    systemPrompt := cb.planner.BuildSystemPrompt(mode, memory)

    // 注入技能 prompt 片段
    if cb.skills != nil {
        for _, skill := range cb.skills.List() {
            systemPrompt += "\n\n" + skill.PromptSnippet
        }
    }

    // ... 其余不变
}
```

### 2.8 API

```
GET  /api/agent/skills              列出所有技能
GET  /api/agent/skills/{id}         获取技能详情
POST /api/agent/skills              注册新技能
DELETE /api/agent/skills/{id}       删除技能
```

### 2.9 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 5 个内置技能注册成功 | `GET /api/agent/skills` 返回 5 条 |
| 2 | 技能 prompt 注入 system prompt | 检查 Build 返回的 system 消息包含技能片段 |
| 3 | 技能推荐工具列表生效 | 使用 `gis-analysis` 技能时 tool defs 包含 `run_python` |
| 4 | 技能可从文件加载 | 在 skills 目录放 JSON 文件，重启后自动加载 |
| 5 | 技能可动态注册 | `POST /api/agent/skills` 后立即可用 |

---

## 3. P2-2：MCP Integration

### 3.1 目标

实现 Model Context Protocol 真实运行，让 Agent 能连接外部 MCP 服务器，调用其提供的工具和资源。

### 3.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/mcp/client.go` | 新建 | MCP 客户端 |
| `core/internal/mcp/transport.go` | 新建 | 传输层（stdio/SSE） |
| `core/internal/aiagent/orchestrator.go` | 修改 | 集成 MCP 工具到 ToolRegistry |

### 3.3 MCP 客户端

```go
package mcp

// Client 连接 MCP 服务器
type Client struct {
    transport Transport
    serverInfo *ServerInfo
    tools     []MCPTool
    log       *zap.Logger
}

// Transport 定义传输层接口
type Transport interface {
    Connect() error
    Send(request []byte) ([]byte, error)
    Close() error
}

// StdioTransport 通过 stdio 与 MCP 服务器通信
type StdioTransport struct {
    cmd  *exec.Cmd
    stdin  io.WriteCloser
    stdout io.ReadCloser
}

// ServerInfo MCP 服务器信息
type ServerInfo struct {
    Name    string
    Version string
    Tools   []MCPTool
}

// MCPTool MCP 服务器提供的工具
type MCPTool struct {
    Name        string
    Description string
    InputSchema map[string]any
}

// Connect 连接 MCP 服务器并发现工具
func (c *Client) Connect() error {
    if err := c.transport.Connect(); err != nil {
        return err
    }
    // 发送 initialize 请求
    resp, err := c.sendRequest("initialize", map[string]any{
        "protocolVersion": "2024-11-05",
        "clientInfo": map[string]any{
            "name": "GeoWork", "version": "1.0",
        },
    })
    if err != nil {
        return err
    }
    // 解析服务器信息 + 工具列表
    return c.parseServerInfo(resp)
}

// CallTool 调用 MCP 服务器上的工具
func (c *Client) CallTool(ctx context.Context, name string, args map[string]any) (map[string]any, error) {
    resp, err := c.sendRequest("tools/call", map[string]any{
        "name": name,
        "arguments": args,
    })
    if err != nil {
        return nil, err
    }
    var result map[string]any
    json.Unmarshal(resp, &result)
    return result, nil
}
```

### 3.4 MCP 工具适配器

```go
// MCPToolAdapter 将 MCP 工具适配为 ToolRegistry 的 Tool 接口
type MCPToolAdapter struct {
    client   *mcp.Client
    toolName string
    tool     mcp.MCPTool
}

func (a *MCPToolAdapter) Name() string { return a.toolName }
func (a *MCPToolAdapter) Description() string { return a.tool.Description }
func (a *MCPToolAdapter) InputSchema() map[string]any { return a.tool.InputSchema }
func (a *MCPToolAdapter) Permission() string { return "read" }  // MCP 默认 read
func (a *MCPToolAdapter) RiskLevel() string { return "medium" }
func (a *MCPToolAdapter) Sandbox() bool { return false }

func (a *MCPToolAdapter) Execute(ctx context.Context, args map[string]any) (map[string]any, error) {
    return a.client.CallTool(ctx, a.tool.Name, args)
}
```

### 3.5 集成到 ToolRegistry

```go
// Orchestrator 启动时连接 MCP 服务器并注册工具
func (o *Orchestrator) connectMCP(configs []MCPConfig) error {
    for _, cfg := range configs {
        client := mcp.NewClient(cfg.Transport, o.log)
        if err := client.Connect(); err != nil {
            o.log.Warn("MCP connect failed", zap.String("server", cfg.Name), zap.Error(err))
            continue
        }
        // 注册 MCP 工具到 ToolRegistry
        for _, tool := range client.Tools() {
            adapter := &MCPToolAdapter{client: client, toolName: cfg.Name+"_"+tool.Name, tool: tool}
            o.registry.Register(adapter)
        }
    }
    return nil
}
```

### 3.6 MCP 配置

```json
// config/mcp_servers.json
{
  "servers": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    {
      "name": "github",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  ]
}
```

### 3.7 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | MCP 客户端能连接 stdio 服务器 | 启动 filesystem MCP 服务器，Connect 成功 |
| 2 | MCP 工具自动注册到 ToolRegistry | 连接后 `registry.List()` 包含 MCP 工具 |
| 3 | MCP 工具可被 Agent 调用 | ReAct 循环中模型选择 MCP 工具并执行 |
| 4 | MCP 服务器断开时优雅降级 | 杀死 MCP 进程后工具调用返回错误，不崩溃 |

---

## 4. P2-3：Hooks & Lifecycle

### 4.1 目标

实现生命周期钩子，允许在 ReAct 循环的关键节点插入自定义逻辑（如日志、审计、自动审批规则）。

### 4.2 钩子点定义

| 钩子点 | 时机 | 用途 |
|---|---|---|
| `OnRunStart` | Run 开始前 | 初始化资源、记录审计 |
| `OnRunEnd` | Run 结束后 | 清理资源、发送通知 |
| `OnTurnStart` | 每轮 ReAct 循环开始前 | 检查预算、限流 |
| `OnTurnEnd` | 每轮 ReAct 循环结束后 | 记录 Trajectory |
| `OnToolBefore` | 工具执行前 | 自动审批规则、参数修改 |
| `OnToolAfter` | 工具执行后 | 结果后处理、缓存 |
| `OnModelCall` | 模型调用前后 | 请求/响应记录、缓存 |

### 4.3 Hook 接口

```go
package aiagent

// Hook 生命周期钩子接口
type Hook interface {
    Name() string
    OnRunStart(ctx *HookContext) error
    OnRunEnd(ctx *HookContext) error
    OnTurnStart(ctx *HookContext) error
    OnTurnEnd(ctx *HookContext) error
    OnToolBefore(ctx *HookContext) error
    OnToolAfter(ctx *HookContext) error
}

// HookContext 传递给钩子的上下文
type HookContext struct {
    RunID      string
    Run        *Run
    RunCtx     *RunContext
    TurnIndex  int
    ToolName   string
    ToolArgs   map[string]any
    ToolResult map[string]any
    ToolError  error
    Cancel     context.CancelFunc  // 钩子可取消执行
}
```

### 4.4 Hook 注册

```go
// Orchestrator 新增 hooks 字段
type Orchestrator struct {
    // ... 已有字段
    hooks []Hook
}

func (o *Orchestrator) RegisterHook(hook Hook) {
    o.hooks = append(o.hooks, hook)
}

// 执行钩子
func (o *Orchestrator) runHooks(event string, ctx *HookContext) {
    for _, hook := range o.hooks {
        var err error
        switch event {
        case "OnRunStart":
            err = hook.OnRunStart(ctx)
        case "OnRunEnd":
            err = hook.OnRunEnd(ctx)
        case "OnTurnStart":
            err = hook.OnTurnStart(ctx)
        case "OnTurnEnd":
            err = hook.OnTurnEnd(ctx)
        case "OnToolBefore":
            err = hook.OnToolBefore(ctx)
        case "OnToolAfter":
            err = hook.OnToolAfter(ctx)
        }
        if err != nil {
            o.log.Warn("hook failed", zap.String("hook", hook.Name()), zap.String("event", event), zap.Error(err))
        }
    }
}
```

### 4.5 内置 Hook 示例

```go
// AuditHook 审计日志钩子
type AuditHook struct {
    log *zap.Logger
}

func (h *AuditHook) OnToolBefore(ctx *HookContext) error {
    h.log.Info("tool executing",
        zap.String("runID", ctx.RunID),
        zap.String("tool", ctx.ToolName),
        zap.Any("args", ctx.ToolArgs),
    )
    return nil
}

// AutoApproveHook 自动审批规则钩子
type AutoApproveHook struct {
    rules []AutoApproveRule
}

type AutoApproveRule struct {
    ToolName string
    MatchArgs map[string]any  // 匹配的参数
}

func (h *AutoApproveHook) OnToolBefore(ctx *HookContext) error {
    for _, rule := range h.rules {
        if rule.ToolName == ctx.ToolName && matchArgs(rule.MatchArgs, ctx.ToolArgs) {
            // 自动批准
            return nil
        }
    }
    return nil
}
```

### 4.6 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 6 个钩子点都能触发 | 注册一个打印日志的 Hook，验证每个点都打印 |
| 2 | Hook 可取消执行 | Hook 调用 `ctx.Cancel()` 后 Run 停止 |
| 3 | Hook 错误不影响主流程 | Hook 返回 error 时 ReAct 循环继续 |
| 4 | 多个 Hook 按注册顺序执行 | 注册 3 个 Hook，验证执行顺序 |

---

## 5. P2-4：Automation

### 5.1 目标

实现定时任务、事件触发器、批处理，让 Agent 能自动化执行重复性工作。

### 5.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/scheduler.go` | 新建 | 定时调度器 |
| `core/internal/aiagent/trigger.go` | 新建 | 事件触发器 |

### 5.3 定时任务

```go
// ScheduledTask 定时任务
type ScheduledTask struct {
    ID        string
    Name      string
    Cron      string          // cron 表达式
    Mode      string          // Agent Mode
    Prompt    string          // 任务 prompt
    Enabled   bool
    LastRun   time.Time
    NextRun   time.Time
}

// Scheduler 定时调度器
type Scheduler struct {
    tasks   map[string]*ScheduledTask
    orch    *Orchestrator
    log     *zap.Logger
    stopCh  chan struct{}
}

func (s *Scheduler) Start() {
    ticker := time.NewTicker(time.Minute)
    for {
        select {
        case <-ticker.C:
            s.checkAndRun()
        case <-s.stopCh:
            ticker.Stop()
            return
        }
    }
}

func (s *Scheduler) checkAndRun() {
    now := time.Now()
    for _, task := range s.tasks {
        if !task.Enabled {
            continue
        }
        if now.After(task.NextRun) {
            // 触发 Agent Run
            s.orch.StartRun(context.Background(), task.Mode, task.Prompt)
            task.LastRun = now
            task.NextRun = s.calculateNext(task.Cron, now)
        }
    }
}
```

### 5.4 事件触发器

```go
// Trigger 事件触发器
type Trigger struct {
    ID       string
    Event    string  // 触发事件类型，如 "file_changed"
    Pattern  string  // 匹配模式，如 "*.py"
    Mode     string
    Prompt   string
}

// TriggerManager 触发器管理
type TriggerManager struct {
    triggers map[string]*Trigger
    orch     *Orchestrator
    log      *zap.Logger
}

// HandleEvent 处理事件
func (tm *TriggerManager) HandleEvent(event string, data map[string]any) {
    for _, trigger := range tm.triggers {
        if trigger.Event == event {
            // 匹配模式
            if path, ok := data["path"].(string); ok {
                if matched, _ := filepath.Match(trigger.Pattern, path); matched {
                    prompt := fmt.Sprintf(trigger.Prompt, data)
                    tm.orch.StartRun(context.Background(), trigger.Mode, prompt)
                }
            }
        }
    }
}
```

### 5.5 API

```
GET    /api/agent/schedule              列出定时任务
POST   /api/agent/schedule              创建定时任务
PUT    /api/agent/schedule/{id}         更新定时任务
DELETE /api/agent/schedule/{id}         删除定时任务
GET    /api/agent/triggers              列出触发器
POST   /api/agent/triggers              创建触发器
```

### 5.6 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 定时任务按 cron 触发 | 设置每分钟触发的任务，1 分钟后验证 Run 创建 |
| 2 | 定时任务可禁用 | `Enabled=false` 时不触发 |
| 3 | 事件触发器响应文件变更 | 文件变更后触发对应 Trigger |
| 4 | 定时任务可动态创建 | `POST /api/agent/schedule` 后立即可用 |

---

## 6. P2-5：Model Routing 策略

### 6.1 目标

实现多模型路由、降级策略、成本控制，让不同任务用不同模型，失败时自动降级。

### 6.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/modelgateway/router.go` | 新建 | 模型路由器 |
| `core/internal/modelgateway/providers.go` | 修改 | 多 provider 支持 |
| `core/internal/aiagent/orchestrator.go` | 修改 | 用 Router 替代直接 gateway |

### 6.3 路由策略

```go
// Router 多模型路由器
type Router struct {
    providers map[string]*ModelProvider  // providerID → provider
    rules     []RoutingRule
    log       *zap.Logger
}

// RoutingRule 路由规则
type RoutingRule struct {
    Mode         string   // 匹配的 Mode
    TaskType     string   // 匹配的任务类型（planning/execution/summary）
    ProviderID   string   // 使用的 provider
    FallbackID   string   // 降级 provider
    MaxRetries   int
}

// Route 根据规则选择 provider
func (r *Router) Route(mode, taskType string) (*ModelProvider, error) {
    for _, rule := range r.rules {
        if rule.Mode == mode && rule.TaskType == taskType {
            provider, ok := r.providers[rule.ProviderID]
            if !ok {
                // 降级
                if rule.FallbackID != "" {
                    return r.providers[rule.FallbackID], nil
                }
                return nil, fmt.Errorf("provider %q not found", rule.ProviderID)
            }
            return provider, nil
        }
    }
    // 默认 provider
    return r.providers["default"], nil
}

// ChatWithFallback 带降级的聊天
func (r *Router) ChatWithFallback(ctx context.Context, mode, taskType string, messages []ChatMessage, tools []ToolDef) (*ChatCompletionResponse, error) {
    rule := r.findRule(mode, taskType)

    // 尝试主 provider
    provider, err := r.Route(mode, taskType)
    if err != nil {
        return nil, err
    }

    client := NewOpenAICompatibleClient(provider, r.log)
    resp, err := client.Chat(ctx, messages, tools, false)

    // 降级
    if err != nil && rule != nil && rule.FallbackID != "" {
        r.log.Warn("primary provider failed, falling back",
            zap.String("primary", rule.ProviderID),
            zap.String("fallback", rule.FallbackID),
            zap.Error(err),
        )
        fallback := r.providers[rule.FallbackID]
        fallbackClient := NewOpenAICompatibleClient(fallback, r.log)
        return fallbackClient.Chat(ctx, messages, tools, false)
    }

    return resp, err
}
```

### 6.4 成本控制

```go
// CostController 成本控制器
type CostController struct {
    dailyBudget    float64  // 每日预算（美元）
    monthlyBudget  float64  // 每月预算
    currentDaily   float64
    currentMonthly float64
    mu             sync.Mutex
}

func (c *CostController) CheckBudget(cost float64) error {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.currentDaily+cost > c.dailyBudget {
        return fmt.Errorf("daily budget exceeded: %.2f + %.2f > %.2f", c.currentDaily, cost, c.dailyBudget)
    }
    return nil
}

func (c *CostController) Record(cost float64) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.currentDaily += cost
    c.currentMonthly += cost
}
```

### 6.5 路由规则配置

```json
// config/model_routing.json
{
  "rules": [
    {
      "mode": "Code",
      "taskType": "planning",
      "provider": "openai-gpt4",
      "fallback": "anthropic-claude",
      "maxRetries": 2
    },
    {
      "mode": "Work",
      "taskType": "execution",
      "provider": "openai-gpt4-mini",
      "fallback": "local-llama",
      "maxRetries": 3
    }
  ]
}
```

### 6.6 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 不同 Mode 用不同 provider | Code 模式用 gpt4，Work 模式用 gpt4-mini |
| 2 | 主 provider 失败时降级 | mock 主 provider 超时，验证降级到 fallback |
| 3 | 超日预算时拒绝调用 | 设置低预算，验证返回 budget exceeded |
| 4 | 路由规则可配置 | 修改 JSON 配置后路由策略变化 |

---

## 7. P2-6：Eval 评估体系

### 7.1 目标

建立轨迹评估、质量评分、回归测试体系，让 Agent 的行为可度量、可比较、可改进。

### 7.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/aiagent/eval/` | 新建目录 | 评估体系 |
| `core/internal/aiagent/eval/scorer.go` | 新建 | 质量评分器 |
| `core/internal/aiagent/eval/regression.go` | 新建 | 回归测试 |

### 7.3 评估指标

| 指标 | 计算方式 | 说明 |
|---|---|---|
| `task_success_rate` | 成功 Run 数 / 总 Run 数 | 任务完成率 |
| `avg_turns` | 总轮数 / 总 Run 数 | 平均 ReAct 轮数 |
| `avg_tool_calls` | 总工具调用数 / 总 Run 数 | 平均工具调用数 |
| `tool_error_rate` | 失败工具调用数 / 总工具调用数 | 工具错误率 |
| `avg_token_usage` | 总 token 数 / 总 Run 数 | 平均 token 消耗 |
| `avg_duration` | 总时长 / 总 Run 数 | 平均执行时长 |
| `user_approval_rate` | 批准数 / 审批总数 | 用户审批通过率 |

### 7.4 质量评分器

```go
package eval

// QualityScore 质量评分
type QualityScore struct {
    RunID         string
    TaskSuccess   bool
    Turns         int
    ToolCalls     int
    ToolErrors    int
    TokenUsage    int
    Duration      time.Duration
    Score         float64  // 0-100 综合分
}

// Scorer 质量评分器
type Scorer struct {
    log *zap.Logger
}

// Score 对一次 Run 评分
func (s *Scorer) Score(traj *aiagent.Trajectory) *QualityScore {
    score := &QualityScore{
        RunID: traj.RunID,
    }

    for _, turn := range traj.Turns {
        score.Turns++
        score.ToolCalls += len(turn.ToolCalls)
        for _, tc := range turn.ToolCalls {
            if tc.Error != "" {
                score.ToolErrors++
            }
        }
        if turn.TokenUsage != nil {
            score.TokenUsage += turn.TokenUsage.TotalTokens
        }
    }

    // 计算综合分
    score.Score = s.calculateScore(score)
    return score
}

func (s *Scorer) calculateScore(score *QualityScore) float64 {
    var s100 float64 = 100
    // 任务成功 +40
    if score.TaskSuccess {
        s100 += 0
    } else {
        s100 -= 40
    }
    // 轮数惩罚（>10 轮扣分）
    if score.Turns > 10 {
        s100 -= float64(score.Turns-10) * 2
    }
    // 工具错误率惩罚
    if score.ToolCalls > 0 {
        errorRate := float64(score.ToolErrors) / float64(score.ToolCalls)
        s100 -= errorRate * 30
    }
    // token 惩罚（>50000 扣分）
    if score.TokenUsage > 50000 {
        s100 -= float64(score.TokenUsage-50000) / 10000
    }
    if s100 < 0 {
        s100 = 0
    }
    return s100
}
```

### 7.5 回归测试

```go
// RegressionTest 回归测试用例
type RegressionTest struct {
    ID       string
    Name     string
    Mode     string
    Prompt   string
    Expected ExpectedResult
}

type ExpectedResult struct {
    Success     bool
    MaxTurns    int
    MustContain string  // 结果必须包含的文本
    MustCallTools []string  // 必须调用的工具
}

// RunRegressionTests 运行回归测试
func RunRegressionTests(orch *aiagent.Orchestrator, tests []RegressionTest) []TestResult {
    var results []TestResult
    for _, test := range tests {
        run, err := orch.StartRun(context.Background(), test.Mode, test.Prompt)
        if err != nil {
            results = append(results, TestResult{TestID: test.ID, Passed: false, Error: err.Error()})
            continue
        }
        orch.WaitForRun(run.ID)
        // 检查结果
        passed := checkResult(run, test.Expected)
        results = append(results, TestResult{TestID: test.ID, Passed: passed})
    }
    return results
}
```

### 7.6 API

```
GET /api/agent/eval/scores            获取所有 Run 的评分
GET /api/agent/eval/scores/{runId}    获取指定 Run 的评分
GET /api/agent/eval/metrics           获取聚合指标
POST /api/agent/eval/regression/run   运行回归测试
GET /api/agent/eval/regression/results  获取回归测试结果
```

### 7.7 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | 每个 Run 有质量评分 | `GET /api/agent/eval/scores/run_xxx` 返回分数 |
| 2 | 聚合指标正确 | `GET /api/agent/eval/metrics` 返回 7 个指标 |
| 3 | 回归测试可执行 | `POST /api/agent/eval/regression/run` 运行测试套件 |
| 4 | 回归测试结果可查询 | `GET /api/agent/eval/regression/results` 返回通过/失败 |
| 5 | 评分算法合理 | 成功 Run 分数 > 失败 Run 分数 |

---

## 8. P2-7：Browser / Computer Use（浏览器/GUI 操控）

### 8.1 目标

将已有的 `browserbridge` 模块接入 Agent 工具链：把 Controller 的会话管理、导航、截图、论文搜索能力注册为 ToolRegistry 工具，让 ReAct 循环中的模型可以自主调用浏览器能力。

**现状问题**（v0.2 诊断）：
- `core/internal/browserbridge/` 已有 6 个 Go 文件（controller/session/network/screenshot/paper_search/routes）
- `tool_policy.go` 已定义 `browser_control`/`screenshot`/`network_request` 三个工具的策略（RiskLevel/Approval/限频）
- 但 `builtin_tools.go` **未注册这三个工具**——策略定义了、代码写了，但 Agent 调不到
- 这是与 executor/context_builder 同类的"死代码"问题

### 8.2 涉及文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `core/internal/toolregistry/builtin_tools.go` | 修改 | 新增 3 个浏览器工具注册 |
| `core/internal/browserbridge/controller.go` | 修改 | 暴露 Execute 方法供工具调用 |
| `core/internal/browserbridge/cdp_adapter.go` | 新建 | CDP 协议适配器（真实浏览器操控） |
| `core/internal/aiagent/state_machine.go` | 修改 | 白名单新增 browser_control/screenshot/network_request |
| `core/internal/sandbox/` | 修改 | 浏览器沙箱约束（URL 白名单/下载路径限制） |

### 8.3 工具清单

| 工具名 | 风险等级 | 需审批 | 对应 Controller 方法 | 说明 |
|---|---|---|---|---|
| `browser_control` | High | ✅ | Navigate/GoBack/GoForward/Refresh/CreateSession/DeleteSession | 浏览器会话管理与导航 |
| `screenshot` | Medium | ❌ | CaptureScreenshot/ExtractText | 截图 + OCR 文本提取 |
| `network_request` | High | ✅ | （新增）HTTPRequest | 发起 HTTP 请求并记录网络日志 |

### 8.4 工具注册（builtin_tools.go 改动）

```go
// browser_control 工具
NewBuilder("browser_control").
    Description("Control a browser session: navigate, go back/forward, refresh, create/delete session.").
    InputSchema(map[string]any{
        "type": "object",
        "properties": map[string]any{
            "action": map[string]any{
                "type": "string",
                "enum": []string{"navigate", "back", "forward", "refresh", "create_session", "delete_session"},
                "description": "Browser action to perform",
            },
            "sessionId": map[string]any{"type": "string", "description": "Browser session ID (required for navigate/back/forward/refresh/delete)"},
            "url":       map[string]any{"type": "string", "description": "URL to navigate to (required for navigate action)"},
        },
        "required": []string{"action"},
    }).
    Permission("exec").
    RiskLevel("high").
    Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
        action, _ := args["action"].(string)
        switch action {
        case "create_session":
            sess := browserCtrl.CreateSession()
            return map[string]any{"sessionId": sess.ID, "url": sess.URL}, nil
        case "navigate":
            sessionID, _ := args["sessionId"].(string)
            url, _ := args["url"].(string)
            if err := browserCtrl.Navigate(sessionID, url); err != nil {
                return nil, err
            }
            sess, _ := browserCtrl.GetSession(sessionID)
            return map[string]any{"sessionId": sessionID, "url": url, "title": sess.Title}, nil
        case "back":
            sessionID, _ := args["sessionId"].(string)
            browserCtrl.GoBack(sessionID)
            return map[string]any{"sessionId": sessionID, "action": "back"}, nil
        case "forward":
            sessionID, _ := args["sessionId"].(string)
            browserCtrl.GoForward(sessionID)
            return map[string]any{"sessionId": sessionID, "action": "forward"}, nil
        case "refresh":
            sessionID, _ := args["sessionId"].(string)
            browserCtrl.Refresh(sessionID)
            return map[string]any{"sessionId": sessionID, "action": "refresh"}, nil
        case "delete_session":
            sessionID, _ := args["sessionId"].(string)
            browserCtrl.DeleteSession(sessionID)
            return map[string]any{"sessionId": sessionID, "deleted": true}, nil
        default:
            return nil, fmt.Errorf("unknown browser action: %s", action)
        }
    }).
    Build(),

// screenshot 工具
NewBuilder("screenshot").
    Description("Capture a screenshot of the browser page and optionally extract text via OCR.").
    InputSchema(map[string]any{
        "type": "object",
        "properties": map[string]any{
            "sessionId": map[string]any{"type": "string", "description": "Browser session ID"},
            "format":    map[string]any{"type": "string", "enum": []string{"png", "jpeg"}, "description": "Image format"},
            "extractText": map[string]any{"type": "boolean", "description": "Whether to extract text from the page"},
        },
        "required": []string{"sessionId"},
    }).
    Permission("read").
    RiskLevel("medium").
    Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
        sessionID, _ := args["sessionId"].(string)
        format, _ := args["format"].(string)
        if format == "" {
            format = "png"
        }
        sess, err := browserCtrl.GetSession(sessionID)
        if err != nil {
            return nil, err
        }
        // 截图（需要 CDP 适配器真实运行，当前为 mock）
        data, w, h, err := sess.Browser.CaptureScreenshot(ctx, sess.Page, format, 80)
        if err != nil {
            return nil, err
        }
        result := map[string]any{
            "sessionId": sessionID,
            "width":     w,
            "height":    h,
            "imageBase64": base64.StdEncoding.EncodeToString(data),
        }
        if extract, _ := args["extractText"].(bool); extract {
            text, _ := sess.Browser.ExtractText(sess.Page)
            result["text"] = text
        }
        return result, nil
    }).
    Build(),

// network_request 工具
NewBuilder("network_request").
    Description("Send an HTTP request and log it to the browser session's network history.").
    InputSchema(map[string]any{
        "type": "object",
        "properties": map[string]any{
            "url":    map[string]any{"type": "string", "description": "Request URL"},
            "method": map[string]any{"type": "string", "enum": []string{"GET", "POST", "PUT", "DELETE"}, "description": "HTTP method"},
            "headers": map[string]any{"type": "object", "description": "Request headers"},
            "body":    map[string]any{"type": "string", "description": "Request body"},
        },
        "required": []string{"url", "method"},
    }).
    Permission("exec").
    RiskLevel("high").
    Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
        url, _ := args["url"].(string)
        method, _ := args["method"].(string)
        // 沙箱检查：URL 必须通过白名单
        if err := sandbox.CheckURLAllowed(url); err != nil {
            return nil, fmt.Errorf("URL blocked by sandbox: %w", err)
        }
        // 发起请求
        req, _ := http.NewRequestWithContext(ctx, method, url, nil)
        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            return nil, err
        }
        defer resp.Body.Close()
        body, _ := io.ReadAll(resp.Body)
        return map[string]any{
            "status":   resp.StatusCode,
            "headers":  resp.Header,
            "body":     string(body),
            "bodySize": len(body),
        }, nil
    }).
    Build(),
```

### 8.5 状态机白名单对齐

`state_machine.go` 的 `allowed` 白名单需新增（P0-2 对齐的延伸）：

```go
// 在 StateInspecting / StateExecuting 状态的 allowed 列表新增：
"browser_control",   // High risk, 需审批
"screenshot",        // Medium risk, 无需审批
"network_request",   // High risk, 需审批
```

### 8.6 CDP 协议适配器（新建 cdp_adapter.go）

当前 `BrowserInterface` 是接口，`Session.Browser` 字段类型为 `BrowserInterface`。需要一个真实的 CDP 适配器实现：

```go
// CDPAdapter 通过 Chrome DevTools Protocol 操控真实浏览器
type CDPAdapter struct {
    browser *chromedp.Context  // 或 rod.Browser，取决于依赖选择
    log     *zap.Logger
}

// 实现 BrowserInterface
func (a *CDPAdapter) CaptureScreenshot(ctx context.Context, page interface{}, format string, quality int) ([]byte, int, int, error) {
    // chromedp.Screenshot
    var buf []byte
    if err := chromedp.Run(ctx, chromedp.CaptureScreenshot(&buf)); err != nil {
        return nil, 0, 0, err
    }
    // 解析尺寸（从 PNG header）
    w, h := parseImageSize(buf, format)
    return buf, w, h, nil
}

func (a *CDPAdapter) ExtractText(page interface{}) (string, error) {
    // chromedp.ActionFunc 获取页面文本
    var text string
    if err := chromedp.Run(ctx, chromedp.Text("body", &text)); err != nil {
        return "", err
    }
    return text, nil
}
```

**依赖选择**（待决策）：
- `chromedp`：纯 Go，CDP 协议直接对接，无外部依赖，但 API 较底层
- `rod`：纯 Go，封装更友好，社区活跃
- 建议：`chromedp`（与 Go 生态对齐，无额外二进制依赖）

### 8.7 沙箱约束

浏览器工具的安全边界：

| 约束 | 实现位置 | 规则 |
|---|---|---|
| URL 白名单 | `sandbox/check_url.go`（新建） | 默认允许 http/https，禁止 file://、localhost 内网地址（可配置） |
| 下载路径限制 | `sandbox/download_path.go` | 浏览器下载文件只能写入沙箱工作目录的 `downloads/` 子目录 |
| 截图尺寸限制 | 工具 Execute 内 | 单张截图 ≤ 2MB，超出则缩放 |
| 会话数量限制 | Controller | 单 Run 最多 3 个并发浏览器会话 |
| 超时 | Controller | 单次导航超时 30s，会话空闲超时 10min |

### 8.8 论文搜索工具化（可选）

`paper_search.go` 已有 `PaperSearch` 和 `OpenAlexSearch` 函数，可作为第 4 个工具注册：

```go
// paper_search 工具（可选，优先级低于上述 3 个）
NewBuilder("paper_search").
    Description("Search academic papers via OpenAlex or other sources.").
    InputSchema(map[string]any{
        "type": "object",
        "properties": map[string]any{
            "query": map[string]any{"type": "string", "description": "Search query"},
            "source": map[string]any{"type": "string", "enum": []string{"openalex", "semantic_scholar"}, "description": "Search source"},
            "limit":  map[string]any{"type": "integer", "description": "Max results (default 10)"},
        },
        "required": []string{"query"},
    }).
    Permission("read").
    RiskLevel("low").
    Execute(func(ctx context.Context, args map[string]any) (map[string]any, error) {
        query, _ := args["query"].(string)
        source, _ := args["source"].(string)
        if source == "" {
            source = "openalex"
        }
        limit := 10
        if l, ok := args["limit"].(int); ok && l > 0 {
            limit = l
        }
        results, err := browserbridge.OpenAlexSearch(ctx, query, limit)
        if err != nil {
            return nil, err
        }
        return map[string]any{"results": results, "count": len(results)}, nil
    }).
    Build(),
```

### 8.9 数据流

```
模型返回 tool_call: browser_control(navigate, url)
  → 状态机检查（StateInspecting 允许 browser_control）
  → Governor 审批（High risk → 发送 approval_request 事件）
    → 用户批准 → 继续
    → 用户拒绝 → 返回拒绝消息给模型
  → 沙箱 URL 检查（CheckURLAllowed）
  → Controller.Navigate(sessionID, url)
  → 返回结果 {sessionId, url, title}
  → Memory.AppendToolResult()
  → 下一轮 ReAct

模型返回 tool_call: screenshot(sessionId, extractText=true)
  → 状态机检查（StateInspecting 允许 screenshot）
  → Governor 审批（Medium risk → 无需审批，直接执行）
  → CDPAdapter.CaptureScreenshot()
  → CDPAdapter.ExtractText()
  → 返回结果 {imageBase64, width, height, text}
  → 下一轮 ReAct
```

### 8.10 验收标准

| # | 检查项 | 验证方法 |
|---|---|---|
| 1 | browser_control 工具已注册 | `registry.List()` 包含 `browser_control` |
| 2 | screenshot 工具已注册 | `registry.List()` 包含 `screenshot` |
| 3 | network_request 工具已注册 | `registry.List()` 包含 `network_request` |
| 4 | 状态机白名单包含三个工具 | `ToolIsAllowed(StateInspecting, "browser_control")` 返回 true |
| 5 | browser_control 触发审批 | 执行 navigate 时前端收到 `approval_request` 事件 |
| 6 | screenshot 不触发审批 | 执行截图时无审批事件，直接返回结果 |
| 7 | URL 沙箱约束生效 | navigate 到 `file:///etc/passwd` 被拒绝 |
| 8 | 会话管理正确 | create_session → navigate → screenshot → delete_session 全链路通过 |
| 9 | CDP 真实截图 | 截图返回非空 base64 数据，可解码为图片 |
| 10 | OCR 文本提取 | extractText=true 时返回非空 text 字段 |

---

## 变更记录

### v0.3（2026-08-11）— GLM 千问审查硬伤 3 修复

**变更**
1. **硬伤 3 修复**（§2.6）：P2-1 Skills Loader 从 `.json` 文件改为 `SKILL.md + meta.json` 目录结构。原来与主文档 §7.1 矛盾（主文档定义目录结构，P2-1 设计了 JSON 文件）。统一为主文档格式：`skills/<skill-id>/manifest/meta.json` + `skill/SKILL.md` + 两阶段加载（LoadAllMeta + LoadFullContent）。

### v0.2（2026-08-11）— GLM 补充 Browser/Computer Use

**背景**：豆包-code 审查发现 14 个核心模块中唯独 Browser/Computer Use 没有详细设计。经核实，`browserbridge/` 已有 6 个 Go 文件、`tool_policy.go` 已有 3 个工具策略定义，但 `builtin_tools.go` 未注册——又是死代码。补充 P2-7 将其接入工具链。

**变更**
1. 新增第 8 节 P2-7 Browser/Computer Use：3 个工具注册（browser_control/screenshot/network_request）+ 状态机白名单对齐 + CDP 适配器 + 沙箱约束 + 数据流 + 10 条验收标准
2. 可选第 4 个工具 paper_search（已有 OpenAlexSearch 函数）
3. 版本表新增 v0.2，任务总览新增 P2-7 行

### v0.1（2026-08-11）— GLM 初稿

**变更**
1. P2-1 Skills Engineering：Skill 结构体 + 注册表 + 加载器 + 5 个内置技能 + ContextBuilder 集成
2. P2-2 MCP Integration：MCP 客户端 + stdio 传输 + 工具适配器 + ToolRegistry 集成 + 配置文件
3. P2-3 Hooks & Lifecycle：6 个钩子点 + Hook 接口 + 注册机制 + 内置 Hook 示例
4. P2-4 Automation：定时任务调度器 + 事件触发器 + API
5. P2-5 Model Routing 策略：多 provider 路由 + 降级 + 成本控制 + 配置文件
6. P2-6 Eval 评估体系：7 个评估指标 + 质量评分器 + 回归测试 + API
