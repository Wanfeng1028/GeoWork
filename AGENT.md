# AGENT.md

> 本文件是 GeoWork 仓库的全局开发约束。
> 任何 AI 编程助手在修改代码前，必须先读本文件，再根据所改模块去读对应的专项文档。
> 本文件不重复各模块的具体规范，只做路由和通用纪律。

---

## 1. 项目身份

| 项 | 值 |
|---|---|
| 产品名 | GeoWork |
| 定位 | 面向 GIS、遥感和地理空间工作流的本地优先桌面 AI Agent 工作台 |
| 仓库结构 | Monorepo |
| 当前版本 | v0.4.x-dev |
| 许可 | PolyForm Noncommercial License 1.0.0 |

---

## 2. 模块地图

| 模块 | 路径 | 技术栈 | 职责 |
|---|---|---|---|
| 桌面前端 | `apps/desktop/` | Electron 34 + React 19 + AntD 6 + TS 6 | UI、状态、地图渲染 |
| Go 核心 | `core/` | Go | 工具编排、技能注册、MCP、安全、模型路由、自动化 |
| Go 云端 | `server/` | Go | Auth、RBAC、计费、会话同步 |
| Python Worker | `workers/geo-python/` | FastAPI | GEE/GDAL/QGIS 处理、报告生成 |
| 技能 | `skills/` | Markdown + JSON | AI 技能包 |
| 插件 | `plugins/` | — | 本地插件市场 |
| MCP | `mcp/` | — | MCP 连接器 |

---

## 3. 文档路由（改什么读什么）

**这是本文件最核心的一节。**

| 你要改的模块 | 必须先读的文档 |
|---|---|
| `apps/desktop/` | `doc/前端设计系统.md`（含 Token、组件、布局、图标、纪律、验收全部内容） |
| `core/` | `doc/GeoWorkAgent.md` + `doc/Agent 架构对比与模块规划.md` |
| `server/` | `AGENT_UPGRADE_PLAN.md`（如涉及 Agent 能力） |
| `workers/geo-python/` | 对应技能的 `SKILL.md` |
| `skills/` | 目标技能的 `manifest/meta.json` + `skill/SKILL.md` |
| `plugins/` | 目标插件的权限声明 |
| 跨模块联调 | 涉及的所有模块文档 |

规则：
- 只读当前模块对应的文档，不读无关模块的
- 不跳过当前模块的文档
- 文档之间冲突时：用户指令 > 本文件 > 模块专项文档 > 其他

---

## 4. 通用工作流程

### 修改前

```text
1. 读本文件
2. 查 §3 路由表，读当前模块对应的文档
3. 读当前任务直接相关的源文件
4. 输出：当前理解 / 修改范围 / 实现方案 / 验收方式
5. 等用户确认后再改代码
