# 第三部分：商业 AI IDE / 闭源 Agent 产品技术实现调研

> 调研日期：2026-08-15。信息来自对官网、官方文档和公开页面的直接抓取。查不到的均标注"公开资料未披露"。

---

## 1. Cursor（Anysphere）

**前端技术**
- 官方文档明确："Cursor is based upon the VS Code codebase"，即 **VS Code 分支**（Electron 架构，继承 VS Code 的扩展/设置导入能力，支持一键导入 VS Code 配置）。React 等具体 UI 框架官方未披露。
- 来源：https://cursor.com/docs/configuration/migrations/vscode

**自研模型**
- **Composer 2.5**：官方称 "Cursor's own agentic model"，用强化学习（RL）在长程编码任务上训练，面向工具调用、文件编辑、终端操作优化；有更快的默认变体 Composer 2.5 (Fast)。训练/推理基础设施细节未披露。来源：https://cursor.com/docs/models/cursor-composer-2-5
- **Tab**：自研 AI 自动补全，基于近期编辑、周边上下文、linter 错误做预测，支持多行修改、跨文件协同编辑、"jump-in-file" 下一编辑位置预测。是否独立模型、架构细节官方未细说。来源：https://cursor.com/help/ai-features/tab
- 第三方模型：Claude（Opus/Sonnet/Fable 系列）、GPT-5.6（Luna/Sol/Terra）、Gemini、Grok 等。来源：https://cursor.com/docs

**后端/推理路由**
- 是否自建推理集群：**公开资料未披露**。官方仅描述云端 Agent 的 VM 由 Cursor 统一管理（"VM provisioning, isolation, snapshots, startup, artifacts, and capacity"）。

**云端 Agent（Cloud Agents）**
- 运行在**云端隔离 VM**（官方明确是 VM 而非容器），可并行运行、无需本地机器联网；从 GitHub/GitLab/Azure DevOps/Bitbucket 克隆仓库、在独立分支工作、推送交接。
- 环境配置：agent-led setup、快照、或 `.cursor/environment.json` + Dockerfile。
- 入口：iOS App、Web、桌面端、Slack、GitHub/Bitbucket、Linear、**API**；另有 Automations（事件/定时触发）、Bugbot、Security Agents、PR Routing & Approval。
- 来源：https://cursor.com/docs/cloud-agent 、https://cursor.com/docs/cloud-agent/api/endpoints

**SDK/API**：Cloud Agents API；官方 SDK（TypeScript / Python / Bridge）；Cursor CLI（支持 ACP、Headless/CI）。来源：cursor.com/docs 导航。

**价格**（https://cursor.com/pricing ）：Hobby 免费；Pro $20/月；Pro+ $60/月（3x Pro 额度）；Ultra $200/月（20x）；Teams $40/用户/月（Premium 5x）；Enterprise 定制。超额按模型 API 价后付费。

**开源情况**：闭源（基于开源 VS Code/Code OSS 代码库）。

---

## 2. Windsurf（Codeium → Cognition）

**收购史**
- 2025-07-14，Cognition 宣布签署最终协议收购 Windsurf（IP、产品、商标、品牌），当时 Windsurf ARR 约 $82M、350+ 企业客户。此前 OpenAI/Google 竞购过程的具体细节，本次抓取的官方来源未提及。来源：https://cognition.com/blog/windsurf

**现状（重要）**
- windsurf.com 已 308 重定向到 devin.ai/desktop；docs.windsurf.com 重定向到 docs.devin.ai/desktop。
- **2026-06-02，Windsurf 正式更名 Devin Desktop**："same IDE, same editor"，统一到 Devin 品牌（Devin Cloud / Devin Desktop / Devin CLI / Devin Review）。来源：https://docs.devin.ai/desktop/devin-desktop-faq.md

**前端技术**
- VS Code 分支（官方文档未逐字写 "fork"，但支持导入 VS Code/Cursor 设置、Open VSX 扩展、WSL、Dev Containers、`.devinignore`/`.codeiumignore`，且 FAQ 称与 Windsurf 2.0 是同一个编辑器，均为 VS Code 系 Electron 架构的证据链）。来源：https://docs.devin.ai/desktop/getting-started.md 、https://docs.devin.ai/desktop/recommended-extensions.md

