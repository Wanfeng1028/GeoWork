# 第五部分：开源 Work Agent / Computer-Use 生态技术实现调研

> 调研日期：2026-08-15。数据均来自 GitHub API、仓库 README/源码文件及官方文档的实时抓取。部分项目的实际 star 数与早期清单给出的数字有出入，已按实测标注。

---

## 1. OpenClaw

- **仓库**：https://github.com/openclaw/openclaw ｜ **协议**：MIT（LICENSE 文件注明 "MIT License, Copyright (c) 2026 OpenClaw Foundation"；GitHub API 显示 NOASSERTION）｜ **实测 stars：约 386k**（高于早期清单的 280k）
- **定位**："Your own personal AI assistant. Any OS. Any Platform. The lobster way." 面向单一操作者的个人 AI 助手，通过一个 Gateway 连接模型、工具、消息渠道与配套 App。官网 https://openclaw.ai，文档 https://docs.openclaw.ai
- **后端/运行时**：
  - 主体语言 **TypeScript**（约 263MB 源码），另有 **Swift**（macOS/iOS 伴侣 App）、**Kotlin**（Android 伴侣 App）、少量 Python/Rust/Go。以 npm 包 `openclaw` 发布，要求 Node 22.22.3+/24.15+/25.9+。
  - **架构**：Gateway 是本地控制平面（常驻守护进程），"owns all messaging surfaces"，提供 typed WebSocket API，负责会话、工具、事件、渠道连接与配对认证；客户端通过 `req:agent` / `event:agent` 流式事件驱动 Agent Loop。工具默认跑在宿主机，可配置沙箱（有专门的 sandboxing/security 文档）。
  - **与 Pi 的关系（实测）**：仓库 package.json 中对 earendil-works 的依赖是 **`@earendil-works/pi-tui`（0.82.1，终端 UI 差分渲染库）**，npm 发布版亦含 `playwright-core`。但官方架构文档（docs.openclaw.ai/concepts/architecture）**并未提及 Pi 是 Agent 运行时**——公开资料只能确认 OpenClaw 复用了 Pi 的 TUI 库，"核心引擎是 Pi"这一说法在抓到的材料中未获直接证实。
- **前端形态**：
  - **Control UI**：仓库 `ui/` 目录（包名 openclaw-control-ui），基于 **Lit 3.3（Web Components）+ Vite 8 + @lit/context + TanStack lit-virtual**，不是 React/Vue。
  - 另有 CLI 与 TUI（TUI 用 pi-tui）。
  - **渠道接入**：WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、WebChat、Matrix、Teams、LINE、IRC 等约 30 个渠道；中国 IM：**飞书/Lark（官方插件）、QQ bot（官方插件）、微信 WeChat（外部插件 openclaw-weixin）、企业微信 WeCom（官方插件）**；**钉钉未出现在官方渠道列表**（钉钉支持见衍生项目 OneClaw/LobsterAI）。渠道分三类：核心内置（bundled）、官方插件、外部插件。
- **衍生项目**：
  - **OneClaw**（https://github.com/oneclaw/oneclaw，576 stars，TypeScript，**AGPL-3.0**）：Electron 桌面客户端，内置 Node.js 运行时 + 完整 OpenClaw Gateway，"一分钟安装"，支持飞书/企微/钉钉/QQ/微信一键接入、clawhub 技能商店、Kimi 搜索。
  - **Clawra**（https://github.com/sumelabs/clawra，2.4k stars，TypeScript，MIT）：给 OpenClaw 注入"人设+自拍"能力的 Skill，用 fal.ai（xAI Grok Imagine）生成固定形象的自拍图，经 OpenClaw Gateway 发到 Discord/Telegram/WhatsApp 等渠道；`npx clawra@latest` 安装到 `~/.openclaw/skills/`。

---

## 2. Pi（earendil-works）

