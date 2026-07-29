<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Ant_Design-6-1677FF?style=flat-square&logo=antdesign&logoColor=white" alt="Ant Design 6" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

<h1 align="center">GeoWork</h1>

<p align="center">
  <strong>用自然语言搞定空间智能工作流</strong>
</p>

<p align="center">
  AI 驱动的空间分析工作台 — 对话式 GIS 分析 · 遥感解译 · 专题制图 · 数据处理
</p>

<p align="center">
  <a href="#features">功能特性</a> ·
  <a href="#tech-stack">技术栈</a> ·
  <a href="#architecture">架构设计</a> ·
  <a href="#getting-started">快速开始</a> ·
  <a href="#roadmap">路线图</a>
</p>

---

## ✨ Features

### 🗣️ 对话式空间分析

用自然语言描述 GIS 任务，AI Agent 自动规划工作流、调用工具、输出结果。支持缓冲区分析、NDVI 计算、坐标转换、专题制图等专业场景。

### 🔬 三大工作模式

| 模式 | 场景 | 说明 |
|------|------|------|
| **Work** | 自然语言 GIS | 对话驱动的空间分析工作流 |
| **Code** | 脚本开发 | 算法编写与代码调试 |
| **Map** | 专题制图 | 通过对话生成地图产品 |

### 🧩 专家套件生态

领域专家能力包，即装即用：

- **空间分析** — 缓冲区、叠加分析、网络分析
- **遥感解译** — 影像分类、变化检测、植被指数
- **数据处理** — 格式转换、坐标系统一、质量检查
- **专题制图** — 符号化、布局设计、批量出图
- **灾害评估** — 洪涝分析、滑坡识别、损失估算

### 📱 多通道移动端控制

任务通知和远程操作可通过微信、钉钉、飞书、企业微信或专属移动端接收，不局限于 Web 界面。

### 🎨 五套主题体系

亮色（Bootstrap 拟物化）、暗色（Ant Design 暗黑算法）、跟随系统、插画风格、玻璃拟态，全部基于 Ant Design Token 实现，零硬编码色值。

### 📂 工作空间分组对话

对话按工作目录自动分组，支持置顶、重命名、归档、导出，IDE 级项目管理与对话交互深度融合。

---

## 🛠 Tech Stack

```
Vite 8          React 19        TypeScript 6     Ant Design 6
React Router 8  Zustand 5       antd-style       clsx
```

**后续引入：** MapLibre GL · deck.gl · @ant-design/pro-components · @ant-design/charts · TanStack Query · Vitest

**明确禁止：** Tailwind · Radix · shadcn/ui · Sass/SCSS 主题系统 · 自研基础 UI 库

---

## 🏗 Architecture

```
src/
├── main.tsx                  # 入口：StrictMode + AppProviders + App
├── App.tsx                   # RouterProvider (createBrowserRouter)
├── app/
│   ├── AppProviders.tsx      # ConfigProvider + AntdApp + 主题解析
│   ├── routes.tsx            # 全部路由定义（AppShell 下嵌套）
│   └── themes/
│       ├── bootstrapTheme.ts # Bootstrap 拟物化主题
│       ├── darkTheme.ts      # Ant Design 暗黑算法
│       ├── glassTheme.ts     # 玻璃拟态主题
│       ├── illustrationTheme.ts # 插画风格主题
│       └── index.ts          # 主题调度器
├── shell/
│   ├── AppShell.tsx          # 全局布局：可折叠侧栏 + 主内容区
│   ├── GlobalSearchModal     # 全局搜索 (Cmd+K)
│   └── ...                   # 快捷键、反馈、用量、用户菜单
├── pages/
│   ├── NewTask/              # 核心对话工作台
│   ├── Tasks/                # 定时任务管理
│   ├── Settings/             # 系统设置
│   ├── Extensions/           # 专家 / 技能 / MCP / 连接器
│   ├── MobileControl/        # 移动端控制通道
│   └── ...                   # Dashboard / Workspace / DataCenter / AgentStudio
└── shared/
    ├── hooks/                # 系统主题监听等
    ── stores/               # Zustand + localStorage 持久化
```

### 核心设计模式

- **StreamAdapter** — 统一的流式响应接口，当前 Mock 实现，预留 SSE / WebSocket 适配
- **Conversation Model** — 完整对话持久化（消息、工具调用、工作流步骤、运行状态），按工作空间分组
- **localStorage 持久化** — 全部前端状态通过 `geowork.*` 前缀键存储，无后端依赖
- **BorderBeam 动效** — 亮色模式下关键 UI 元素的流光边框，克制的视觉点缀

---

## 🚀 Getting Started

```bash
# 克隆项目
git clone https://github.com/your-org/geofrontend2.0.git
cd geofrontend2.0

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build
```

### 环境要求

- Node.js >= 20.19 或 22.12+
- Chrome / Edge（推荐，支持 File System Access API）

---

## 📐 Design Philosophy

> 全面拥抱 Ant Design，默认不自行设计基础 UI。

GeoWork 的设计约束以机器可读的规则文档（`design.md`）编码，同时约束人类和 AI 开发者：

- **Ant Design 是唯一基础 UI 体系** — 所有基础组件必须来自 AntD，业务组件内部继续组合 AntD 组件
- **Token 驱动** — 颜色、阴影、圆角全部来自 Ant Design Token，禁止硬编码色值
- **CSS Modules 只负责布局** — flex、grid、间距、overflow；视觉样式交给 Token
- **Bootstrap 拟物化不是简单配置** — 渐变按钮、内阴影开关、边框 Modal，通过 AntD `classNames` 组件级主题实现
- **GIS 领域聚焦** — 所有文案、空状态、Mock 数据、专家套件围绕空间分析场景

---

## 🗺 Roadmap

| 阶段 | 目标 |
|------|------|
| **Phase 1** (当前) | 对话工作台、专家/技能/MCP/连接器管理、定时任务、多主题体系 |
| **Phase 2** | MapLibre GL + deck.gl 地图集成、Workspace 地图工作台 |
| **Phase 3** | ProComponents 引入、数据资产管理、Dashboard 概览 |
| **Phase 4** | 真实后端接入（SSE / WebSocket）、Agent Studio 模型编排 |

---

## 📄 License

[MIT](./LICENSE)

---

<p align="center">
  <sub>Built with React, Ant Design, and a love for geospatial intelligence.</sub>
</p>
