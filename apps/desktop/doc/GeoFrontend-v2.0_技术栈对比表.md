# GeoFrontend2.0 与 GeoWork 原项目前端技术栈对比表

> 生成时间：2026-06-30  
> 新项目路径：`E:\code\javascript\project\GeoFrontend2.0`  
> 原项目仓库：`https://github.com/Wanfeng1028/GeoWork`  
> 新项目目标：先做 **Web SPA**，不接 Electron 桌面封装。  
> 核心策略：**全面拥抱 Ant Design 体系**，能用 AntD / ProComponents / Ant Design Charts / Ant Design 设计规范的地方优先使用。

---

## 1. 总体结论

### 1.1 GeoFrontend2.0 最终技术栈一句话

```text
GeoFrontend2.0 = Vite + React + TypeScript + Ant Design v6 + ProComponents + Ant Design Charts / AntV + React Router + TanStack Query + Zustand + MapLibre GL / deck.gl + Ant Design Visual / Motion / Illustration / For Agents 规范
```

### 1.2 与原项目前端的核心区别

| 对比项 | GeoFrontend2.0 | GeoWork 原项目前端 | 结论 |
|---|---|---|---|
| 应用形态 | Web SPA | Electron 桌面端 | v2.0 先做 Web，降低启动成本 |
| UI 体系 | Ant Design v6 + ProComponents | 当前远端 `apps/desktop/package.json` 已无 AntD，使用原生 HTML / 自定义样式混合 | v2.0 全面回到 AntD 体系 |
| 设计规范 | Ant Design 视觉 / 动效 / 图形化 / For Agents | 原项目缺少统一设计规范层 | v2.0 把规范写进工程约束 |
| 工程复杂度 | Vite Web 工程 | electron-vite + Electron main/preload/renderer | v2.0 第一阶段不碰桌面壳 |
| 样式方案 | CSS Modules + 少量 `layout.css` | `app.css` + `global.scss` + `sass` | v2.0 不用 SCSS 做主题 |
| 状态方案 | TanStack Query + Zustand + AntD Form | TanStack Query + Zustand + Jotai | v2.0 状态边界更简单 |
| 图表方案 | Ant Design Charts / AntV 优先 | ECharts | v2.0 优先 AntD 生态；必要时再评估 ECharts |
| 地图方案 | MapLibre GL + deck.gl | MapLibre GL + deck.gl | 地图能力保留并升级 |
| AI 辅助开发 | 集成 Ant Design For Agents / CLI / design.md / LLMs.txt / MCP | 原项目未集成 | v2.0 更适合 AI 辅助开发和代码生成 |

---

## 2. 版本锁定原则

### 2.1 版本策略

新项目不使用宽泛的 `latest` 作为长期工程状态。

初始化时可以用：

```bash
npm create vite@latest GeoFrontend2.0 -- --template react-ts
```

但安装完成后必须通过 `package-lock.json` 锁定具体版本。

### 2.2 package.json 写法建议

建议新项目 `package.json` 中依赖使用精确版本，避免大版本或小版本漂移：

```json
{
  "dependencies": {
    "antd": "6.5.0",
    "@ant-design/icons": "6.3.2"
  }
}
```

不建议长期写成：

```json
{
  "dependencies": {
    "antd": "latest",
    "@ant-design/icons": "latest"
  }
}
```

---

## 3. GeoFrontend2.0 新前端技术栈版本表

### 3.1 基础工程层

| 分类 | 技术 / 包 | 建议锁定版本 | 用途 | 备注 |
|---|---|---:|---|---|
| Node.js | Node.js | `24 LTS` | 运行环境 | React Router 8 / Vite 8 / ESLint 10 都更适合 Node 22+ / 24 |
| 包管理器 | npm | 随 Node 24 | 依赖安装与 lockfile | 先用 npm，避免多包管理器混用 |
| 构建工具 | `vite` | `8.1.0` | Web SPA 构建和开发服务器 | 取代 electron-vite |
| React 插件 | `@vitejs/plugin-react` | `6.0.3` | React Fast Refresh / JSX 编译 | Vite React 官方插件 |
| 前端框架 | `react` | `19.2.7` | UI 框架 | 与 AntD v6 匹配 |
| DOM 渲染 | `react-dom` | `19.2.7` | React DOM 渲染 | 与 React 版本保持一致 |
| 语言 | `typescript` | `6.0.3` | 类型系统 | 新项目直接使用 TS 6 |

