# 第一部分：OpenAI Codex 全系产品技术实现调研

> 调研日期：2026-08-15。主要来源：GitHub API（openai/codex 仓库实时数据）、OpenAI 官方博客、developers.openai.com 文档、VS Code Marketplace、JetBrains 官方博客。

---

## 1. Codex CLI（开源）

**仓库**：https://github.com/openai/codex ｜ Apache-2.0 ｜ 实测 **106,060 stars**（2026-08-15）｜ 描述 "Lightweight coding agent that runs in your terminal"

**语言构成（GitHub API 实测字节数）**：Rust 约 4900 万字节，占绝对主导（>96%）；其余为 Python（约 1.4MB，构建/脚本）、Starlark（Bazel 构建）、TypeScript（仅约 90KB，是 npm shim）、Shell/PowerShell（安装脚本）。

**TypeScript → Rust 重写已核实**：
- 2025-04 首发时是 TypeScript/Node（Ink/React 渲染 TUI）。
- Rust 实现（`codex-rs/`）最早提交在 2025-04 底（2025-04-30 已有 Rust release 脚本）。
- **2025-08-08 PR #2048 "chore: remove the TypeScript code from the repository"** 删除了旧 TS 代码。当前状态：**纯 Rust**。
- npm 包 `@openai/codex`（最新 0.147.0）现在只是一个 JS shim（`bin/codex.js`），通过 optionalDependencies 拉取平台原生 Rust 二进制（`@openai/codex-linux-x64`、`-darwin-arm64`、`-win32-x64` 等）。

**前端（终端 UI）**：Rust 的 `codex-rs/tui` crate，基于 **ratatui + crossterm**（含 scrolling-regions 等 unstable 特性），syntect 做语法高亮，pulldown-cmark 渲染 Markdown，支持图片显示（image crate）、主题（/theme，自定义 .tmTheme）。

**后端/运行时**：
- 架构是"内核 + 多前端"：`codex-rs/core`（agent loop、会话/turn 管理、rollout 持久化在 `~/.codex/sessions`）+ `app-server`（JSON-RPC 2.0，stdio/WebSocket/Unix socket 传输，驱动 VS Code 扩展等富客户端）+ `tui` + `exec`（非交互）+ `mcp-server`。
- **沙箱**（源码 + 历史文档核实）：
  - macOS 12+：**Seatbelt**，调用 `/usr/bin/sandbox-exec` 加载内置 `.sbpl` 策略文件（`seatbelt_base_policy.sbpl` 等，编译进二进制）。
  - Linux：当前默认 **bubblewrap（bwrap）** 容器 + `PR_SET_NO_NEW_PRIVS` + **seccomp 网络过滤**；**Landlock + seccomp** 保留为 legacy 回退路径（`use_legacy_landlock=true`）。WSL2 走 bwrap 路径，WSL1 不支持。
  - Windows：原生 Windows 沙箱（`windows-sandbox-rs` crate）或 WSL2 内走 Linux 方案。
  - 审批策略与沙箱模式正交：read-only / workspace-write / danger-full-access × untrusted / on-request / on-failure / never。
- **MCP 双向支持**：既能作为 MCP 客户端连接外部 MCP server（`codex mcp add`，rmcp crate），也能作为 MCP server 暴露自己（`codex mcp-server`，stdio JSON-RPC，thread/turn/account/config 等 v2 RPC + 审批 elicitation）。
- **子代理**：core 中有 `tasks/review.rs`、`codex_delegate`（one-shot 子线程）、subagent hooks（subagent-start/stop）、`/agent` 命令切换查看子代理线程；文档说明子代理需用户显式触发，可为不同子代理配置模型（`[agents]` 配置）。
- **codex exec**：非交互模式，输出到 stdout（支持 `--json`），用于 CI；另有官方 GitHub Action（`codex/github-action` 文档页）。
- **/review**：TUI 斜杠命令，启动专用审查子代理，支持对基础分支 diff、未提交更改、指定 commit 审查，可配 `review_model`。
- 其他：`codex cloud` 子命令管理云端任务、`codex resume` 恢复会话、`codex app` 打开桌面应用、远程 TUI（`codex --remote ws://`）。

