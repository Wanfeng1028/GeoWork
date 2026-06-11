# GeoWork v0.4.x-dev 开发版验收清单

## 版本说明

GeoWork 当前是 **v0.4.x-dev 开发版**，不是正式上线版。本文档明确列出哪些能力已完成、哪些仍是开发态/占位/mock，防止后续 Agent 把 dev/in-memory/mock 误判成正式实现。

---

## 基础命令

- [ ] `npm install`
- [ ] `npm run test:core`
- [ ] `npm run test:worker`
- [ ] `npm run test:cloud`
- [ ] `npm test`
- [ ] `npm run build`

## 启动链路

- [ ] `npm run dev`
- [ ] Core 8765 health 正常
- [ ] Worker 8766 health 正常
- [ ] Cloud 8767 health 正常
- [ ] Desktop 不白屏
- [ ] Electron 无 `No handler registered`

## 前端主链路

- [ ] AppShell 正常显示
- [ ] LeftSidebar 正常显示
- [ ] MainWorkspace 正常显示
- [ ] ConversationMinimap 不崩
- [ ] RightDock 不崩
- [ ] BottomDock 不崩
- [ ] 无任务时显示空状态
- [ ] 无 diff 时显示空状态
- [ ] 无产物时显示空状态

## Agent / Runtime 开发态说明

- [ ] Agent Context Budget 已有初步实现
- [ ] State Machine 已有初步实现
- [ ] Tool Governance 已有初步实现
- [ ] Sandbox 是开发版策略，不是强隔离容器
- [ ] Recovery 仍在完善
- [ ] Cloud Server 当前是 dev / in-memory
- [ ] 部分 GEE / QGIS / GDAL 能力依赖本机环境
- [ ] 部分页面仍为开发态占位

## 不应伪装为正式完成的功能

- [ ] 账号计费
- [ ] 团队协作
- [ ] 插件市场正式安装/卸载
- [ ] MCP Server 完整运行管理
- [ ] Cloud 数据持久化
- [ ] Windows 安装包发布
- [ ] 完整 GIS 生产级处理链路

---

## 已完成的能力

### Agent Runtime (第一版)
- [x] Go Core Runtime 基础框架
- [x] Agent 引擎（Engine）
- [x] State Machine 状态机
- [x] Context Budget 管理
- [x] Tool Governor 工具治理

### Server SQLite (第一版)
- [x] pure-Go SQLite 持久化层
- [x] 数据库迁移机制
- [x] Storage 层基础 CRUD

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

### 前端组件
- [x] TaskStore 任务状态管理
- [x] SSE 实时事件流
- [x] RightDock 右侧面板
- [x] DiffPanel 差异对比
- [x] ArtifactPanel 产物展示

---

## 仍是开发态的能力

### Sandbox 策略
- **状态**: 开发版策略，不是强隔离容器
- **说明**: 
  - 空 AllowedPaths 允许所有路径（dev 模式）
  - 非空 AllowedPaths 只允许指定目录及子目录
  - 阻止危险命令（rm, sudo, mkfs, fdisk）
  - Windows 优先 pwsh，fallback cmd
  - 路径判断支持 `/` 和 `\` 分隔符
- **v0.5.0 计划**: 强隔离容器

### Recovery 机制
- **状态**: 恢复机制，不等于任务完成
- **说明**: 
  - 有 checkpoint 时：恢复后任务状态为 `paused`（用户决定继续/放弃）
  - 无 checkpoint 时：返回 `no_checkpoint`，不修改任务状态
  - CreateReadOnlySnapshot：任务状态为 `paused`（非 completed）
  - **重要**: 恢复 ≠ 完成，不能把恢复操作标记为 completed
- **v0.5.0 计划**: 完整的任务恢复、回滚、Diff patch

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

## 发布前验收命令

发布前必须通过以下测试和验证：

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

1. **数据持久化**: Server SQLite 已有第一版，但仍需验证
2. **环境依赖**: 部分功能依赖本机安装特定软件（GEE/QGIS/GDAL）
3. **功能完整性**: 部分页面为开发占位，非真实功能
4. **安全隔离**: Sandbox 为开发版策略，非强隔离
5. **账号系统**: 无真实账号认证和授权

---

## 下一步计划 (v0.5.0)

1. 账号、计费、团队协作真实化
2. 插件市场真实安装/卸载
3. MCP Server 管理器真实运行
4. 完整任务恢复、回滚、Diff patch
5. Windows 安装包发布
6. 地图页接入 MapLibre 真实底图
7. PaperSearch 接入 OpenAlex 真实搜索

---

*最后更新: 2026-06-11*
*版本: v0.4.x-dev / v0.5.0-dev*
