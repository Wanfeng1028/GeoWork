# GeoWork 前后端 API 契约规范

> **文档路径**：`doc/15-Engineering-API-Contract.md`
> **关联文档**：`09-GeoWork-Communication-Protocol.md`（WebSocket 协议）/ `03-GeoWorkFrontend-Engineering-Standards.md`（数据层 §2）
> **适用对象**：前后端贡献者（含 AI 编程助手）
> **最后更新**：2026-08-16

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：接口契约维护方式、类型生成、版本管理、错误码规范 |
| v1.1 | 2026-08-16 | 新增 §2.5 前端统一客户端约定（coreApi + client 双层、超时、ApiError 三分类）；§3.3 补 `X-GeoWork-Token` 请求头 |

---

## 1. 架构

```
前端 (React)                    Go Core (:8765)
    │                                │
    │── HTTP REST ──────────────────►│  请求/响应
    │◄── JSON ──────────────────────│
    │                                │
    │◄── SSE 事件流 ────────────────│  单向推送
    │                                │
    │◄──► WebSocket (JSON-RPC 2.0) ─│  双向控制信令
    │                                │
```

---

## 2. 接口契约维护

### 2.1 当前方式

前后端类型**手动维护**——Go 侧定义结构体，前端侧手写对应的 TypeScript interface。没有自动生成。

### 2.2 规则

- **后端主导**：接口变更由后端发起，前端按后端给出的新结构更新类型
- **先改文档再改代码**：接口变更必须先更新本文档或对应的模块文档，再改代码
- **类型文件集中**：前端 API 类型统一在 `src/shared/api/types.ts`，不散落在各组件
- **Go 侧类型集中**：API 请求/响应结构体统一在 `core/internal/api/types.go`

### 2.3 变更流程

```
1. 后端在 PR 描述中列出接口变更（新增/修改/删除的字段）
2. 前端 reviewer 确认类型兼容
3. 合入后双方各自更新类型文件
4. 如有 breaking change，走版本管理（见 §4）
```

### 2.4 未来改进（TODO）

考虑引入 OpenAPI/Swagger 自动生成前端类型：

- Go 侧用 `swag` 或 `go-swagger` 从注释生成 OpenAPI spec
- 前端用 `openapi-typescript` 从 spec 生成 TypeScript 类型
- CI 中检查 spec 与代码是否同步

### 2.5 前端统一客户端（唯一入口）

前端访问 Go Core 的 HTTP/SSE 接口**必须**通过 `apps/desktop/src/shared/api/`，禁止在组件里裸写 `fetch(CORE_BASE_URL...)`：

```
shared/api/
├── coreApi.ts   # 底层：runtime token 鉴权（IPC 获取 + 缓存）
│                #   coreFetch()        → 自动附加 X-GeoWork-Token 头
│                #   coreEventSource()  → EventSource，token 走 ?token= query（EventSource 不支持自定义 header）
│                #   CORE_BASE_URL      → VITE_CORE_API_URL ?? http://127.0.0.1:8765
└── client.ts    # 上层：apiGet/apiPost/apiPut/apiDelete/apiPatch + createSSEStream
                 #   - 统一超时：默认 30s（AbortController），RequestOptions.timeoutMs 可覆盖，0 = 不限时
                 #   - ApiError 三分类 kind = 'timeout' | 'network' | 'http'
                 #     · network（后端未启动/连接被拒）→ 上层可降级本地缓存
                 #     · timeout → 可重试
                 #     · http → 携带状态码 + §5.1 业务错误码 code
                 #   - RequestOptions.signal 支持组件卸载时取消请求
```

历史说明：`src/utils/apiClient.ts`（指向 8080、臆想的 `{ok,data}` 信封、无人引用的死代码）已于 2026-08-16 删除。**不要**重新引入第二套客户端或响应信封——Go Core 的 REST 响应是裸 JSON（列表接口带 total 字段），无统一信封包装（见 §3.2）。

---

## 3. REST API 规范

### 3.1 URL 风格

```
GET    /api/{resource}              # 列表
GET    /api/{resource}/{id}         # 详情
POST   /api/{resource}              # 创建
PUT    /api/{resource}/{id}         # 全量更新
PATCH  /api/{resource}/{id}         # 部分更新
DELETE /api/{resource}/{id}         # 删除
```

### 3.2 响应格式

