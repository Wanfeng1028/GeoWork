# GeoWork 参考产品拆解

GeoWork 只参考产品和架构思路，不复制代码、UI、Logo 和文案。

## 参考产品表

| 产品 | 定位 | 可确认技术/能力 | GeoWork 应参考的点 |
|------|------|------------------|---------------------|
| Codex | 代码 Agent 工作台 | 项目目录、任务线程、worktree、Git、diff、sandbox、plugins、skills | Code Mode、worktree、diff 审查、任务线程、安全边界 |
| Claude Cowork | 桌面知识工作 Agent | 授权文件夹、本地文件处理、文档综合、用户监督 | 文件夹授权、非技术用户体验、文档综合 |
| QoderWork | 通用桌面办公 Agent | 本地工作区、任务监视器、MCP、Skills、Office/PDF 输出 | 办公成果交付、Skills、MCP、任务监视器 |
| WorkBuddy | 职场 AI Agent 工作台 | 多 Agent、专家团、插件、Skills、MCP、多入口 | 专家系统、多角色协作、企业版方向 |
| Trae Solo | Work/Code 双模式 Agent 工作台 | Work/Code 模式、任务进度、产物预览、worktree | 双模式、三栏工作台、进度与产物验收 |
| DeepSeek-GUI | 开源本地 Agent 工作台 | Electron + React + TypeScript + 本地 Runtime + HTTP/SSE + Skill/MCP | 工程骨架、SSE 事件流、本地 Runtime、权限审查 |
| GeoCode-Release | 地学数据处理助手 | QGIS、GEE、Python、Skill Store | 地理遥感专业能力、Skill 结构、GEE/QGIS 工具链 |

## 详细拆解

### 1. Codex

**产品定位**：代码 Agent 工作台

**核心能力**：
- 项目目录管理
- 任务线程（Task Thread）
- Worktree 隔离
- Git 集成
- Diff 审查
- Sandbox 沙箱
- 插件系统
- 技能系统

**GeoWork 应参考**：
- Code Mode 的任务线程设计
- Worktree 的隔离执行环境
- Diff 审查的用户体验
- 安全边界的设计

### 2. Claude Cowork

**产品定位**：桌面知识工作 Agent

**核心能力**：
- 授权文件夹
- 本地文件处理
- 文档综合
- 用户监督

**GeoWork 应参考**：
- 文件夹授权的用户体验
- 非技术用户的交互设计
- 文档综合的能力

### 3. QoderWork

**产品定位**：通用桌面办公 Agent

**核心能力**：
- 本地工作区
- 任务监视器
- MCP 集成
- Skills 系统
- Office/PDF 输出

**GeoWork 应参考**：
- 办公成果交付的设计
- Skills 系统的结构
- MCP 的集成方式
- 任务监视器的用户体验

### 4. WorkBuddy

**产品定位**：职场 AI Agent 工作台

**核心能力**：
- 多 Agent 协作
- 专家团系统
- 插件系统
- Skills 系统
- MCP 集成
- 多入口设计

**GeoWork 应参考**：
- 专家系统的设计
- 多角色协作的架构
- 企业版方向的规划

### 5. Trae Solo

**产品定位**：Work/Code 双模式 Agent 工作台

**核心能力**：
- Work 模式
- Code 模式
- 任务进度
- 产物预览
- Worktree 隔离

**GeoWork 应参考**：
- 双模式的设计思路
- 三栏工作台的布局
- 进度与产物验收的用户体验

### 6. DeepSeek-GUI

**产品定位**：开源本地 Agent 工作台

**核心能力**：
- Electron + React + TypeScript 桌面端
- 本地 Runtime
- HTTP/SSE 通信
- Skill/MCP 集成
- 权限审查

**GeoWork 应参考**：
- 工程骨架的结构
- SSE 事件流的设计
- 本地 Runtime 的架构
- 权限审查的实现

### 7. GeoCode-Release

**产品定位**：地学数据处理助手

**核心能力**：
- QGIS 集成
- GEE 集成
- Python 处理
- Skill Store

**GeoWork 应参考**：
- 地理遥感专业能力的实现
- Skill 结构的设计
- GEE/QGIS 工具链的集成

## 对 GeoWork 的最终组合

```
DeepSeek-GUI 的工程骨架思路
+ Codex 的任务线程、安全、diff/worktree
+ Cowork 的文件夹授权体验
+ QoderWork 的办公成果交付
+ WorkBuddy 的专家系统
+ Trae Solo 的 Work/Code 双模式
+ GeoCode 的地理遥感专业能力
```

## 差异化设计

GeoWork 与参考产品的核心差异：

| 维度 | GeoWork | 参考产品 |
|------|---------|----------|
| 领域 | 地理遥感科研工程 | 通用代码/办公 |
| 用户 | 本科生、研究生、科研人员、GIS 工程师 | 开发者、办公人员 |
| 成果 | GEE 脚本、遥感报告、地图、论文材料 | 代码、文档、PPT |
| 工具 | GEE、QGIS、GDAL、遥感分析 | Git、Docker、Office |
| 专家 | 12 个地理遥感专家 | 通用代码助手 |
| 技能 | NDVI、分类、变化检测等遥感技能 | 通用编程技能 |
| 数据 | GeoTIFF、Shapefile、GeoJSON | 通用文件 |
| 地图 | MapLibre + Deck.gl 地图预览 | 无地图预览 |
| 知识库 | 遥感论文、数据源、方法 | 通用文档 |

## 参考原则

1. **只参考思路**：不复制代码、UI、Logo、文案
2. **差异化定位**：聚焦地理遥感科研工程场景
3. **本地优先**：所有数据和处理都在本地
4. **专业能力**：GEE、QGIS、GDAL 等专业工具集成
5. **学术诚信**：不伪造数据、不编造引用、不代写论文
