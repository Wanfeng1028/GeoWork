# GeoWork 通信协议规范

> **文档路径**：`doc/GeoWork-Communication-Protocol.md`
> **关联文档**：`doc/GeoWorkAgent.md`（Agent 架构宪法）/ `doc/GeoWorkAgent-P1-Detailed-Design.md`（P1 施工）/ `doc/GeoWorkFrontend-Engineering-Standards.md`（前端工程规范）
> **协议定义权**：后端（Go Core）主导协议设计，前端按协议实现消费端
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：SSE + WebSocket 双通道架构、JSON-RPC 2.0 消息格式、审批流协议、Method 定义、异常处理 |

---

## 1. 架构定位：双通道分层

不替换 SSE，而是分层——SSE 和 WebSocket 各司其职：

```
┌─────────────────────────────────────────────────────┐
│                    前端 (Electron)                    │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │  SSE 通道    │         │  WebSocket 通道       │  │
│  │  (只读流)    │         │  (双向控制信令)        │  │
│  │              │         │                      │  │
│  │ • Agent 思考  │         │ • approval/request   │  │
│  │ • 工具执行日志│         │ • approval/response  │  │
│  │ • 长文本输出  │         │ • run/abort          │  │
│  │ • 状态变更    │         │ • terminal/input     │  │
│  └──────┬───────┘         │ • terminal/output    │  │
│         │                 │ • ping/pong          │  │
│         │                 └──────────┬───────────┘  │
└─────────┼────────────────────────────┼──────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────────────────────────────────────┐
│                   Go Core (后端)                      │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │ SSE Handler  │         │  WS Handler           │  │
│  │ /api/stream  │         │  /api/ws              │  │
│  └──────────────┘         └──────────────────────┘  │
│         │                            │               │
│         ▼                            ▼               │
│  ┌─────────────────────────────────────────────┐    │
│  │           Orchestrator (ReAct Loop)          │    │
│  │                                             │    │
│  │  StateRunning ──→ StateWaitingForUser       │    │
│  │       │                │                    │    │
│  │       │                ▼                    │    │
│  │       │         ws.SendRequest()            │    │
│  │       │         ws.WaitForResponse() ←阻塞  │    │
│  │       │                │                    │    │
│  │       ▼                ▼                    │    │
│  │  StateCompleted   StateRunning (恢复)        │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**核心原则**：SSE 负责"Agent 告诉你它在干什么"，WebSocket 负责"Agent 问你怎么办"。

---

## 2. 传输层规范

| 项目 | 选择 | 理由 |
|---|---|---|
| 协议 | JSON-RPC 2.0 | 标准化程度高，Go/TS 均有现成库 |
| 编码 | JSONL（每行一个 JSON 对象） | 便于流式解析，不需要额外分帧 |
| WS 连接地址 | `ws://127.0.0.1:{port}/api/ws?runId={runId}` | 复用 Go Core 端口 |
| 心跳 | 客户端每 30s 发 `ping`，服务端回 `pong` | 检测连接存活 |
| 断线重连 | 指数退避：1s → 2s → 4s → 8s → 最大 30s | 前端负责 |

---

## 3. 消息格式（JSON-RPC 2.0）

### 3.1 基础结构

```typescript
// 请求（需要对方回复）
interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: string          // 唯一标识，用于匹配 response
  method: string      // 方法名
  params?: unknown    // 参数
}

// 响应（回复请求）
interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: string          // 对应 request 的 id
  result?: unknown    // 成功结果
  error?: {           // 失败信息
    code: number
    message: string
    data?: unknown
  }
}

// 通知（单向，不需要回复）
interface JsonRpcNotification {
  jsonrpc: "2.0"
  method: string      // 无 id = 通知
  params?: unknown
}
```

### 3.2 Go 侧结构体

```go
type JsonRpcRequest struct {
    Jsonrpc string          `json:"jsonrpc"`
    ID      string          `json:"id"`
    Method  string          `json:"method"`
    Params  json.RawMessage `json:"params,omitempty"`
}

type JsonRpcResponse struct {
    Jsonrpc string          `json:"jsonrpc"`
    ID      string          `json:"id"`
    Result  json.RawMessage `json:"result,omitempty"`
    Error   *JsonRpcError   `json:"error,omitempty"`
}

type JsonRpcNotification struct {
    Jsonrpc string          `json:"jsonrpc"`
    Method  string          `json:"method"`
    Params  json.RawMessage `json:"params,omitempty"`
}

type JsonRpcError struct {
    Code    int             `json:"code"`
    Message string          `json:"message"`
    Data    json.RawMessage `json:"data,omitempty"`
}
```