**Cascade 实现**
- Devin Desktop 的本地 agentic 助手，Code / Chat 双模式；架构上有一个**专门的 planning agent** 维护总体计划、由所选模型执行当前步骤；单次 prompt 最多 20 次工具调用；支持 MCP、Web Search、Memories & Rules、快照保存/恢复、语音输入、Cascade Hooks（pre/post shell 命令，用于日志/安全/校验）。RAG 式上下文引擎索引代码库。更底层实现未披露。
- 来源：https://docs.devin.ai/desktop/cascade/cascade 、https://docs.devin.ai/desktop/cascade/hooks.md 、https://docs.devin.ai/desktop/context-awareness/windsurf-overview.md

**SDK/API**：继承 Devin API；扩展走 Open VSX。闭源。

---

## 3. Kiro（AWS，规格驱动 IDE）

**前端**
- 官方 FAQ 明确："**Kiro is based on Code OSS**"，可导入 VS Code 设置/主题和 Open VSX 兼容插件（Electron）。来源：https://kiro.dev/faq/ 、https://kiro.dev/docs/guides/migrating-from-vscode/
- 形态已扩展：IDE、CLI（含 headless、ACP、语音）、Web、Mobile、**Crew**（24/7 常驻 agent）、Cloud sessions。来源：https://kiro.dev/docs/

**Spec 机制**
- 三文件：`requirements.md`（或 bugfix.md，用户故事/验收标准/缺陷分析）、`design.md`（架构与实现决策）、`tasks.md`（任务清单）；三阶段流程 Requirements→Design→Tasks，独立任务可分波并发执行。来源：https://kiro.dev/docs/specs/

**Hooks / Steering**
- Hooks：事件驱动自动化（文件保存、工具调用、任务完成时触发 agent 动作）。
- Steering：`.kiro/steering/`（工作区）或 `~/.kiro/steering/`（全局）的 markdown 持久项目知识，YAML front matter 控制加载方式（always / fileMatch / manual / auto）；兼容 AGENTS.md。
- 来源：https://kiro.dev/docs/steering/ 、https://kiro.dev/docs/

**后端/模型**
- "Built and operated by AWS"。模型：Anthropic Claude 全系（Opus 5/4.8/4.7/4.6/4.5、Sonnet 5/4.6/4.5/4.0、Haiku 4.5）、OpenAI GPT-5.6（Sol/Terra/Luna）、多个开源权重模型；**Auto 为官方模型路由器**（多前沿模型组合+流量路由）。
- 推理部署在 AWS 区域（us-east-1、eu-central-1，cross-region inference，IAM Identity Center 登录）——与 Amazon Bedrock 的交付形态一致，但官方文档未逐字写 "Bedrock"，严格说 **Bedrock 字样公开资料未直接披露**。
- 来源：https://kiro.dev/docs/models/available-models/ 、https://kiro.dev/
- 前身为 Amazon Q Developer（文档含 "Migrating from Q Developer"）。

**价格**（https://kiro.dev/pricing/ ）：Free 50 credits；Pro $20（1000 credits）；Pro+ $40（2000）；Pro Max $100（5000）；Power $200（10000）；加购 $0.04/credit。

**开源情况**：闭源（基于开源 Code OSS）。

---

## 4. Devin（Cognition）

**云端架构**
- 每个 session 运行在 **Linux 虚拟机**中（官方："a Linux-based virtual machine with your repositories cloned, tools installed…"），从**快照（snapshot，冻结的可启动镜像）**启动，每个 session 是快照的全新副本，session 内变更不回写快照；每个组织一个活跃快照。云环境在 **AWS**（安全文档提及 "our cloud environment in AWS"）。
- 企业可选 **Devin Outposts**：在客户自有基础设施上跑 session（自托管 worker、fleet API、orchestrator）。
- 来源：https://docs.devin.ai/onboard-devin/environment.md 、https://docs.devin.ai/admin/security.md 、https://docs.devin.ai/cloud/outposts/overview.md

**前端**
- Web 应用 app.devin.ai（"conversational user interface"）；Slack/Teams 集成；Devin Desktop（原 Windsurf）；移动端。Web 前端具体框架（React?）**公开资料未披露**。

