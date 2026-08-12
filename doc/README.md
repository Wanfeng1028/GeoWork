# GeoWork 文档导航

> 10 分钟读完这份指南，知道"改什么代码 → 读什么文档"。

## 文档层级

```
Level 0 — 宪法（极少改动）
├── AGENT.md                              ← 全局约束 + 路由表 + 纪律
└── GeoWorkFrontend-Design-System.md      ← 视觉宪法（色值/圆角/组件规格）

Level 1 — 规范（按阶段更新）
├── GeoWorkFrontend-Engineering-Standards.md  ← 前端代码规范（状态管理/API/测试/性能）
├── GeoWork-Communication-Protocol.md         ← 前后端通信协议（SSE + WebSocket）
└── Engineering-*.md × 9                      ← 各领域工程规范（见下表）

Level 2 — 施工图（每个 P 阶段更新）
├── GeoWorkFrontend-Design-System-Detailed.md  ← 视觉施工（F0-FP3）
├── GeoWorkAgent-P0~P3-Detailed-Design.md      ← 后端施工（接口签名/伪码/验收）
└── Engineering-Implementation-Plan.md          ← 工程化施工（E0-E2）

Level 3 — 记录（持续追加）
├── CHANGELOG.md
└── ADR/                                       ← 架构决策记录
```

## 按模块索引

| 你要改的 | 先读这个 | 再读这个 |
|---|---|---|
| **任何代码** | `AGENT.md` | 下面对应的行 |
| 前端 UI | 设计系统 | 施工计划 + 工程规范 |
| 前端状态/API | 工程规范 §1-2 | TypeScript 规范 |
| Go Core | GeoWorkAgent.md | P0-P3 对应阶段文档 |
| Go Core 通信 | 通信协议 | P1 §4.5（SSE）+ §5.5.1（WS） |
| Python Worker | 对应技能的 SKILL.md | — |
| CI/CD | Engineering-CI-CD.md | Engineering-Git-Workflow.md |
| 安全相关 | Engineering-Security.md | — |
| 测试 | Engineering-Testing.md | 工程规范 §3 |

## Engineering 文档速查

| 文档 | 一句话 |
|---|---|
| `Engineering-Git-Workflow.md` | 分支策略 + commit 规范 + PR 模板 |
| `Engineering-CI-CD.md` | GitHub Actions pipeline + 环境管理 + 门禁规则 |
| `Engineering-Security.md` | Electron 安全 + CSP + XSS + IPC 规范 + 依赖审计 |
| `Engineering-TypeScript.md` | tsconfig 配置 + strict 模式 + 运行时校验 |
| `Engineering-ESLint-Prettier.md` | oxlint 规则 + Prettier + import 排序 + import 边界 |
| `Engineering-API-Contract.md` | REST 规范 + 错误码 + SSE 事件类型 + 版本管理 |
| `Engineering-Testing.md` | 测试分层 + MSW mock + Playwright + 跨平台 |
| `Engineering-Release.md` | SemVer + CHANGELOG + Feature Flags + 打包发布 |
| `Engineering-Monitoring.md` | Sentry 错误上报 + Electron 性能指标 + 埋点 |

## 阅读顺序建议

**新加入项目的 AI 助手**：

1. `AGENT.md`（5 分钟）— 知道规矩
2. 你负责模块对应的文档（5 分钟）— 知道规范
3. 当前 P 阶段的施工图（10 分钟）— 知道要做什么

**不需要全读**。14+ 份文档全部加载到上下文会浪费 token。按 `AGENT.md §3` 路由表只读你需要的。
