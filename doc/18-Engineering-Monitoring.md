# GeoWork 错误监控与可观测性规范

> **文档路径**：`doc/18-Engineering-Monitoring.md`
> **关联文档**：`11-Engineering-CI-CD.md` / `06-GeoWorkAgent-P1-Detailed-Design.md`（P1-2 Observability）
> **适用对象**：所有贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：错误上报、日志规范、性能监控、用户行为埋点 |

---

## 1. 错误监控

### 1.1 当前状态

**无错误上报系统**。前端错误只输出到 DevTools console，用户看不到反馈，开发者无法主动发现线上问题。

### 1.2 目标方案

使用 **Sentry**（自托管或 SaaS）作为错误上报平台：

```typescript
// src/shared/monitoring/sentry.ts（待创建）
import * as Sentry from '@sentry/electron'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_MODE,
  release: `geowork@${appVersion}`,
  
  // 性能监控
  tracesSampleRate: 0.1,  // 10% 的事务被采样
  
  // 过滤敏感信息
  beforeSend(event) {
    // 移除 PII（个人身份信息）
    delete event.user?.ip_address
    return event
  },
})
```

**Sentry DSN 存放位置**：`.env.production` 中设置 `VITE_SENTRY_DSN=...`，`.env.development` 中**不设置**（开发环境不上报）。

**开发环境行为**：`VITE_APP_MODE === 'dev'` 时 Sentry 不初始化，错误走 `console.error`。

### 1.3 错误分级

| 级别 | 含义 | 上报？ | 示例 |
|---|---|---|---|
| `fatal` | 应用崩溃 | **立即上报** | 渲染进程崩溃、主进程崩溃 |
| `error` | 功能不可用 | **上报** | API 500、WebSocket 断连无法恢复 |
| `warning` | 功能降级 | **采样上报** | SSE 断连后重连成功、审批超时 |
| `info` | 正常但值得关注 | **不上报** | 主题切换、新任务创建 |
| `debug` | 开发调试 | **不上报** | 组件渲染、状态变更 |

### 1.4 全局错误捕获

```typescript
// src/shared/monitoring/errorHandler.ts（待创建）

// React 组件渲染错误
window.addEventListener('error', (event) => {
  Sentry.captureException(event.error)
})

// Promise 未捕获异常
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason)
})

// Electron 渲染进程崩溃
ipcRenderer.on('renderer-crashed', () => {
  Sentry.captureMessage('Renderer process crashed', 'fatal')
})
```

---

## 2. 日志规范

### 2.1 前端日志

当前无统一日志系统。建议：

- 开发环境：`console.log/warn/error` 直接输出
- 生产环境：禁止 `console.log`（通过 oxlint `no-console` 规则），只保留 `console.warn/error`
- 日志通过 Sentry 的 `addBreadcrumb` 记录上下文，不直接打印到用户可见的地方

```typescript
// 推荐做法
Sentry.addBreadcrumb({
  category: 'api',
  message: `POST /api/conversations`,
  level: 'info',
  data: { status: 201, duration: 142 },
})
```

### 2.2 Go Core 日志

Go Core 使用标准 `log/slog` 包，分级输出：

| 级别 | 用途 |
|---|---|
| `DEBUG` | 开发调试（生产环境关闭） |
| `INFO` | 正常操作记录 |
| `WARN` | 异常但可恢复 |
| `ERROR` | 功能失败 |

---

## 3. 性能监控

### 3.1 Electron 特有指标

Web Vitals（FCP/LCP/CLS）对 Electron 本地加载意义有限。改为监控以下桌面应用特有指标：

| 指标 | 目标值 | 测量方式 |
|---|---|---|
| 窗口首次渲染 | < 1.5s | `BrowserWindow` 的 `ready-to-show` 事件时间戳 - `createWindow` 时间戳 |
| 主进程阻塞 | < 50ms/次 | `process.monitorEventLoopDelay`（Node.js 内置） |
| 渲染进程内存 | < 500MB | `process.memoryUsage().rss` |
| Go Core 内存 | < 1GB | 运行时 `runtime.MemStats` |
| Python Worker 内存 | < 2GB | GIS 处理可能吃内存，超过时记录 warning |
| CPU 占用 | < 80%（持续 30s） | 超过时记录 warning |

### 3.2 Electron 进程监控

| 指标 | 阈值 | 处理方式 |
|---|---|---|
| 渲染进程内存 | < 500MB | 超过时记录 warning |
| Go Core 内存 | < 1GB | 超过时记录 warning |
| Python Worker 内存 | < 2GB | GIS 处理可能吃内存，超过时记录 |
| CPU 占用 | < 80%（持续 30s） | 超过时记录 warning |

### 3.3 上报策略

- 性能数据**不实时上报**，每分钟采集一次聚合数据
- 使用 Sentry Performance API 或自建上报（TODO）
- 敏感数据（用户输入内容）不上报

---

## 4. 用户行为埋点

### 4.1 当前状态

无埋点系统。

### 4.2 建议方案（TODO）

轻量级埋点，记录关键用户行为用于产品决策：

| 事件 | 数据 | 用途 |
|---|---|---|
| `task_created` | `{ mode: 'work' \| 'code' \| 'map' }` | 了解用户偏好 |
| `task_completed` | `{ duration, toolCallCount }` | 了解任务复杂度 |
| `theme_changed` | `{ from, to }` | 了解主题偏好 |
| `extension_installed` | `{ extensionId }` | 了解插件使用率 |
| `settings_changed` | `{ settingKey }` | 了解配置需求 |

### 4.3 规则

- 埋点**只记录行为，不记录内容**（记"用户创建了任务"，不记"任务内容是什么"）
- 埋点数据不上传到第三方——本地存储或自建后端
- 尊重用户隐私，提供关闭埋点的选项

---

## 5. 实施路线图

| 阶段 | 任务 | 优先级 |
|---|---|---|
| 1 | 前端全局错误捕获（`window.onerror` + `unhandledrejection`） | P0 |
| 2 | 引入 Sentry（或自建错误上报） | P1 |
| 3 | Go Core 结构化日志（`slog`） | P1 |
| 4 | Web Vitals 采集 | P2 |
| 5 | 用户行为埋点 | P2 |
| 6 | Electron 进程内存监控 | P3 |