### 3.2 Ant Design 生态层

| 分类 | 技术 / 包 | 建议锁定版本 | 用途 | 是否第一阶段安装 |
|---|---|---:|---|---:|
| 基础 UI | `antd` | `6.5.0` | Button、Form、Table、Modal、Drawer、Layout 等基础组件 | 是 |
| 图标 | `@ant-design/icons` | `6.3.2` | 统一图标库 | 是 |
| 高阶中后台组件 | `@ant-design/pro-components` | `2.8.10` | ProTable、ProForm、ProCard、ProLayout、PageContainer | 第二阶段验证后安装 |
| 图表 | `@ant-design/charts` | `2.6.7` | Dashboard、任务统计、数据资产图表 | 第二阶段安装 |
| 设计规范 | Ant Design Visual | 文档规范 | 图表、地图统计、可视化面板规范 | 是，作为规范使用 |
| 动效规范 | Ant Design Motion | 文档规范 | Drawer、Modal、任务状态、面板切换动效规范 | 是，作为规范使用 |
| 图形化规范 | Ant Design Illustration | 文档规范 | 空状态、异常页、成功页、引导页插画规范 | 是，作为规范使用 |
| AI 辅助开发 | Ant Design For Agents | 文档 / CLI / MCP | 让 AI Agent 查询组件 API、Token、Demo、Changelog | 是，作为开发流程使用 |

### 3.3 路由、状态和数据层

| 分类 | 技术 / 包 | 建议锁定版本 | 用途 | 备注 |
|---|---|---:|---|---|
| 路由 | `react-router` | `8.0.1` | Web SPA 页面路由 | 使用 React Router 8 |
| 服务端状态 | `@tanstack/react-query` | `5.101.2` | 请求、缓存、异步状态 | 服务端数据不放 Zustand |
| 客户端状态 | `zustand` | `5.0.14` | 主题、侧栏、当前工作区、UI 状态 | 不再引入 Jotai |
| 表单状态 | AntD Form / ProForm | 随 AntD / ProComponents | 表单字段、校验、提交状态 | 表单字段不放 Zustand |

### 3.4 地图、空间可视化和业务能力层

| 分类 | 技术 / 包 | 建议锁定版本 | 用途 | 备注 |
|---|---|---:|---|---|
| 地图底图 | `maplibre-gl` | `5.24.0` | Web 地图底图和交互 | 保留 GeoWork 核心地图方向 |
| 空间可视化 | `deck.gl` | `9.3.3` | 大规模空间数据可视化 | Workspace 阶段再接入 |
| React 空间可视化 | `@deck.gl/react` | `9.3.3` | React 中使用 deck.gl | 与 deck.gl 保持同版本 |
| 图层能力 | `@deck.gl/layers` | `9.3.3` | 常用图层能力 | 与 deck.gl 保持同版本 |
| 面板布局 | AntD Splitter / `react-resizable-panels` | 优先 AntD Splitter | 工作区面板拆分 | 复杂拖拽再加 panels |
| 代码编辑器 | Monaco | 后续按需安装 | 脚本、JSON、配置编辑 | 初期不装 |
| 终端 | xterm | 后续按需安装 | 运行日志 / 命令输出 | 初期不装 |

### 3.5 测试和工程质量层