**规划/执行**
- 自主 agent，内置 Shell、IDE（编辑器）、Browser 工具；"3 小时法则"（人 3 小时能做的任务 Devin 大概率能做）；并行处理大量任务；Ask Devin（代码库问答+生成高上下文 session）、Security Swarm、Devin Review、DeepWiki。内部 planner 细节未披露。

**SDK/API**：Devin API v1/v2/v3（session 创建/消息/终止、consumption、metrics、企业 hypervisor 列表）；Devin CLI（含 OS 级 sandbox、hooks、MCP、plugins、skills）；Outposts API。来源：https://docs.devin.ai/api-reference/overview

**价格**（https://docs.devin.ai/admin/billing/self-serve.md ）：Free；Pro $20/月；Max $200/月；Teams $80/月起；Teams 全席位含 Devin Desktop + $40/月跨产品用量。

**2025 收购 Windsurf 后的整合**：见第 2 节——2026-06-02 Windsurf 更名 Devin Desktop，产品线统一为 Devin Cloud/Desktop/CLI/Review；Windsurf 计划/价格不变。

**开源情况**：闭源。

---

## 5. GitHub Copilot（含 coding agent）

**形态**
- VS Code / JetBrains 等 IDE 扩展 + GitHub.com 原生 + **Copilot CLI** + GitHub Copilot app（移动端）+ 云端 agent。Copilot 本身是闭源扩展/服务，不是 VS Code 分支。

**Coding agent（现称 Copilot cloud agent）**
- 任务入口：在 issue 里把 assignee 指派给 Copilot；GitHub.com agents panel；VS Code；PR 评论 @copilot；Automations（定时/事件触发，如 issue 打开时）；安全活动（security campaigns）的告警指派。
- 运行环境：**由 GitHub Actions 提供的临时（ephemeral）开发环境**（即 Actions runner 体系；Azure 字样官方文档未提），可探索代码、改代码、跑测试和 linter，然后在分支上迭代并开 PR。
- 来源：https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
- 沙箱：另有 **cloud sandbox**（GitHub 托管的临时隔离 Linux 环境，按用量计费，用于 CLI/app session）和 **local sandbox**（基于 Microsoft eXecution Container / MXC 的跨平台本地隔离）。来源：https://docs.github.com/en/copilot/concepts/about-cloud-and-local-sandboxes

**多模型路由**
- 支持模型（部分）：OpenAI GPT-5 mini / 5.3-Codex / 5.4 / 5.5 / 5.6 Luna·Sol·Terra；Anthropic Claude Haiku 4.5、Opus 4.5–4.8、Sonnet 4.5/4.6/5、Fable 5；Google Gemini 3.x 等。
- **Auto model selection**：官方自动选模（基于可用性和限流），Free/学生用户仅能用 Auto；企业可用策略控制模型默认启用/禁用。
- 来源：https://docs.github.com/en/copilot/reference/ai-models/supported-models

**SDK/API**：GitHub REST/GraphQL API、Copilot CLI、Copilot Extensions、Agent skills/plugins 生态。闭源。

---

## 6. Qoder（阿里巴巴，2025 发布）

**归属**：官网版权方为 BRIGHT ZENITH PRIVATE LIMITED（新加坡实体），官网未直书"阿里巴巴"；但官方文档客户案例大量出现阿里云、高德（AMAP）、"Alibaba Qoder" 等字样，公开普遍认定其为阿里出品。来源：https://docs.qoder.com/product-series/what-is-qoder.md 、https://docs.qoder.com/customer-cases/

**产品全系**（官方 "What is Qoder"）：
- **Qoder IDE**（Editor + Quest 双工作区）、**JetBrains 插件**、**Qoder CLI**、**Cloud Agents**（托管云 agent，API 驱动：Agents/Environments/Sessions/流式结果）、**QoderWork**（文档/表格/研究/浏览器/桌面办公任务）、**QoderWake**（"Wakers" 数字员工）、Mobile & Web（远程监控/审批）、Enterprise 管控。

**是否 VS Code 分支**：官方文档未逐字声明；但 FAQ 出现 VS Code 特有的 "extension host" 崩溃排查并直接引用 code.visualstudio.com 的 extension bisect 工具，属 VS Code 系架构的强证据。严格表述：**官方未明确披露，证据指向 VS Code 分支**。来源：https://docs.qoder.com/troubleshooting/common-issue.md

