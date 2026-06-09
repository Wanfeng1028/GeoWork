# GeoWork 最终技术架构

## 1. 最终架构结论

GeoWork 采用混合后端架构：

```
Electron + React + TypeScript 桌面端
        ↓
Go Core Runtime
        ↓
Python Geo Worker
```

Go 作为主后端，负责 Agent 主控、任务系统、权限、安全、插件、模型、自动化、用量统计和本地 API。Python 作为专业地理计算 Worker，负责 QGIS、GEE、GDAL、Rasterio、GeoPandas、xarray、PyMuPDF、Office 报告生成等能力。

## 2. 为什么不是纯 Python

纯 Python 后端可以快速做原型，但长期会遇到：

- Windows 打包体积大
- GDAL/QGIS/Conda 环境冲突
- 依赖版本容易炸
- 后台进程管理不如 Go 稳
- 插件权限隔离难做清楚
- 自动化和长任务调度越来越复杂
- 企业版部署不如 Go 单文件清晰

Python 适合做专业计算 Worker，不适合承担整个桌面 Agent 产品的主控系统。

## 3. 为什么不是全 Go

GeoWork 的专业能力强依赖 Python 生态：

- PyQGIS
- GDAL/Rasterio
- GeoPandas/Shapely/PyProj
- rioxarray/xarray/Dask
- earthengine-api/geemap
- PyMuPDF
- python-docx
- python-pptx
- openpyxl

全 Go 会牺牲地理遥感科研生态、复现能力和学生学习友好性。

## 4. Go Core Runtime 职责

| 职责 | 说明 |
|------|------|
| 本地 HTTP API | 提供 RESTful API 给 Electron 桌面端 |
| Agent Planner / Executor | 任务规划和执行引擎 |
| 专家系统 | 专家角色管理、路由、调度 |
| 技能系统 | Skill 包加载、运行、管理 |
| 插件系统 | 插件加载、权限审批、启用/禁用 |
| MCP 管理 | MCP 连接器管理 |
| 模型路由 | 模型配置、测试、路由 |
| API Key 管理 | 安全存储和管理 API 密钥 |
| 用量统计 | Token 消耗、成本计算、统计 |
| 任务队列 | 任务创建、执行、暂停、取消、重试 |
| 自动化/定时任务 | Cron 调度、文件变化触发 |
| 文件工作区沙箱 | 工作区隔离、文件读写控制 |
| 权限审批 | 高风险操作审批 |
| SSE/WebSocket 事件流 | 实时事件推送 |
| SQLite 数据库 | 数据持久化 |
| Python Worker 进程管理 | 启动、停止、健康检查 |
| 日志和错误诊断 | 全过程日志记录 |

### 推荐 Go 技术栈

- Go 1.23+
- chi (HTTP 路由)
- SQLite (数据库)
- sqlc (SQL 代码生成)
- zap (日志)
- robfig/cron (定时任务)
- fsnotify (文件监控)
- go-git (Git 操作)
- SSE (Server-Sent Events)
- WebSocket (实时通信)

## 5. Python Geo Worker 职责

| 职责 | 说明 |
|------|------|
| GEE 认证检测 | 检查 Google Earth Engine 认证状态 |
| GEE 数据搜索 | 搜索 GEE 数据集 |
| GEE 脚本生成 | 生成 GEE Python 脚本 |
| GEE 导出任务管理 | 管理 GEE 导出任务 |
| QGIS 环境检测 | 检查本地 QGIS 安装状态 |
| QGIS Processing 调用 | 调用 QGIS Processing 工具 |
| GDAL/Rasterio 栅格处理 | 栅格裁剪、重投影、元数据提取 |
| GeoPandas/Shapely 矢量处理 | 矢量裁剪、缓冲、叠加分析 |
| xarray/Dask 时序分析 | 多时相数据分析 |
| PyMuPDF PDF 解析 | PDF 文本提取、论文解析 |
| python-docx 报告生成 | 生成 Word 实验报告 |
| python-pptx PPT 生成 | 生成 PowerPoint 演示文稿 |
| openpyxl Excel 生成 | 生成 Excel 数据表 |
| matplotlib/plotly 图表生成 | 生成统计图表 |

### 推荐 Python 技术栈

- Python 3.11/3.12
- FastAPI (Web 框架)
- Uvicorn (ASGI 服务器)
- Pydantic (数据验证)
- PyQGIS (QGIS Python API)
- GDAL (地理数据抽象库)
- Rasterio (栅格 I/O)
- GeoPandas (地理数据处理)
- Shapely (几何操作)
- PyProj (坐标转换)
- rioxarray (xarray 扩展)
- xarray (多维数据)
- Dask (并行计算)
- earthengine-api (GEE API)
- geemap (GEE 交互地图)
- PyMuPDF (PDF 处理)
- python-docx (Word 生成)
- python-pptx (PPT 生成)
- openpyxl (Excel 生成)
- matplotlib (图表)
- plotly (交互图表)

## 6. Electron 桌面端技术栈

| 技术 | 用途 |
|------|------|
| Electron | 桌面应用框架 |
| React | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Ant Design | UI 组件库 |
| MapLibre GL | 地图渲染 |
| Deck.gl | 大规模地理数据可视化 |
| ECharts | 统计图表 |
| Monaco Editor | 代码编辑器 |
| xterm.js | 终端模拟 |
| Zustand | 状态管理 |
| TanStack Query | 数据获取 |