**来源**：https://github.com/openai/codex 、https://github.com/openai/codex/pull/2048 、https://github.com/openai/codex/tree/main/codex-rs 、https://developers.openai.com/codex 、npm `@openai/codex`

---

## 2. Codex 桌面应用（Codex app，闭源）

**发布**：2026-02-02 macOS 首发（博客 "Introducing the Codex app"），2026-03-04 登陆 Windows。

**分发**（从 CLI 源码 `codex-rs/cli/src/desktop_app/` 核实）：
- macOS：DMG 下载（`persistent.oaistatic.com/codex-app-prod/Codex.dmg`），bundle id `com.openai.codex`。
- Windows：**Microsoft Store**（产品 ID 9PLM9XGG6VKS，MSIX 打包，包名 `OpenAI.Codex_*`），CLI 通过 `codex://threads/new?path=...` 深链接唤起。

**技术栈**：应用本体**闭源**（官方开源清单明确 "Codex 应用 - 非开源"；仓库内无 Tauri/Electron 痕迹）。但可确认它**复用 Codex CLI 的 Rust 内核**：
- 官方 app-server README 明说 app-server 是"驱动富客户端（如 VS Code 扩展）的接口"；开源清单把 app-server 列为独立开源组件（`openai/codex/codex-rs/app-server`）。
- 博客明确"应用会继承 Codex CLI 和 IDE 扩展的会话历史与配置"（共享 `~/.codex`），且"使用与 CLI 相同的原生、开源系统级沙箱"。
- CLI 侧有 `remote-control`、`app-server proxy`、cloud-tasks 等专为托管客户端设计的基础设施。
- 前端 UI 具体框架（Electron/Tauri/原生）**公开资料未披露**。

**功能实现**：
- **Worktrees**：基于原生 **git worktree**，每个线程绑定一个 worktree（默认 detached HEAD），支持 Local ↔ Worktree "Handoff" 迁移线程；Automations 在专用后台 worktree 运行。
- **Automations（定时任务）**：cron 表达式调度，分"独立自动化"（结果进 Triage 收件箱）和"对话自动化"（心跳式唤醒同一对话）；使用默认沙箱设置，可结合 skills（`$skill-name` 触发）。
- **Plugins/Skills**：skills = 指令+资源+脚本的打包（与 CLI/IDE 共享，可 check in 仓库共享给团队）；plugins = skills + app 集成 + MCP server 的组合（2026-04 已发布 90+ 插件：Figma、Linear、Cloudflare、Vercel、Atlassian 等）。skills 库开源在 https://github.com/openai/skills 。
- 2026-04 更新（"Codex for almost everything"）：后台 computer use（看屏幕/点击/输入）、应用内浏览器、SSH 远程 devbox、多终端、记忆预览。

**来源**：https://openai.com/index/introducing-the-codex-app/ 、https://openai.com/index/codex-for-almost-everything/ 、https://developers.openai.com/codex/app/worktrees 、https://developers.openai.com/codex/open-source

---

## 3. Codex cloud / Codex Web（chatgpt.com/codex，闭源）

**历史**：2025-05-16 以 codex-1（o3 微调版）发布研究预览；2025-10-06 GA。