- **仓库**：https://github.com/earendil-works/pi ｜ **协议**：MIT ｜ **实测 stars：约 90.7k**
- **语言**：**TypeScript**（约 8.4MB），npm monorepo。定位 "AI agent toolkit: unified LLM API, agent loop, TUI, coding agent CLI"，官网 https://pi.dev
- **harness 设计（五个包）**：
  - `@earendil-works/pi-ai`：统一多供应商 LLM API（OpenAI/Anthropic/Google 等）
  - `@earendil-works/pi-agent-core`：Agent 运行时（工具调用 + 状态管理）
  - `@earendil-works/pi-coding-agent`：**可独立使用的交互式 coding agent CLI**（自我可扩展）
  - `@earendil-works/pi-tui`：终端 UI 库（差分渲染）——**这就是被 OpenClaw 依赖的部分**
  - `@earendil-works/pi-telemetry`：厂商中立遥测契约
- **安全模型**：明确不带内置权限系统，默认以启动用户权限运行；需要边界时用容器化，官方给出三种模式：Gondolin 扩展（工具路由进本地 Linux micro-VM）、纯 Docker、OpenShell 策略沙箱。Slack/聊天自动化另有 earendil-works/pi-chat 仓库。

---

## 3. Hermes Agent（Nous Research）

- **仓库**：https://github.com/NousResearch/hermes-agent ｜ **协议**：MIT ｜ **实测 stars：约 231k**（远高于早期清单的 60k）
- **语言**：**Python 为主**（约 67.7MB），TypeScript 次之（约 17.8MB，应为桌面/Web 前端部分）。官网 https://hermes-agent.nousresearch.com
- **自我进化/跨会话记忆（官方称 "closed learning loop"）**：
  - Agent 自策展记忆 + 周期性"nudge"提醒自己持久化知识
  - 复杂任务完成后**自动创建技能**，技能在使用中自我改进；兼容 agentskills.io 开放标准
  - **FTS5（SQLite 全文索引）会话搜索 + LLM 摘要**实现跨会话召回
  - **Honcho**（plastic-labs/honcho）辩证式用户建模，跨会话加深对用户的理解
- **子代理与执行环境**：可 spawn 隔离 subagent 做并行工作流；可写 **Python 脚本经 RPC 调用工具**（把多步流水线压缩为零上下文成本的单轮）。**七种终端后端**：local、Docker、SSH、Singularity、Modal、Daytona、Vercel Sandbox（Modal/Daytona 提供 serverless 休眠）。
- **渠道/前端**：单网关进程接 Telegram、Discord、Slack、WhatsApp、Signal + CLI 全功能 TUI（多行编辑、斜杠命令补全、可打断重定向）。浏览器能力经 Nous Portal Tool Gateway 路由到 **Browser Use 云浏览器**。还提供 `hermes claw migrate` 从 OpenClaw 迁移设置/记忆/技能/API key。

---

## 4. OpenManus

- **仓库**：主仓库现为 **https://github.com/FoundationAgents/OpenManus**（57,977 stars，**Python**，MIT）。注意：早期的 mannaandpoem/OpenManus 仍存在但已基本清空（626 stars、无语言统计），作者 mannaandpoem 是 MetaGPT 团队核心作者，项目已迁至 FoundationAgents 组织。
- **架构（源码实测）**：
  - Agent 分层：`BaseAgent → ReActAgent（app/agent/react.py）→ ToolCallAgent（app/agent/toolcall.py）→ Manus（app/agent/manus.py）`。早期资料说的 "PlanningAgent" 在当前代码中实际以 **PlanningFlow（app/flow/planning.py）+ PlanningTool** 形式存在（计划步骤有 not_started/in_progress/completed/blocked 状态机），另有 run_flow 多 Agent 编排与 DataAnalysis Agent。
  - 工具集：`BrowserUseTool`（封装 browser-use 库，直接用其 DomService）、`PythonExecute`（Python 沙箱执行）、`StrReplaceEditor`、`AskHuman`、`Terminate`、`WebSearch`（googlesearch/baidusearch/duckduckgo）、**MCP 客户端**（mcp~=1.5.0）。
  - 依赖（requirements.txt）：browser-use~=0.1.40、playwright~=1.51.0、**docker~=7.1.0**（容器沙箱）、browsergym、crawl4ai、fastapi/uvicorn（有 API 服务形态）。
