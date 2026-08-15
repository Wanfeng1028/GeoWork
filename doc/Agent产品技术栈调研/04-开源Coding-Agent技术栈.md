# 第四部分：开源 Coding Agent 技术实现调研

> 调研日期：2026-08-15。语言构成数据来自各仓库 GitHub Languages API（首页 Language bar 数据）；star 数为当日实时值。

---

## 1. OpenCode — github.com/sst/opencode（197.7k stars，MIT）

**核心结论：现在核心不是 Go，是 TypeScript（Bun 运行时）；但历史上确实是 Go + Bubble Tea，后来整体重写。**

- **语言构成**：TypeScript 26.7MB、MDX 7.4MB、CSS 1.0MB，**没有任何 Go 代码**（全仓搜索 go.mod 结果为 0）。
- **Go 历史已核实**：早期 tag（v0.0.1～v0.0.20）存在 `go.mod`，依赖 `charmbracelet/bubbletea v1.3.4`、`bubbles`、`lipgloss`、`glamour`、`huh` —— 即**最初的终端 TUI 确实是 Go 的 Bubble Tea**。从 v0.1.0 起仓库已是纯 TypeScript/Bun monorepo（README 徽章已指向 anomalyco/opencode，项目现由 anomaly 团队维护）。
- **client/server 架构**：是。monorepo 中有 `packages/server`（HTTP API：api.ts/routes.ts/handlers）、`packages/client`、`packages/sdk`，TUI/桌面端均作为客户端连接本地 server。
- **终端 TUI（现状）**：`packages/tui`（@opencode-ai/tui），基于 **OpenTUI（@opentui/core + @opentui/solid）+ SolidJS**，不再是 Bubble Tea。
- **桌面端**：有，Beta。`packages/desktop` 为 **Electron**（electron 42 + electron-builder + electron-vite）+ SolidJS 应用。
- **SDK**：`@opencode-ai/sdk`（TypeScript，由 OpenAPI spec 用 @hey-api/openapi-ts 生成），仓库内 `packages/sdk/js`。
- **多模型**：支持任意 LLM provider（配置 API key），另有官方 Zen 精选模型列表。内置 build/plan 双 agent。
- 来源：https://github.com/sst/opencode 、https://api.github.com/repos/sst/opencode/languages 、tag v0.0.20 的 go.mod、https://opencode.ai/docs/

---

## 2. Cline — github.com/cline/cline（66.2k stars，Apache-2.0）

- **形态**：TypeScript 为主（22.4MB TS，另有少量 Rust 69KB）。起家于 VS Code 扩展，现已扩展为：**VS Code 扩展 + JetBrains 插件（未开源）+ 独立 CLI + Kanban 多 agent 看板 + SDK** 的 monorepo。
- **CLI**：`npm i -g cline`（`apps/cli`，@cline/cli），支持交互式与 headless（CI/CD），TUI 用 **@opentui/react + React 19**；还有多 agent 团队、cron 定时 agent、Slack/Telegram/Discord 接入。
- **SDK**：有，`@cline/sdk`（Node.js 编程式 agent API，`sdk/` 目录），CLI/Kanban/扩展共用同一引擎，支持自定义工具与插件系统。
- **架构特性（README 明确）**：Plan/Act 双模式；MCP servers 支持；**human-in-the-loop 审批**（每个文件编辑和命令需批准，可切换 auto-approve）；checkpoint 回滚；`.clinerules` 规则与 skills。
- **多模型**：Anthropic、OpenAI、Gemini、OpenRouter、Bedrock、Vertex、Cerebras/Groq、Ollama/LM Studio、任意 OpenAI 兼容 API。
- 来源：https://github.com/cline/cline 、https://api.github.com/repos/cline/cline/languages 、apps/cli/package.json

---

## 3. Kilo Code — github.com/Kilo-Org/kilocode（26.9k stars，MIT）

- **分支渊源（已核实，两阶段）**：Kilo 最初是 **Roo Code 的分支**（Roo Code 本身是 Cline 分支）——证据：`packages/kilo-vscode/README.md` 有 "Coming from Roo Code?" 迁移指南、`migration.ts` 迁移代码、i18n 中的 Roo Code 引用。后来整个仓库**重构到 OpenCode 之上**：README 明说 "Kilo CLI is a fork of OpenCode"，仓库内含 `packages/opencode`，CONTEXT.md 标题即 "OpenCode Session Runtime"。
- **形态**：VS Code 扩展 + JetBrains 插件（Kotlin 4.8MB）+ CLI（@kilocode/cli）+ Cloud Agent + 代码审查。
- **语言构成**：TypeScript 32MB、Kotlin 4.8MB。VS Code webview 用 **SolidJS**（solid-js + vite-plugin-solid，App.tsx）。
- 来源：https://github.com/Kilo-Org/kilocode 、packages/kilo-vscode/README.md、README.md 第 171 行

