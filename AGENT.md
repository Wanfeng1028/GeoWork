

---

# AGENT.md

> 本文件是 GeoWork 仓库的全局开发约束。
> 任何 AI 编程助手在修改代码前，必须先读本文件，再根据所改模块去读对应的专项文档。
> 本文件不重复各模块的具体规范，只做路由和通用纪律。

---

## 1. 项目身份

| 项       | 值                                                           |
| -------- | ------------------------------------------------------------ |
| 产品名   | GeoWork                                                      |
| 定位     | 面向 GIS、遥感和地理空间工作流的本地优先桌面 AI Agent 工作台 |
| 仓库结构 | Monorepo                                                     |
| 当前版本 | v0.4.x-dev                                                   |
| 许可     | PolyForm Noncommercial License 1.0.0                         |

---

## 2. 模块地图

| 模块          | 路径                  | 技术栈                                 | 职责                                            |
| ------------- | --------------------- | -------------------------------------- | ----------------------------------------------- |
| 桌面前端      | `apps/desktop/`       | Electron 34 + React 19 + AntD 6 + TS 6 | UI、状态、地图渲染                              |
| Go 核心       | `core/`               | Go                                     | 工具编排、技能注册、MCP、安全、模型路由、自动化 |
| Go 云端       | `server/`             | Go                                     | Auth、RBAC、计费、会话同步                      |
| Python Worker | `workers/geo-python/` | FastAPI                                | GEE/GDAL/QGIS 处理、报告生成                    |
| 技能          | `skills/`             | Markdown + JSON                        | AI 技能包                                       |
| 插件          | `plugins/`            | —                                      | 本地插件市场                                    |
| MCP           | `mcp/`                | —                                      | MCP 连接器                                      |

---

## 3. 文档路由（改什么读什么）

**这是本文件最核心的一节。**

| 你要改的模块          | 必须先读的文档                                               |
| --------------------- | ------------------------------------------------------------ |
| `apps/desktop/`       | `doc/前端设计系统.md`（含 Token、组件、布局、图标、纪律、验收全部内容） |
| `core/`               | `doc/GeoWorkAgent.md` + `doc/Agent 架构对比与模块规划.md`    |
| `server/`             | `AGENT_UPGRADE_PLAN.md`（如涉及 Agent 能力）                 |
| `workers/geo-python/` | 对应技能的 `SKILL.md`                                        |
| `skills/`             | 目标技能的 `manifest/meta.json` + `skill/SKILL.md`           |
| `plugins/`            | 目标插件的权限声明                                           |
| 跨模块联调            | 涉及的所有模块文档                                           |

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
```

### 修改后

```text
1. 执行当前模块的构建/测试（见 §5）
2. 汇报：改了什么 / 没改什么 / 是否影响其他模块 / 构建结果
```

### 禁止

```text
- 跳过确认直接改代码
- 没有构建/测试就说"完成了"
- 构建失败后继续做新功能
- 一次性跨多个阶段
- 顺手修改无关模块
```

---

## 5. 构建与测试命令

| 模块          | 构建                                     | 测试                                        | 开发                                      |
| ------------- | ---------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| 前端          | `npm --workspace apps/desktop run build` | `npm --workspace apps/desktop test`         | `npm --workspace apps/desktop run dev`    |
| Go 核心       | `cd core && go build ./...`              | `cd core && go test ./...`                  | `cd core && go run ./cmd/geowork-runtime` |
| Go 云端       | `cd server && go build ./...`            | `cd server && go test ./...`                | `cd server && go run ./cmd/geowork-api`   |
| Python Worker | —                                        | `cd workers/geo-python && python -m pytest` | `uvicorn app.main:app --port 8766`        |
| 全栈          | `npm run build`                          | `npm test`                                  | `npm run dev`                             |

---

## 6. 跨模块通信

```text
前端 ←→ Go 核心：HTTP API + SSE（前端通过 /api 代理）
Go 核心 ←→ Python Worker：HTTP
Go 核心 ←→ Go 云端：HTTP
前端 ←→ Go 云端：不直接通信，经过核心层

禁止：
- 前端直接调用 Python Worker
- Worker 直接向前端推送（必须经过核心层 SSE）
```

---

## 7. Git 规则

```text
禁止自动执行（除非用户明确要求）：
git pull / commit / push / reset / checkout / rebase / clean

远端仓库只用于了解进度，开发基于本地状态。
```

---

## 8. 依赖规则

```text
禁止未经确认安装新依赖。
需要新依赖时说明：为什么 / 有没有替代 / 影响范围。
```

| 模块   | 依赖文件                              |
| ------ | ------------------------------------- |
| 前端   | `apps/desktop/package.json`           |
| Go     | `core/go.mod` / 根目录 `go.mod`       |
| Python | `workers/geo-python/requirements.txt` |

---

## 9. 全局禁止

```text
- 在 UI / 变量名 / 注释中出现参考软件名称
- 修改无关模块的代码
- 绕过类型检查或错误处理
- 吞错误不处理
- 把参考项目变成我们的项目名
```

---

## 10. 汇报格式

**开始前：**
```text
当前理解：
涉及模块：
准备修改的文件：
不修改的文件：
实现方案：
验收方式：
等待确认。
```

**完成后：**
```text
完成情况：
修改/新增文件：
未做事项：
是否影响其他模块：
是否安装新依赖：
构建/测试结果：
需要重点验收的地方：
```

---

## 11. 最后原则

```text
小范围、可回滚、可解释、可验收。
不破坏现有功能，不污染其他模块。
```
```

---

这版大概 150 行，只做三件事：**告诉你项目有什么模块、改哪个模块去读哪份文档、所有模块共同遵守的纪律**。前端的颜色怎么写、圆角多大、按钮什么样式，一个字都不重复——全在 `doc/前端设计系统.md` 里。
