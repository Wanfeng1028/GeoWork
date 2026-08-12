<!-- language: zh-CN -->
<!-- license: PolyForm NC 1.0.0 -->

<p align="center">
  <img src="./assets/GeoWork_Logo_Kit_v1.0/01_Master_SVG/geowork-marketing-orbit-horizontal.svg" width="700" alt="GeoWork - Spatial Intelligence Core" />
</p>

<p align="center">
  <strong>面向 GIS、遥感和地理空间工作流的本地优先桌面 AI Agent 工作台</strong>
</p>

<p align="center">
  <a href="README.en.md">English</a> &nbsp;·&nbsp; <a href="README.md">简体中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/QGIS-589632?style=flat-square&logo=qgis&logoColor=white" alt="QGIS">
  <img src="https://img.shields.io/badge/GDAL-5CAE58?style=flat-square&logo=osgeo&logoColor=white" alt="GDAL">
  <img src="https://img.shields.io/badge/GEE-4285F4?style=flat-square&logo=googleearth&logoColor=white" alt="Google Earth Engine">
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/macOS-arm64-blue?style=flat-square&logo=apple&logoColor=white" alt="macOS arm64">
  <img src="https://img.shields.io/badge/Windows-x64-blue?style=flat-square&logo=windows&logoColor=white" alt="Windows x64">
  <img src="https://img.shields.io/badge/license-PolyForm--NC--1.0.0-yellow?style=flat-square" alt="PolyForm Noncommercial License">
</p>

---

## 当前版本状态

> **v0.5.x-dev（开发预览版）** — **本项目尚未正式发布。** 当前代码仅供开发者本地启动、测试和继续开发使用。v0.1–v0.4 为 demo 探索版（已封存），v0.5 起为开发预览版，v1.0.x 为第一个正式发布版。
>
> 部分能力仍处于开发态，包括 Cloud Server in-memory、部分 GIS/GEE/QGIS/GDAL 能力、本地沙箱策略、插件市场、团队协作和计费系统。**请勿将当前版本视为生产可用版本。**
>
> 详见 [开发版验收清单](doc/DEV_VERSION_CHECKLIST.md)。

---

## GeoWork 能做什么

通过对话处理复杂的地理空间和科学工作流——赋能任何人分析地球 🌏、生成专业地图、自动化研究流程。

| 能力 | 范围 | 示例 |
|---|---|---|
| 🗺️ **QGIS** | **QGIS 处理中的数百种算法** | 空间分析、矢量/栅格批处理、格式转换、可达性分析... |
| 🛰️ **Google Earth Engine** | **完整的 GEE Python API** — 任何你能表达的遥感任务 | 时序合成、分类、变化检测、地表温度、影像下载... |
| 🐍 **Python** | 在隔离环境中运行**任意 Python 脚本**，完整的科学计算栈 | 地理空间处理、专题制图、深度学习、数据科学... |
| 📄 **论文阅读** | AI 驱动的文稿分析和研究总结 | 提取见解、总结论文、管理参考文献... |
| 📝 **报告撰写** | 生成包含地图和图表的专业 Office 文档 | 自动化报告生成、格式化表格、出版级图表... |
| ⚡ **自动化** | 工作流自动化和任务调度 | 串联工具、自动化重复地理空间流程、基于 cron 的工作流... |
| 🤖 **模型路由** | 灵活的 AI 模型配置和管理 | 切换模型、配置 API 密钥、优化成本和性能... |

---

## 如何使用

> **注意：以下指引适用于尚未正式发布的开发预览版（v0.5.x-dev）。** 项目结构和启动方式在正式发布前可能随时调整。

### 1. 需要哪些环境？

无需复杂设置。在运行 GeoWork 之前，确保你的机器上已安装以下内容：

- **[QGIS](https://qgis.org/download/)** — 桌面 GIS 应用，GeoWork 调用其算法
- **Python 环境管理器**（推荐 [Miniconda](https://docs.anaconda.com/miniconda/)）— 隔离 Python 依赖，使工作流之间互不干扰

> [!TIP]
> 为 GeoWork 创建一个**专用的 Python 环境**（用 Conda / Mamba 创建一个全新的环境）。Agent 会在运行过程中自行安装、卸载和升级 Python 包——专用环境保持其他项目干净，帮助 Agent 更可靠地运行。

### 2. 安装

```bash
npm install
npm run dev
```

**单独测试：**

```bash
npm run test:core      # 运行 Go 核心测试
npm run test:worker    # 运行 Python worker 测试
npm test               # 运行桌面应用测试
npm run build          # 构建桌面应用
```

---

## 架构

GeoWork 采用模块化三层架构：

| 层级 | 技术栈 | 职责 |
|---|---|---|
| **桌面端** | Electron + React + TypeScript + Ant Design v5 | UI 层、状态管理、地图渲染（MapLibre + DeckGL）、图表（ECharts、Plotly、Monaco Editor） |
| **核心** | Go runtime + HTTP API + SSE 事件 | 工具编排、技能注册表、MCP 连接器、安全检查、模型路由、自动化引擎 |
| **地理空间 Worker** | Python FastAPI | GEE 工作流、GDAL/QGIS 相关处理、论文解析、Office 报告生成、NDVI 分析 |

---

## 如何编写你自己的技能

所有 GeoWork 技能位于 [`skills/`](skills/) 目录下——任何人都可以添加新技能。技能包的标准结构：

```
skills/<your-skill-id>/
├── manifest/
│   ├── README.md       # 面向人类的技能描述
│   └── meta.json       # 元数据：版本 / 描述 / 作者 / 标签...
└── skill/
    ├── SKILL.md        # 必需，核心提示（LLM 导向，含 frontmatter）
    └── <dir>/          # 可选，任何名称和嵌套——参考资料、模板、脚本等
```

提交流程：

1. 在 `skills/` 下创建你的技能目录
2. 按上述结构填写 `manifest/` 和 `skill/`
3. 将你的技能 ID 添加到 `skills/official-skills.json`
4. 使用 `npm run dev` 测试——Agent 会自动加载你的技能

> [!TIP]
> 技能加载到 Agent 的提示中，直接影响其行为。遵循 `SKILL.md` 中的 frontmatter 约定来声明版本、描述、作者和标签。

---

## 许可

GeoWork 基于 [PolyForm Noncommercial License 1.0.0](licenses/LICENSE) 提供源代码。

- ✅ **允许**：非商业评估、学习、研究和个人使用
- ❌ **需商业许可**：商业用途、转售、托管服务运营、付费插件分发、企业部署或嵌入商业产品

详见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