- **前端形态**：无独立前端，终端交互（python main.py），另有 HuggingFace Spaces 在线 Demo；联网能力靠 WebSearch 工具 + Playwright 浏览器自动化（`playwright install`）。

---

## 5. Browser Use

- **仓库**：https://github.com/browser-use/browser-use ｜ **协议**：MIT ｜ **实测 stars：约 109k**（早期清单 42.3k 已过时）
- **语言**：**纯 Python 库**（3.5MB Python），官网 browser-use.com，另有 Browser Use Cloud 商业服务。
- **机制（官方文档实测）**：
  - 浏览器驱动：通过 **CDP（Chrome DevTools Protocol）**连接与控制浏览器（配置项含 CDP 连接超时、启动/标签页/导航/存储/下载等），底层生态为 Playwright/CDP。
  - **DOM 提取**：每步 "fetching browser state/DOM"，可用独立的小型页面抽取模型提取文本，属性白名单控制抽取内容。
  - **视觉结合**：vision 开关三档——`auto`（含截图工具但按需使用）、`True`（每步带截图）、`False`（不截图）；截图精细度 low/high/auto。即 **DOM 结构化信息为主、截图视觉为辅**的混合感知。
  - **Agent 循环**：先执行无模型的初始动作，再由模型调用工具；每步最多 N 个动作，"执行动作直到页面发生变化"，含失败重试、兜底响应、思考/快速模式。
- **作为底座**：OpenManus 的 BrowserUseTool 直接 import `browser_use`（Browser/BrowserContext/DomService）；README 明确列出可作为 Claude Code、Codex、Cursor、**Hermes、OpenClaw** 等的浏览器能力；Hermes 经 Nous Portal 使用 Browser Use 云浏览器。UI-TARS-desktop 的 topics 也含 browser-use（其 `packages/agent-infra/browser-use` 是字节自研的同名 TS 浏览器控制包）。

---

## 6. UI-TARS / Agent TARS（字节跳动）

- **UI-TARS 模型仓库**：https://github.com/bytedance/UI-TARS ｜ **协议**：Apache-2.0。这是模型/论文仓库：UI-TARS-1.5-7B 开源在 HuggingFace（ByteDance-Seed），2025-09 发布 UI-TARS-2（"All In One" Agent 模型，arXiv:2509.02544）。基于 Qwen2.5-VL，用绝对坐标做 GUI grounding；网页自动化配套推荐 Midscene.js。**该仓库无 Python SDK 产品**，模型部署见其 README_deploy.md。
- **UI-TARS-desktop / TARS 全家桶**：https://github.com/bytedance/UI-TARS-desktop ｜ **协议**：Apache-2.0 ｜ 实测 stars：约 38.6k ｜ 语言：**TypeScript**（5.8MB）。pnpm + turbo monorepo，包含两个产品：
  - **UI-TARS Desktop**（`apps/ui-tars`）：**Electron 34 + electron-vite + Electron Forge 打包；渲染层为 React（@vitejs/plugin-react）+ Tailwind CSS 4**——确认是 Electron + React。基于 UI-TARS VLM 的本地 GUI Agent，支持本地/远程 computer operator 与浏览器 operator。
  - **Agent TARS**（源码在 `multimodal/agent-tars/`，分 cli/core/interface 三个子包）：通用多模态 Agent stack，以 **npm 包 `@agent-tars/cli`（Node/TypeScript）**发布，形态是 **CLI + Web UI + headless server**；内核构建在 MCP 之上并可挂载外部 MCP Server；**混合浏览器 Agent**——GUI 视觉 grounding、DOM、或混合策略三种模式；v0.3.0 支持 AIO agent Sandbox（agent-infra/sandbox，Python，5.7k stars）作为隔离工具执行环境；事件流协议驱动上下文工程与 Agent UI。官网 https://agent-tars.com。

---

## 7. Open Computer Use（E2B）

