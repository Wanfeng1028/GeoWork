# AGENT.md

| 版本 | 日期       | 变更摘要                                                 |
| ---- | ---------- | -------------------------------------------------------- |
| v1.0 | 2026-08-11 | 初稿：模块地图、文档路由、通用纪律                       |
| v1.1 | 2026-08-12 | 合并去重双版本；修正路由表 404、skills 结构、依赖文件名；补 marketplace 模块、P0-P3 文档入口、版本表 |

> 本文件是 GeoWork 仓库的全局开发约束。
> 任何 AI 编程助手在修改代码前，必须先读本文件，再根据所改模块去读对应的专项文档。
> 本文件不重复各模块的具体规范，只做路由和通用纪律。

---

## 1. 项目身份

| 项       | 值                                                           |
| -------- | ------------------------------------------------------------ |
| 产品名   | GeoWork                                                      |
| 定位     | 面向 GIS、遥感和地理空间工作流的本地优先桌面 AI Agent 工作台   |
| 仓库结构 | Monorepo                                                     |
| 当前版本 | v0.4.x-dev                                                   |
| 当前阶段 | P0 详细设计完成（`doc/GeoWorkAgent-P0-Detailed-Design.md`），待施工 |
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
| 市场索引      | `marketplace/`        | JSON                                   | 技能 / 插件市场索引                             |

---

## 3. 文档路由（改什么读什么）

**这是本文件最核心的一节。**

| 你要改的模块          | 必须先读的文档                                                                     | 状态             |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| `apps/desktop/`       | `doc/GeoWorkFrontend-Design-System.md` + `doc/GeoWorkFrontend-Design-System-Detailed.md` | 活文档 v1.5.1    |
| `core/`               | `doc/GeoWorkAgent.md`                                                              | 主宪法 v1.5      |
| `core/` 施工          | `doc/GeoWorkAgent-P0-Detailed-Design.md` ~ `P3-Detailed-Design.md`                 | 施工图           |
| `core/` 历史参考      | `doc/过程参考文档归档/Agent 架构对比与模块规划 v1.0.md`                             | 归档             |
| `server/`             | 如涉及 Agent 能力，读 `doc/` 下对应设计文档                                        | —                |
| `workers/geo-python/` | 对应技能的 `SKILL.md`                                                              | —                |
| `skills/`             | 目标技能的 `manifest.json` + `SKILL.md`（扁平结构，无子目录）                       | 骨架已立         |
| `plugins/`            | 目标插件的权限声明                                                                 | —                |
| 跨模块联调            | 涉及的所有模块文档                                                                 | —                |

规则：

- 只读当前模块对应的文档，不读无关模块的
- 不跳过当前模块的文档
- 文档之间冲突时：用户指令 > 本文件 > 模块专项文档 > 其他

---

## 4. 核心开发原则

### 4.1 先读文件，再给方案，再改代码

每次开发前必须：

1. 读本文件
2. 查 §3 路由表，读当前模块对应的文档
3. 读当前任务直接相关的源文件
4. 输出：当前理解 / 修改范围 / 实现方案 / 验收方式
5. 等用户确认后再改代码

禁止直接开始大改。

### 4.2 只做当前任务，不顺手做别的

严格遵守用户当前阶段的目标。不要因为看到别的页面、别的 TODO、别的提交，就顺手修改：

- 路由
- AppShell
- 主题系统
- Page页面文件
- package.json
- 设计文档
- 已经完成的功能模块

除非当前任务明确要求。

### 4.3 能复用就复用

优先复用已有代码：组件、hooks、theme token、类型定义、mock 数据、布局方式、组件模式。不要重复造轮子，不要为一个页面复制一套几乎相同的 UI。

### 4.4 小步提交式开发

大任务必须拆阶段。推荐节奏：

1. 先做基础壳
2. 再补交互
3. 再补状态
4. 再补边界处理
5. 最后做样式修复和 build

不要一次性改几十个文件，不要把一个页面写成几千行巨型组件。

---

## 5. 工作流程

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
1. 执行当前模块的构建/测试（见 §6）
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

## 6. 构建与测试命令

| 模块          | 构建                                     | 测试                                        | 开发                                      |
| ------------- | ---------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| 前端          | `npm --workspace apps/desktop run build` | `npm --workspace apps/desktop test`         | `npm --workspace apps/desktop run dev`    |
| Go 核心       | `cd core && go build ./...`              | `cd core && go test ./...`                  | `cd core && go run ./cmd/geowork-runtime` |
| Go 云端       | `cd server && go build ./...`            | `cd server && go test ./...`                | `cd server && go run ./cmd/geowork-api`   |
| Python Worker | —                                        | `cd workers/geo-python && python -m pytest` | `uvicorn app.main:app --port 8766`        |
| 全栈快捷      | `npm run build`                          | `npm test`                                  | `npm run dev`                             |

