# 第二部分：Claude / Gemini / Grok 系产品技术实现调研

> 调研日期：2026-08-15。调研方法：GitHub API、npm registry、raw.githubusercontent.com、Hacker News Algolia API 及部分代理抓取。注意：antigravity.google、x.ai、wikipedia 等域名无法直连时，相关结论来自 GitHub 官方仓库、HN 讨论存档和二手报道，已逐条标注来源；无法核实处明确标注。

---

## 1. Claude Code（Anthropic）

### 开源情况核实：仓库不含产品源码
- 仓库 https://github.com/anthropics/claude-code 当前 **141,528 stars**（2026-08-15 实测），**无开源许可证**——LICENSE.md 只有一句 "© Anthropic PBC. All rights reserved"，受商业服务条款约束。
- 仓库顶层内容：README、CHANGELOG、SECURITY、`examples/`、`plugins/`、`scripts/`、`.claude-plugin/`、`.devcontainer/`——**只有文档、示例和官方插件，没有产品源代码**。GitHub 语言统计为 Python 369KB / Shell 64KB / TypeScript 23KB / PowerShell / Dockerfile，全是脚本和示例的量级。
- 结论：认为"Claude Code 有开源代码"不准确。它是**闭源产品 + 公开 issue 跟踪/文档/插件仓库**。

### 分发方式：npm 打包 JS（现已改为原生安装器）
- 历史上通过 npm `@anthropic-ai/claude-code` 分发：如 v1.0.120、v2.0.0，**零依赖、bin 指向单个打包压缩的 `cli.js`，解包后约 78MB**。
- 现状（重要变化）：README 已标注 "Installation via npm is deprecated"，推荐 `curl -fsSL https://claude.ai/install.sh | bash`、Homebrew、WinGet。最新 npm 版 2.1.233（2026-08-14 发布）只剩 169KB 的安装器壳（`cli-wrapper.cjs` + `install.cjs` + `bin/claude.exe`）。

### 技术栈：TypeScript + Node.js + React/Ink（有实锤）
- npm 包 engines 要求 Node >= 22。
- 通过社区 sourcemap 还原源码验证：入口 `main.tsx` 使用 React、`@commander-js/extra-typings`、chalk、lodash-es；UI 层有自维护的 `src/ink/root.ts`（vendored/fork 的 Ink 渲染器，`inkRender`/`createRoot`）、`useInput`、React Context、React Compiler runtime。**终端 UI 确为 React + Ink 方案（Ink 被内联改造）**。
- 打包器用 **Bun**（源码中大量 `import { feature } from 'bun:bundle'`）。

### 架构（基于官方文档 + 还原源码目录结构）
- **Agent loop**：`query.ts` 主循环，与 Anthropic API（`@anthropic-ai/sdk`）交互，工具调用循环。
- **子代理**：`tools/AgentTool/AgentTool.tsx`（Task 工具派生独立上下文的子代理）；还原目录还有 `coordinator/`（多 Agent 协调）。
- **Hooks**：`utils/hooks.ts`——用户定义的 shell 命令，在 agent loop 的固定事件点（PreToolUse/PostToolUse/SubagentStop 等）执行。
- **插件**：官方仓库 `plugins/` + `.claude-plugin` 清单机制；**MCP**：`services/mcp` 客户端集成。
- **权限系统**：`utils/permissions/permissions.ts`，`CanUseToolFn` 回调 + permission mode（如 acceptEdits）+ allow/deny 工具列表。

### 社区反混淆/可读源码项目
- **ChinaSiro/claude-code-sourcemap**（9,615 stars）：从 npm 包 v2.1.88 的 `cli.js.map` 中 `sourcesContent` 还原出 **4,756 个文件（含 1,884 个 .ts/.tsx）**，目录含 tools/（30+ 工具）、commands/（40+ 命令）、services/、coordinator/、plugins/、skills/、voice/ 等。声明非官方、仅研究用。https://github.com/ChinaSiro/claude-code-sourcemap
- 镜像/衍生：Hyper66666/claude-code-sourcemap（213 stars）、dadiaomengmeimei/claude-code-sourcemap-learning-notebook（166 stars，"512K+ 行 TypeScript" 分析笔记）、nadonghuang/claude-code（v2.1.76 反混淆，1,902 个 TS 文件）。
- shareAI-lab 的 `analysis_claude_code`/`learn-claude-code` 原仓库已 404（疑似被下架），留有备份：wytheglobal/learn-claude-code、sheng-jie/learn-cc-csharp（.NET 移植）。
- 学术向：**VILA-Lab/Dive-into-Claude-Code**（2,057 stars，系统性架构分析）。
- 系统提示词泄露合集：x1xhlol/system-prompts-and-models-of-ai-tools（142k stars）。