- **仓库**：https://github.com/e2b-dev/open-computer-use ｜ **协议**：Apache-2.0 ｜ 实测 stars：约 2.2k ｜ 语言：**Python**（Poetry，Python 3.10+）
- **实现**："A secure cloud Linux computer powered by **E2B Desktop Sandbox** and controlled by open-source LLMs"。
  - 沙箱：E2B Desktop Sandbox（云端安全 Linux 虚拟机，Ubuntu，设计上可换任意 OS），客户端**实时串流沙箱屏幕画面**，用户可随时暂停并插入提示。
  - 操作方式：键盘、鼠标、shell 命令。
  - **三模型分工架构**（config.py）：grounding_model（OS-Atlas/ShowUI，元素定位）、vision_model（如 Llama 3.2/Gemini/GPT-4o）、action_model（如 Llama 3.3/DeepSeek/Claude）；支持 Fireworks、OpenRouter、Groq、DeepSeek、Google、OpenAI、Anthropic、HF Spaces、Moonshot、Mistral 等 10+ 供应商，provider 可在 providers.py 中自行扩展。

---

## 8. LobsterAI（网易有道）

- **仓库**：https://github.com/netease-youdao/LobsterAI ｜ **协议**：MIT ｜ 实测 stars：5,890 ｜ 官网 https://lobsterai.youdao.com
- **技术栈（README 徽章与语言统计实测）**：**Electron 40 + React 18** 桌面应用（macOS/Windows）；语言构成 TypeScript 11.9MB 为主，JavaScript、Python（约 455KB，应为技能/工具脚本）、NSIS（Windows 安装包）。
- **架构关键点**：官方明确 "**Cowork 是 LobsterAI 的产品/会话层，OpenClaw 是底层运行时与网关**"——桌面端负责本地持久化、权限、UI 状态、Artifacts、Agents、记忆与 IM 绑定，Agent 执行交给 OpenClaw。所以它被称为"中国版 OpenClaw"。
- **能力**：28 个内置技能（Web 搜索、Word/Excel/PPT/PDF 处理、Remotion 视频生成、浏览器自动化、图片/视频生成、股票研究、邮件、天气、技能创建等）；MCP 服务本地保存并同步到 OpenClaw；自然语言定时任务；敏感操作（文件/终端/网络）前请求审批。
- **IM 原生适配**：通过 **IM 远程控制**实现——微信、企业微信、**钉钉**、飞书/Lark、QQ、Telegram、Discord、网易云信 IM、网易小蜜蜂、POPO、邮件均可触达桌面 Agent，多实例平台可把不同账号/渠道绑定到不同 Agent。注：**README 中未见 WPS 的明确表述**（公开资料未披露对 WPS 的原生适配细节）。

---

## 9. AstrBot

- **仓库**：https://github.com/AstrBotDevs/AstrBot ｜ **协议**：**AGPL-3.0** ｜ 实测 stars：约 39.2k（早期清单 9.2k 严重过时）｜ 官网 https://astrbot.app
- **语言**：**Python**（要求 Python 3.12+，uv 安装）。定位"开源一站式 Agent 聊天机器人平台"，README 自称 "can be your openclaw alternative"。
- **架构/能力**：
  - **IM 网关**：QQ、企业微信、飞书、钉钉、微信公众号、Telegram、Slack、Discord 等多平台适配。
  - AI 能力：大模型对话、多模态、Agent、MCP、Skills、知识库、人格设定、对话自动压缩；可接 Dify、阿里云百炼、Coze 等智能体平台。
  - **Agent Sandbox**：隔离化环境，安全执行任意代码、调用 Shell、会话级资源复用。
  - 前端：**WebUI 管理面板 + Web ChatUI**（内置代理沙盒、网页搜索）；插件生态 1000+ 一键安装；i18n 支持；Docker 一键部署。

---

## 10. MoltWorker（Cloudflare）