---

## 4. Method 定义

### 4.1 P1 必须实现

| Method | 方向 | 类型 | 用途 |
|---|---|---|---|
| `approval/request` | Server → Client | Request | Agent 暂停，请求用户审批 |
| `approval/response` | Client → Server | Response | 用户回复 allow/deny |
| `run/abort` | Client → Server | Request | 用户紧急终止当前 Run |
| `run/status` | Server → Client | Notification | 推送 Run 状态变更 |

### 4.2 P2 扩展

| Method | 方向 | 类型 | 用途 |
|---|---|---|---|
| `terminal/input` | Client → Server | Notification | 用户向 PTY 发送输入 |
| `terminal/output` | Server → Client | Notification | PTY 输出推送到前端 |
| `browser/screenshot` | Server → Client | Notification | Browser Use 截图推送 |

### 4.3 前端 Method 常量

```typescript
export const WS_METHODS = {
  APPROVAL_REQUEST: "approval/request",
  APPROVAL_RESPONSE: "approval/response",
  RUN_ABORT: "run/abort",
  RUN_STATUS: "run/status",
  TERMINAL_INPUT: "terminal/input",
  TERMINAL_OUTPUT: "terminal/output",
  BROWSER_SCREENSHOT: "browser/screenshot",
} as const
```

---

## 5. 审批流完整交互序列

```
前端                          WebSocket                         Go Core
 │                              │                                │
 │──── ws connect ─────────────►│                                │
 │◄─── connected ───────────────│                                │
 │                              │                                │
 │                              │◄── orchestrator 触发审批 ──────│
 │◄── approval/request ────────│                                │
 │    {                         │                                │
 │      id: "req_001",          │                                │
 │      method: "approval/request",                              │
 │      params: {               │                                │
 │        runId: "run_abc",     │                                │
 │        stepId: "step_3",     │                                │
 │        tool: "write_file",   │                                │
 │        reason: "即将覆盖配置文件",                              │
 │        riskLevel: "high",    │                                │
 │        timeout: 300          │                                │
 │      }                       │                                │
 │    }                         │                                │
 │                              │          [Orchestrator 阻塞]    │
 │                              │          [等待 response...]     │
 │                              │                                │
 │──── approval/response ──────►│                                │
 │    {                         │──────────────────────────────►│
 │      id: "req_001",          │                                │
 │      result: {               │          [恢复执行]             │
 │        action: "allow",      │                                │
 │        comment: "确认"        │                                │
 │      }                       │                                │
 │    }                         │                                │
 │                              │                                │
```

### 5.1 审批请求参数

```typescript
interface ApprovalRequestParams {
  runId: string
  stepId: string
  tool: string
  reason: string
  riskLevel: "low" | "medium" | "high"
  timeout: number   // 秒
}
```

### 5.2 审批响应结果

```typescript
interface ApprovalResponseResult {
  action: "allow" | "deny"
  comment?: string
}
```

---

## 6. 超时与异常处理

| 场景 | 处理方式 |
|---|---|
| 用户 5 分钟未回复 | 后端自动 deny，Run 进入 `failed` 状态，通过 SSE 推送 `run.failed` 事件 |
| WebSocket 断线 | 前端指数退避重连；后端如果 30s 内没重连上，视为用户离线，按超时处理 |
| 前端收到未知 method | 忽略，不回复（JSON-RPC 规范允许） |
| 后端收到格式错误的消息 | 返回 `error: { code: -32700, message: "Parse error" }` |

---

## 7. 后端文件结构（Go Core）

```
core/internal/api/
├── routes.go              # 新增 /api/ws 路由
├── ws_handler.go          # [新建] WebSocket 升级 + 消息循环
├── ws_session.go          # [新建] Session 管理（连接池）
└── ws_protocol.go         # [新建] JSON-RPC 消息结构体定义

core/internal/agent/
├── orchestrator.go        # 修改：StateWaitingForUser 时调用 WS
└── worker.go              # 不变
```