每次改完必须执行对应模块的构建命令。汇报时必须说明 build 是否通过。

---

## 7. 跨模块通信

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

## 8. Git 规则

```text
禁止自动执行（除非用户明确要求）：
git pull / commit / push / reset / checkout / rebase / clean

远端仓库只用于了解进度，开发基于本地状态。
```

---

## 9. 依赖规则

禁止未经确认安装新依赖。需要新依赖时说明：为什么 / 有没有替代 / 影响范围。

当前项目已有 Ant Design v6，应优先使用 AntD 能力。禁止随手引入：UI 库、Markdown 渲染库、状态管理库、图表库、动画库、文件处理库、CSS 框架。

| 模块   | 依赖文件                              |
| ------ | ------------------------------------- |
| 前端   | `apps/desktop/package.json`           |
| Go     | `core/go.mod` / 根目录 `go.mod`       |
| Python | `workers/geo-python/pyproject.toml` |

---

## 10. 全局禁止

```text
- 在 UI / 变量名 / 注释中出现参考软件名称
- 修改无关模块的代码
- 绕过类型检查或错误处理
- 吞错误不处理
- 把参考项目变成我们的项目名
```

---

## 11. 前端专项纪律

### 11.1 参考截图使用规则

参考截图只参考：布局、信息层级、交互模式、视觉节奏。

禁止照搬：品牌名、业务数据、用户头像、产品文案、插件包名、安装规则、不属于 GeoWork 的行业内容。

### 11.2 页面语义

GeoWork 是空间智能 / GIS / 遥感 / 数据工作流工具。页面文案应围绕：空间分析、遥感解译、数据处理、专题制图、工作流、工具调用、任务执行、工作目录、地图、图层、坐标系统、GeoJSON、CSV、DEM、遥感影像。

不要写成泛泛的聊天工具或普通办公助手。

### 11.3 localStorage 使用

- key 必须带 `geowork.` 前缀
- 读取失败要兜底，未知值要回退合理默认
- 不保存 File 对象、DirectoryHandle、敏感信息、大体积内容

### 11.4 异步与中断

流式、timer、异步任务必须支持清理：

- AbortController 可中断
- 组件卸载时清理 timer
- 停止生成后不继续追加内容
- 新任务重置后旧回调不能污染新状态
- 快速连续发送不能导致状态串线

### 11.5 组件设计规范

- `Page.tsx` 负责编排，`components/*` 负责局部 UI，类型定义集中管理
- Props 要明确，不要传一整个巨大对象，组件只接收自己需要的数据和回调
- 展示组件不要直接操作 localStorage / 发请求 / 改全局状态 / 操作路由 / 写复杂状态机，这些放在页面层或 hook / adapter 里

---

## 12. 代码质量要求

### 12.1 TypeScript

- 类型明确，避免隐式 any
- 复用已有类型，避免重复定义
- 复杂 union 类型集中定义
- 禁止 `@ts-ignore`、`@ts-nocheck`、`eslint-disable`、通过 `any` 粗暴绕过类型、删除类型定义来通过 build、关闭 TypeScript 检查或 ESLint 规则

### 12.2 React

- 遵守 Hooks 规则，不条件调用 Hook，不在循环 / 条件里调用 Hook
- useEffect dependency 完整
- 需要清理的 effect 必须 return cleanup
- 多个主题 hook 都依赖 React Hook 时，必须无条件调用后再按条件返回，避免 hook 顺序变化

### 12.3 命名

命名应表达业务含义。推荐：`ExpertSuite`、`WorkflowStep`、`ToolCallLog`、`RunStatus`、`MobileControlChannel`、`ScheduledTask`、`ConversationMessage`。

禁止无意义命名：`data1`、`aaa`、`temp`、`newData`、`test`、`demo2`。

---

## 13. 汇报模板

### 开始前

```text
当前理解：
涉及模块：
准备修改 / 新增文件：
不修改文件：
实现方案：
如何复用已有代码：
如何避免影响已有功能：
验收方式：
等待确认后再改代码。
```

### 完成后

```text
完成情况：
修改 / 新增文件：
功能说明：
未做事项：
是否影响已有页面：
是否安装新依赖：
build 结果：
doc/ 下相关文档是否需要同步更新：□ 是（哪份哪节） □ 否
需要用户重点验收的地方：
```

---

## 14. 最后原则

```text
小范围、可回滚、可解释、可验收。
不破坏现有功能，不污染其他模块。
不偷懒绕过类型，不把参考项目变成我们的项目名。
```