| 分类 | 技术 / 包 | 建议锁定版本 | 用途 | 备注 |
|---|---|---:|---|---|
| 测试框架 | `vitest` | `4.1.9` | 单元测试 / 组件测试 | Vite 生态优先 |
| DOM 测试环境 | `jsdom` | `29.1.1` | 浏览器 DOM 模拟 | 配合 Vitest |
| React 测试 | `@testing-library/react` | `16.3.0` | React 组件测试 | 测试用户视角行为 |
| 测试断言 | `@testing-library/jest-dom` | `6.9.1` | DOM matcher | 增强断言可读性 |
| 用户事件 | `@testing-library/user-event` | `14.6.1` | 模拟真实用户交互 | 表单、按钮、菜单测试 |
| Lint | `eslint` | `10.6.0` | 代码质量检查 | 必须开启 |
| TS ESLint | `typescript-eslint` | `8.62.0` | TypeScript lint 规则 | 必须开启 |
| 格式化 | `prettier` | `3.9.1` | 代码格式化 | 与 ESLint 分工明确 |
| ESLint / Prettier 兼容 | `eslint-config-prettier` | `10.1.8` | 关闭冲突格式化规则 | 必须配置 |

---

## 4. GeoWork 原项目前端技术栈现状

以下基于远端仓库当前 `apps/desktop/package.json` 和根目录 `package.json`。

### 4.1 原项目前端依赖现状

| 分类 | 原项目技术 / 包 | 当前版本范围 | 说明 |
|---|---|---:|---|
| 应用形态 | Electron | `^34.5.8` | 桌面端应用壳 |
| 构建工具 | Vite | `^6.0.0` | renderer 构建 |
| Electron 构建 | electron-vite | `^3.1.0` | main / preload / renderer 集成构建 |
| React | react | `^19.0.0` | UI 框架 |
| React DOM | react-dom | `^19.0.0` | DOM 渲染 |
| TypeScript | typescript | `^5.8.0` | 类型系统 |
| 服务端状态 | `@tanstack/react-query` | `^5.0.0` | 服务端状态 |
| 客户端状态 | `zustand` | `^5.0.0` | UI 状态 |
| 局部状态 | `jotai` | `^2.20.1` | 原项目保留 |
| 地图 | `maplibre-gl` | `^4.0.0` | 地图能力 |
| 空间可视化 | `deck.gl` | `^9.0.0` | 空间数据可视化 |
| 图表 | `echarts` | `^5.0.0` | 图表统计 |
| 编辑器 | `@monaco-editor/react` | `^4.0.0` | Monaco React 封装 |
| 终端 | `xterm` | `^5.0.0` | 终端 / 日志 |
| 面板 | `react-resizable-panels` | `^4.11.2` | 拖拽面板 |
| 图标 | `lucide-react` | `^1.17.0` | 非 AntD 图标体系 |
| 通知 | `sonner` | `^2.0.7` | 非 AntD 通知体系 |
| 动效 | `motion` | `^12.40.0` | 动效库 |
| 样式 | `sass` | `^1.0.0` | SCSS / Sass 体系 |
| 测试 | `vitest` | `^2.1.8` | 测试框架 |
| DOM 测试 | `jsdom` | `^25.0.1` | 测试环境 |
| React 测试 | `@testing-library/react` | `^16.1.0` | 组件测试 |
| E2E | `@playwright/test` | `^1.60.0` | 端到端测试 |

### 4.2 原项目脚本现状

`apps/desktop/package.json` 当前脚本：

```json
{
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "test": "vitest run",
  "dist:win": "electron-builder --win nsis --x64"
}
```

根目录 `package.json` 当前包含桌面、Go runtime、Python worker、Go server 等多端脚本。

### 4.3 原项目当前需要规避的问题

| 问题 | 说明 | v2.0 处理方式 |
|---|---|---|
| Electron 工程链重 | main / preload / renderer 同时存在 | v2.0 先做 Web SPA |
| UI 体系不统一 | 当前没有 AntD 依赖，且有自定义 HTML / 样式残留 | v2.0 全面使用 AntD |
| 样式体系复杂 | `sass`、`global.scss`、`app.css` 等仍在 | v2.0 只用 CSS Modules + layout.css |
| 图标体系不统一 | 使用 `lucide-react` | v2.0 使用 `@ant-design/icons` |
| 通知体系不统一 | 使用 `sonner` | v2.0 使用 AntD `App.useApp()` |
| 状态体系偏多 | React Query + Zustand + Jotai | v2.0 先只用 React Query + Zustand + AntD Form |
| 工程门禁不足 | desktop package 缺少 lint / typecheck / format:check | v2.0 从第一天补齐 |