---

## 4. Goose — github.com/block/goose（52.8k stars，Apache-2.0，Block 出品）

- **核心是 Rust**（8.7MB）：README 明确 "Built in Rust for performance and portability"。Cargo workspace 含 goose、goose-cli、goose-mcp、goose-providers、goose-sdk 等 crates。
- **桌面应用是 Electron，不是 Tauri**：`ui/desktop` 使用 electron-forge + Vite + React + Radix UI（package.json 中 electron-forge/electron-updater 等）。
- **CLI**：有，goose-cli crate，"A full CLI for terminal workflows"。
- **扩展机制**：基于 **MCP**（Model Context Protocol），README："Connect to 70+ extensions via the Model Context Protocol open standard"；桌面端还集成了 @agentclientprotocol/sdk（ACP）与 @mcp-ui/client。
- **语言构成**：Rust 8.7MB、TypeScript 3.1MB（桌面 UI + TS SDK）。
- 来源：https://github.com/block/goose 、ui/desktop/package.json、https://api.github.com/repos/block/goose/languages

---

## 5. Aider — github.com/Aider-AI/aider（48.2k stars，Apache-2.0）

- **纯 Python 终端工具**（Python 1.33MB 占绝对主导）："AI Pair Programming in Your Terminal"，`python -m pip install aider-install` 安装。无独立前端/服务端，就是终端 CLI。
- **repo map 实现（已核实源码）**：`aider/repomap.py` 直接 `from tree_sitter import Query`，并借助 **grep_ast**（TreeContext、filename_to_lang）做 tree-sitter 语法解析提取符号标签，配合 diskcache 缓存与排序生成整库地图（"Aider makes a map of your entire codebase"）。
- **git 集成**：深度集成，自动提交并生成合理的 commit message（"Aider automatically commits changes with sensible commit messages"），支持在已有 git 仓库中结对编程。
- 来源：https://github.com/Aider-AI/aider 、aider/repomap.py 源码

---

## 6. OpenHands — github.com/OpenHands/OpenHands（84.1k stars，MIT）

**重要变化：主仓库已重塑为 "Agent Canvas"（自托管 coding agent 控制中心），原 Python 后端迁至独立仓库。**

- **前端（主仓库）**：TypeScript 7.9MB 占主导。**React 19 + react-router 7 + Vite**（另有 @heroui/react、Monaco editor），并带 **Electron** 桌面壳（electron/ 目录 + electron-builder.config.mjs）。npm 包名 @openhands/agent-canvas。
- **后端**：**OpenHands Agent Server**，位于 https://github.com/OpenHands/software-agent-sdk （Python 12MB）——**FastAPI + uvicorn + websockets**（pyproject 明确依赖 fastapi/uvicorn/websockets/docker/SQLAlchemy），是"在一台机器上运行多个 agent 的 REST API"。
- **事件流架构**：新版 SDK 中为事件化的会话模型（`event_router.py`、`event_service.py`、`event_store.py`、event_tree 测试），延续了原 OpenHands 的 event stream 思想；旧版 "EventStream" 类名在新仓库中已不存在。
- **沙箱**：支持 Docker 沙箱（README "Option 2: With a Docker Sandbox"），agent 可跑在本地、Docker 容器、VM、Kubernetes 临时工作区或 OpenHands Cloud。
- **跑多种 Agent**：是。README 明确支持 **OpenHands、Claude Code、Codex、Gemini 或任何 ACP（Agent-Client Protocol）兼容 agent**。
- **SDK**：Python SDK（openhands-sdk / openhands-tools / openhands-agent-server，MIT），另有 OpenHands-CLI（Python 打包二进制，https://github.com/OpenHands/OpenHands-CLI ）。
- 来源：https://github.com/OpenHands/OpenHands 、https://github.com/OpenHands/software-agent-sdk 、openhands-agent-server/pyproject.toml

---

## 7. DeepSeek 相关第三方 Agent