---

## 2. Claude Agent SDK

### 与 Claude Code 的关系
- 前身就是 "Claude Code SDK"，改名而来（TS 版 README 有迁移指南）。**本质是把 Claude Code 的 harness 内核开放出来**：Python SDK README 明确写 "The Claude Code CLI is automatically bundled with the package"，SDK 通过启动捆绑的 Claude Code CLI 进程、以 JSON 流通信来驱动 agent。即：**引擎（Claude Code 本体）闭源，SDK 是它的编程接口壳**。

### 暴露的能力（Python SDK README + types.py 实测）
- `query()`（单次异步查询）与 `ClaudeSDKClient`（双向交互式会话）；
- **工具**：默认可用 Claude Code 全套工具（Read/Write/Edit/Bash 等），`allowed_tools`/`disallowed_tools` 控制许可；
- **权限**：`permission_mode`（如 acceptEdits）+ `can_use_tool` 回调；
- **自定义工具**：`@tool` 装饰器 + `create_sdk_mcp_server` 进程内 MCP server（无 IPC 开销）；
- **MCP**：支持进程内 SDK server 与外部 stdio server 混用；
- **Hooks**：Python 函数挂到 PreToolUse/PostToolUse/SubagentStart/SubagentStop/PermissionRequest 等事件；
- **子代理**：`AgentDefinition` 编程式定义 subagents + 会话 forking（changelog 提及）；
- **会话**：resume/fork、消息类型（AssistantMessage/ResultMessage 等）。

### 开源程度（两个语言版本差异很大）
- **Python**：https://github.com/anthropics/claude-agent-sdk-python ，7,897 stars，**MIT 许可证**，完整源码（src/claude_agent_sdk/），Python 3.10+，依赖 anyio/sniffio/mcp。`pip install claude-agent-sdk`。
- **TypeScript**：https://github.com/anthropics/claude-agent-sdk-typescript ，1,695 stars，**仓库只有 README/examples/scripts，无源码**；LICENSE.md 为 All rights reserved。npm 包 `@anthropic-ai/claude-agent-sdk`（v0.3.233）内是**压缩的 sdk.mjs（约 1.3MB）+ .d.ts 类型声明 + 捆绑 Bun 运行时提取脚本**，文件头还写着 "Want to see the unminified source? We're hiring!"。即 TS SDK 闭源分发、仅类型可见。

---

## 3. Gemini CLI（Google）

### 前端技术
- **TypeScript + React 19 + Ink**（注意用的是 Ink 的社区 fork：`ink npm:@jrichman/ink@6.6.9`），配 ink-gradient、ink-spinner、chalk、yargs、zod。Node >= 20。
- 仓库：https://github.com/google-gemini/gemini-cli ，**106,524 stars，Apache-2.0**，2025-04-17 创建，npm 包 `@google/gemini-cli`。

### Monorepo 结构（npm workspaces，packages/ 实测）
- `cli`（TUI 入口）、`core`（agent 内核，69 个依赖：@google/genai、@modelcontextprotocol/sdk、OpenTelemetry + Google Cloud 导出器、@a2a-js/sdk、grpc）、`a2a-server`、`sdk`（**@google/gemini-cli-sdk**，"提供与 Gemini 模型和工具交互的编程接口"）、`devtools`、`test-utils`、`vscode-ide-companion`（VS Code 伴侣扩展）。
- 沙箱：Docker 镜像（us-docker.pkg.dev/gemini-code-dev/gemini-cli/sandbox）。

