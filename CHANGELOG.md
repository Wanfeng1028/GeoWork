# Changelog

> **状态：站位文档**
> 本文件为占位文件，待 GeoWork 第一次正式发版（v1.0.0）时填充完整内容。

## 格式规范

所有项目变更遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

### 分类

- `Added` — 新功能
- `Changed` — 对现有功能的变更
- `Deprecated` — 即将移除的功能
- `Removed` — 移除的功能
- `Fixed` — 对现有功能的修复
- `Security` — 安全相关修复

### 示例条目

```markdown
## [Unreleased]

### Added
- 初始项目结构与文档体系

### Added — 后端/Agent P0-P3 全阶段实现（TraeCodeCloud，2026-08-12，分支 `dev/TraeCodeCloud`）
- **P0**：ReAct 循环 + 状态机三者对齐 + per-run RunContext 隔离 + ContextBuilder 接线（L1-L3 三级裁剪）+ workflow/worker 工具改走 ToolRegistry（`e17c026`、`10f4305`）
- **P1**：ApprovalGovernor 审批流 + Trajectory/UsageMeter 可观测性 + SSE 断线重连（Last-Event-ID）+ WebSocket JSON-RPC 2.0 双向通信 + Pause/Resume + WorkerPool 资源限制 + Checkpoint 断点续传（`33883ec`）
- **P2**：Skills 体系（两阶段加载）+ MCP transport 集成 + 6 钩子点 Lifecycle + Cron Scheduler/Trigger + 多模型 Router（ModelGateway 实现 + 降级 + 成本控制）+ Eval 评估体系 + 浏览器工具/CDP/URL 沙箱（`3fb4646`）
- **P3**：Sub-agent（NewChildOrchestrator + spawn_subagent）+ Harness 统一规则引擎 + 流式推测执行（SpeculativeExecutor + ReadOnly）+ 5 层压缩完整版 L4/L5（Summarizer + SolidifyMemory）（`cc69658`）

### Changed
- AGENT.md §1 当前阶段更新为「P0-P3 后端施工全部完成，待验收」
- `doc/05-GeoWorkAgent-P0-Detailed-Design.md` 追加 v0.6 实现记录
- `doc/06-GeoWorkAgent-P1-Detailed-Design.md` 追加 v0.5 实现记录
- `doc/07-GeoWorkAgent-P2-Detailed-Design.md` 追加 v0.5 实现记录
- `doc/08-GeoWorkAgent-P3-Detailed-Design.md` 追加 v0.3 实现记录

### Fixed
- `orchestrator.go` `ExecutionMode` int→string 转换 vet 警告（改用 `.String()`）

## [1.0.0] - 2026-08-12

### Added
- 首个正式版本发布
```

## 相关文档

- 版本发布流程：`doc/17-Engineering-Release.md`
- 文档变更规则：`AGENT.md §15.3`

---

*最后更新：2026-08-12（TraeCodeCloud 补充 P0-P3 后端/Agent 全阶段实现记录）*