- **Reasonix（存在，已核实）**：即 **esengine/DeepSeek-Reasonix**（34.6k stars，MIT，reasonix.io）。"DeepSeek 原生终端 coding agent"，主打 prefix-cache 稳定、可长期挂机。**核心是单个 Go 静态二进制**（Go 23MB，CGO_ENABLED=0；另有 TypeScript 6.9MB 用于桌面端/Web/文档）。四种入口共用同一本地引擎：终端 CLI/TUI、桌面应用（dmg/exe/deb）、浏览器、VS Code 扩展（经 ACP 连接本地 `reasonix acp` 后端）。特性：Plan 模式、权限、工作区沙箱、每轮 checkpoint、MCP + Extension Protocol v1、reasonix.toml 配置驱动、双模型（executor+planner）。注意：这是社区项目，非 DeepSeek 官方。来源：https://github.com/esengine/DeepSeek-Reasonix
- **DeepSeek-TUI（无权威同名项目）**：GitHub 上只有若干小型同名/教程仓库（如 DeepSeek-TUI-app/DeepSeek-TUI，Rust，3 stars；azevedoguigo/deepseek-tui，Go），无一是主流项目。**最可能的真实所指是 DeepSeek 官方的 deepseek-harness（`dsh`）**：deepseek-ai/deepseek-harness，**108k stars，MIT，TypeScript**，口号 "Everything is a Plugin"，基于 Cordis 插件框架（cordiverse），含 apps/cli（@deepseek-ai/dsh，含 dsh-terminal、plan-mode、MCP client 等插件）与 apps/web（`npx @deepseek-ai/dsh web` 启动 Web UI）。社区还有 Rust 写的 openma-ai/deepseek-harness-tui 等 TUI 外壳。来源：https://github.com/deepseek-ai/deepseek-harness
- **"deepseek gui"（无权威项目）**：搜索只返回杂项（如 ihatecsv/deepseek-ocr-client，Electron GUI，775 stars）。最接近的官方 GUI 即上述 deepseek-harness 的 Web UI 及社区桌面端 anywhere-labs/deepseek-harness-desktop（TypeScript，4.5k stars）。
- **"kunruntime"（GitHub 搜索 0 结果）**：几乎可确定是 **Kun 的运行时**——**KunAgent/Kun**（6.1k stars，PolyForm Noncommercial 1.0.0 许可，非标准开源）。本地优先 AI agent 工作台，**TypeScript 38MB**，**Electron 桌面 GUI + 终端 TUI 共用同一个本地运行时 `kun serve`（HTTP/SSE）**（package.json 自述 "Electron workbench for the Kun runtime (HTTP/SSE)"）。Code/Work 双模式、Design 画布、MCP/Skills/扩展、多 Provider。来源：https://github.com/KunAgent/Kun

---

## 8. Roo Code — github.com/RooCodeInc/Roo-Code（24.3k stars，Apache-2.0）

- **技术栈**：TypeScript 10.9MB 的 **VS Code 扩展**，webview 用 **React 18**；pnpm monorepo（packages/core、apps/cli、docs 等）。Cline 的分支（README 自述 "Cline (from where Roo Code originated)"）。特性：Code/Architect/Ask/Debug/自定义 Modes、MCP servers。
- **重要状态**：README 声明 **"The Roo Code Extension was shut down on May 15th"**（2026-05-15 停运），官方建议转向社区分支 ZooCode（https://github.com/Zoo-Code-Org/Zoo-Code ）或回归 Cline。

---

## 速览对照表

| 产品 | 前端/UI | 后端/核心 | SDK | 协议 |
|---|---|---|---|---|
| OpenCode | OpenTUI+SolidJS TUI；Electron 桌面端 | TypeScript/Bun，client/server | @opencode-ai/sdk (TS) | MIT |
| Cline | VS Code 扩展；CLI 用 @opentui/react | TypeScript 引擎（多端共用） | @cline/sdk (Node.js) | Apache-2.0 |
| Kilo Code | VS Code 扩展(SolidJS webview)+JetBrains(Kotlin)+CLI | TS，基于 OpenCode fork（早期为 Roo/Cline fork） | packages/sdk | MIT |
| Goose | Electron+React 桌面；CLI | Rust | goose-sdk (TS/Rust) | Apache-2.0 |
| Aider | 终端（prompt_toolkit 系，纯 Python） | Python；repo map=tree-sitter+grep_ast；深度 git 集成 | 无（库即 CLI） | Apache-2.0 |
| OpenHands | React 19 + Electron (Agent Canvas) | Python FastAPI Agent Server（software-agent-sdk），事件化会话，Docker 沙箱 | Python SDK + OpenHands-CLI | MIT |
| Reasonix | TUI+桌面+浏览器+VS Code(ACP) | Go 单二进制 | 无独立 SDK（ACP/扩展协议） | MIT |
| DeepSeek Harness | Web UI + CLI | TypeScript/Cordis 插件架构 | 插件体系 | MIT |
| Kun | Electron GUI + TUI 共用 kun serve 运行时 | TypeScript | 扩展 API | PolyForm Noncommercial |
| Roo Code | VS Code 扩展（React webview） | TypeScript；已停运 | — | Apache-2.0 |

---

## 关键纠偏

1. **OpenCode 核心已从 Go/Bubble Tea 重写为 TypeScript/Bun**（仅历史版本是 Go）。
2. **OpenHands 主仓库已转型为 TypeScript 的 Agent Canvas**，Python FastAPI 后端在 software-agent-sdk 仓库。
3. **Kilo Code 兼具 "Roo Code 分支" 与 "OpenCode fork" 双重渊源**。
4. **"kunruntime" 实为 KunAgent/Kun 的运行时**。
5. **Roo Code 已于 2026-05-15 停运**。
