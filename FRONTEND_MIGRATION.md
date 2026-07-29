

---

# GeoFrontend2.0 → GeoWork 前端迁移完整方案

> **文档定位**：将 `GeoFrontend2.0`（Ant Design 6 + React 19 + Vite 8 + TypeScript 6 + Zustand 5）迁移并完全替换 `GeoWork/apps/desktop` 下的旧前端，实现前后端统一在 `GeoWork` 仓库开发。
>
> 来源仓库：[GeoFrontend2.0](https://github.com/Wanfeng1028/GeoFrontend2.0) · [GeoWork](https://github.com/Wanfeng1028/GeoWork)
> 注意：我已经将GeoFrontend2.0仓库的代码和设计规范移动到GeoWork文件夹：E:\code\javascript\project\GeoWork\GeoFrontend2.0。

---

## 一、迁移前架构对比

| 维度       | GeoFrontend2.0（新前端）               | GeoWork/apps/desktop（旧前端）   |
| ---------- | -------------------------------------- | -------------------------------- |
| UI 框架    | Ant Design 6                           | 自研组件（已移除 AntD 残留）     |
| 样式方案   | CSS Modules + AntD Token               | SCSS Modules + 自定义 Token 系统 |
| 状态管理   | Zustand 5 + localStorage (`geowork.*`) | 不明/自研                        |
| 构建工具   | Vite 8 独立 SPA                        | electron-vite（含主进程）        |
| React 版本 | React 19                               | 未知旧版                         |
| 设计规范   | design.md 强约束                       | 无明确规范                       |

**核心决策**：新前端仅替换 `apps/desktop` 的**渲染进程（Renderer）** 部分，保留 Electron **主进程（Main Process）+ Preload** 代码不动。

---

## 二、迁移全流程 SOP

### 第 0 步：前置条件确认

```bash
node -v          # 需要 >= 20.19 或 22.12+
go version       # 需要 >= 1.21
python --version # 需要 >= 3.10（Python Worker）
```

---

### 第 1 步：在 GeoWork 创建迁移分支

```bash
cd GeoWork
git checkout -b feature/migrate-frontend-v2
```

> **绝对不要直接在 `master` 上操作**，迁移验证通过后再合并。

---

### 第 2 步：备份旧前端

```bash
# 将旧前端整体备份，方便回退
cp -r apps/desktop apps/desktop_backup_old
git add apps/desktop_backup_old
git commit -m "chore: backup old desktop frontend before migration"
```

---

### 第 3 步：清理旧前端渲染层代码

**保留**（Electron 相关，不动）：
```
apps/desktop/electron/          # 主进程代码（main.ts, preload.ts 等）
apps/desktop/electron.vite.config.ts  # 整体 Electron-Vite 配置
apps/desktop/resources/         # 应用图标、Electron 资源
```

**删除**（旧 Renderer 全部清除）：
```bash
rm -rf apps/desktop/src/components/
rm -rf apps/desktop/src/pages/
rm -rf apps/desktop/src/stores/
rm -rf apps/desktop/src/styles/
rm -rf apps/desktop/src/lib/
rm -rf apps/desktop/src/hooks/
rm -rf apps/desktop/src/app/       # 如果存在旧版
# 删除旧 design 目录（已被新规范替代）
rm -rf design/
```

> ⚠️ 注意：如果 `src/main.tsx`（Renderer 入口）存在旧内容，**暂时不删**，第 4 步覆盖。

---

### 第 4 步：复制新前端核心文件

```bash
#我已经将GeoFrontend2.0仓库的代码和设计规范移动到GeoWork文件夹：E:\code\javascript\project\GeoWork\GeoFrontend2.0 
#以下路径以本地 Clone 目录为准，请替换为实际路径
NEW_FE="../GeoFrontend2.0"
TARGET="apps/desktop"

# 1. 核心源码
cp -r $NEW_FE/src/app       $TARGET/src/app
cp -r $NEW_FE/src/shell     $TARGET/src/shell
cp -r $NEW_FE/src/pages     $TARGET/src/pages
cp -r $NEW_FE/src/shared    $TARGET/src/shared
cp    $NEW_FE/src/main.tsx  $TARGET/src/main.tsx
cp    $NEW_FE/src/App.tsx   $TARGET/src/App.tsx

# 2. 静态资源
cp -r $NEW_FE/public/. $TARGET/public/

# 3. 入口 HTML
cp $NEW_FE/index.html $TARGET/index.html

# 4. 设计规范文档（长期约束）
cp $NEW_FE/design.md     $TARGET/design.md
cp $NEW_FE/AGENT.MD      $TARGET/AGENT.MD
cp $NEW_FE/.oxlintrc.json $TARGET/.oxlintrc.json
```

---

### 第 5 步：合并 `package.json` 依赖

打开 `GeoWork/apps/desktop/package.json`，将以下来自 `GeoFrontend2.0` 的依赖合并进去：

**`dependencies` 必须包含：**
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "antd": "^6.0.0",
  "@ant-design/icons": "latest",
  "antd-style": "latest",
  "react-router": "^8.0.0",
  "zustand": "^5.0.0",
  "clsx": "latest"
}
```

**`devDependencies` 必须包含：**
```json
{
  "@vitejs/plugin-react": "latest",
  "typescript": "^6.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "vite": "^8.0.0"
}
```

**同时删除旧前端遗留的已弃用包：**
```
移除：tailwindcss / @tailwindcss/*（根据 commit 历史已存在）
移除：@radix-ui/* 全系列
移除：旧的 antd v5（如存在）
移除：旧的 sass / scss 主题相关包
```

然后重新安装：
```bash
cd apps/desktop
npm install
```

---

### 第 6 步：TS 配置合并

将 `GeoFrontend2.0` 的 TypeScript 配置合并到 `apps/desktop`：

```bash
cp $NEW_FE/tsconfig.json      $TARGET/tsconfig.json
cp $NEW_FE/tsconfig.app.json  $TARGET/tsconfig.app.json
cp $NEW_FE/tsconfig.node.json $TARGET/tsconfig.node.json
```

> ⚠️ 如果 `apps/desktop` 使用了 `electron-vite`，可能存在 `tsconfig.electron.json`，**不要覆盖**，只更新 `tsconfig.app.json` 中的 `include` / `compilerOptions`。

---

### 第 7 步：Vite 配置适配（关键）

`GeoFrontend2.0` 使用标准 `vite.config.ts`；`GeoWork/apps/desktop` 使用 `electron.vite.config.ts`（含三端配置：`main`, `preload`, `renderer`）。

**操作**：只更新 `electron.vite.config.ts` 的 `renderer` 配置区：

```typescript
// electron.vite.config.ts
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    // 主进程配置，保持不变
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    // Preload 配置，保持不变
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // ✅ 这里替换为新前端的 Vite 配置
    root: 'src',
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    server: {
      proxy: {
        // API 请求代理到 Go 后端
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        },
        // Python Worker 代理
        '/worker': {
          target: 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  }
})
```

---

### 第 8 步：新前端与 Go 后端接口联调适配

`GeoFrontend2.0` 当前使用 Mock 数据（`localStorage` 持久化，无真实后端依赖）。迁移到 `GeoWork` 后，需要逐步对接真实 Go API。

**创建统一的环境变量文件：**

```bash
# apps/desktop/.env.development
VITE_API_BASE_URL=http://localhost:8080
VITE_WORKER_BASE_URL=http://localhost:8000
VITE_APP_MODE=dev
```

```bash
# apps/desktop/.env.production
VITE_API_BASE_URL=/api
VITE_WORKER_BASE_URL=/worker
VITE_APP_MODE=prod
```

**在新前端的 `shared/` 目录下创建统一 API 客户端：**

```typescript
// src/shared/api/client.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// SSE 流式接口（对接 Go 的 SSE 事件流）
export function createSSEStream(path: string, onMessage: (data: string) => void): EventSource {
  const es = new EventSource(`${BASE_URL}${path}`)
  es.onmessage = (e) => onMessage(e.data)
  return es
}
```

---

### 第 9 步：localStorage Key 前缀校验

按照 `design.md` 规范，所有 Zustand + localStorage 持久化的 Key 必须使用 `geowork.` 前缀。

```bash
# 检查是否有遗留的非 geowork. 前缀
grep -r "localStorage.setItem\|localStorage.getItem\|persist(" apps/desktop/src \
  | grep -v "geowork\."
```

如发现问题，统一修正：
```typescript
// ✅ 正确
persist(store, { name: 'geowork.appearance' })
persist(store, { name: 'geowork.conversation' })

// ❌ 错误（需修正）
persist(store, { name: 'theme' })
persist(store, { name: 'geofront.conversation' })
```

---

### 第 10 步：构建验证（硬性门槛）

迁移完成后，必须执行以下验证，**全部通过才算迁移成功**：

```bash
cd apps/desktop

# 1. TypeScript 类型检查（零报错）
npx tsc --noEmit

# 2. 生产构建（零报错）
npm run build

# 3. 本地开发服务器启动验证
npm run dev
```

**浏览器中验证以下路由均可正常访问：**
```
http://localhost:5173/                # Dashboard
http://localhost:5173/workspace       # 地图工作区
http://localhost:5173/data-center     # 数据资产
http://localhost:5173/tasks           # 任务队列
http://localhost:5173/settings        # 系统设置
http://localhost:5173/agent-studio    # Agent 编排
http://localhost:5173/theme-preview   # 主题验证页（Bootstrap / Dark / System）
```

**主题切换验证：**
- Bootstrap（亮色）下：侧栏浅色，无写死深色背景
- Dark 下：全局进入 `darkAlgorithm`，无手写黑色 CSS
- System：能跟随操作系统主题自动切换
- 刷新后主题状态通过 `geowork.appearance` 正确恢复

---

### 第 11 步：合并与清理

验证通过后，将迁移分支合并回主分支：

```bash
cd GeoWork
git add .
git commit -m "feat(desktop): migrate frontend to GeoFrontend2.0 (AntD6 + React19 + Vite8)"
git checkout master
git merge feature/migrate-frontend-v2
git push origin master

# 确认稳定后，删除旧前端备份
rm -rf apps/desktop_backup_old
git add .
git commit -m "chore: remove old frontend backup"
git push
```

---

## 三、迁移后统一开发工作流（你暂时不需要进行这一部分，我一部分我来进行）

迁移完成后，所有开发均在 `GeoWork` 仓库中进行，使用以下工作流：

### 日常启动（Windows）
更新根目录 `start.bat`：
```batch
@echo off
echo ========================================
echo  GeoWork 本地开发环境启动中...
echo ========================================

:: Go 后端（核心服务）
start "GeoWork-Core" cmd /k "cd /d %~dp0 && go run ./server/..."

:: Python 空间计算 Worker
start "GeoWork-PyWorker" cmd /k "cd /d %~dp0workers\geo-python && uvicorn main:app --port 8000 --reload"

:: 新前端（Vite 开发服务器）
start "GeoWork-Frontend" cmd /k "cd /d %~dp0apps\desktop && npm run dev"

echo ========================================
echo  前端:  http://localhost:5173
echo  后端:  http://localhost:8080
echo  Worker: http://localhost:8000
echo ========================================
```

### 日常启动（macOS/Linux）
```bash
# 并行启动所有服务
concurrently \
  "cd server && go run main.go" \
  "cd workers/geo-python && uvicorn main:app --port 8000 --reload" \
  "cd apps/desktop && npm run dev"
```

### 分工开发
```
前端开发  → 只在 apps/desktop/src/ 下工作
后端开发  → 只在 core/ 和 server/ 下工作
AI技能开发→ 只在 skills/ 下工作
Python计算→ 只在 workers/geo-python/ 下工作
```

---

## 四、迁移后长期开发约束（摘自 design.md）

> 这是永久性规范，不得因个人偏好绕过。

| 类别             | 规则                                                         |
| ---------------- | ------------------------------------------------------------ |
| **UI 体系**      | Ant Design 6 是唯一基础 UI 体系，禁止引入 Tailwind / Radix / shadcn/ui |
| **颜色**         | 所有色值来自 `theme.useToken()`，**禁止硬编码任何色值**      |
| **CSS**          | CSS Modules 只负责布局（flex/grid/spacing），视觉全交给 AntD Token |
| **组件**         | 禁止自封装 BaseButton / GwCard 等基础 UI，业务组件内部组合 AntD 组件 |
| **主题**         | 只允许三种主题入口：`light`（Bootstrap）/ `dark` / `system`  |
| **localStorage** | 所有持久化 Key 必须以 `geowork.` 为前缀                      |
| **构建**         | 每次修改后必须 `npm run build` 通过才算完成                  |
| **API**          | Mock 数据标记为 `DevBadge`，真实接口对接 Go SSE / WebSocket  |

---

## 五、常见迁移问题速查

| 问题                                       | 原因                         | 解决方案                                               |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------ |
| `Cannot find module 'antd'`                | 新依赖未安装                 | `cd apps/desktop && npm install`                       |
| `type 'React.ReactNode' is not assignable` | React 19 类型变更            | 更新 `@types/react` 到 `^19.0.0`                       |
| Electron 白屏                              | Renderer 入口路径不对        | 检查 `electron.vite.config.ts` 的 `renderer.root` 配置 |
| 主题刷新重置                               | localStorage Key 不匹配      | 确保 Zustand persist name 为 `geowork.appearance`      |
| API 404                                    | 代理路径未配置               | 在 Vite renderer 配置中添加 `server.proxy`             |
| 暗色主题下背景为白色                       | 手写了白色背景 CSS           | 删除硬编码色值，改用 `token.colorBgContainer`          |
| 构建后 CSS 乱序                            | Vite CSS code splitting 问题 | 在 `vite.config` 中设置 `build.cssCodeSplit: false`    |

---

*迁移完成后，`后续所有前端开发均在 `GeoWork/apps/desktop` 下进行。后端仍然在GeoWork仓库进行。*