**Quest 模式**：agent-first 委托窗口；Agent 模式（单 agent 端到端）+ **Experts 模式**（多专家 agent 并行分工）；多任务并行调度、spec-driven、Goal-driven、定时任务、Terminal and Sandbox、执行环境（Execution Environments）、Supabase 集成。来源：https://docs.qoder.com/user-guide/quest/overview.md

**Repo Wiki**：自动生成结构化项目文档并随代码变更持续更新，作为 agent 的代码库认知底座。来源：https://docs.qoder.com/user-guide/repo-wiki.md

**记忆机制**：长期记忆库（开发者/项目/问题三类），主动记忆（告诉它记住）、Knowledge Center 管理，全局记忆 + 项目记忆双作用域；另有 Rules、Knowledge 引擎。来源：https://docs.qoder.com/user-guide/knowledge-engine/memory.md

**后端模型**：模型分层选择器（Auto 智能路由 / Ultimate / Performance / Efficient 等 5 档，按 Credit 倍率计费）；活动页出现 Qwen3.8-Max、"Cantus"、Premium Model；支持 API Key 接入自定义模型。推理基础设施未披露。来源：https://docs.qoder.com/user-guide/chat/model-tier-selector.md

**CLI/SDK**：Qoder CLI + **Python/TypeScript SDK**、Hooks、MCP、插件市场。来源：https://docs.qoder.com/cli/overview.md 、https://docs.qoder.com/cli/sdk/quick-start.md

**市场**：全球站 + 中国站（"Visit China Site"），宣称百万全球用户。价格：Credits 制，新用户 14 天 Pro 试用（300 Credits）。来源：https://qoder.com/

**开源情况**：闭源。

---

## 7. Trae（字节跳动）

**产品线**：TraeCode（IDE，网页/桌面/移动客户端）+ **TraeWork**（AI 原生工作台，Work/Code/Design 三模式，网页/桌面/移动）+ Trae CLI。国际版 trae.ai / 国内版 trae.cn（文档 docs.trae.ai / docs.trae.cn）。

**是否 VS Code 分支**：官方文档明确支持从 **VS Code 插件市场安装插件、导入 .vsix**，属 VS Code 分支形态（官方未逐字写 "fork"）。来源：https://docs.trae.cn/ide_manage-extensions.md

**SOLO 模式**：AI 主导的自主开发模式——自然语言/语音/文件输入后，AI 自主拆解任务、规划并执行代码生成、测试、预览、总结全流程；界面为任务管理面板 + 对话面板 + 工具面板（编辑器/文档/浏览器/终端）；内置 SOLO Agent（支持 Plan 模式、Spec 模式、调用自定义智能体）、多任务并行、Figma 设计还原、Diff 视图。来源：https://docs.trae.cn/ide_solo-mode.md
- 注：原 "Trae SOLO" 已演进为 TraeWork 客户端（2026 年上线）。来源：https://docs.trae.cn/ide_trae-solo-is-now-available.md

**Builder 模式**：当前官方文档中未见独立的 "Builder" 模式条目（早期版本的 Builder 建应用流程已并入 SOLO/Agent 体系）——**现行文档未披露**。

**后端模型**（国内版内置）：字节 **Seed-2.1-Pro / Seed-2.1-Turbo / Seed-Code**（字节自研 Seed 系列；"豆包/Doubao" 字样未直接出现）、GLM-5.x、DeepSeek-V4、Kimi-K3/K2.7-Code、MiniMax-M3、Qwen3.8-Max/3.7-Plus；支持 API Key 自定义模型。来源：https://docs.trae.cn/ide_models.md

**沙箱/运行时**：官方称"智能体生成的命令可以在受限环境中执行"；Trae CLI 2.0 有权限与沙箱机制（Plan / Auto-Review / Full Access 模式、目录信任）；套餐含"云端任务并行数量"上限（存在云端执行）。云沙箱具体技术（VM/容器）**公开资料未披露**。来源：https://docs.trae.cn/cli_permission-and-sandbox.md

**SDK/API**：MCP、自定义智能体、Rules、Skills；文档站基于字节 ArcoSite 基础设施。闭源（有开源软件声明页）。

---

## 8. CodeBuddy（腾讯）

