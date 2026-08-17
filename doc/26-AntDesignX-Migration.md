# GeoWork AI 组件 Ant Design X 迁移计划

> **文档路径**：`doc/26-AntDesignX-Migration.md`
> **关联文档**：`doc/23-Frontend-AI-Components-Plan.md`（自研 AI 组件 A1–A5，已收官）
> **状态**：一期完成（2026-08-17）；二期完成（2026-08-17）

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

## 3. 二期：补齐与打磨（已完成）

### 3.1 已落地

| 项 | 内容 |
|---|---|
| Prompts 接真实数据 | 新增 `antdx/promptData.ts` 共享数据层：`loadPromptSkills()`（已安装+启用技能，与 ContextPickerModal 同一数据源 skillsStorage，去重取前 6）/ `loadExpertCommands()`（已安装专家 quickCommands，`/触发词`，取前 12）/ `loadWelcomePrompts()`（无技能时回退 GIS 场景文案）。WelcomeX 的 Prompts 从写死文案改为真实技能，点击填入「使用技能「X」：」引导语 |
| Suggestion 输入联想 | SenderX 用 antd-x `Suggestion` 包裹 `Sender`（官方 children 渲染模式）：输入 `/` 打开联想面板（技能 + 专家命令），方向键导航、Enter 选中——Sender `onKeyDown` 返回 `false` 阻断提交（SlotTextArea 的 `shouldSkipKeyHandling` 契约），选中项填入输入框；`block` 模式弹层与输入区同宽 |
| 虚拟滚动调优 | ConversationX `estimateSize` 从固定 120 改为按角色分层（user 72 / assistant 220），首屏高度预估更准，measureElement 实测后自动修正 |
| 暗色主题 | 检查结论：antdx 树零硬编码色值（CSS 仅布局属性），X 组件全走 antd token；应用当前无暗色开关，无需改动，未来开启 darkAlgorithm 自动跟随 |

### 3.2 评估结论（明确保留自研 / 不迁移）

| 项 | 结论 | 理由 |
|---|---|---|
| 审批卡片 X 化 | **保留 ApprovalCard** | 审批是结构化表单交互（风险等级/参数展示/批准-拒绝+理由），非对话气泡语义；Bubble 变体无法承载，硬套反而增加复杂度。已作为复用资产挂进 ConversationX |
| 工作流卡片 X 化 | **保留 WorkflowRunCard** | antd `Steps`（横向步骤条 + 状态 Tag + 确认/调整按钮 + 状态 Alert）已是该场景最佳呈现；ThoughtChain 是纵向思考链语义，不匹配「计划确认→执行」流程 |
| 侧栏 Conversations | **保留自研** | taskStore 的工作空间分组/置顶模型与 antd-x Conversations 的扁平列表 + menu 模型不匹配，迁移需重写分组逻辑，收益为负 |
| AssistantChatPanel | **本期不迁移** | 右侧旁路面板独立于主对话页，数据流不同（非 useSession 快照）；待主对话页 X 化稳定运行后再评估 |

### 3.3 验收

tsc + vitest 114/114（新增 4 条：promptData 技能/专家命令、WelcomeX 真实技能点击、SenderX `/` 联想面板）
+ build 无 circular 告警（vendor-antd +62.7KB = Suggestion 组件，仍仅懒加载页面引用）+ 边界检查 129 源文件全绿。

## 4. 明确不做

- 不引入 Tailwind/shadcn 生态组件（assistant-ui / shadcn-chat / CopilotKit UI，与 antd token 体系冲突）
- 不动 Session 对象层与 SSE 状态机（渲染层替换零数据层风险）
- 不删自研组件（开关回退路径，doc/23 资产保留）
