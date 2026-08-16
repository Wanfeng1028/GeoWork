# GeoWork 前端 AI 组件补齐计划

> **文档路径**：`doc/23-Frontend-AI-Components-Plan.md`
> **关联文档**：`doc/21-Frontend-Refactor-Plan.md`（六阶段重构已完成，本计划是其后续）
> **状态**：A1–A5 全部完成（2026-08-17），本计划收官
> **背景**：设计参考 TurboProduct 的 Beautiful UI 组件清单（beautifului.dev，MIT/copy-paste，无公开仓库）；因源码需邮件订阅，本计划以 antd token 体系自研，其组件清单作设计规格参考。

---

## 0. 缺口结论（2026-08-17 评审）

「缺 UI 组件」不成立（antd 6 + Capsule 四件套 + 反馈三件套已覆盖通用层）；
「缺 AI 组件」成立——MarkdownLite 是手写正则渲染器（无表格/列表/标题/高亮），
core 已建好的能力有三个在前端零消费：

| core 已就绪 | 前端现状 |
|---|---|
| `approval_request` SSE 事件 + `GET/POST /api/agent/approvals/*`（governor 审批，routes.go 注释明言"for the frontend"） | A1 已消费 ✅ |
| `diff.created` SSE 事件（A4 起 core 产 unified diff 并路由进会话 SSE） | A4 已消费 ✅ |
| `message` / `state_change` SSE 事件（思考流） | A3 已消费 ✅ |

## 阶段划分（每阶段独立提交、独立验收）

### A1 审批流闭环（Approval Card）✅ 已完成（b35e570）
纯 HTTP+SSE，不需要 `/api/ws`（WS 是可选通道，HTTP resolve 与 WS 共享同一 resolver）：
1. `shared/api/types.ts` 加 `CoreApprovalRequest`（镜像 toolregistry.ApprovalRequest 的 JSON 投影）
2. Session：SSE `approval_request` → 快照 `pendingApproval`；`approval_resolved`/`approval_timeout` → 清除；`cancel()` 清除；新方法 `resolveApproval(approved, reason?)` POST `/api/agent/approvals/{id}/approve|reject`（乐观清除，失败恢复）
3. `ApprovalCard.tsx`：toolName + riskLevel 标签 + args 摘要 + 批准/拒绝按钮（提交中 disabled）
4. NewTaskPage：`snap.pendingApproval` 存在时消息列表上方渲染卡片
5. 测试：事件填充 / approve 调用+清除 / reject 带 reason / resolved 事件清卡片

### A2 流式 Markdown 升级（替换 MarkdownLite）✅ 已完成（b35e570）
1. 依赖：`react-markdown` + `remark-gfm` + `shiki`（高亮懒加载，动态 import 不进主包）
2. `MarkdownStream.tsx`：GFM 表格/列表/标题/链接 + 代码块组件（语言标签 + 复制按钮 + Shiki 高亮，未就绪时纯文本）
3. 流式容错：未闭合 ``` fence 按代码块渲染（流式的自然形态）
4. ConversationMessage 挂 `React.memo`（流式 delta 只重渲末条消息）
5. 删除 MarkdownLite

### A3 Thinking 面板 ✅ 已完成（2026-08-17）
消费 `message`/`state_change` 事件折叠为 assistant 消息的 thinkingSteps，antd Collapse 展示。
- Session：`state_change` → state 类步骤（中文标签 + reason，连续重复去噪）；`message` isDelta → reasoning 步骤累积；完整帧关闭步骤并把全文并入气泡（修复真实模式 assistant 气泡只有完成摘要的内容缺失）；done/error/cancel 关闭开放步骤
- `ThinkingPanel.tsx`：antd Collapse，流式自动展开、结束自动收起，Brain 图标 + 步数 + 活动 spinner
- 4 条测试（state 步骤/去噪/reasoning 累积与关闭/终态关闭）

### A4 Diff 查看器 ✅ 已完成（2026-08-17，跨 Go core + 前端）
调研发现原方案不可行：`diff.created` 事件未带会话路由（发不到会话 SSE），且 core 只产行级 diff 非 unified。经确认改修 core 接通完整链路：
- **core**：`toolregistry/diff_recorder.go`（DiffRecorder 上下文注入）；write_file/create_artifact 写前读旧内容、成功后上报；orchestrator 工具执行挂 recorder 闭包，`emitDiffCreated` 用 go-difflib（真实 LCS 多 hunk）生成 unified diff 并发 `diff.created`（带 runID → EventBridge → 会话 SSE，复用既有事件路由）；payload 仅含 path/toolCallId/unified（自包含，不带全文）
- **前端**：`FileDiff` 类型 + Session `diff.created` 监听（按 path 去重 upsert）；`DiffViewer.tsx`（@git-diff-view/react 动态导入 ~320KB 独立 chunk + antd Collapse 每文件一面板 + 增删行数徽标 + 明暗主题）接入 ConversationMessage
- 测试：Go 侧 diff 生成器 4 条 + recorder 3 条；前端 Session 3 条（事件填充/同路径去重/缺字段忽略）

### A5 性能 ✅ 已完成（2026-08-17）
- **路由级代码分割**：`routes.tsx` 14 个页面全部改 react-router `lazy` 路由（AppShell 壳保持静态导入）；`electron.vite.config.ts` manualChunks 拆 vendor-react / vendor-antd 独立缓存 chunk（不设兜底 vendor，页面专属依赖留在各自懒加载 chunk）。主入口 chunk 5.0MB → 首屏仅 3 个可缓存 chunk，其余按路由懒加载
- **消息列表虚拟滚动**：NewTaskPage 接入 @tanstack/react-virtual（动态测量 + overscan 6 + 稳定键）；贴底跟随（距底 <80px 才自动滚动，上滑看历史不打扰）；顺带消除 lastAssistantIdx 的 O(n²) 计算
- 测试：routes 懒加载冒烟 2 条（所有路由声明 lazy + 每个 lazy() 解析出 Component）

## 明确不做

- 不整体引入 Tailwind/shadcn 体系（与 antd token + 三主题冲突）；Beautiful UI 类组件的适装区是未来的官网/落地页，不进应用本体
- `/api/ws` 双向通道接入（HTTP resolve 已闭环；WS 待有实时推送需求再评估）
