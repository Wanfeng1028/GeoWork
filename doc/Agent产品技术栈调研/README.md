# Agent 产品技术栈调研（2026-08-15）

对市面主流 Coding Agent 与 Work Agent 产品（含各家 SDK/开发套件）的前端、后端、运行时技术实现进行的联网调研，共五个部分。所有结论均标注来源；查不到的明确标注"公开资料未披露"。

## 目录

| 文档 | 覆盖产品 |
|---|---|
| [01-OpenAI-Codex全系技术栈.md](./01-OpenAI-Codex全系技术栈.md) | Codex CLI、Codex 桌面应用、Codex cloud(Web)、Codex IDE 扩展、ChatGPT Agent、Codex SDK |
| [02-Claude-Gemini-Grok技术栈.md](./02-Claude-Gemini-Grok技术栈.md) | Claude Code、Claude Agent SDK、Gemini CLI、Google Antigravity、xAI Grok Build |
| [03-商业闭源AI-IDE技术栈.md](./03-商业闭源AI-IDE技术栈.md) | Cursor、Windsurf(→Devin Desktop)、Kiro、Devin、GitHub Copilot、Qoder 全系、Trae 全系、CodeBuddy、WorkBuddy、Manus |
| [04-开源Coding-Agent技术栈.md](./04-开源Coding-Agent技术栈.md) | OpenCode、Cline、Kilo Code、Goose、Aider、OpenHands、Reasonix、DeepSeek Harness、Kun、Roo Code |
| [05-开源Work-Agent生态技术栈.md](./05-开源Work-Agent生态技术栈.md) | OpenClaw、Pi、Hermes Agent、OpenManus、Browser Use、UI-TARS/Agent TARS、E2B Open Computer Use、LobsterAI、AstrBot、MoltWorker、memU |

## 全局速览表

| 产品 | 前端/UI | 后端/内核语言 | 开源 |
|---|---|---|---|
| Codex CLI | Rust（ratatui+crossterm） | Rust，Seatbelt/bwrap 沙箱 | ✅ Apache-2.0 |
| Codex 桌面/IDE/cloud | 闭源 UI（框架未披露）/ VS Code 扩展壳 / Web | 复用 Rust 内核（app-server JSON-RPC）；云端每任务独立容器 | ❌（内核与基础镜像开源） |
| Claude Code | React + Ink（vendored）终端 TUI | TypeScript/Node≥22，Bun 打包 | ❌（仓库仅文档/插件；社区有 sourcemap 还原） |
| Claude Agent SDK | — | Python 版 MIT 开源；TS 版闭源压缩；均捆绑 Claude Code CLI 引擎 | ⚠️ 部分 |
| Gemini CLI | React 19 + Ink fork | TypeScript/Node≥20 monorepo | ✅ Apache-2.0 |
| Antigravity | VS Code fork（疑基于 Windsurf）+ TUI CLI | IDE 闭源；Python SDK 捆绑闭源二进制 | ❌ |
| Grok Build | ratatui 全屏 TUI + ACP | Rust，70+ crates | ✅ Apache-2.0（不收外部贡献） |
| Cursor | VS Code 分支（Electron） | 自研 Composer 2.5/Tab；云端隔离 VM | ❌ |
| Windsurf→Devin Desktop | VS Code 分支 | Cascade planning agent；并入 Devin Cloud | ❌ |
| Kiro | 基于 Code OSS + CLI/Web/Mobile/Crew | AWS 区域推理，Auto 模型路由 | ❌ |
| Devin | Web + CLI + Desktop | 每 session 一台 Linux VM（AWS），快照启动 | ❌ |
| GitHub Copilot | IDE 扩展 + CLI + GitHub.com | Actions 临时环境 + 云/本地沙箱，多模型 Auto 路由 | ❌ |
| Qoder 全系 | IDE（证据指向 VS Code 分支）+ CLI + Cloud + QoderWork/Wake | Auto 分层模型路由；Cloud Agents API | ❌ |
| Trae 全系 | VS Code 分支 IDE + TraeWork + CLI | 字节 Seed 系列模型；云端任务并行 | ❌ |
| CodeBuddy | IDE + 插件 + CLI(npm/Node) | 混元模型（默认）；CloudStudio 部署沙箱 | ❌ |
| WorkBuddy | 桌面 + 小程序 + 移动 + Web | 云端 7×24 任务托管（模型未披露） | ❌ |
| Manus | Next.js Web + 桌面 + 移动 | 每任务 VM 沙箱（manus.computer），KV-cache 上下文工程 | ❌ |
| OpenCode | OpenTUI+SolidJS TUI；Electron 桌面端 | TypeScript/Bun，client/server（历史上是 Go/Bubble Tea） | ✅ MIT |
| Cline | VS Code 扩展 + CLI(@opentui/react) | TypeScript 引擎多端共用 | ✅ Apache-2.0 |
| Kilo Code | VS Code(SolidJS) + JetBrains(Kotlin) + CLI | TS，OpenCode fork（早期 Roo/Cline fork） | ✅ MIT |
| Goose | Electron+React 桌面 + CLI | Rust | ✅ Apache-2.0 |
| Aider | 纯终端 | Python；repo map = tree-sitter+grep_ast | ✅ Apache-2.0 |
| OpenHands | React 19 + Electron（Agent Canvas） | Python FastAPI Agent Server，Docker 沙箱 | ✅ MIT |
| Reasonix | TUI+桌面+浏览器+VS Code(ACP) | Go 单二进制 | ✅ MIT |
| DeepSeek Harness | Web UI + CLI | TypeScript/Cordis 插件架构 | ✅ MIT |
| OpenClaw | Lit(Web Components) Control UI + TUI + 30 渠道 | TypeScript/Node，Gateway 守护进程 + WebSocket API | ✅ MIT |
| Pi | TUI 库 + coding agent CLI | TypeScript，五包 harness | ✅ MIT |
| Hermes Agent | TUI + 多渠道网关 | Python 为主；FTS5 记忆 + 技能自学习 | ✅ MIT |
| OpenManus | 终端 + HF Demo | Python；PlanningFlow + ToolCallAgent 分层 | ✅ MIT |
| Browser Use | —（Python 库） | CDP/Playwright，DOM 为主截图为辅 | ✅ MIT |
| UI-TARS Desktop / Agent TARS | Electron 34 + React / CLI+Web UI | TypeScript monorepo，MCP 内核 | ✅ Apache-2.0 |
| E2B Open Computer Use | 串流沙箱屏幕 | Python，三模型分工（grounding/vision/action） | ✅ Apache-2.0 |
| LobsterAI | Electron 40 + React 18 | 底层复用 OpenClaw 运行时 | ✅ MIT |
| AstrBot | WebUI + ChatUI | Python IM 网关，Agent Sandbox | ✅ AGPL-3.0 |
| MoltWorker | —（无 UI） | TypeScript，Cloudflare Workers + Containers 跑 OpenClaw | ✅ Apache-2.0 |
| memU | —（中间件） | Python，"记忆即 Wiki"，sidecar 适配器 | ✅ Apache-2.0 |

