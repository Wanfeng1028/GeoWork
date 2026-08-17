# GeoWork AI 组件 Ant Design X 迁移计划

> **文档路径**：`doc/26-AntDesignX-Migration.md`
> **关联文档**：`doc/23-Frontend-AI-Components-Plan.md`（自研 AI 组件 A1–A5，已收官）
> **状态**：一期完成（2026-08-17）；二期待执行

---

## 0. 背景与决策

doc/23 用 antd token 体系自研了五个 AI 组件（审批卡片 / Markdown / Thinking 面板 / Diff 查看器 / 性能优化）。
Ant Design X（`@ant-design/x`，antd 官方 AI 组件扩展，MIT）2.x 的 peerDependency 为 `antd ^6.1.1`，
与项目 antd 6.5.2 完全兼容，共用同一套 design token 与 CSS-in-JS 体系——无 Tailwind/shadcn 技术栈冲突。

用户决策（2026-08-17）：**自研组件保留但入口关闭，用 Ant Design X 把 AI 组件重做**。

落地原则：
1. **只换渲染层，不动数据层**：`useSession(convId)` → `ConversationSnapshot` 是唯一数据源，
   Session 对象层 / SSE 状态机 / conversationCache 全部不动
2. **自研组件不删**：`aiComponentsV2` 开关关闭即回退自研渲染树（入口关闭 ≠ 删除）
3. **最大化复用既有资产**：MarkdownStream（A2）/ DiffViewer（A4）/ ToolCallTimeline /
   WorkflowRunCard / ApprovalCard / SelectedContextBar / ModelPicker / ContextPickerModal
   直接挂进 X 组件，不重造
4. **开关默认 X 版**（`aiComponentsV2: true`），设置页「实验特性」区留 Switch 可切回

## 1. 开关设计

- `GeoWorkSettings.aiComponentsV2: boolean`（默认 `true`），settingsStorage 合并逻辑天然兼容存量用户
- 设置页「实验特性」区首行 Switch（照抄 generativeUi 行模式）
- settings 为快照读取（非响应式），切换后重新进入对话页生效——与 demoMode 惯例一致
- 消费点：`NewTaskPage` 顶部 `const useAntdx = loadSettings().aiComponentsV2`，
  homeView / conversationView 各区块按开关二选一渲染

## 2. 一期：核心会话回路（已完成）

新目录 `pages/NewTask/components/antdx/`，与自研树并列：

| 组件 | X 件 | 说明 |
|---|---|---|
| `MessageBubbleX.tsx` | `Bubble` + `ThoughtChain` | user 右侧 filled 气泡；assistant `contentRender` = MarkdownStream（复用）；thinkingSteps → ThoughtChain（未结束步骤 loading 态，streaming 默认展开最新节点）；toolCalls/fileDiffs/workflow 挂 extras 区复用自研组件 |
| `ConversationX.tsx` | `Bubble` 逐项 + `@tanstack/react-virtual` | **Bubble.List 无内置虚拟化**（仅 autoScroll），为保住 A5 长会话性能，自持虚拟器逐项渲染 MessageBubbleX，贴底跟随逻辑与自研分支一致（距底 <80px 才滚动）；审批卡片复用 ApprovalCard 渲染在列表上方 |
| `SenderX.tsx` | `Sender` | onSubmit/onCancel → handleSend/handleStop；`allowSpeech` 内置语音（替代自研手写 Web Speech）；prefix 加号附件菜单（技能/专家/MCP → ContextPickerModal，文件/图片/文件夹 → 系统选择器）；footer 左 GIS 模式 + ModelPicker、右 Sender 原生发送/停止按钮；SelectedContextBar 复用 |
| `WelcomeX.tsx` | `Welcome` + `Prompts` | 替代 homeView hero 文案区；Prompts 按 workMode 给 GIS 场景示例，点击填入输入框（二期接真实技能/专家数据） |

辅助变更：
- `useFilePickers.ts`：文件/文件夹/图片选择逻辑自 ChatComposer 抽出为共享 hook（两分支复用）
- `test/setup.ts`：补 `ResizeObserver` polyfill（jsdom 缺失，antd-x resize-observer 依赖）
- NewTaskPage：`handleResolveApproval` 提成共享 handler（两分支共用）

### 包体积

`@ant-design/x` 匹配既有 manualChunks 的 `@ant-design` 模式进 vendor-antd（+284KB），
仅被 NewTaskPage 懒加载 chunk 引用，**不进首屏**（首屏仍是 vendor-react + vendor-antd + 入口 3 chunk）。
`sideEffects: false` 保证 mermaid/react-syntax-highlighter 等未用子模块被 tree-shake 掉。

### 验收

tsc + vitest 110/110（新增 antdx 7 条：气泡渲染/Markdown/ThoughtChain/复用组件/审批卡片/输入/流式）
+ build 无 circular chunk 告警 + 边界检查 128 源文件全绿。
routes 懒加载冒烟测试因 NewTaskPage 引入大包解析变慢，单独放宽时限至 30s。

## 3. 二期：补齐与打磨（待执行）

- 审批卡片 X 化评估（Bubble 变体 or 保留 ApprovalCard）
- 工作流卡片 X 化评估（Steps → ThoughtChain/自定义）
- Prompts 推荐数据接真实技能/专家、Suggestion 输入联想
- 虚拟滚动动态高度实测调优、暗色主题微调
- 侧栏 Conversations 评估（taskStore 工作空间分组/置顶模型与 antd-x Conversations 不匹配，大概率保留自研）
- 右侧 AssistantChatPanel 旁路面板是否迁移（本期明确不动）

## 4. 明确不做

- 不引入 Tailwind/shadcn 生态组件（assistant-ui / shadcn-chat / CopilotKit UI，与 antd token 体系冲突）
- 不动 Session 对象层与 SSE 状态机（渲染层替换零数据层风险）
- 不删自研组件（开关回退路径，doc/23 资产保留）