- **仓库**：https://github.com/cloudflare/moltworker ｜ **协议**：Apache-2.0 ｜ 实测 stars：约 9.9k ｜ 语言：**TypeScript**
- **实现**：在 **Cloudflare Sandbox（Cloudflare Containers）**里运行完整的 OpenClaw（"Run OpenClaw, formerly Moltbot, formerly Clawdbot, on Cloudflare Workers"）。官方定位为**实验性 PoC**，不保证维护。
  - 架构：Workers 作为入口/编排层 + standard-1 容器实例（1/2 vCPU、4GiB 内存、8GB 磁盘）跑 OpenClaw；`SANDBOX_SLEEP_AFTER`（如 10m）让容器空闲休眠以省钱。
  - 依赖的 Cloudflare 服务：Workers Paid plan（$5/月，Sandbox 容器必需）、Anthropic API key（或 AI Gateway Unified Billing）、Cloudflare Access（认证，免费额度）、**Browser Rendering**（浏览器导航）、AI Gateway（可选路由/分析）、R2（可选持久化）。
  - 成本估算：24/7 运行约 $34.5/月；每天用 4 小时约 $5-6 计算费 + $5 套餐费。

---

## 11. memU（NevaMind-AI）

- **仓库**：https://github.com/NevaMind-AI/memU ｜ **协议**：Apache-2.0 ｜ 实测 stars：约 14.3k ｜ 语言：**Python**（Python 3.11+，PyPI 包 memu-cli）
- **理念**："Personal memory, stored as Wiki"——跨会话、跨 Agent、跨设备的共享 LLM Wiki；核心记忆逻辑仅约 500 行。分工：**Agent 负责总结判断，memU 负责存储、嵌入与检索**；自动从 Agent 历史中蒸馏可复用技能并写成可读的 Markdown。本地部署用 `MEMU_DB`（SQLite/Postgres），也可用 memU Cloud（memu.so，免费跨设备查看记忆文件）。
- **接入方式（Host Adapters）**："one binary per host" 的 sidecar 适配器，绑定两个接缝：**record**（定时切分会话日志，让 Agent 提炼成记忆/技能）与 **inject**（在宿主指令文件中要求 Agent 回答前先检索记忆）：
  - **OpenClaw**：`memu-openclaw`，读取 OpenClaw 的 SQLite/legacy JSONL 会话记录，补丁 `~/.openclaw/workspace/AGENTS.md`
  - **Hermes**：`memu-hermes`，读取 `~/.hermes/state.db`，补丁 `~/.hermes/SOUL.md`
  - **OpenManus**：无专用适配器，可走通用 `memu-agent detect` 探测会话日志与可补丁指令文件
  - 另支持 Codex、Claude Code、Cursor、ChatGPT(Work 模式)、WorkBuddy、Cola 等；也可让 Agent 直接读 https://memu.pro/SKILL.md 自助安装配置。

---

## 关键结论与勘误

1. **star 数勘误**（2026-08-15 实测）：OpenClaw 386k（非 280k）、Pi 90.7k（非 58k）、Hermes 231k（非 60k）、Browser Use 109k（非 42.3k）、AstrBot 39.2k（非 9.2k）、MoltWorker 9.9k、LobsterAI 5.9k（非 11.7k）、OpenManus 58k、UI-TARS-desktop 38.6k、memU 14.3k、E2B open-computer-use 2.2k。
2. **OpenManus 主仓库已迁移**至 FoundationAgents/OpenManus（mannaandpoem/OpenManus 已清空）；"PlanningAgent" 在现行代码中实为 PlanningFlow + ToolCallAgent 分层。
3. **OpenClaw 与 Pi**：可证实的依赖是 `@earendil-works/pi-tui`（TUI 库）；官方架构文档未声明 Pi 是其 Agent 运行时核心，此点公开资料未完全证实。
4. **OpenClaw 官方渠道不含钉钉**；钉钉/飞书/企微/微信的中国生态适配主要由 OneClaw、LobsterAI（底层复用 OpenClaw 网关）承担。OpenClaw Control UI 用的是 **Lit（Web Components）**而非 React；LobsterAI 与 UI-TARS Desktop 才是 Electron + React。
5. **Agent TARS 无独立仓库**，源码在 bytedance/UI-TARS-desktop 的 `multimodal/agent-tars/`（cli/core/interface），以 `@agent-tars/cli` npm 包发布，纯 TypeScript。
6. 全程未发现 LobsterAI 对 **WPS** 原生适配的公开披露。
