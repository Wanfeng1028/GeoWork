# GeoWork 开发文档

## 1. 开发目标

本开发文档用于指导 GeoWork MVP 的工程落地。最终后端采用 Go Core Runtime + Python Geo Worker，桌面端采用 Electron + React + TypeScript。

## 2. 仓库结构

```
geowork/
├── apps/desktop/
│   ├── src/app/                  # 主应用组件
│   ├── src/pages/                # 页面组件
│   ├── src/components/           # 通用组件
│   ├── src/map/                  # 地图组件
│   ├── src/services/             # API 服务
│   ├── src/hooks/                # 自定义 Hooks
│   ├── electron/main.ts         # Electron 主进程
│   ├── electron/preload.ts      # 预加载脚本
│   └── electron/runtime.ts      # Go Runtime 管理
├── core/
│   ├── cmd/geowork-runtime/main.go  # Go 入口
│   └── internal/
│       ├── api/                  # HTTP API 处理器
│       ├── agent/                # Agent 引擎
│       ├── runtime/              # 运行时状态管理
│       ├── tools/                # 工具注册表
│       ├── worker/               # Python Worker 客户端
│       ├── file/                 # 文件管理
│       └── knowledge/            # 知识库管理
├── workers/geo-python/
│   ├── app/main.py               # FastAPI 入口
│   ├── app/api/                  # API 路由
│   └── tests/                    # 测试
├── skills/                       # Skill 包
├── plugins/                      # 插件
├── marketplace/                  # 本地市场索引
├── assets/icons/                 # 图标
├── docs/                         # 文档
├── samples/                      # 示例
└── licenses/                     # 授权文件
```

## 3. 顶层 package.json

```json
{
  "name": "geowork",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "concurrently \"npm:dev:desktop\" \"npm:dev:core\"",
    "dev:desktop": "npm --workspace apps/desktop run dev",
    "dev:core": "cd core && go run ./cmd/geowork-runtime --port 8765 --dev",
    "build:core": "cd core && go build -o ../dist/geowork-runtime.exe ./cmd/geowork-runtime",
    "build:desktop": "npm --workspace apps/desktop run build",
    "dist:win": "npm run build:core && npm --workspace apps/desktop run dist:win"
  },
  "workspaces": ["apps/desktop"],
  "devDependencies": {"concurrently": "^9.0.0"}
}
```

## 4. Electron 主进程

### main.ts

```typescript
import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows'
import { startCoreRuntime, stopCoreRuntime } from './runtime'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

async function bootstrap() {
  await app.whenReady()
  await startCoreRuntime({ port: 8765 })
  registerIpcHandlers()
  mainWindow = createMainWindow()
}

app.on('window-all-closed', async () => {
  await stopCoreRuntime()
  if (process.platform !== 'darwin') app.quit()
})

bootstrap().catch((err) => {
  console.error(err)
  app.quit()
})
```

### runtime.ts

```typescript
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'

let proc: ChildProcessWithoutNullStreams | null = null

export async function startCoreRuntime(options: { port: number }) {
  if (proc) return
  const isDev = !!process.env.ELECTRON_RENDERER_URL
  const command = isDev ? 'go' : 'geowork-runtime.exe'
  const args = isDev
    ? ['run', './cmd/geowork-runtime', '--port', String(options.port), '--dev']
    : ['--port', String(options.port)]

  proc = spawn(command, args, {
    cwd: isDev ? '../../core' : process.resourcesPath,
    shell: false
  })

  proc.stdout.on('data', (d) => console.log('[core]', d.toString()))
  proc.stderr.on('data', (d) => console.error('[core]', d.toString()))

  await waitForHealth(`http://127.0.0.1:${options.port}/api/health`)
}
```

## 5. Go Core Runtime 文件职责

### cmd/geowork-runtime/main.go

启动 Go Runtime，初始化 SQLite，启动 Python Worker，启动 HTTP Server。

### internal/api/router.go

注册所有 API：health、projects、tasks、skills、plugins、models、usage、settings。

### internal/agent/planner.go

根据用户 prompt 生成结构化执行计划。MVP 可先用规则，后期改为模型 JSON 输出。

### internal/agent/executor.go

按步骤执行，调用 Tool Registry，发送事件到 Event Bus。

### internal/tools/tool.go

定义 Tool 接口和 Registry，注册、获取、列表、执行工具。

### internal/worker/client.go

封装 Go 调 Python Worker 的 HTTP 客户端。

### internal/runtime/runtime.go

核心 App 结构体，管理所有模块状态。

### internal/runtime/store.go

状态持久化，JSON 文件读写。

### internal/file/manager.go

文件管理，SQLite + fsnotify 文件监控。

### internal/knowledge/manager.go

知识库管理，SQLite + FTS5 全文搜索。

## 6. Go 代码骨架

### internal/agent/planner.go

```go
package agent

import "strings"

