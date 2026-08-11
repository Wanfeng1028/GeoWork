# Agent 架构对比与模块规划

> 文档定位：对比主流 Agent 产品的模块架构，明确 GeoWork 后端和 Agent Runtime 需要的模块结构与实现方向。
> 适用对象：GeoWork 开发者
> 最后更新：2026-08-10

---

## 一、主流 Agent 产品架构总览

| 产品 | 公司 | 语言 | 代码量 | 形态 | 代码库 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | Anthropic | TypeScript | ~163K 行 | CLI（终端） | [claude-code-from-source](https://github.com/alejandrobalderas/claude-code-from-source)（架构分析） |
| Codex CLI | OpenAI | Rust | ~549K 行 | CLI（终端） | [openai/codex](https://github.com/openai/codex) |
| Cursor | Anysphere | TypeScript | 未公开 | IDE（VS Code fork） | 闭源，参考 [deployhq.com/guides/cursor](https://www.deployhq.com/guides/cursor) |
| Windsurf (Cascade) | Codeium → Cognition | 未公开 | 未公开 | IDE（VS Code fork） | 闭源，参考 [windsurf.com](https://www.windsurf.com) |
| Trae Agent | 字节跳动 | Python | 开源 | CLI | [bytedance/trae-agent](https://github.com/bytedance/trae-agent) |
| DeerFlow | 字节跳动 | Python + TS | 开源 | 框架 | [bytedance/deer-flow](https://github.com/bytedance/deer-flow)（79.6K stars） |
| Qoder Work / CLI | 阿里 | Rust + TS | 部分开源 | Desktop + CLI | [QoderAI](https://github.com/qoderAI) |
| Kimi Work | 月之暗面 | 未公开 | 部分开源 | Desktop | [moonshot.ai](https://www.moonshot.ai)，SDK 开源 |
| Manus AI | Butterfly Effect → Meta | 未公开 | 未公开 | 云端 Web | 闭源 |
| Pi | earendil-works（Mario Zechner 等） | TypeScript | 86.1K stars，monorepo 5 包 | CLI Agent Toolkit | [earendil-works/pi](https://github.com/earendil-works/pi) |
| OpenAI Agents SDK | OpenAI | Python | 开源 | SDK/框架 | [openai/openai-agents-python](https://github.com/openai/openai-agents-python)（26.9K stars） |
| LangGraph | LangChain | Python | 开源 | SDK/框架 | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) |
| Microsoft Agent Framework | Microsoft | Python + .NET | 开源 | SDK/框架 | [microsoft/agent-framework](https://github.com/microsoft/agent-framework)（12.7K stars） |
| MetaGPT | FoundationAgents | Python | 开源 | 多 Agent 框架 | [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT)（69.7K stars） |

---

## 二、各产品核心模块详细对比

### 2.1 Agent Loop（核心循环）

| 产品 | 实现方式 | 特点 |
| --- | --- | --- |
| Claude Code | `query.ts` 单文件 AsyncGenerator（785KB） | yield 消息流，天然支持取消和背压；while(tool) 循环 |
| Codex CLI | Queue-pair Protocol（Op-Event 双通道） | 主循环发 Op，执行层回 Event，完全解耦控制与执行 |
| Cursor | Agent Mode（长循环）+ Composer（短循环） | Agent Mode 读→编辑→跑命令→看输出→迭代；Composer 做快速多文件编辑 |
| Windsurf | Cascade Flow | 规划→多文件编辑→跑命令→读输出→自我修正；偏好长时程计划 + 显式验证步骤 |
| Trae | 标准 ReAct Loop | 理解指令→规划→执行→验证；支持 Docker 容器内执行 |
| Kimi Work | Desktop Agent Loop | 读文件→操作浏览器→跑 Python→定时任务 |
| Manus | Orchestrator Loop | 中央编排器拆解目标→分派 sub-agent→收集结果→判断完成 |
| DeerFlow | SuperAgent Harness | 长时程任务（分钟到小时级），含沙箱、记忆、工具、技能、子代理 |
| Pi | `pi-agent-core`（工具调用 + 状态管理，显式状态 Harness 设计） | monorepo 架构，5 个独立包；无内置权限/沙箱，靠外部容器化（Gondolin micro-VM / Plain Docker / OpenShell 策略沙箱） |
| **GeoWork** | `internal/agent` + `internal/runtime` | **建议：采用 ReAct + Plan-then-Execute 混合模式** |

---

### 2.2 Tool System（工具系统）

| 产品 | 工具数量 | 执行策略 | 特点 |
| --- | --- | --- | --- |
| Claude Code | 54 个工具 | 读操作并行、写操作串行；推测执行（模型输出中就开始跑只读工具） | 环境和功能门控注册 |
| Codex CLI | 未公开 | Sandbox 内执行 | Guardian AI 独立审批每次调用 |
| Cursor | 未公开 | Agent 自动选择 | 内置 explore sub-agent 辅助搜索代码库 |
| Windsurf | 未公开 | Cascade 自动编排 | 自动读项目结构、规划编辑序列 |
| Trae | 文件编辑、Bash、Sequential Thinking 等 | 顺序/并行 | 工具生态丰富 |
| Kimi Work | 文件、浏览器、Python、Cron | 本地执行 | WebBridge 通过 CDP 协议操控浏览器 |
| Manus | Browser/Code/Data/File Agent | 并行 sub-agent 各自执行 | 每种 Agent 有自己的工具集 |
| **GeoWork** | `internal/toolregistry` + `internal/tools` | **建议：实现读/写分离 + 推测执行** |

---

### 2.3 Permission & Safety（权限与安全）

| 产品 | 机制 | 特点 |
| --- | --- | --- |
| Claude Code | 7 层权限模式，deny > ask > allow | 最严规则优先；7 个安全层 |
| Codex CLI | Guardian AI（独立 LLM 审批） | 用轻量模型判断工具调用是否安全，不是纯规则引擎 |
| Cursor | Rules + Hooks | `.cursor/rules/*.mdc` 定义规则；Cursor Hooks 在编辑前后插入验证脚本 |
| Windsurf | 自动权限 | Agent 自主决策较多，用户可配置 |
| Trae | Docker 隔离 | 在容器中执行，天然隔离 |
| Kimi Work | 本地执行 + 权限声明 | 浏览器操作在本地，不上传云端 |
| Manus | 云端沙箱 | 所有执行在云端隔离环境 |
| **GeoWork** | `internal/permissions` + `internal/safety` + `internal/sandbox` | **建议：规则引擎 + AI 审批双层机制** |

---

### 2.4 Context Engineering（上下文工程）

| 产品 | 压缩层数 | 策略 |
| --- | --- | --- |
| Claude Code | **5 层** | ① Snip（裁剪过长工具输出）→ ② Microcompact（压缩早期对话）→ ③ Collapse（折叠已完成子任务）→ ④ Autocompact（全量摘要）→ ⑤ Session-memory（记忆外置到文件） |
| Codex CLI | 有 | 上下文窗口管理 |
| Cursor | 有 | Subagent 隔离上下文，避免主对话膨胀 |
| Windsurf | 有 | RAG 按需拉取代码库上下文 |
| Trae | 有 | Lakeview 模块生成步骤摘要 |
| Manus | **核心能力** | Handoff 时将历史压缩为单条上下文消息："For context, here is the conversation so far..." |
| DeerFlow | 有 | 上下文压缩 + 记忆外置 |
| Pi | 有（从 commit 历史看有 compaction 相关实现） | 参考 Claude Code 5 层压缩思路 |
| **GeoWork** | `internal/conversation` | **建议：实现 5 层渐进式压缩（Write/Select/Compress/Isolate）** |

---

### 2.5 Memory（记忆系统）

| 产品 | 实现 | 特点 |
| --- | --- | --- |
| Claude Code | 文件系统 + LLM 召回 | 用 Sonnet 侧查询选择相关记忆（不是关键词匹配）；三层：In-context / MEMORY.md / CLAUDE.md |
| Codex CLI | AGENTS.md + 项目记忆 | 项目级指令文件 |
| Cursor | 代码库索引 + Rules | 自动索引整个项目 |
| Windsurf | Memories | 自适应记忆，学习用户编码风格 |
| Trae | 代码知识图谱 | MarsCode 的多方向图（变量/函数/类/文件 + 调用关系 + 符号索引） |
| Kimi Work | 文件挂载 + 会话持久化 | 挂载用户文件夹 |
| Manus | 云端存储 | 会话状态持久化 |
| DeerFlow | Memories 模块 | 持久化记忆 |
| **GeoWork** | `internal/storage` + `internal/knowledge` | **建议：三层记忆（工作记忆/会话记忆/长期记忆）+ 地理空间数据语义索引** |

---

### 2.6 Skills（技能系统）

| 产品 | 加载方式 | 特点 |
| --- | --- | --- |
| Claude Code | **两阶段加载**：启动时只读 frontmatter，调用时加载全文 | 避免上下文膨胀 |
| Codex CLI | Progressive Disclosure（渐进式加载） | 同上思路 |
| Cursor | 按需加载 | Skills 是专业知识包，Rules 是始终生效的规则 |
| Windsurf | 内置 | 无独立技能系统 |
| Trae | 工具生态 | 文件编辑、Bash、Sequential Thinking |
| Qoder | better-harness | 将项目和会话证据转化为循环级洞察 |
| Manus | 无独立技能 | 通过 sub-agent 分工实现 |
| DeerFlow | Skills 模块 | 可复用能力包 |
| **GeoWork** | `skills/`（根目录，12 个官方技能） | **建议：实现两阶段加载 + 按需匹配** |

---

### 2.7 Sub-agent / Multi-agent（子代理）

| 产品 | 机制 | 规模 |
| --- | --- | --- |
| Claude Code | `Agent` tool 生成 sub-agent，隔离上下文，depth=1 | 单个 sub-agent |
| Codex CLI | 多 agent 编排 | 有限 |
| Cursor | **Subagents（v2.4）**：独立上下文窗口，可树形嵌套 | 树形结构 |
| Windsurf | **Parallel Agents（Wave 13）**：Git worktree 隔离 | 多分支并行 |
| Kimi Work | **Agent Swarm**：最多 ~300 个 sub-agent | 4000+ 工具调用 |
| Manus | Orchestrator + 专业 sub-agent（Browser/Code/Data/File） | 4 种专业 Agent 并行 |
| DeerFlow | Subagents 模块 | 多 Agent 协作 |
| MetaGPT | 多 Agent 框架 | 69.7K stars |
| **GeoWork** | `internal/aiagent` | **建议：定义 spawn/isolate/return 协议 + 悬浮辅助对话** |

---

### 2.8 Sandbox（沙箱）

| 产品 | 实现 | 平台 |
| --- | --- | --- |
| Claude Code | 文件系统限制 | 跨平台 |
| Codex CLI | **3-OS 沙箱**：macOS sandbox-exec / Linux Landlock+seccomp / Windows Job Objects | 三套独立实现 |
| Cursor | 云端沙箱（Background Agents） | 云端 |
| Trae | Docker 容器 | Docker |
| Manus | 云端沙箱 | 云端 |
| Kimi Work | 本地执行 | 本地 |
| **GeoWork** | `internal/sandbox` | **建议：开发版用路径限制，正式版用容器隔离** |

---

### 2.9 Events / Streaming（事件流）

| 产品 | 实现 |
| --- | --- |
| Claude Code | AsyncGenerator yield SDKMessage |
| Codex CLI | Op-Event channels |
| Cursor | IDE 内部事件 |
| Trae | Trajectory Recording（记录所有 Agent 行为） |
| Manus | Session Replay（完整回放） |
| **GeoWork** | `internal/events`（SSE） | **已有，需加强 Trajectory 记录** |

---

### 2.10 Hooks / 生命周期（钩子）

| 产品 | 机制 | 数量 |
| --- | --- | --- |
| Claude Code | **27 种 Hook 事件** | 在 Agent 执行的每个节点可插入自定义逻辑 |
| Cursor | Cursor Hooks | 编辑前后可插入脚本验证 |
| Codex CLI | Automations | 定时/条件触发 |
| **GeoWork** | `internal/automation` | **建议：定义 Hook 事件清单，至少覆盖工具调用前后、状态转换、错误发生** |

---

### 2.11 Model Gateway（模型路由）

| 产品 | 实现 |
| --- | --- |
| Claude Code | 单模型（Claude） |
| Codex CLI | GPT 系列 |
| Cursor | 多模型可选（GPT/Claude/自研） |
| Windsurf | 自研 SWE-1.5（比 Sonnet 快 13 倍） |
| Trae | Multi-LLM：OpenAI/Anthropic/Doubao/Azure/Ollama/Gemini |
| Manus | Claude 3.5 Sonnet + Qwen（辅助） |
| **GeoWork** | `internal/modelgateway` | **已有，需加 Fallback + 按任务类型路由** |

---

### 2.12 MCP（外部工具协议）

| 产品 | 支持 |
| --- | --- |
| Claude Code | ✅ MCP Client |
| Codex CLI | ✅ |
| Cursor | ✅ GUI 配置 + JSON 配置 + Marketplace |
| Windsurf | ✅ |
| Trae | ✅ 可选 |
| Qoder | ✅ |
| Kimi Work | ✅ |
| Manus | ✅ |
| DeerFlow | ✅ |
| **GeoWork** | `internal/mcp` | **已有** |

---

### 2.13 Browser / Computer Use（浏览器/GUI 操控）

| 产品 | 实现 |
| --- | --- |
| Claude Code | Computer Use（beta） |
| Kimi Work | **WebBridge**：Chrome 扩展 + CDP 协议，本地操控浏览器 |
| Manus | Browser Agent |
| Cursor / Codex / Trae | ❌ 无 |
| **GeoWork** | `internal/browserbridge` | **已有，是独特优势** |

---

### 2.14 Diagnostics / Trajectory（诊断与轨迹）

| 产品 | 实现 |
| --- | --- |
| Claude Code | 日志系统 |
| Codex CLI | 调试模式 |
| Trae | **Trajectory Recording**：记录所有 Agent 行为，用于调试和分析 |
| Manus | **Session Replay**：完整回放 Agent 执行过程 |
| Cursor | 内部观测（Arize Observe） |
| **GeoWork** | `internal/diagnostics` | **建议：实现 Trajectory 记录 + 前端可视化回放** |

---

## 三、GeoWork 后端模块规划

### 3.1 现有目录结构（core/internal/）

```text
core/internal/
├── agent/           # Agent 引擎、循环控制
├── aiagent/         # Sub-agent 管理
├── api/             # HTTP API 层
├── artifacts/       # 生成产物管理
├── automation/      # 定时任务、自动循环
├── browserbridge/   # 浏览器/GUI 操控桥
├── conversation/    # 对话历史、上下文管理
├── diagnostics/     # 诊断、日志
├── diff/            # 文件差异对比
├── eino/            # 字节 Eino AI 框架集成
├── events/          # SSE 事件流
├── file/            # 文件操作
├── idgen/           # 唯一标识生成
├── knowledge/       # 知识检索、RAG
├── mcp/             # MCP 连接器
├── modelgateway/    # 模型路由
├── permissions/     # 权限校验
├── plugins/         # 插件体系
├── runtime/         # 运行时管理
├── safety/          # 安全护栏
├── sandbox/         # 沙箱策略
├── storage/         # 存储层
├── tasks/           # 任务状态机
├── toolregistry/    # 工具注册表
├── tools/           # 工具执行
├── worker/          # Python Worker 通信桥
└── workspace/       # 工作目录管理
```

### 3.2 需要加强的模块

| 模块 | 当前状态 | 需要做什么 | 参考谁 |
| --- | --- | --- | --- |
| `conversation/` | 基础对话管理 | 实现 5 层渐进式压缩（Snip/Microcompact/Collapse/Autocompact/Memory Externalize） | Claude Code |
| `permissions/` + `safety/` | 规则引擎 | 加入 AI 审批层（用轻量模型判断灰色地带操作） | Codex CLI Guardian AI |
| `tools/` | 基础执行 | 实现读/写分离 + 推测执行（模型输出中就开始跑只读工具） | Claude Code |
| `aiagent/` | 初步实现 | 定义清晰的 spawn/context-isolate/result-return 协议 | Cursor Subagents |
| `knowledge/` | 基础 RAG | 加入地理空间数据语义索引（不只是文本） | Trae MarsCode |
| `diagnostics/` | 基础日志 | 实现 Trajectory 记录 + 执行回放 | Trae / Manus |
| `automation/` | 定时任务 | 加入 Hooks 事件系统（工具调用前后、状态转换、错误发生） | Claude Code 27 种 Hook |

### 3.3 建议新增的模块

| 新模块 | 职责 | 参考 |
| --- | --- | --- |
| `hooks/` | 生命周期钩子注册与触发 | Claude Code Hooks |
| `trajectory/` | 执行轨迹记录、存储、回放 | Trae Trajectory / Manus Replay |
| `compaction/` | 独立的上下文压缩引擎（从 conversation 中拆出） | Claude Code 5 层压缩 |
| `guardian/` | AI 审批模块（独立于规则引擎） | Codex Guardian AI |
| `telemetry/` | 指标采集（token 消耗、工具成功率、循环次数） | Cursor 内部观测 |

### 3.4 建议的完整目录结构

```text
core/internal/
├── agent/              # Agent 引擎（循环控制、停止条件、错误处理）
├── aiagent/            # Sub-agent（spawn/isolate/return 协议）
├── api/                # HTTP API 层
├── artifacts/          # 生成产物管理
├── automation/         # 定时任务、工作流串联
├── browserbridge/      # 浏览器/GUI 操控桥
├── compaction/         # 🆕 上下文压缩引擎（5 层策略）
├── conversation/       # 对话历史管理
├── diagnostics/        # 诊断、日志
├── diff/               # 文件差异对比
├── eino/               # Eino AI 框架集成
├── events/             # SSE 事件流
├── file/               # 文件操作
├── guardian/           # 🆕 AI 审批（用轻量模型判断操作安全性）
├── hooks/              # 🆕 生命周期钩子（工具调用前后、状态转换等）
├── idgen/              # 唯一标识生成
├── knowledge/          # 知识检索、RAG、地理空间语义索引
├── mcp/                # MCP 连接器
├── modelgateway/       # 模型路由、Fallback、成本控制
├── permissions/        # 权限校验（规则引擎层）
├── plugins/            # 插件体系
├── runtime/            # 运行时管理
├── safety/             # 安全护栏（Prompt Injection 防御等）
├── sandbox/            # 沙箱策略
├── storage/            # 存储层（SQLite、Cloud Sync）
├── tasks/              # 任务状态机、Checkpoint、Recovery
├── telemetry/          # 🆕 指标采集（token、成功率、循环次数）
├── toolregistry/       # 工具注册表
├── tools/              # 工具执行（读/写分离、推测执行）
├── trajectory/         # 🆕 执行轨迹记录与回放
├── worker/             # Python Worker 通信桥
└── workspace/          # 工作目录管理
```

### 3.5 workers/geo-python 结构

```text
workers/geo-python/
├── app/                    # FastAPI 应用入口
│   ├── main.py             # 服务启动
│   ├── health.py           # 🆕 健康检查端点
│   └── config.py           # 配置管理
├── services/               # 业务逻辑
│   ├── gee/                # Google Earth Engine 工作流
│   ├── gdal/               # GDAL 处理
│   ├── qgis/               # QGIS 算法调用
│   ├── paper/              # 论文解析
│   ├── report/             # 报告生成
│   └── ndvi/               # NDVI 分析
├── tools/                  # 工具实现（供 Core 调用）
├── sandbox/                # 🆕 Python 执行沙箱
├── validation.py           # 结果验证
├── telemetry.py            # 🆕 执行指标上报
├── exceptions.py           # 异常定义
└── pyproject.toml          # 依赖管理
```

---

## 四、模块实现优先级

| 优先级 | 模块 | 原因 |
| --- | --- | --- |
| **P0（立即）** | `compaction/`（上下文压缩） | 没有这个，长任务会崩溃。所有成熟产品都有多层压缩 |
| **P0（立即）** | `hooks/`（生命周期钩子） | 没有这个，无法扩展、无法插入验证、无法做审计 |
| **P1（本版本）** | `trajectory/`（执行轨迹） | 可追溯性是 GeoWork 的核心卖点（"可追溯的 GIS 分析"） |
| **P1（本版本）** | `guardian/`（AI 审批） | 地理空间操作有真实破坏性（覆盖数据、删除文件），需要智能判断 |
| **P1（本版本）** | `tools/` 推测执行 | 显著提升用户感知速度 |
| **P2（下版本）** | `telemetry/`（指标采集） | 评估 Agent 质量的基础 |
| **P2（下版本）** | `aiagent/` 协议明确化 | Sub-agent 是处理复杂 GIS 工作流的关键 |
| **P2（下版本）** | `knowledge/` 地理空间语义索引 | 让 Agent 理解数据之间的空间关系 |
| **P3（远期）** | 并行 Agent | 多任务并行执行 |
| **P3（远期）** | Session Replay UI | 前端回放执行过程 |

---

## 五、GeoWork vs 竞品的独特定位

| 维度 | 其他 Agent 产品 | GeoWork |
| --- | --- | --- |
| 领域 | 通用 coding | **地理空间垂直领域** |
| 执行层 | 单语言（TS/Rust/Python） | **多语言（Go + Python + Electron）** |
| 工具集 | 文件编辑、终端命令 | **QGIS/GDAL/GEE + 文件 + 终端** |
| 产物 | 代码文件 | **地图、报告、分析结果、GeoJSON** |
| 验证 | 类型检查、lint | **CRS 一致性、要素数量、空间范围** |
| 用户 | 开发者 | **GIS 从业者、遥感研究者、学生** |
| 独特模块 | 无 | **browserbridge + worker bridge + eino + api 服务化** |

---

## 六、参考资源汇总

| 资源 | 链接 | 价值 |
| --- | --- | --- |
| Claude Code 架构分析（逆向） | [alejandrobalderas/claude-code-from-source](https://github.com/alejandrobalderas/claude-code-from-source) | 最详细的 Agent 架构拆解 |
| Claude Code 源码集合 | [chauncygu/collection-claude-code-source-code](https://github.com/chauncygu/collection-claude-code-source-code) | 模块描述 + 执行流程 |
| Claude Code 深度指南 | [FlorianBruniaux/claude-code-ultimate-guide](https://github.com/FlorianBruniaux/claude-code-ultimate-guide) | Master Loop、Tool Arsenal、Context Internals |
| Dive into Claude Code | [VILA-Lab/Dive-into-Claude-Code](https://github.com/VILA-Lab/Dive-into-Claude-Code) | 7 层安全、5 层压缩、54 工具、27 Hook |
| Codex CLI 架构拆解 | [openai/codex Discussion #17051](https://github.com/openai/codex/discussions/17051) | Queue-pair、Guardian AI、3-OS Sandbox |
| Codex CLI 生态 | [RoggeOhta/awesome-codex-cli](https://github.com/RoggeOhta/awesome-codex-cli) | 280+ 资源汇总 |
| Trae Agent（开源） | [bytedance/trae-agent](https://github.com/bytedance/trae-agent) | 模块化、透明、研究友好 |
| DeerFlow（开源） | [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | 79.6K stars，SuperAgent Harness |
| OpenAI Agents SDK | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | Handoff 架构、Guardrails、Tracing |
| Agent Skills 标准 | [agentskills.io](https://agentskills.io) | Anthropic 开源技能标准 |
| Agent 架构 Topic | [github.com/topics/agent-architecture](https://github.com/topics/agent-architecture) | 各种 Agent 架构项目 |
| Awesome AI Agents 2026 | [Supersynergy/awesome-ai-agents-2026](https://github.com/Supersynergy/awesome-ai-agents-2026) | 100+ 工具全景 |
| Pi（earendil-works） | [github.com/earendil-works/pi](https://github.com/earendil-works/pi) | 86.1K stars，monorepo 5 包：pi-agent-core / pi-ai / pi-coding-agent / pi-tui / pi-telemetry；显式状态 Harness 设计；无内置权限系统 |
| AI Agent 深入理解（书） | [bojieli/ai-agent-book](https://github.com/bojieli/ai-agent-book) | 34.8K stars，设计原理与工程实践 |
| QoderAI GitHub | [github.com/qoderAI](https://github.com/qoderAI) | better-harness、Agent SDK |
| Kimi WebBridge 解析 | [v2code.ai](https://www.v2code.ai/post/kimi-webbridge-analysis) | CDP 协议 + 本地守护进程架构 |
| Manus 架构分析 | [Medium](https://tao-hpu.medium.com/ai-agent-landscape-2025-2026-a-technical-deep-dive-abda86db7ae2) | 多 Agent 架构 + Context Engineering |