---

## 5. Ant Design、ProComponents、Ant Design Pro 的区别

| 名称 | 本质 | 是否使用 | 在 GeoFrontend2.0 中的定位 |
|---|---|---:|---|
| Ant Design | React 基础 UI 组件库 | 使用 | 所有基础 UI 的唯一来源 |
| ProComponents | 基于 AntD 的高阶中后台组件库 | 使用 | ProTable、ProForm、ProCard、PageContainer 等 |
| Ant Design Pro | 完整中后台模板 / 解决方案 | 不直接使用 | 参考设计和页面组织，不采用整套 Umi 模板 |
| Umi Max | 企业级 React 框架 | 暂不使用 | v2.0 先用 Vite，避免框架假设过重 |

### 5.1 为什么不用完整 Ant Design Pro 模板

GeoWork / GeoFrontend2.0 不是普通 CRUD 后台，而是地理空间工作台。

它包含：

```text
地图工作台
图层树
空间分析任务
数据中心
模型与插件配置
AgentStudio
报告导出
```

完整 Ant Design Pro 更适合用户管理、权限管理、普通后台 CRUD。

因此本项目采用：

```text
Vite 自建工程 + Ant Design v6 + ProComponents + Ant Design Charts
```

不采用：

```text
Ant Design Pro 完整脚手架 + Umi Max
```

---

## 6. Ant Design 设计规范层

这部分不是 npm 依赖，但必须写入工程规范。

### 6.1 Visual 可视化规范

来源：`https://ant.design/docs/spec/visual-cn`

用于约束：

```text
Dashboard 指标卡
任务趋势图
数据资产统计
图层类型分布
空间分析结果图表
Workspace 地图分析面板
报告导出图表
```

落地规则：

```text
图表必须有标题、单位、图例、Tooltip、loading、error、empty 状态。
图表不能只是装饰，必须服务业务判断。
地图图层颜色不能误导用户。
Dashboard 不堆无意义图表。
```

### 6.2 Motion 动效规范

来源：`https://ant.design/docs/spec/motion-cn`

用于约束：

```text
Drawer 打开关闭
Modal 打开关闭
侧栏展开收起
任务状态变化
任务进度反馈
地图要素选中反馈
图层显隐切换
主题切换
```

落地规则：

```text
动效遵循自然、高效、克制。
优先使用 AntD 组件内置动效。
少量 CSS transition 只用于布局状态变化。
不引入 framer-motion、gsap、lottie-web 等重型动效库。
必须支持 prefers-reduced-motion。
```

### 6.3 Illustration 图形化规范

来源：`https://ant.design/docs/spec/illustration-cn`

用于约束：

```text
空状态
异常状态
成功页
首次引导
数据导入引导
报告导出完成
模型未配置
插件未启用
地图加载失败
任务运行失败
```

落地规则：

```text
插画必须服务状态表达，不用于填充空白。
图形元素应贴合地理空间业务，例如地图网格、图层叠片、经纬线、点线面、报告文档。
不使用过度卡通、过度营销、过度拟人的插画风格。
```

---

## 7. Ant Design For Agents 集成

来源：`https://ant.design/docs/react/for-agents-cn`

Ant Design For Agents 是 Ant Design 面向 AI 编程 Agent 的开发支持方案。它不是普通 UI 组件，而是一套让 AI 更准确使用 AntD 的上下文和工具。

### 7.1 需要集成的内容