## 关键趋势与勘误

1. **终端 Agent 的两条技术路线**：TypeScript/Node + React/Ink（Claude Code、Gemini CLI、早期 Codex）与 Rust + ratatui（Codex 现状、Grok Build、Goose）。Codex 已完成 TS→Rust 重写；OpenCode 反向从 Go/Bubble Tea 重写为 TypeScript/Bun。
2. **"内核 + 多前端"成为主流架构**：Codex（Rust 内核 + app-server JSON-RPC 驱动桌面/IDE/Xcode）、Cline（引擎共用扩展/CLI/Kanban）、Reasonix（Go 引擎 + 四种入口）、Kun（kun serve + GUI/TUI）。
3. **VS Code 分支是 IDE 类的事实标准**：Cursor、Kiro（Code OSS）、Trae、Antigravity（疑 Windsurf fork）、Devin Desktop（原 Windsurf）；Qoder/CodeBuddy IDE 证据指向但未官方确认。
4. **云端执行普遍采用"每任务独立 VM/容器 + 快照"**：Codex cloud（容器）、Cursor Cloud Agents（VM）、Devin（Linux VM + 快照）、Manus（VM 沙箱）、Copilot（Actions 临时环境）。
5. **SDK 开放程度差异大**：Gemini CLI SDK、Claude Agent SDK Python 版、Codex SDK 完全开源；Claude Agent SDK TS 版、Antigravity SDK 核心为闭源二进制。
6. **star 数勘误（2026-08-15 实测）**：OpenClaw 386k、Hermes 231k、OpenCode 197.7k、Claude Code 仓 141.5k、Browser Use 109k、Codex 106k、Gemini CLI 106.5k、DeepSeek Harness 108k、OpenHands 84.1k、AstrBot 39.2k。
7. **重大产品变动**：Windsurf 已于 2026-06-02 更名 Devin Desktop；Roo Code 已于 2026-05-15 停运；OpenManus 迁至 FoundationAgents 组织；Manus 被 Meta 收购后于 2026-08 宣布恢复独立运营；Claude Code 弃用 npm 分发改为原生安装器。