### 扩展系统
- 扩展可打包 **prompts、MCP servers、custom commands、themes、hooks、sub-agents、agent skills**，通过 `gemini extensions install <GitHub仓库URL>` 安装（来源：docs/extensions/index.md）。
- 子代理：独立上下文/工具集的"专家代理"，作为工具暴露给主 agent，支持 @ 显式委派（docs/core/subagents.md）。

### 免费额度与认证
- README 明示：**个人 Google 账号免费层 60 请求/分钟、1,000 请求/天**；模型为 Gemini 3（1M token 上下文）。
- 认证三种：Sign in with Google（OAuth）、Gemini API key、Vertex AI（ADC/服务账号）（docs/get-started/authentication.mdx）。付费走 Google AI Pro / Ultra 订阅。
- 发布节奏：nightly / preview / stable 三通道，每周二发版。

---

## 4. Google Antigravity

### 基本情况
- **2025-11-18 发布**（HN 发布帖当日 1,088 分，https://news.ycombinator.com/item?id=45967814 ）。官方定位："agentic development platform, evolving the IDE into the agent-first era"——agent 横跨**编辑器、终端、浏览器**自主规划执行端到端任务。
- 2026-05-19 发布 **Antigravity 2.0**：更新的桌面应用 + Antigravity CLI（`agy`），两者共享同一 "Core Agent Engine"（TechCrunch 报道 + 官方 CLI 仓库 README）。

### 是否基于 VS Code 分支
- **是 VS Code fork（Electron）**：HN 发布帖大量用户实测确认（"It's VS Code"、"VSCode fork very similar to Cursor"、入门清单甚至让看 VS Code 教程）。
- 更具体的说法（Kilo 博客分析，https://blog.kilo.ai/p/antigravity-is-the-most-expensive ）：代码中出现 "Cascade" 等痕迹，**实质是 Windsurf fork**（Windsurf 本身是 VS Code fork）——Google 2025 年以约 $2B 级交易吸收了 Windsurf 团队/技术。此点为第三方分析，官方未确认。

### 核心机制
- **Artifacts**：agent 产出的报告/清单/录屏等"交付物"供人审阅（PromptArmor 漏洞分析中提到 "Artifact > Review Policy > Agent Decides" 流程，https://www.promptarmor.com/resources/google-antigravity-exfiltrates-data ）。
- **Mission Control / Agent Manager**：跨 workspace 管理多个并行 agent 的界面（官方文案 "managing agents across workspaces"；PromptArmor 称之为 "Agent Manager interface"）。
- **内置浏览器**：agent 自带浏览器子代理（"agentic browser subagent"、"browser tools feature"）。

### 后端/模型
- 发布时用户实测可选模型：**Gemini 3 Pro（High/Low）、Claude Sonnet 4.5（含 Thinking）、GPT-OSS 120B**（HN 用户 nateb2022 报告）；后续还接入 Opus 等。企业版连接 GCP 项目（Vertex AI，现改名 Gemini Enterprise Agent Platform）。

### 价格
- 发布时为**免费公开预览**（free individual plan with "generous rate limits"，HN 引述定价页）。
- 之后绑定 Google 订阅：**Google AI Pro $19.99/月**（含 Antigravity/Gemini CLI 使用额度，HN 多条评论确认）；**Google AI Ultra $249.99/月**（高额度档）。**$19.99/月 对应的是 Google AI Pro 档**。官方定价页（antigravity.google/pricing）本次网络无法直连，以上为二手来源，建议以官网为准。

### 开源情况与 SDK
- IDE 本体**闭源**。官方 GitHub 组织 https://github.com/google-antigravity 仅两个仓库：
  - **antigravity-sdk-python**（3,023 stars，Apache-2.0，Python）：`pip install google-antigravity`，提供 Agent/LocalAgentConfig 等 agent 编排 API；但 README 强调**核心是编译好的 runtime 二进制（随 PyPI wheel 分发），克隆仓库本身跑不起来**。
  - **antigravity-cli**（1,913 stars）：只有 README/CHANGELOG/examples，**无源码、无许可证**，二进制经 install.sh 安装。

---

## 5. xAI Grok Build（xAI 的编码 Agent）