type Step struct {
    ID          string `json:"id"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Tool        string `json:"tool"`
    Status      string `json:"status"`
}

type Planner struct{}

func NewPlanner() *Planner { return &Planner{} }

func (p *Planner) CreatePlan(prompt string) []Step {
    if strings.Contains(strings.ToLower(prompt), "ndvi") {
        return []Step{
            {ID: "step_1", Title: "解析任务目标", Description: "识别研究区、时间范围和输出要求", Tool: "task.parse", Status: "pending"},
            {ID: "step_2", Title: "推荐 GEE 数据集", Description: "推荐 Sentinel-2 或 Landsat 数据", Tool: "geo.gee.search_dataset", Status: "pending"},
            {ID: "step_3", Title: "生成 NDVI 脚本", Description: "生成 GEE Python 脚本", Tool: "geo.gee.generate_ndvi_script", Status: "pending"},
            {ID: "step_4", Title: "生成实验报告", Description: "生成 Word 实验报告", Tool: "geo.office.write_report", Status: "pending"},
        }
    }
    return []Step{{ID: "step_1", Title: "分析任务", Description: "生成通用执行计划", Tool: "task.parse", Status: "pending"}}
}
```

### internal/tools/tool.go

```go
package tools

import "context"

type Result struct {
    OK      bool           `json:"ok"`
    Message string         `json:"message"`
    Data    map[string]any `json:"data,omitempty"`
}

type Tool interface {
    Name() string
    Description() string
    RiskLevel() string
    Run(ctx context.Context, args map[string]any) (Result, error)
}
```

### internal/worker/client.go

```go
package worker

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http"
    "time"
)

type Client struct { BaseURL string }

func (c *Client) Post(ctx context.Context, path string, input any, output any) error {
    body, _ := json.Marshal(input)
    req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+path, bytes.NewReader(body))
    if err != nil { return err }
    req.Header.Set("Content-Type", "application/json")
    httpClient := &http.Client{Timeout: 120 * time.Second}
    res, err := httpClient.Do(req)
    if err != nil { return err }
    defer res.Body.Close()
    return json.NewDecoder(res.Body).Decode(output)
}
```

## 7. Python Geo Worker 文件职责

### app/main.py

启动 FastAPI，注册 GEE、QGIS、Raster、Vector、Office、Paper 路由。

### app/api/gis.py

GIS 处理端点：clip、reproject、merge、dissolve、analyze。

### app/api/ndvi.py

NDVI 分析端点：analyze、history。

### app/api/papers.py

论文搜索端点：search、parse-pdf、index。

### app/api/knowledge.py

知识库端点：index、import、search、detail。

## 8. Python 代码骨架

### app/main.py

```python
from fastapi import FastAPI
from app.api.gis import router as gis_router
from app.api.ndvi import router as ndvi_router
from app.api.papers import router as papers_router
from app.api.knowledge import router as knowledge_router

app = FastAPI(title="GeoWork Geo Python Worker", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok", "service": "geo-python-worker"}

app.include_router(gis_router, prefix="/tools/gis")
app.include_router(ndvi_router, prefix="/tools/ndvi")
app.include_router(papers_router, prefix="/tools/papers")
app.include_router(knowledge_router, prefix="/tools/knowledge")
```

### app/api/gis.py

```python
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class GenerateNDVIRequest(BaseModel):
    workspace: str | None = None
    start_date: str = "2019-01-01"
    end_date: str = "2024-12-31"
    dataset: str = "COPERNICUS/S2_SR_HARMONIZED"

@router.post("/generate-ndvi-script")
def generate_ndvi_script(payload: GenerateNDVIRequest):
    workspace = Path(payload.workspace or Path.home() / "GeoWorkProjects" / "demo")
    scripts = workspace / "scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    path = scripts / "gee_ndvi_analysis.py"
    code = """
import ee

ee.Initialize()
region = ee.Geometry.Rectangle([103.0, 30.0, 105.0, 31.5])
collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(region)
def add_ndvi(image):
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
    return image.addBands(ndvi)
ndvi = collection.map(add_ndvi).select('NDVI').mean().clip(region)
print(ndvi.getInfo())
""".strip()
    path.write_text(code, encoding="utf-8")
    return {"ok": True, "message": "GEE NDVI 脚本已生成", "data": {"path": str(path)}}
```

## 9. Skill 示例

### skills/ndvi-timeseries/manifest.json

```json
{
  "id": "ndvi-timeseries",
  "name": "NDVI 时序分析",
  "version": "0.1.0",
  "description": "基于 GEE 或本地遥感影像计算 NDVI 并生成图表和实验报告",
  "tags": ["remote-sensing", "ndvi", "gee", "experiment-report"],
  "required_tools": [
    "geo.gee.search_dataset",
    "geo.gee.generate_ndvi_script",
    "geo.office.write_report"
  ],
  "permissions": {"network": true, "file_write": true, "shell": false}
}
```

## 10. 开发 Sprint

| Sprint | 目标 | 关键产出 |
|--------|------|----------|
| Sprint 0 | 基础骨架 | Electron 启动、Go Runtime 启动、`/api/health`、Python Worker 健康检查 |
| Sprint 1 | 主界面 | 顶部栏、左侧导航、工作台三栏、底部日志、地图预览 |
| Sprint 2 | 任务系统 | 创建任务、Planner 生成计划、Executor 执行、SSE 推送事件 |
| Sprint 3 | Python Worker 工具 | GEE 脚本生成、Word 报告生成、Go Tool 调用 Worker |
| Sprint 4 | 项目工作区与安全 | 新建项目、目录结构、工作区白名单、高风险工具审批 |
| Sprint 5 | Skill 系统 | 加载本地 Skill、显示 Skill、运行 NDVI Skill |
| Sprint 6 | 模型与 API | OpenAI-compatible 模型配置、模型测试、API 状态、用量记录 |
| Sprint 7 | 论文搜索与知识库 | OpenAlex 搜索、PDF 导入、论文精读、知识库索引 |
| Sprint 8 | 插件和市场 | 插件 manifest、本地插件市场、插件权限展示、启用/禁用 |
| Sprint 9 | 自动化与定时任务 | cron 定时任务、文件变化触发、任务执行记录 |

## 11. MVP 验收

### 验收任务

> 帮我完成成都市 2019-2024 年 NDVI 时序分析，并生成实验报告。

### 验收标准

- 能创建项目
- 能创建任务
- 能生成计划
- SSE 显示执行过程
- Go 调 Python Worker
- 生成 GEE 脚本
- 生成 Word 实验报告
- 文件写入项目目录
- 底部日志显示工具调用记录
