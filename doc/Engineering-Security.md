# GeoWork 安全规范

> **文档路径**：`doc/Engineering-Security.md`
> **关联文档**：`AGENT.md`（全局禁止 §10）/ `GeoWork-Communication-Protocol.md`（通信协议）
> **适用对象**：所有贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：Electron 安全、CSP、XSS 防护、依赖审计、敏感信息 |

---

## 1. Electron 安全基线

### 1.1 当前配置（已确认）

| 配置项 | 值 | 说明 |
|---|---|---|
| `contextIsolation` | `true` | ✅ 渲染进程与主进程隔离 |
| `nodeIntegration` | `false` | ✅ 渲染进程无法直接访问 Node.js |
| `preload` | `../preload/preload.cjs` | ✅ 通过 contextBridge 暴露安全 API |
| `webSecurity` | 默认（`true`） | ✅ 同源策略启用 |
| `sandbox` | 未显式设置 | ⚠️ 建议显式设为 `true` |

### 1.2 必须遵守

- **禁止**将 `nodeIntegration` 设为 `true`
- **禁止**将 `contextIsolation` 设为 `false`
- **禁止**将 `webSecurity` 设为 `false`
- 新增 `BrowserWindow` 或 `WebContentsView` 时必须显式设置以上三项
- `preload.ts` 中通过 `contextBridge.exposeInMainWorld` 暴露的 API 必须做参数校验

### 1.3 sandbox 加固（TODO）

```typescript
// electron/main.ts - 建议添加
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,           // 显式启用
  preload: '../preload/preload.cjs',
}
```

---

## 2. Content Security Policy（CSP）

当前**未设置 CSP**。建议通过 `session.defaultSession.webRequest` 注入：

```typescript
// electron/main.ts - 建议添加
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +  // antd 需要 inline style
        "img-src 'self' data: https:; " +
        "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; " +
        "font-src 'self' data:;"
      ]
    }
  })
})
```

**规则**：

- `default-src 'self'`：默认只允许同源资源
- `connect-src` 必须包含 Go Core（`http://127.0.0.1:8765`）和 WebSocket（`ws://127.0.0.1:*`）
- `style-src` 需要 `'unsafe-inline'`（Ant Design 运行时注入样式）
- 禁止 `'unsafe-eval'`
- 生产环境 CSP 用严格模式，开发环境可用 Report-Only 模式调试

---

## 3. XSS 防护

### 3.1 禁止

- **禁止**使用 `dangerouslySetInnerHTML`，除非经过安全审查并添加注释说明
- **禁止**将用户输入直接拼接到 HTML / URL / CSS 中
- **禁止**使用 `eval()`、`new Function()`、`setTimeout(string)`

### 3.2 安全替代

| 需求 | 安全做法 |
|---|---|
| 渲染 Markdown | 使用 `DOMPurify` 消毒后再渲染（待引入） |
| 动态样式 | 使用 CSS 变量 + `style` 对象，不拼字符串 |
| 动态 URL | 使用 `URL` 构造函数校验，禁止 `javascript:` 协议 |

---

## 4. 敏感信息处理

### 4.1 规则

- API key、token、密码**永远不入库**
- 通过 `.env.local`（已 gitignore）或系统环境变量注入
- `.env.development` 和 `.env.production` 只放非敏感配置（URL、端口、模式标识）
- 代码中禁止硬编码任何密钥，即使注释掉也不行
- 日志中禁止打印 token / key / password（即使截断）

### 4.2 .env 文件管理

| 文件 | 入库？ | 用途 |
|---|---|---|
| `.env` | ❌ | 本地覆盖（gitignore） |
| `.env.local` | ❌ | 本地敏感配置（gitignore） |
| `.env.development` | ✅ | 开发环境非敏感配置 |
| `.env.production` | ✅ | 生产环境非敏感配置 |
| `.env.example` | ✅ | 模板文件，标注需要哪些变量（待创建） |