### 7.1 连接管理核心结构

```go
type WsSession struct {
    conn     *websocket.Conn
    runID    string
    send     chan []byte    // 发送缓冲
    pending  map[string]chan JsonRpcResponse  // 等待回复的请求
    mu       sync.Mutex
}

type WsSessionManager struct {
    sessions map[string]*WsSession  // runID -> session
    mu       sync.RWMutex
}

// 发送请求并等待回复（阻塞）
func (s *WsSession) SendRequestAndWait(req JsonRpcRequest, timeout time.Duration) (*JsonRpcResponse, error)
```

### 7.2 Orchestrator 对接

```go
// 在 StateWaitingForUser 分支中：
case StateWaitingForUser:
    resp, err := h.wsManager.GetSession(runID).SendRequestAndWait(
        JsonRpcRequest{
            Jsonrpc: "2.0",
            ID:      generateID(),
            Method:  "approval/request",
            Params:  mustMarshal(ApprovalRequestParams{...}),
        },
        5*time.Minute,
    )
    
    if err != nil {
        h.failRun(runID, "approval timeout")
        return
    }
    
    var result ApprovalResponseResult
    json.Unmarshal(resp.Result, &result)
    
    if result.Action == "allow" {
        h.resumeRun(runID)
    } else {
        h.failRun(runID, "user denied: "+result.Comment)
    }
```

---

## 8. 前端文件结构

```
apps/desktop/src/shared/api/
├── streamAdapters.ts       # 已有：SSE 适配器（不改）
├── wsClient.ts             # [新建] WebSocket 客户端
├── wsProtocol.ts           # [新建] JSON-RPC 类型定义
└── wsMessageRouter.ts      # [新建] 消息分发路由

apps/desktop/src/features/chat/  (或对应页面目录)
├── ApprovalModal.tsx        # [新建] 审批弹窗组件
└── useApproval.ts           # [新建] 审批 Hook
```

### 8.1 WsClient 核心接口

```typescript
export class WsClient {
  constructor(baseUrl: string, runId: string)
  connect(): void
  disconnect(): void
  
  // 发送请求并等待回复
  sendRequest(method: string, params: unknown, timeoutMs?: number): Promise<unknown>
  
  // 发送通知（不需要回复）
  sendNotification(method: string, params: unknown): void
  
  // 监听服务端发来的请求/通知
  on(method: string, handler: (params: unknown) => void): () => void
  
  // 回复服务端发来的请求
  respond(id: string, result: unknown): void
}
```

### 8.2 与现有 SSE 的关系

**不改 `streamAdapters.ts`**。SSE 适配器继续负责事件流。WebSocket 是独立的新模块，两者在页面层并存使用：

```typescript
function NewTaskPage() {
  // SSE：接收 Agent 执行过程的事件流
  const { events } = useSSEStream(currentRunId)
  
  // WS：处理双向控制信令
  const wsClient = useWsClient(currentRunId)
  const { pendingApproval } = useApproval()
  
  return (
    <>
      <EventStream events={events} />
      <ApprovalModal />
    </>
  )
}
```

---

## 9. 实施路线图

| 阶段 | 任务 | 归属 | 前置依赖 | 预计工时 |
|---|---|---|---|---|
| 1 | 定义 `ws_protocol.go` + `wsProtocol.ts`（消息结构体对齐） | 全栈 | 无 | 0.5 天 |
| 2 | Go 后端：`ws_handler.go` + `ws_session.go`（连接管理） | 后端 | 步骤 1 | 1.5 天 |
| 3 | Go 后端：Orchestrator 对接（`StateWaitingForUser` → WS 阻塞） | 后端 | 步骤 2 | 1 天 |
| 4 | 前端：`wsClient.ts`（连接/重连/心跳/消息路由） | 前端 | 步骤 1 | 1 天 |
| 5 | 前端：`ApprovalModal.tsx` + `useApproval.ts` | 前端 | 步骤 4 | 0.5 天 |
| 6 | 联调：断线重连、超时处理、多端同步 | 全栈 | 步骤 3+5 | 1 天 |
| 7 | 更新文档 | 全栈 | 步骤 6 | 0.5 天 |

**总计约 6 天**，其中后端 3 天、前端 1.5 天、联调+文档 1.5 天。
