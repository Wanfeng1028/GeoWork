# GeoWork 产品文档

## 1. 产品定位

GeoWork 是一款面向地理信息科学、遥感科研、GIS 工程实践、本科生课程实验、研究生论文研究的本地优先 AI Agent 桌面工作台。

它不是普通聊天软件，也不是单纯代码助手，而是一个地理遥感领域的垂直通用 Agent：能理解地理遥感任务、规划步骤、调用工具、读写项目文件、生成地图、代码、数据、报告、论文材料和 PPT。

GeoWork 参考 Codex、Claude Cowork、QoderWork、WorkBuddy、DeepSeek-GUI、Trae Solo、GeoCode-Release 的产品思路，但不复制它们的代码、UI、Logo 和文案。GeoWork 的差异化是地理遥感科研工程场景。

## 2. 目标用户

### 本科生

用于完成 GIS、遥感、GEE、QGIS、Python 课程实验。

典型任务：

- 老师让我们做 NDVI 实验，我有 Landsat 影像和研究区 shp，帮我完成实验报告。

### 研究生

用于找论文、读论文、做综述、提 idea、找数据、设计实验、写论文。

典型任务：

- 帮我搜索近五年基于 Sentinel-2 的城市绿地变化检测论文，并整理研究空白和可行选题。

### 科研人员

用于快速调研方向、复现论文、跑遥感分析、生成图表和论文材料。

### GIS / 遥感工程人员

用于数据清洗、坐标转换、栅格裁剪、矢量叠加、专题制图、批处理和工程报告。

## 3. 核心价值

GeoWork 的核心价值是：把 AI 变成一个受控的地理遥感科研工程助手。

必须做到：

1. 理解地理遥感任务；
2. 拆解科研和工程流程；
3. 调用 GEE、QGIS、GDAL、Python、论文搜索、Office 输出等工具；
4. 生成真实可交付成果；
5. 记录全过程；
6. 支持用户确认、暂停、重试、回滚；
7. 通过专家、技能、插件、MCP 和自定义模型扩展。

## 4. 产品原则

### 本地优先

项目文件、论文、数据、代码、报告默认保存在本地。Agent 只能访问用户授权的工作区。

### 任务透明

用户能看到 Agent 做了什么、为什么做、调用了什么工具、读写了什么文件、消耗了多少 Token、生成了什么成果。

### 成果导向

GeoWork 的最终结果不是"回答"，而是产物：

- GeoTIFF / COG / Shapefile / GeoPackage / GeoJSON / CSV / Excel / PNG 地图 / HTML 交互地图 / Python 脚本 / GEE 脚本 / Jupyter Notebook / Word 实验报告 / 论文草稿 / PPT / BibTeX / Markdown 报告

### 可扩展

必须支持专家、技能、插件、插件市场、MCP、自定义模型、知识库、自动化、定时任务和用量统计。

### 学术诚信

GeoWork 是科研辅助工具，不是伪造数据、编造引用、代写论文的工具。系统应提示用户核查 AI 输出，并保留数据来源、代码和执行日志。

## 5. 一级模块

| 模块 | 说明 |
|------|------|
| 工作台 | 任务创建、计划生成、执行流程、成果预览 |
| 项目文件 | 工作区文件管理、目录树、文件预览 |
| 地图与图层 | MapLibre + Deck.gl 地图预览、图层管理 |
| 论文搜索 | OpenAlex 搜索、PDF 解析、文献综述矩阵 |
| 知识库 | 本地知识索引、FTS5 全文搜索、论文精读 |
| 数据中心 | 数据集登记、元数据查看、空间分析 |
| 专家 | 12 个内置专家角色，角色描述、工具绑定、模型绑定 |
| 技能 | Skill 包管理、运行、自定义 Skill |
| 自动化 | 触发器、条件、动作规则配置 |
| 定时任务 | Cron 表达式、任务执行记录 |
| 扩展 | 工作流编排、Eino 适配器 |
| 插件市场 | 本地插件管理、权限审批、启用/禁用 |
| 模型与 API | 模型配置、测试、路由 |
| 用量统计 | Token 消耗、成本统计、图表 |
| 设置 | 外观、环境、安全、通知、数据与隐私 |

## 6. 核心工作流

### 本科生实验流程

1. 新建课程实验项目
2. 上传数据和实验要求
3. 选择实验报告专家
4. 运行 NDVI 实验报告 Skill
5. AI 生成计划
6. 用户确认
7. 系统生成代码、图表、报告
8. 用户修改报告
9. 导出 Word/PDF

### 研究生科研流程