| 能力 | 作用 | GeoFrontend2.0 是否使用 |
|---|---|---:|
| For Agents Prompt | 提醒 AI 不要按旧训练数据猜 AntD API | 使用 |
| `@ant-design/cli` | 离线查询组件 props、tokens、demo、changelog | 使用 |
| `design.md` | 给 AI 设计工具提供 AntD 视觉语言上下文 | 使用 |
| LLMs.txt | 给 LLM 提供结构化文档入口 | 使用 |
| MCP Server | 在 Cursor / VS Code / Claude Code 等 IDE 中给 Agent 提供 AntD 工具 | 可选，但建议预留 |
| Skill | 让 AI Agent 自动调用 AntD 知识 | 可选，若环境支持则使用 |

### 7.2 推荐 Agent Prompt

以后让 AI 写 AntD 代码前，建议把这段放进提示词：

```text
当前项目使用 Ant Design v6。这个版本可能包含破坏性变更，组件 API、约定、文件结构都可能与你训练数据中的内容不同。
在编写任何 AntD 相关代码之前，请先参考：
https://ant.design/docs/react/for-agents-cn.md
https://raw.githubusercontent.com/ant-design/ant-design-cli/main/skills/antd/SKILL.md
请优先使用 AntD / ProComponents / Ant Design Charts，不要自研基础 UI 组件。
```

### 7.3 推荐安装 Ant Design CLI

```bash
npm install -g @ant-design/cli
```

常用命令：

```bash
antd list --format json
antd info Button --format json
antd doc Table --lang zh
antd demo Select basic --format json
antd token DatePicker --format json
antd semantic Table --format json
antd changelog 6.0.0 6.5.0 Table --format json
antd doctor
antd usage ./src --format json
antd lint ./src --format json
antd design.md --format json
```

### 7.4 AI 开发规则

```text
写 AntD 组件前，先查 antd info。
写复杂组件前，先查 antd demo。
做主题定制前，先查 antd token。
写自定义样式前，先查 antd semantic。
升级版本前，先查 antd changelog / migrate。
改完代码后，运行 antd lint ./src。
```

### 7.5 MCP Server 预留配置

如果后续 IDE 支持 MCP，可以使用：

```json
{
  "mcpServers": {
    "antd": {
      "command": "npx",
      "args": ["-y", "@ant-design/cli", "mcp"]
    }
  }
}
```

---

## 8. GeoFrontend2.0 分阶段依赖安装建议

### 8.1 Phase 1：只装工程底座和 AntD 基础能力

```bash
npm install react@19.2.7 react-dom@19.2.7
npm install antd@6.5.0 @ant-design/icons@6.3.2
npm install react-router@8.0.1 @tanstack/react-query@5.101.2 zustand@5.0.14
npm install -D vite@8.1.0 @vitejs/plugin-react@6.0.3 typescript@6.0.3
npm install -D vitest@4.1.9 jsdom@29.1.1 @testing-library/react@16.3.0 @testing-library/jest-dom@6.9.1 @testing-library/user-event@14.6.1
npm install -D eslint@10.6.0 typescript-eslint@8.62.0 prettier@3.9.1 eslint-config-prettier@10.1.8
```

Phase 1 目标：

```text
项目能启动
AntD 样式正常
Bootstrap / Dark / System 主题能切换
AppShell 能显示
Dashboard / Workspace / Settings 基础路由能跳转
```

### 8.2 Phase 2：验证 ProComponents 和 Charts

```bash
npm install @ant-design/pro-components@2.8.10
npm install @ant-design/charts@2.6.7
```

Phase 2 目标：

```text
验证 ProTable 是否能和 antd@6.5.0 正常工作
验证 ProForm 是否能和 antd@6.5.0 正常工作
验证 PageContainer / ProCard 是否满足项目布局需求
验证 Ant Design Charts 在 Dashboard 中显示正常
```

注意：

```text
ProComponents 和 antd v6 的组合需要实测。
如果安装时出现 peerDependencies 警告，不要直接忽略，先记录并做最小页面验证。
```

### 8.3 Phase 3：地图和空间可视化

```bash
npm install maplibre-gl@5.24.0 deck.gl@9.3.3 @deck.gl/react@9.3.3 @deck.gl/layers@9.3.3
```