**结论：xAI 确实发布了编码 Agent，产品名 Grok Build（命令 `grok`），且已开源（Apache-2.0，Rust 实现）。**

### 时间线
- **2025-08-28**：先发布编码模型 **grok-code-fast-1**（Reuters 报道 "Musk's xAI forays into agentic coding with new model"；x.ai/news/grok-code-fast-1；并上线 GitHub Copilot 公开预览）。当时还没有 agent 产品。
- **2026-04**：被发现在准备 credits 计费系统（testingcatalog.com）。
- **2026-05-14**：**Grok Build CLI 早期访问发布**（x.ai/news/grok-build-cli、x.ai/cli），初期仅限 SuperGrok Heavy（$300/月）订阅者。
- **2026-06**：Composer 2.5 接入 Grok Build。
- **2026-07-12~14**：安全风波——社区 wire-level 分析发现 CLI 会把**整个 git 仓库（含 .env）上传到 Google Cloud 存储桶**（HN 539 分帖；theregister.com 报道 Musk 承诺清除）。
- **2026-07-14/15**：**开源**，仓库 https://github.com/xai-org/grok-build （x.ai/open-source，HN 590 分）。
- **2026-08**：Grok Build 1.0，新增 remote-workspace 命令（runtimewire.com 报道）。

### 技术实现（官方仓库实测）
- **语言：Rust**（约 61MB Rust 代码），25,266 stars，Apache-2.0，从 SpaceXAI monorepo 定期同步（SOURCE_REV 记录版本）。
- **UI：全屏 TUI**（ratatui 系，自研 xai-ratatui-inline / xai-ratatui-textarea crates），支持鼠标交互；可交互、可 headless（`-p` 用于脚本/CI）、可通过 **ACP（Agent Client Protocol）** 嵌入编辑器。
- Crate 结构：`xai-grok-shell`（agent runtime）、`xai-grok-tools`（工具实现）、`xai-grok-workspace`（文件系统/VCS/checkpoints）、`xai-grok-mcp`、`xai-grok-hooks`、插件市场、skills、sandbox、voice、telemetry 等 70+ crates。
- THIRD-PARTY-NOTICES 披露：**树内移植了 openai/codex 和 sst/opencode 的工具实现**。
- 安装：`curl -fsSL https://x.ai/cli/install.sh | bash`（macOS/Linux）/ PowerShell 脚本（Windows），预编译二进制；首次启动浏览器 OAuth 认证。
- **注意**：CONTRIBUTING 声明 "External contributions are not accepted"——属于**源码可见（source-available）但不接受外部贡献的 Apache-2.0**。
- **无独立 SDK**；编程集成走 ACP 和 headless 模式。社区衍生：grok-build-desktop（Electron GUI）、grok-build-ios 等。

---

## 横向对比速览

| 产品 | 前端/UI | 语言/运行时 | 开源情况 | SDK |
|---|---|---|---|---|
| Claude Code | React + Ink（vendored）终端 TUI | TypeScript/Node(≥22)，Bun 打包 | 闭源（npm 打包 JS；仓库仅文档/插件）；社区 sourcemap 还原可读源码 | Claude Agent SDK（Python MIT 开源；TS 版闭源压缩） |
| Gemini CLI | React 19 + Ink fork | TypeScript/Node(≥20)，npm monorepo | **完全开源 Apache-2.0**（106k stars） | @google/gemini-cli-sdk（同仓库内） |
| Antigravity | VS Code/Windsurf fork（Electron GUI）+ TUI CLI | IDE 闭源；SDK 为 Python + 编译二进制 | IDE 闭源；SDK 仓库 Apache-2.0 但依赖闭源二进制 | antigravity-sdk-python（PyPI） |
| Grok Build | ratatui 全屏 TUI + ACP | Rust | **Apache-2.0 开源**（但不收外部贡献） | 无独立 SDK，走 ACP/headless |

**未能核实/公开资料未披露的部分**：Antigravity 官方定价页与官方博客原文（网络不可达，定价数字来自 HN 等二手来源）；Claude Code 官方对 "Bun 打包" 的公开确认（仅从还原源码推断）；Antigravity "Windsurf fork" 说法官方从未确认。