**形态**：官方表述为 **IDE、插件、CLI 三种编程形态**（另有 WorkBuddy 系列独立产品线）。"Cloud" 未单列为第四形态，云能力体现为 CloudStudio/EdgeOne Pages 一键部署（沙箱/生产环境）与云端任务托管。来源：https://cloud.tencent.com/document/product/1831/134343 、https://www.codebuddy.cn/docs/ide/Introduction

**IDE**："对话即编程" 产设研一体工作台：自然语言生成 PRD、草图/自然语言转设计稿、**内置 Figma 设计稿转代码**、智能体模式（任务创建/管理/对话/结果查看）、Plan 模式、Subagents、Skills、Hooks、Memory、MCP、检查点；内置 Supabase/腾讯 CloudBase BaaS；一键部署 CloudStudio / EdgeOne Pages。是否 VS Code 分支：**官方文档未明确披露**（插件版才明确装进 VS Code/JetBrains/微信开发者工具/Xcode/VS 2022）。

**CLI（CodeBuddy Code）**：`npm install -g @tencent-ai/codebuddy-code`（Node.js 18+，**npm/Node 技术栈**）；终端原生、Unix 管道哲学（`git log | codebuddy "分析"`）；交互/无头模式、MCP、Hooks、插件系统、Agent Teams、子代理、检查点、Git Worktree、DevContainer、ACP 协议、GitLab CI/CD、Daemon、远程控制 Web UI、企业微信机器人接入、**Bash 沙箱**、**Python/TypeScript SDK**、HTTP API (Beta)。版本迭代到 v2.132。来源：https://www.codebuddy.cn/docs/cli/overview

**Craft 模式**：插件版（VS Code / JetBrains / 微信开发者工具）内的软件开发智能体，与 Ask 对话模式并列；多文件代码生成/改写、Plan 计划模式、自动运行、自动改文件、检查点回退；**预置 hunyuan 与 deepseek-v3 模型，默认 hunyuan**。来源：https://www.codebuddy.cn/docs/plugin/操作指南/Craft 智能体/Craft 的使用

**后端模型**：腾讯自研**混元助手大模型**（备案号 Guangdong-TencentHunyuan-20230901），支持 DeepSeek 等切换；IDE 可通过 models.json 接入任意 OpenAI 兼容 API。来源：https://cloud.tencent.com/document/product/1831/134343 、https://www.codebuddy.cn/docs/ide/Features/models

**沙箱**：部署沙箱（CloudStudio）+ CLI Bash 沙箱；腾讯云沙箱底层技术细节未披露。闭源。

---

## 9. WorkBuddy（腾讯）——确认存在

**定位**：Tencent WorkBuddy 是**腾讯出品的全场景 AI 办公工作台**（通用自主 Agent），由腾讯云 CodeBuddy 团队于 2026 年 3 月推出（腾讯云开发者社区文章，2026-07-10）。官网 www.workbuddy.cn；workbuddy.tencent.com 重定向至 codebuddy.cn/work；腾讯云产品页 cloud.tencent.com/product/workbuddy。与 CodeBuddy、WorkBuddy Managed Agents、WorkBuddy Enterprise 同属一个产品家族。

**能力**（官方产品页/文档）：
- 自然语言下达任务 → 自主思考、拆解、规划、执行 → 交付可验收结果（文档/表格/PPT/数据分析/图片视频多模态）。
- **本地文件读写**（授权目录内批量处理）；桌面客户端（Win/mac，约 447MB）+ 小程序端 + 移动端 + 网页版。
- 三种解法：100+ 预置领域**专家**（招聘/投研/前端/法务/营销）、云端助理（**云端 7×24 任务托管**，关客户端不断）、多 Agent 并行项目空间（流程/知识沉淀复用）。
- **SkillHub 专家市场**（skillhub.cn，7 万+ Skills）；微信/企微/QQ/飞书/钉钉机器人接入；文档含"默认权限与安全沙箱"、记忆、模型配置。
- 计费：Credits 积分制。
- 来源：https://cloud.tencent.com/product/workbuddy 、https://www.workbuddy.cn/docs/workbuddy/Overview

**技术实现**：桌面端 + 云端任务托管架构；具体模型（混元?）**官方页面未明确披露**（仅有"模型配置"功能项）；前端框架未披露。闭源。

---

## 10. Manus（通用自主 Agent）

