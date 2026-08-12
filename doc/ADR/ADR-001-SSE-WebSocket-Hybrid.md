# ADR-001: 通信协议采用 SSE + WebSocket 混合架构

## 状态：已接受 (2026-08-12)

## 背景

GeoWork Agent 系统需要前端（Electron + React）与后端（Go Core）之间的实时通信。初始设计只使用 SSE（Server-Sent Events）做单向事件推送。

随着 Human-in-the-Loop（审批流）和实时打断需求的出现，纯 SSE 方案暴露了局限：

- 审批请求推给前端后，用户的 approve/reject 需要额外的 HTTP POST，有往返延迟
- 用户打断模型输出需要 POST `/cancel`，延迟 50-200ms
- 未来实时协作场景需要服务端主动推送给多个客户端

## 决策

**保留 SSE 作为主事件流通道，新增 WebSocket 作为轻量控制信令通道。**

具体分工：

| 通道 | 方向 | 职责 | 协议 |
|---|---|---|---|
| SSE | Server → Client（单向） | Agent 思考过程、工具执行日志、文本输出、状态变更 | 原生 EventSource |
| WebSocket | 双向 | 审批请求/响应、run/abort、终端 I/O、心跳 | JSON-RPC 2.0 |

**不全面替换 SSE 的原因**：

1. SSE 有浏览器原生自动重连（`EventSource`），WebSocket 需要自己实现心跳和重连
2. SSE 走标准 HTTP，不会被企业防火墙/代理拦截，WebSocket 的 `Upgrade` 握手在某些环境下失败
3. 事件流本质是单向的（模型输出、工具结果、状态变更都是 Server→Client），SSE 完美匹配
4. P0-P1 已经围绕 SSE 设计了完整的事件协议（12 种事件类型、per-run 过滤、前端 adapter 契约），替换意味着重写

**连接地址**：`ws://127.0.0.1:{port}/api/ws?runId={runId}`

**消息格式**：JSON-RPC 2.0（JSONL 编码）

**P1 Method**：`approval/request`、`approval/response`、`run/abort`、`run/status`

## 后果

- 后端需维护两种连接类型（SSE handler + WebSocket handler），增加约 230 行新代码
- 前端需同时管理 SSE 和 WS 生命周期（`streamAdapters.ts` 不变，新增 `wsClient.ts`）
- P1 阶段必须完成 WS 基础设施（连接管理、心跳、重连、审批弹窗）
- 协议规范独立为 `doc/09-GeoWork-Communication-Protocol.md`
- HTTP 审批 API 作为降级通道保留（WS 断连时回退到 HTTP POST）