**云端隔离环境**（官方文档核实）：
- 每个任务创建**独立容器**，在选定分支/commit SHA 检出仓库；默认镜像叫 **universal**，参考 Dockerfile 开源在 https://github.com/openai/codex-universal （"Base docker image used in Codex environments"，含 entrypoint.sh、setup_universal.sh）。
- 环境可配 setup script（有网）、maintenance script、环境变量；**Secrets 额外加密、仅 setup 阶段可见，agent 阶段前移除**。
- **容器缓存最长 12 小时**加速后续任务。
- 网络：环境运行在 **HTTP/HTTPS 网络代理**之后，所有出站流量过代理；agent 阶段默认断网，可开启受限/不受限访问。
- 是容器还是 microVM：官方只说 "isolated container"，**更底层隔离技术（是否 gVisor/Firecracker 类）公开资料未披露**。
- 并行任务：每任务独立环境互不干扰，天然并行；任务 1~30 分钟量级，产出 diff/PR/终端日志引用。

**起手方式**（官方集成文档核实）：
- **GitHub**：连接 GitHub 账号后，在 Issue/PR 评论 `@codex`（`@codex review` 触发代码审查、`@codex fix...` 触发云任务），支持自动审查，遵循 AGENTS.md 中的 Review guidelines，只标 P0/P1。
- **Slack**：安装 Slack 应用，频道/线程 `@Codex` + prompt，自动选环境/repo 映射，回任务链接。
- **Linear**：把 issue 指派给 Codex 或评论 `@Codex`，支持 triage 规则自动委派；本地访问 Linear 则用 Linear MCP server（`codex mcp add linear --url https://mcp.linear.app/mcp`）。
- 也可从 IDE 扩展、CLI（`codex cloud`）、ChatGPT 移动端发起。

**来源**：https://openai.com/index/introducing-codex/ 、https://openai.com/index/codex-now-generally-available/ 、https://developers.openai.com/codex/cloud/environments 、https://github.com/openai/codex-universal

---

## 4. Codex IDE 扩展

**VS Code / Cursor / Windsurf / VS Code Insiders**：
- 官方扩展 "Codex – OpenAI's coding agent"（publisher: OpenAI，id `openai.chatgpt`），Marketplace 显示 **1310 万+ 安装**。Cursor/Windsurf 有各自分发版本，同一扩展适配 VS Code 系分支。
- **架构：复用 CLI Rust 内核**——官方 app-server README 明说 "`codex app-server` is the interface Codex uses to power rich surfaces such as the Codex VS Code extension"。即扩展（TypeScript 前端壳）通过 JSON-RPC 与本地 `codex app-server` 进程通信，共享 `~/.codex` 配置与会话。扩展本体闭源。
- 功能：侧边栏面板结对、@文件引用、模型/推理力度切换、审批模式（Chat/Agent/Full Access）、云端委派（Run in the cloud）、云任务 diff 拉回本地、图片输入、gpt-image 图像生成、缓存式 web search。

**JetBrains**：不是 OpenAI 独立插件，而是**原生集成进 JetBrains AI Assistant 的 AI Chat**（IDE 2025.3+，JetBrains 2026-01 博客确认），在 agent picker 里选 Codex；支持 JetBrains AI 订阅 / ChatGPT 账号 / API key 三种登录。底层接入方式（是否也走 app-server）**公开资料未披露**。

**Xcode**：Xcode 26.4 起作为 MCP/app-server 客户端接入（app-server 源码里有针对 `client_name == "Xcode"` 26.4 的 elicitation 兼容处理，证明 Xcode 通过 app-server/MCP 协议连接本地 Codex 引擎）。

**来源**：https://marketplace.visualstudio.com/items?itemName=openai.chatgpt 、https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md 、https://blog.jetbrains.com/ai/2026/01/codex-in-jetbrains-ides/ 、https://developers.openai.com/codex/ide

---

## 5. ChatGPT Agent / agent 模式