**架构**（官方博客《Context Engineering for AI Agents: Lessons From Building Manus》）：
- **云端沙箱虚拟机**：agent loop 中 action 在 "Manus's virtual machine sandbox" 中执行产生 observation；页面配置泄露的沙箱域名为 `manus.computer`（另有 `manus.space` 部署域、`pages.manus.im`、CDN manuscdn.com、API api.manus.im WebSocket）。
- **任务规划**：复杂任务生成并持续更新 `todo.md`，通过"复述"（recitation）把全局计划推入模型近端注意力，防止跑题。
- **上下文工程**：以 KV-cache 命中率为核心指标（输入输出 token 比约 100:1；引用 Claude Sonnet 缓存价差 0.3 vs 3 USD/MTok）；**把文件系统当作无限上下文**（URL/路径保留即可从上下文裁剪内容）；model-driven 架构 + stateful logits processors 保证 agent loop 稳定。
- 来源：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus

**前端**：Next.js Web 应用 + 桌面端 + 移动端；浏览器操作器（browser operator）、Wide Research。公司主体 Butterfly Effect（新加坡），数据存于美国和**新加坡**。

**Meta 收购风波最新状态（2026）**：
- 2025-12-29 官方博客宣布 "Manus is joining Meta"（未说明交易结构）。
- 2026-08 官方《A Note to Our Users》明确写道："**On December 29, 2025, Meta acquired Manus.**" 同时宣布 **Manus 将很快恢复为独立公司运营**（"resume operating as an independent company"）；为满足特定司法辖区监管要求，2025-12-29 之后部分用户生成的数据将于 2026-08-23~24 删除（可备份、8-25 起恢复），强调非安全事件；新加坡运营继续、订阅服务不变。
- 来源：https://manus.im/blog/manus-joins-meta-for-next-era-of-innovation 、https://manus.im/blog/a-note-to-our-users

**SDK/API**：站点提供 API、Team plan、SSO；细节公开资料有限。闭源。

---

## 横向速览

| 产品 | 前端形态 | VS Code 分支? | 云端执行 | 自研模型 | 价格起点 |
|---|---|---|---|---|---|
| Cursor | Electron IDE + Web/iOS | 是（官方确认） | 隔离 VM，Cursor 托管 | Composer 2.5、Tab | 免费 / Pro $20 |
| Windsurf→Devin Desktop | Electron IDE | 是（证据链） | 并入 Devin Cloud | Cascade planning agent | 随 Devin 计划 |
| Kiro | Code OSS IDE+CLI+Web+Mobile+Crew | 是（基于 Code OSS） | AWS 区域推理、Cloud sessions | Auto 路由器（无自研 LLM） | 免费 / Pro $20 |
| Devin | Web(app.devin.ai)+CLI+Desktop | Desktop 是 | 每 session 一台 Linux VM（AWS），快照启动 | 未披露 | 免费 / Pro $20 |
| Copilot | IDE 扩展+CLI+GitHub.com | 否（扩展） | GitHub Actions 临时环境+云沙箱 | 无（多模型 Auto 路由） | Free/Pro $10 档 |
| Qoder | IDE+CLI+JetBrains 插件+Cloud+QoderWork/Wake | 未明说，证据指向是 | Cloud Agents（API 托管） | 未披露（Auto 分层路由，含 Qwen） | Credits 制 |
| Trae | IDE+TraeWork+CLI+移动 | 是（.vsix/VS Code 市场兼容） | 云端任务并行（细节未披露） | Seed 系列（字节） | 积分制 |
| CodeBuddy | IDE+插件+CLI(npm/Node) | IDE 未披露；插件挂 VS Code | CloudStudio/EdgeOne 部署沙箱 | 混元（默认） | Credits 制 |
| WorkBuddy | 桌面+小程序+移动+Web | 不适用（办公 Agent） | 云端 7×24 任务托管 | 未披露 | Credits 制 |
| Manus | Next.js Web+桌面+移动 | 不适用 | 每任务 VM 沙箱(manus.computer) | 无（调用前沿模型） | 订阅制 |

**关键未披露项**：Cursor 推理集群细节、Qoder/Trae/CodeBuddy 的云沙箱具体技术（VM vs 容器）、WorkBuddy 所用模型、Manus 交易金额与条款、各家前端具体 UI 框架（React 等）均未在官方公开资料中确认。
