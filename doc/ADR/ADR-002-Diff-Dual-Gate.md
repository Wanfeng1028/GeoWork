# ADR-002: Diff 采用双闸模型（事前动作审批 + 事后落盘审查）

## 状态：已接受（2026-08-19）

## 背景

GeoWork 的 Agent 会修改用户工作区文件，用户需要两道安全闸：

1. **事前**：Agent 要执行高危动作（写文件、跑命令）时，先征求同意
2. **事后**：文件已被修改后，用户审查改了什么、决定接受还是回滚

2026-08-19 全量核查发现现状是"一条链通、一条链断"：

- **内联查看链已通**（AGENT.md v1.10）：写工具经 DiffRecorder 上报前后内容 → orchestrator 用 go-difflib 生成真实 LCS unified diff → `diff.created` 事件带 runID 路由进会话 SSE → 前端 Session 按 path 去重 upsert → DiffViewer（@git-diff-view/react）内联渲染在对话流里
- **审批/应用链断裂**：ReviewPanel 经 IPC 调 `GET /api/security/diff`、`.../approve`、`.../reject`、`/api/security/apply-all`（preload.ts:83-90），但活路由只注册了 `POST /api/security/diff` + rollback + recycle-delete（diff_handler.go:49-51）；ReviewPanel 调的那组端点只存在于**从未挂载**的 `core/internal/diff/routes.go`（1063 行完整实现：Generator/Manager/8 条路由），运行时全部 404

同时存在两个看 diff 的地方（内联 DiffViewer 与 ReviewPanel），需要明确分工还是合并。

## 决策

**采用双闸模型（Codex/Cursor 同款），且内联查看器与审查面板分工不合并。**

### 双闸分工

| 闸 | 时机 | 载体 | 后端 |
|---|---|---|---|
| 事前动作审批 | 工具执行**前** | 对话流内 ApprovalCard | `/api/agent/approvals/{reqId}/approve\|reject`（已通） |
| 事后落盘审查 | 文件修改**后** | ReviewPanel（右侧面板） | `core/internal/diff` 包挂载后的 `/api/security/diff` 系列（待接线，doc/27 W2-2） |

### DiffViewer 与 ReviewPanel 分工（不合并）

| | 内联 DiffViewer | ReviewPanel |
|---|---|---|
| 定位 | 对话流里的**即时可见性**——"Agent 刚改了哪个文件" | 跨会话的**批量审查闸门**——"这次运行总共改了什么，逐个接受/回滚" |
| 数据源 | `diff.created` SSE 事件（会话内、自包含 unified） | `/api/security/diff` 列表（跨会话、持久化） |
| 交互 | 只读查看 | approve / reject / apply-all / rollback |
| 生命周期 | 随会话消息存在 | 独立于会话，按 status 过滤 |

**不合并的原因**：两者数据源和生命周期不同（SSE 事件 vs 持久化列表），合并会让对话流组件背上跨会话状态；分工后内联查看器可进一步加"在 ReviewPanel 中打开"的跳转，职责单向依赖。

**2026-08-19 用户拍板：分工成立**，并对冲"两个入口"的代价，钉三条边界：

1. **单一渲染核**：两个入口共用同一 unified 格式与同一 `@git-diff-view/react` 渲染核——两个入口 ≠ 两套实现
2. **互链成环**：内联加"在审查面板中打开"深链（按 runID/path 过滤），面板条目回链对话轮次——两个入口是一个闭环，不是两处孤岛
3. **写操作只属于面板**：内联 DiffViewer 禁止调用 `/api/security/diff` 系列的 approve/reject/apply-all/rollback——这条是分工成立的安全边界，也是 A5 虚拟滚动/懒加载架构不被仓库查询污染的制度保证（内联保持纯展示，A4 设计刻意让 SSE payload 只带 path/toolCallId/unified 不带全文）

### 接线前提（W2-2 工单，顺序不可颠倒）

1. **先删** diff_handler.go 三条旧 security 路由（`POST /api/security/diff`、`rollback`、`recycle-delete`）——与 `core/internal/diff/routes.go` 重复，Go ServeMux 重复注册同 pattern 会 panic
2. main 构造 Generator/Manager 并注入
3. 挂载 `diff.Routes.Register(mux)`
4. 契约测试（desktop_contract_test.go）补钉这组端点
5. ReviewPanel 订阅 `diff.created` 事件刷新列表

## 后果

**正面**：

- 执行链闭环：审批（事前）→ 执行 → 内联可见（即时）→ 面板审查（事后）→ 接受/回滚
- ReviewPanel 从 404 死界面变为真实闸门
- 1063 行已写好的 diff 包复活，不用重写

**负面/代价**：

- 两个看 diff 的入口，用户需要理解分工（用"在 ReviewPanel 中打开"跳转缓解）
- diff_handler.go 旧三条路由删除后，若有未知调用方会 404——接线前需 grep 确认无其他消费方（preload.ts 的 rollback 桥接需同步改指向）

**回滚**：W2-2 为独立提交，回滚即恢复旧三条路由注册。