Phase 3 目标：

```text
Workspace 接入 MapLibre 地图容器
接入基础点、线、面图层
验证 deck.gl 与 MapLibre 联动
验证暗色 / 亮色主题下地图控件和图例可读
```

---

## 9. 新旧技术栈完整对比表

| 分类 | GeoFrontend2.0 新前端 | GeoWork 原项目前端 | 是否沿用原项目 | 迁移结论 |
|---|---|---|---:|---|
| 应用形态 | Web SPA | Electron 桌面应用 | 否 | v2.0 先不做桌面封装 |
| 构建工具 | Vite 8.1.0 | Vite ^6.0.0 + electron-vite ^3.1.0 | 部分 | 保留 Vite，移除 Electron 构建链 |
| React | React 19.2.7 | React ^19.0.0 | 是 | 升级并锁版本 |
| React DOM | React DOM 19.2.7 | React DOM ^19.0.0 | 是 | 升级并锁版本 |
| TypeScript | TypeScript 6.0.3 | TypeScript ^5.8.0 | 是 | 升级到 TS 6 |
| UI | Ant Design 6.5.0 | 当前无 AntD 依赖 | 否 | 全面接入 AntD v6 |
| 高阶 UI | ProComponents 2.8.10 | 无 | 否 | 用 ProTable / ProForm / ProCard 提效 |
| 图标 | @ant-design/icons 6.3.2 | lucide-react ^1.17.0 | 否 | 统一 AntD 图标 |
| 图表 | Ant Design Charts 2.6.7 | ECharts ^5.0.0 | 部分 | 新项目优先 AntD Charts，必要时保留 ECharts 思路 |
| 路由 | React Router 8.0.1 | 未明确独立路由库 | 否 | v2.0 明确路由体系 |
| 服务端状态 | TanStack Query 5.101.2 | TanStack Query ^5.0.0 | 是 | 沿用并锁版本 |
| 客户端状态 | Zustand 5.0.14 | Zustand ^5.0.0 + Jotai ^2.20.1 | 部分 | 只保留 Zustand |
| 表单 | AntD Form / ProForm | 原生 / 自定义表单 | 否 | 表单全部走 AntD 体系 |
| 表格 | AntD Table / ProTable | 原生 / 自定义表格 | 否 | 数据页优先 ProTable |
| 通知 | AntD App.useApp | sonner ^2.0.7 | 否 | 移除 sonner 思路 |
| 弹窗 | AntD Modal / Drawer | 自定义 / 原生 | 否 | 统一 AntD |
| 地图 | MapLibre GL 5.24.0 | MapLibre GL ^4.0.0 | 是 | 升级并保留 |
| 空间可视化 | deck.gl 9.3.3 | deck.gl ^9.0.0 | 是 | 升级并保留 |
| 编辑器 | 后续 Monaco | @monaco-editor/react ^4.0.0 | 延后 | 初期不装，后续按需接入 |
| 终端 | 后续 xterm | xterm ^5.0.0 | 延后 | 初期不装，后续按需接入 |
| 面板 | AntD Splitter 优先 | react-resizable-panels ^4.11.2 | 部分 | 先用 AntD，复杂布局再加 panels |
| 动效 | AntD 内置动效 + CSS transition | motion ^12.40.0 | 否 | 不引入重型动效库 |
| 样式 | CSS Modules + layout.css | sass + app.css + global.scss | 否 | 不使用 SCSS 做主题 |
| 测试 | Vitest 4.1.9 | Vitest ^2.1.8 | 是 | 升级 |
| DOM 测试 | jsdom 29.1.1 | jsdom ^25.0.1 | 是 | 升级 |
| React 测试 | Testing Library React 16.3.0 | Testing Library React ^16.1.0 | 是 | 小版本升级 |
| E2E | 暂不第一阶段接入 Playwright | Playwright ^1.60.0 | 延后 | Web 稳定后再接 E2E |
| Lint | ESLint 10.6.0 | desktop 未配置 | 否 | 新项目必须配置 |
| 格式化 | Prettier 3.9.1 | desktop 未配置 | 否 | 新项目必须配置 |
| AI 开发辅助 | Ant Design For Agents / CLI / MCP | 无 | 否 | 新项目纳入流程 |
| 可视化规范 | Ant Design Visual | 无统一规范 | 否 | 新项目纳入规范 |
| 动效规范 | Ant Design Motion | 无统一规范 | 否 | 新项目纳入规范 |
| 图形化规范 | Ant Design Illustration | 无统一规范 | 否 | 新项目纳入规范 |