- 2025-07-17 发布（"Introducing ChatGPT agent"）：统一 agentic 系统，融合 Operator（网页操作）+ deep research（综合检索）+ ChatGPT 对话能力。
- **实现**：agent 拥有一台**云端虚拟计算机**（virtual computer），工具集包括可视化浏览器（GUI 点击）、文本浏览器、终端、直接 API 调用、ChatGPT connectors（Gmail/GitHub 等）。跨工具保持同一虚拟机的上下文。
- 前后端具体技术（虚拟机实现、编排框架）**公开资料未披露**；闭源。与 Codex 的关系：Codex 后来成为 ChatGPT 内的编码 agent 入口（ChatGPT 侧边栏/移动端可派发 Codex 任务，2026-05 起移动端可通过安全 relay 层连接本地/远程 Codex 机器）。

**来源**：https://openai.com/index/introducing-chatgpt-agent/ 、https://openai.com/index/work-with-codex-from-anywhere/

---

## 6. Codex SDK

**TypeScript SDK**（`@openai/codex-sdk`，最新 0.147.0，Apache-2.0）：
- 源码在 https://github.com/openai/codex/tree/main/sdk/typescript 。
- 实现方式：**spawn `codex` CLI 子进程，通过 stdin/stdout 交换 JSONL 事件**（依赖 `@openai/codex` 包）。
- 能力：`Codex().startThread()` / `resumeThread()`（会话持久化在 `~/.codex/sessions`）、`thread.run()` / `runStreamed()`（流式事件）、结构化输出（JSON Schema / Zod）、图片输入、MCP 配置。Node 18+，服务端使用。
- 2025-10-06 随 GPT-5-Codex GA 一同发布；Instacart 已用它驱动内部后台 agent 平台 Olive。

**Python SDK**（`openai-codex`，实验性）：
- 源码 `sdk/python`，Python 3.10+，pydantic 依赖，通过 **JSON-RPC 控制本地 codex app-server**；依赖 `openai-codex-cli-bin` 二进制包。支持 ChatGPT 浏览器登录/设备码登录、同步与 Async 客户端。

**codex-rs 库**：Rust 内核各 crate（codex-core、codex-tui、codex-app-server 等）**未发布到 crates.io**（实测查询不存在），只能以源码/git 依赖方式使用；官方推荐的嵌入途径是 SDK 或 app-server 协议。

**app-server 协议**（深度集成用）：JSON-RPC 2.0，stdio/WS/Unix socket，`thread/start`、`turn/start`、`turn/interrupt`、审批请求、`codex/event/*` 流式事件；可用 `codex app-server generate-ts / generate-json-schema` 生成类型定义。

**来源**：https://github.com/openai/codex/tree/main/sdk 、https://developers.openai.com/codex/sdk 、https://developers.openai.com/codex/app-server

---

## 关键结论速览

| 产品 | 前端 | 后端/内核 | 开源 |
|---|---|---|---|
| Codex CLI | Rust（ratatui+crossterm TUI） | Rust 内核 + Seatbelt/bwrap+seccomp/Landlock 沙箱 | 是，Apache-2.0 |
| 桌面应用 | 闭源（UI 框架未披露），macOS DMG / Windows Store | 复用 CLI Rust 内核（app-server），git worktree，cron 自动化 | 否（内核开源） |
| Codex cloud | chatgpt.com Web（闭源） | 每任务独立容器（universal 镜像开源），12h 缓存，出站 HTTP 代理，默认断网 | 否（基础镜像开源） |
| IDE 扩展 | VS Code 系扩展（TS 壳）/ JetBrains AI Chat 内置 / Xcode MCP 客户端 | 通过 app-server JSON-RPC 复用 Rust 内核 | 否 |
| ChatGPT Agent | ChatGPT Web/App | 云端虚拟机 + 浏览器/终端/API 工具（细节未披露） | 否 |
| SDK | TS（spawn CLI + JSONL）/ Python（app-server JSON-RPC） | 同左 | 是，仓库内 sdk/ |

**未能查到的点**：桌面应用 UI 框架、Codex cloud 容器之下的隔离技术（是否 microVM）、ChatGPT Agent 虚拟机实现、JetBrains 集成的底层通道——这些公开资料均未披露。
