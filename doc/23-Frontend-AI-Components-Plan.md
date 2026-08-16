# GeoWork 前端 AI 组件补齐计划

> **文档路径**：`doc/23-Frontend-AI-Components-Plan.md`
> **关联文档**：`doc/21-Frontend-Refactor-Plan.md`（六阶段重构已完成，本计划是其后续）
> **状态**：已批准执行中（2026-08-17 起草并同日开工）
> **背景**：设计参考 TurboProduct 的 Beautiful UI 组件清单（beautifului.dev，MIT/copy-paste，无公开仓库）；因源码需邮件订阅，本计划以 antd token 体系自研，其组件清单作设计规格参考。

---

## 0. 缺口结论（2026-08-17 评审）

「缺 UI 组件」不成立（antd 6 + Capsule 四件套 + 反馈三件套已覆盖通用层）；
「缺 AI 组件」成立——MarkdownLite 是手写正则渲染器（无表格/列表/标题/高亮），
core 已建好的能力有三个在前端零消费：

| core 已就绪 | 前端现状 |
|---|---|
| `approval_request` SSE 事件 + `GET/POST /api/agent/approvals/*`（governor 审批，routes.go 注释明言"for the frontend"） | 零消费 |
| `diff.created` SSE 事件 | 零消费 |
| `message` / `state_change` SSE 事件（思考流） | 零消费 |

## 阶段划分（每阶段独立提交、独立验收）

### A1 审批流闭环（Approval Card）★本轮
纯 HTTP+SSE，不需要 `/api/ws`（WS 是可选通道，HTTP resolve 与 WS 共享同一 resolver）：
1. `shared/api/types.ts` 加 `CoreApprovalRequest`（镜像 toolregistry.ApprovalRequest 的 JSON 投影）
2. Session：SSE `approval_request` → 快照 `pendingApproval`；`approval_resolved`/`approval_timeout` → 清除；`cancel()` 清除；新方法 `resolveApproval(approved, reason?)` POST `/api/agent/approvals/{id}/approve|reject`（乐观清除，失败恢复）
3. `ApprovalCard.tsx`：toolName + riskLevel 标签 + args 摘要 + 批准/拒绝按钮（提交中 disabled）
4. NewTaskPage：`snap.pendingApproval` 存在时消息列表上方渲染卡片
5. 测试：事件填充 / approve 调用+清除 / reject 带 reason / resolved 事件清卡片

### A2 流式 Markdown 升级（替换 MarkdownLite）★本轮
1. 依赖：`react-markdown` + `remark-gfm` + `shiki`（高亮懒加载，动态 import 不进主包）
2. `MarkdownStream.tsx`：GFM 表格/列表/标题/链接 + 代码块组件（语言标签 + 复制按钮 + Shiki 高亮，未就绪时纯文本）
3. 流式容错：未闭合 ``` fence 按代码块渲染（流式的自然形态）
4. ConversationMessage 挂 `React.memo`（流式 delta 只重渲末条消息）
5. 删除 MarkdownLite

### A3 Thinking 面板（后续）
消费 `message`/`state_change` 事件折叠为 assistant 消息的 thinkingSteps，antd Collapse 展示。

### A4 Diff 查看器（后续）
消费 `diff.created` 事件，`@git-diff-view/react` 内联渲染。

### A5 性能（后续，与 A3/A4 并行）
路由级代码分割（现单 chunk 4.57MB）+ 消息列表虚拟滚动。

## 明确不做

- 不整体引入 Tailwind/shadcn 体系（与 antd token + 三主题冲突）；Beautiful UI 类组件的适装区是未来的官网/落地页，不进应用本体
- `/api/ws` 双向通道接入（HTTP resolve 已闭环；WS 待有实时推送需求再评估）