```typescript
// 成功
interface ApiResponse<T> {
  data: T
  message?: string
}

// 列表
interface ApiListResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// 错误
interface ApiError {
  code: number       // 错误码（见 §5）
  message: string    // 用户可读的错误描述
  details?: unknown  // 调试信息（仅开发环境返回）
}
```

### 3.3 请求头

| Header | 值 | 说明 |
|---|---|---|
| `Content-Type` | `application/json` | JSON 请求体 |
| `Accept` | `application/json` | 期望 JSON 响应 |
| `X-GeoWork-Token` | hex 随机串 | runtime token（P0-4）。Electron 主进程铸造，经 `GEOWORK_RUNTIME_TOKEN` 注入 Go runtime；前端经 IPC 获取后由 `coreFetch` 自动附加。SSE 用 `?token=` query 等效传递 |
| `X-Request-ID` | UUID | 请求追踪 ID（可选，待实现） |

---

## 4. 版本管理

### 4.1 URL 版本

当前**不启用 URL 版本**（`/api/v1/...`）。项目处于 v0.x 阶段，接口变动频繁，URL 版本增加维护成本。

当项目进入 v1.0 稳定版后，再启用 URL 版本。

### 4.2 Breaking Change 处理

| 变更类型 | 是否 Breaking | 处理方式 |
|---|---|---|
| 新增可选字段 | 否 | 直接加 |
| 新增必填字段 | **是** | 先加为可选 → 前端适配 → 下个版本改必填 |
| 删除字段 | **是** | 先标记 deprecated → 两个版本后删除 |
| 改字段名 | **是** | 新增字段 + 保留旧字段 → 前端迁移 → 删除旧字段 |
| 改字段类型 | **是** | 同"删除+新增" |

---

## 5. 错误码规范

| 范围 | 含义 | 示例 |
|---|---|---|
| 200-299 | 成功 | 200 OK, 201 Created |
| 400-499 | 客户端错误 | 400 参数错误, 401 未认证, 403 无权限, 404 不存在 |
| 500-599 | 服务端错误 | 500 内部错误, 502 上游错误, 503 不可用 |

### 5.1 业务错误码

在 HTTP 状态码基础上，用 `code` 字段传递业务错误码：

| 错误码 | 含义 |
|---|---|
| 10000 | 通用请求参数错误 |
| 10001 | 任务不存在 |
| 10002 | 任务状态不允许此操作 |
| 20001 | 工具执行超时 |
| 20002 | 沙箱拒绝 |
| 30001 | 模型调用失败 |
| 30002 | 上下文超长 |

（错误码段分配：1xxxx 任务、2xxxx 工具/沙箱、3xxxx 模型、4xxxx 权限、5xxxx 系统）

### 5.2 已分配码值登记

每次新增错误码必须更新此表。错误码的权威定义在 Go 代码 `core/internal/api/errors.go` 中，此表为文档镜像。

| 错误码 | 含义 | 添加日期 | 所在文件 |
|---|---|---|---|
| 10000 | 通用请求参数错误 | 2026-08-15 | `core/internal/api/errors.go` |
| 10001 | 任务不存在 | 2026-08-12 | `core/internal/api/errors.go`（待创建） |
| 10002 | 任务状态不允许此操作 | 2026-08-12 | 同上 |
| 20001 | 工具执行超时 | 2026-08-12 | 同上 |
| 20002 | 沙箱拒绝 | 2026-08-12 | 同上 |
| 30001 | 模型调用失败 | 2026-08-12 | 同上 |
| 30002 | 上下文超长 | 2026-08-12 | 同上 |

---

## 6. SSE 事件类型

SSE 事件由 Go Core 推送，前端通过 `streamAdapters.ts` 消费。事件类型定义：

| 事件类型 | 数据 | 说明 |
|---|---|---|
| `thinking` | `{ content: string }` | Agent 思考过程 |
| `tool_call` | `{ tool: string, args: unknown }` | 工具调用开始 |
| `tool_result` | `{ tool: string, result: unknown }` | 工具调用完成 |
| `text_delta` | `{ content: string }` | 文本增量 |
| `state_change` | `{ from: string, to: string }` | 状态变更 |
| `approval_request` | `{ reqId, tool, riskLevel, ... }` | 审批请求（WS 为主通道，SSE 为降级） |
| `error` | `{ code: number, message: string }` | 错误 |
| `done` | `{}` | 流结束 |