1. 新建科研论文项目
2. 输入研究方向
3. 论文专家搜索论文
4. 生成文献综述矩阵
5. 数据专家推荐数据源
6. GEE 专家生成处理流程
7. 遥感专家分析结果
8. 写作专家生成论文大纲和初稿
9. 质量专家检查可复现性
10. 导出论文材料

### 工程项目流程

1. 新建 GIS 工程项目
2. 导入 shp/tif/csv 数据
3. GIS 专家检查坐标系和数据质量
4. 运行批处理 Skill
5. 生成地图和统计表
6. 生成项目报告
7. 导出成果文件

## 7. 内置专家

| 专家 | 角色描述 |
|------|----------|
| 总控专家 | 任务规划、步骤编排、结果汇总 |
| 论文专家 | 文献搜索、综述生成、引用管理 |
| 数据专家 | 数据源推荐、数据下载、数据质量检查 |
| GEE 专家 | Google Earth Engine 脚本生成、云端遥感分析 |
| QGIS 专家 | QGIS Processing 调用、本地 GIS 分析 |
| 遥感分析专家 | 指数计算、分类、变化检测 |
| GIS 工程专家 | 坐标转换、投影、空间分析、批处理 |
| 地图制图专家 | 专题地图、图例、比例尺、导出布局 |
| 实验报告专家 | 实验步骤、数据、图表、结论生成 |
| 论文写作专家 | 论文大纲、初稿、修改、格式 |
| 质量检查专家 | 可复现性检查、数据溯源、逻辑验证 |
| 代码审查专家 | 代码质量、性能优化、安全审查 |

每个专家包含角色描述、默认模型、可调用工具、可使用 Skill、可访问知识库、可用插件、安全权限、输出格式、调用历史、成功率和平均耗时。

## 8. 内置技能

### 第一批官方 Skill

| Skill ID | 名称 | 标签 |
|----------|------|------|
| ndvi-timeseries | NDVI 时序分析 | remote-sensing, ndvi, gee, experiment-report |
| gee-sentinel2-cloudfree-composite | GEE Sentinel-2 无云合成 | remote-sensing, gee, sentinel2 |
| landsat-lst-retrieval | Landsat 地表温度反演 | remote-sensing, landsat, lst |
| water-extraction-ndwi | 水体提取 NDWI | remote-sensing, water, ndwi |
| dem-terrain-analysis | DEM 地形分析 | terrain, dem, hillshade |
| land-cover-classification | 土地覆盖分类 | classification, land-cover |
| urban-expansion-analysis | 城市扩张分析 | urban, change-detection |
| map-layout-export | 地图布局导出 | map, export, qgis |
| paper-reading-geography | 地理论文精读 | paper, reading |
| literature-review-remote-sensing | 遥感文献综述 | paper, review |
| graduate-thesis-outline | 研究生论文大纲 | thesis, outline |
| undergraduate-experiment-report | 本科生实验报告 | experiment, report |

### Skill 结构

```
skills/<skill-id>/
├── manifest.json       # 技能元数据
├── SKILL.md            # 技能说明和执行指南
├── templates/          # 模板文件
├── scripts/            # 脚本文件
├── examples/           # 示例数据
└── tests/              # 测试文件
```

## 9. 插件与插件市场

### 插件类型

GEE、QGIS Processing、GDAL、OpenAlex、Zotero、STAC、PostGIS、报告导出、模型供应商、地图底图。

### 插件市场策略

第一版做本地 JSON 市场，后期再做在线市场、评分、更新和商业插件。

## 10. 自动化与定时任务

### 触发器

定时、文件变化、数据下载完成、论文搜索更新、GEE 任务完成、项目打开、插件事件。

### 动作

调用专家、运行技能、搜索论文、处理数据、生成报告、发送通知、整理文件、更新知识库、导出地图、运行脚本。

## 11. 模型与 API

### 支持的模型供应商

DeepSeek、Qwen、Kimi、智谱、豆包、讯飞星火、OpenAI、Claude、Gemini、Ollama、LM Studio、vLLM、OpenAI-compatible 自定义接口。

### 模型路由

规划、论文阅读、代码生成、报告写作、遥感图像理解、低成本任务、本地隐私任务。

## 12. MVP 范围

- Electron 桌面壳
- Go Runtime 启动
- Python Geo Worker 启动
- 工作区选择
- 模型配置
- 任务创建
- 计划生成
- SSE 日志
- GEE 认证检测
- QGIS 路径检测
- NDVI 分析 Skill
- 实验报告生成
- 地图/图表预览
- 结果文件导出

### MVP Demo

> 帮我完成成都市 2019-2024 年 NDVI 时序分析，并生成实验报告。

**输出**：GEE 脚本、Python 处理脚本、NDVI 图、趋势图、统计表、实验报告 DOCX、任务日志。