## 7. 通信方式

```
Electron ←→ Go Runtime: HTTP, SSE, WebSocket, IPC
Go Runtime ←→ Python Worker: HTTP + JSON
```

### API 端点示例

```
POST http://127.0.0.1:8765/api/projects
POST http://127.0.0.1:8765/api/tasks
GET  http://127.0.0.1:8765/api/tasks/:id/events
POST http://127.0.0.1:8765/tools/gee/generate-ndvi-script

POST http://127.0.0.1:8766/tools/gee/search-dataset
POST http://127.0.0.1:8766/tools/office/write-report
```

## 8. 进程关系

```
Electron main process
        ↓ 启动
geowork-runtime.exe  Go Runtime (端口 8765)
        ↓ 启动/管理
python geo worker  Python FastAPI (端口 8766)
```

Electron 不直接管理 Python。Electron 只和 Go Runtime 通信。

## 9. 最终目录结构

```
geowork/
├── apps/desktop/                 # Electron + React 桌面端
│   ├── src/
│   │   ├── app/                  # 主应用
│   │   ├── pages/                # 页面组件
│   │   ├── components/           # 通用组件
│   │   ├── map/                  # 地图组件
│   │   └── services/             # API 服务
│   └── electron/                 # Electron 主进程
├── core/                         # Go Core Runtime
│   ├── cmd/geowork-runtime/      # 入口
│   └── internal/
│       ├── api/                  # HTTP API
│       ├── agent/                # Agent 引擎
│       ├── runtime/              # 运行时状态
│       ├── tools/                # 工具注册
│       ├── worker/               # Worker 客户端
│       ├── file/                 # 文件管理
│       └── knowledge/            # 知识库
├── workers/geo-python/           # Python Geo Worker
│   ├── app/
│   │   ├── main.py               # FastAPI 入口
│   │   └── api/                  # API 路由
│   └── tests/                    # 测试
├── skills/                       # Skill 包
├── plugins/                      # 插件
├── marketplace/                  # 本地市场索引
├── assets/icons/                 # 图标
├── docs/                         # 文档
├── samples/                      # 示例
├── licenses/                     # 授权文件
├── LICENSE
├── COMMERCIAL-LICENSE.md
└── README.md
```

## 10. API 设计

### Go Runtime 对 Electron 提供

```
GET    /api/health                    # 健康检查
POST   /api/projects                  # 创建项目
GET    /api/projects                  # 项目列表
GET    /api/projects/:id              # 项目详情
POST   /api/tasks                     # 创建任务
GET    /api/tasks/:id                 # 任务详情
GET    /api/tasks/:id/events          # SSE 事件流
POST   /api/tasks/:id/run             # 运行任务
POST   /api/tasks/:id/pause           # 暂停任务
POST   /api/tasks/:id/cancel          # 取消任务
POST   /api/tasks/:id/retry           # 重试任务
GET    /api/skills                    # 技能列表
POST   /api/skills/:id/run            # 运行技能
GET    /api/plugins                   # 插件列表
POST   /api/plugins/:id/enable        # 启用插件
POST   /api/plugins/:id/disable       # 禁用插件
GET    /api/models                    # 模型列表
POST   /api/models                    # 添加模型
POST   /api/models/test               # 测试模型
GET    /api/usage/summary             # 用量统计
GET    /api/settings                  # 设置
POST   /api/settings                  # 更新设置
POST   /api/worker/geo/check          # Worker 健康检查
```

### Python Worker 提供

```
GET  /health                          # 健康检查
POST /tools/gee/search-dataset        # GEE 数据搜索
POST /tools/gee/generate-ndvi-script  # GEE NDVI 脚本生成
POST /tools/gee/check-auth            # GEE 认证检测
POST /tools/qgis/check-env            # QGIS 环境检测
POST /tools/qgis/run-processing       # QGIS Processing 调用
POST /tools/raster/metadata           # 栅格元数据
POST /tools/raster/clip               # 栅格裁剪
POST /tools/raster/reproject          # 栅格重投影
POST /tools/raster/ndvi               # NDVI 计算
POST /tools/vector/metadata           # 矢量元数据
POST /tools/vector/buffer             # 矢量缓冲
POST /tools/vector/clip               # 矢量裁剪
POST /tools/vector/reproject          # 矢量重投影
POST /tools/office/write-report       # Word 报告生成
POST /tools/office/write-ppt          # PPT 生成
POST /tools/office/write-excel        # Excel 生成
POST /tools/paper/parse-pdf           # PDF 解析
```

## 11. 安全架构

### 安全模式

| 模式 | 说明 |
|------|------|
| 只读模式 | 只允许读取文件，不允许写入 |
| 标准模式 | 允许工作区内写入，高风险操作需审批 |
| 自动模式 | 允许工作区内写入，高风险操作自动执行 |
| 开发者模式 | 允许所有操作 |

### 必须实现的安全措施

- 工作区白名单
- 文件 diff
- 一键回滚
- 删除进入回收站
- 联网审批
- Shell 命令审批
- Python 包安装审批
- GEE 导出审批
- 插件权限审批
- 任务日志不可篡改记录