---

## 5. 依赖安全审计

### 5.1 规则

- 新增依赖前必须执行 `npm audit` 检查已知漏洞
- 高危漏洞（`high` / `critical`）必须在合入前修复或添加豁免说明
- 定期（每月）执行一次全量 `npm audit`
- Go 依赖：`govulncheck ./...`（待集成到 CI）
- Python 依赖：`pip-audit`（待集成到 CI）

### 5.2 审计命令

```bash
# 前端
npm audit --workspace apps/desktop

# Go Core
cd core && govulncheck ./...

# Python Worker
cd workers/geo-python && pip-audit
```

---

## 6. IPC 通信规范

### 6.1 安全规则

Electron IPC 是主进程和渲染进程的通信桥梁，必须做权限控制：

- `preload.ts` 暴露的每个 API 都必须有明确的白名单（当前已实现：`security/allowlist.ts`）
- 禁止在 preload 中暴露 `ipcRenderer.invoke` 的通用调用接口
- 文件操作类 IPC 必须校验路径（防止路径穿越攻击）
- 命令执行类 IPC 必须走沙箱（`sandbox/`）

### 6.2 IPC 通道命名

格式：`geowork:{domain}:{action}`

| Domain | 示例通道 | 说明 |
|---|---|---|
| `window` | `geowork:window:minimize` / `maximize` / `close` | 窗口控制 |
| `file` | `geowork:file:import` / `export` / `open-dialog` | 文件操作 |
| `shell` | `geowork:shell:open` | 系统 shell |
| `shortcut` | `geowork:shortcut:register` / `unregister` | 全局快捷键 |
| `runtime` | `geowork:runtime:proxy` | Go Core 代理 |
| `terminal` | `geowork:terminal:create` / `write` / `resize` | PTY 终端 |
| `browser` | `geowork:browser:navigate` / `screenshot` | 内嵌浏览器 |
| `clipboard` | `geowork:clipboard:read` / `write` | 剪贴板 |
| `notification` | `geowork:notification:show` | 系统通知 |

### 6.3 类型共享

在 `apps/desktop/src/shared/ipc/types.ts`（待创建）定义所有 IPC 消息的 TypeScript 接口：

```typescript
// 每个 IPC 通道对应一个请求/响应类型对
export interface IpcChannelMap {
  'geowork:window:minimize': { req: void; res: void }
  'geowork:file:import': { req: { paths: string[] }; res: { success: boolean; error?: string } }
  'geowork:terminal:create': { req: { cwd: string }; res: { sessionId: string } }
  // ...
}
```

主进程和渲染进程共同引用此类型文件，**禁止 `any`**。

### 6.4 职责边界

| 操作 | 归属 | 走 IPC？ |
|---|---|---|
| 窗口控制（最小化/最大化/关闭） | 主进程 | ✅ |
| 文件对话框 / 拖入导入 | 主进程 → 渲染 | ✅ |
| 系统托盘 / 菜单 | 主进程 | ❌ 不暴露给渲染 |
| 全局快捷键注册 | 主进程 | ✅ |
| Go Core HTTP 通信 | 渲染进程直连 | ❌ 不走 IPC |
| 纯 UI 状态（主题/面板开关） | 渲染进程 | ❌ 不走 IPC |
| node-pty 终端 | 主进程创建，渲染消费 | ✅ |
| 内嵌浏览器（WebContentsView） | 主进程创建 | ✅ |

---

## 7. 安全检查清单

新页面 / 新 IPC / 新依赖合入前，对照检查：

- [ ] 没有引入 `dangerouslySetInnerHTML`
- [ ] 没有硬编码密钥
- [ ] 新 IPC 已加入白名单
- [ ] 新 `BrowserWindow` 已设置安全 webPreferences
- [ ] `npm audit` 无高危漏洞
- [ ] CSP 不会被新资源类型破坏
