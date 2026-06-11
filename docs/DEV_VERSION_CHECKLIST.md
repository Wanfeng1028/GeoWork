# GeoWork v0.4.x-dev 开发版验收标准

## 版本说明

GeoWork v0.4.x-dev 是**开发版**，不是正式上线版。本文档明确列出哪些能力已完成、哪些仍是开发态/占位/mock，防止后续 Agent 把 dev/in-memory/mock 误判成正式实现。

---

## 已完成的能力

### AppShell 工作台
- [x] 五区布局（TopBar、LeftSidebar、MainWorkspace、RightDock、BottomDock）
- [x] 导航分组（智能体、扩展能力、知识资料、地理空间）
- [x] 任务/频道底部标签
- [x] 用户卡片和设置入口

### Electron IPC 基础桥
- [x] preload.ts 暴露 IPC 接口
- [x] main handler 注册
- [x] 运行时客户端（RuntimeClient）

### Go Core Runtime
- [x] 项目 CRUD
- [x] 任务 CRUD 和状态管理
- [x] Agent 引擎（Engine）
- [x] Sandbox 服务（开发版策略）
- [x] Recovery 管理器（checkpoint/pause/recover）
- [x] API 路由和处理器
- [x] 事件桥（EventBridge）

### Python Worker 基础能力
- [x] NDVI 脚本生成
- [x] 报告生成
- [x] OpenAlex 论文搜索
- [x] PDF 解析
- [x] 知识库索引
- [x] GIS 数据检查
- [x] QGIS 环境检测
- [x] GEE 数据集搜索

### Cloud Server dev/in-memory
- [x] 基础 HTTP 服务
- [x] Storage 层（in-memory）
- [x] 健康检查端点

### Agent 模块
- [x] Context Budget 管理
- [x] State Machine 状态机
- [x] Tool Governor 工具治理

### 前端组件
- [x] TaskStore 任务状态管理
- [x] SSE 实时事件流
- [x] RightDock 右侧面板
- [x] DiffPanel 差异对比
- [x] ArtifactPanel 产物展示

---

## 仍是开发态的能力

### Cloud Server
- **状态**: dev/in-memory
- **说明**: Cloud Server 使用内存存储，重启后数据丢失
- **v0.5.0 计划**: 迁移到 SQLite/PostgreSQL

### 地图/GEE/QGIS/GDAL
- **状态**: 依赖本机环境或占位
- **说明**: 
  - GEE 需要本机安装 Google Earth Engine SDK
  - QGIS 需要本机安装 QGIS
  - GDAL 需要本机安装 GDAL 库
  - 地图页面无真实底图
- **v0.5.0 计划**: 接入 MapLibre 真实底图，GEE/QGIS/GDAL 明确依赖检测

### MainWorkspace 页面
- **状态**: 部分开发占位
- **说明**: 
  - 部分页面使用 mock 数据
  - 无真实功能实现
- **v0.5.0 计划**: 逐步替换为真实功能页面

### 任务恢复语义
- **状态**: 基础可用
- **说明**: 
  - 恢复后任务状态为 paused（非 completed）
  - 无 checkpoint 时返回 no_checkpoint
  - 恢复 ≠ 完成
- **v0.5.0 计划**: 完整的任务恢复、回滚、Diff patch

### Sandbox 策略
- **状态**: 开发版策略
- **说明**: 
  - 空 AllowedPaths 允许所有路径（dev 模式）
  - 阻止危险命令（rm, sudo, mkfs, fdisk）
  - Windows 优先 pwsh，fallback cmd
- **v0.5.0 计划**: 强隔离容器

### 账号/计费/团队协作
- **状态**: 未实现
- **说明**: Cloud Server 中的账号、计费、团队协作功能尚未实现
- **v0.5.0 计划**: 真实化实现

### 插件市场
- **状态**: 静态配置
- **说明**: 插件市场使用静态 JSON 配置，无真实安装/卸载
- **v0.5.0 计划**: 真实安装/卸载机制

### MCP Server 管理器
- **状态**: 配置文件
- **说明**: MCP 连接器使用静态配置文件
- **v0.5.0 计划**: 真实运行管理

---

## 验收命令

```bash
# 运行所有测试
npm run test:core      # Go Core 测试
npm run test:worker    # Python Worker 测试
npm run test:cloud     # Cloud Server 测试
npm test               # Desktop 前端测试
npm run build          # Desktop 构建

# 验证脚本
npm run verify:static  # 静态覆盖率检查
npm run verify:flows   # 流程验证
npm run check:available # 综合可用性检查

# 启动开发环境
npm run dev            # 启动 core/worker/cloud/desktop
```

---

## 开发版限制

1. **数据持久化**: Cloud Server 数据重启丢失
2. **环境依赖**: 部分功能依赖本机安装特定软件
3. **功能完整性**: 部分页面为开发占位，非真实功能
4. **安全隔离**: Sandbox 为开发版策略，非强隔离
5. **账号系统**: 无真实账号认证和授权

---

## 下一步计划 (v0.5.0)

1. Cloud Server 迁移到 SQLite/PostgreSQL
2. 账号、计费、团队协作真实化
3. 插件市场真实安装/卸载
4. MCP Server 管理器真实运行
5. 完整任务恢复、回滚、Diff patch
6. Windows 安装包发布
7. 地图页接入 MapLibre 真实底图
8. PaperSearch 接入 OpenAlex 真实搜索

---

*最后更新: 2026-06-11*
*版本: v0.4.x-dev*
