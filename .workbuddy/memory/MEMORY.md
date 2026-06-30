# GeoWork 项目长期记忆

## 项目概述
- 本地优先桌面 AI Agent 工作台，面向 GIS/遥感/科研工作流
- 技术栈：Electron + React + TypeScript + Ant Design v6（前端）+ Go Runtime（核心）+ Python FastAPI（地理空间 Worker）
- 版本：v0.4.x-dev

## UI 设计规范（已确认）
- UI 框架：Ant Design v6 最新版
- 亮色主题：Ant Design 主题编辑器的 Bootstrap 预设
- 暗色主题：Ant Design 主题编辑器的 Dark 预设
- 品牌色：深海军蓝 #071225 / 地理青 #8BFFE2 / 信号蓝 #3AD9FF / 沙金 #F4D77E

## design/ 文件夹内容
- `tokens.css` — 完整双主题 CSS 变量系统
- `index.html` — 设计系统总览导航
- `01-workbench.html` — 工作台主界面
- `02-expert-skill.html` — 专家 & 技能
- `03-plugin-model.html` — 插件市场 & 模型API
- `04-settings-usage.html` — 设置 & 用量统计

## 项目结构关键路径
- 桌面前端：`apps/desktop/src/`
- 布局组件：AppShell / TopBar / LeftSidebar / RightDock / BottomBar
- 输入组件：GeoComposer（任务输入框）
- 状态管理：shellStore / settingsStore / taskStore / chatStore
- 16个一级导航模块（详见 docs/04_UI_INFORMATION_ARCHITECTURE.md）