---

## 10. 禁止项

GeoFrontend2.0 禁止引入：

```text
Electron
Radix
Tailwind
shadcn/ui
Bootstrap CSS
Sass / SCSS 主题方案
自研基础 Button
自研基础 Card
自研基础 Input
自研基础 Modal
自研基础 Table
sonner
lucide-react
framer-motion
gsap
lottie-web
```

允许保留或后续引入的非 AntD 能力：

```text
MapLibre GL：地图底图
Deck.gl：空间数据可视化
Monaco：代码 / JSON / 脚本编辑
xterm：终端 / 日志输出
```

原则：

```text
基础 UI 全部 AntD。
中后台高阶组件优先 ProComponents。
图表优先 Ant Design Charts / AntV。
地图继续用专业 GIS 可视化库。
```

---

## 11. 第一阶段验收标准

第一阶段只验收工程底座，不做复杂业务。

```md
## Phase 1 Acceptance Checklist

- [ ] 项目位于 E:\code\javascript\project\GeoFrontend2.0
- [ ] 使用 Vite Web SPA，不包含 Electron
- [ ] React / ReactDOM 锁定到 19.2.7
- [ ] TypeScript 锁定到 6.0.3
- [ ] Ant Design 锁定到 6.5.0
- [ ] @ant-design/icons 锁定到 6.3.2
- [ ] 已接入 ConfigProvider
- [ ] 已接入 AntD App
- [ ] 已接入 Bootstrap / Dark / System 主题
- [ ] 已接入 React Router
- [ ] 已接入 TanStack Query
- [ ] 已接入 Zustand
- [ ] 已配置 ESLint
- [ ] 已配置 Prettier
- [ ] 已配置 Vitest
- [ ] npm run dev 可以启动
- [ ] npm run build 可以通过
- [ ] npm run test 可以通过
- [ ] 不存在 Radix / Tailwind / Sass / Electron / shadcn/ui
```

---

## 12. 参考资料

- GeoWork 原项目：`https://github.com/Wanfeng1028/GeoWork`
- GeoWork desktop package：`https://raw.githubusercontent.com/Wanfeng1028/GeoWork/master/apps/desktop/package.json`
- GeoWork root package：`https://raw.githubusercontent.com/Wanfeng1028/GeoWork/master/package.json`
- Ant Design 快速上手：`https://ant.design/docs/react/getting-started-cn/`
- Ant Design v5 到 v6 迁移：`https://ant.design/docs/react/migration-v6-cn`
- Ant Design Changelog：`https://ant.design/components/changelog/`
- Ant Design For Agents：`https://ant.design/docs/react/for-agents-cn`
- Ant Design CLI Skill：`https://raw.githubusercontent.com/ant-design/ant-design-cli/main/skills/antd/SKILL.md`
- Ant Design Visual：`https://ant.design/docs/spec/visual-cn`
- Ant Design Motion：`https://ant.design/docs/spec/motion-cn`
- Ant Design Illustration：`https://ant.design/docs/spec/illustration-cn`
- ProComponents：`https://pro-components.antdigital.dev/`
- Ant Design Charts：`https://charts.ant.design/`
- Vite：`https://vite.dev/`
- React Router：`https://reactrouter.com/`
- TanStack Query：`https://tanstack.com/query/latest`
- Zustand：`https://zustand.docs.pmnd.rs/`
- MapLibre GL：`https://maplibre.org/`
- deck.gl：`https://deck.gl/`
