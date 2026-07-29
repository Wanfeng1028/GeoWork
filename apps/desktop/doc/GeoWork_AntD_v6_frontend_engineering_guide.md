# GeoWork Desktop 前端工程化方案

> 适用项目：`https://github.com/Wanfeng1028/GeoWork`  
> 适用范围：`apps/desktop` 桌面端前端  
> 最终 UI 框架：**Ant Design v6 最新版**  
> 最终主题：**亮色 = Ant Design 主题编辑器的 Bootstrap 主题；暗色 = Ant Design 主题编辑器的暗黑 / Dark 主题**

---

## 0. 本次纠正

前面把亮色主题说成 AntD 默认 Light，这是不准确的。你截图里确定的是：

```text
亮色：Bootstrap
暗色：暗黑 / Dark
```

这里的 **Bootstrap** 指的是 Ant Design 主题编辑器里的 Bootstrap 风格预设，不是安装 `bootstrap` 这个 CSS 框架。

所以最终主题不是：

```text
AntD Default Light + AntD Default Dark
```

而是：

```text
AntD Bootstrap Theme + AntD Dark Theme
```

---

## 1. 最终目标

GeoWork Desktop 前端要从旧的混合 UI 技术栈，迁移成一个统一、可维护、可工程化的 Ant Design 前端体系。

最终目标：

```text
1. UI 组件统一使用 Ant Design。
2. 亮色主题使用 AntD 主题编辑器里的 Bootstrap 主题。
3. 暗色主题使用 AntD 主题编辑器里的 Dark 主题。
4. 支持 system 跟随系统，在 Bootstrap / Dark 之间切换。
5. 不再维护旧的自研设计系统。
6. 不再使用 Radix、Tailwind、自研 Gw 组件、自研 components/ui、QoderWorkCopy token。
7. CSS 只负责布局，不负责重新设计组件视觉。
8. 项目结构要清晰、可维护、可长期迭代。
```

---

## 2. 前端技术栈总览

### 2.1 核心框架

| 技术 | 是否保留 | 作用 |
|---|---:|---|
| React 19 | 保留 | UI 组件框架 |
| TypeScript 5.x | 保留 | 类型安全，保证复杂桌面端项目长期可维护 |
| Electron 34 | 保留 | 桌面应用壳，负责窗口、菜单、托盘、本地能力、IPC |
| Vite 6 | 保留 | 前端构建、开发服务器、快速热更新 |
| electron-vite | 保留 | Electron main / preload / renderer 构建集成 |

### 2.2 UI 技术

| 技术 | 是否使用 | 作用 |
|---|---:|---|
| Ant Design v6 最新版 | 使用 | 唯一 UI 组件体系 |
| @ant-design/icons | 使用 | 唯一通用图标库 |
| ConfigProvider | 使用 | 全局主题、语言、组件配置 |
| App | 使用 | message、notification、modal 等上下文能力 |
| AntD Theme Token | 使用 | 只用于 Bootstrap / Dark 主题配置 |
| Bootstrap CSS 框架 | 不使用 | 不安装 `bootstrap` |
| Radix | 不使用 | 全部移除 |
| Tailwind | 不使用 | 全部移除 |
| 自研 Gw 组件 | 不使用 | 全部移除 |
| 自研 components/ui | 不使用 | 全部移除 |

### 2.3 状态管理

| 技术 | 是否保留 | 职责 |
|---|---:|---|
| React Query | 保留 | 服务端状态：任务、运行时、模型、插件、工作区数据 |
| Zustand | 保留 | 全局客户端 UI 状态：主题、侧栏折叠、当前工作区 |
| Jotai | 谨慎保留 | 复杂页面局部状态，能不用就不用 |
| AntD Form | 使用 | 表单字段状态 |
| useState / useReducer | 使用 | 组件局部状态 |

状态边界：

```text
服务端数据不要放 Zustand。
表单字段不要放 Zustand。
地图内部渲染状态不要污染全局 Store。
主题状态只记录 light / dark / system，不记录旧的 glass/parchment/classic。
```

### 2.4 地理空间与业务能力

| 技术 | 是否保留 | 作用 |
|---|---:|---|
| MapLibre GL | 保留 | 地图底图和地图交互 |
| deck.gl | 保留 | 大规模空间数据可视化 |
| ECharts | 保留 | 图表、统计、时序数据 |
| Monaco Editor | 保留 | 代码、JSON、脚本编辑 |
| xterm | 保留 | 终端、命令输出、运行日志 |
| react-resizable-panels | 保留 | 可拖拽面板布局 |

这些属于功能能力，不属于 UI 设计系统，不要删除。

---

## 3. 旧技术栈清理结论

必须彻底移除：

```text
@radix-ui/*
tailwindcss
@tailwindcss/vite
tailwind-merge
class-variance-authority
components/ui
components/foundation
GwButton
GwCard
GwPanel
GwTabs
GwBadge
GwTooltip
GwIconButton
QoderWorkCopy token
theme-init
tokens.css
themes.css
tokens.scss
themes.scss
--gw-* token
旧 SCSS 写死视觉
```

禁止再引入：

```text
shadcn/ui
Radix
Tailwind
CVA
自研 Button
自研 Card
自研 Input
自研 Select
自研 Tabs
自研基础 UI 组件库
```

---

## 4. Less / Sass / SCSS 是什么？为什么不用？

### 4.1 Less 是什么？

Less 是 CSS 预处理器。它允许你写变量、嵌套、函数，然后编译成 CSS。

```less
@primary-color: #1677ff;

.button {
  color: @primary-color;

  &:hover {
    color: darken(@primary-color, 10%);
  }
}
```

以前 Ant Design v4 常见做法是通过 Less 变量覆盖主题，比如改 `@primary-color`。

### 4.2 Sass / SCSS 是什么？

Sass 也是 CSS 预处理器。SCSS 是 Sass 的一种语法。

```scss
$primary-color: #1677ff;

.button {
  color: $primary-color;

  &:hover {
    color: darken($primary-color, 10%);
  }
}
```

### 4.3 为什么 GeoWork 不用 Less / Sass 做主题？

因为 Ant Design v5 以后主题能力已经转向 CSS-in-JS 和 Design Token，主题切换通过 `ConfigProvider` 的 `theme` 配置完成，而不是通过 Less 变量覆盖。

GeoWork 现在决定使用 AntD v6 最新版，所以主题应该这样做：

```tsx
<ConfigProvider theme={antdTheme}>
  <App />
</ConfigProvider>
```

而不是这样做：

```less
@primary-color: ...;
```

或者这样做：

```scss
$primary-color: ...;
```

最终结论：

```text
不用 Less。
不用 Sass / SCSS 做主题。
不通过 Less 变量覆盖 AntD。
不通过 SCSS 变量重写 AntD 组件颜色。
```

---

## 5. CSS 方案最终决策

### 5.1 使用什么？

使用：

```text
CSS Modules
全局 layout.css
Ant Design Theme Token
```

推荐文件：

```text
*.module.css
styles/layout.css
```

### 5.2 不使用什么？

不使用：

```text
Less
Sass / SCSS 作为长期方案
Tailwind
自定义 design token
全局写死颜色
自定义 AntD 组件样式覆盖
```

### 5.3 CSS 只负责布局

CSS 允许写：

```text
布局
宽高
margin / padding
grid / flex
overflow
滚动区域
地图容器尺寸
Monaco 容器尺寸
xterm 容器尺寸
Electron 拖拽区
Split panel 尺寸
```

允许示例：

```css
.workspaceLayout {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.mapContainer {
  height: 100%;
  min-height: 360px;
  overflow: hidden;
}
```

CSS 禁止写：

```text
按钮颜色
按钮 hover
卡片背景
卡片阴影
输入框边框
Menu 选中颜色
Tabs 颜色
Table 样式
Tag 颜色
Badge 颜色
Alert 颜色
Modal 样式
Drawer 样式
AntD 圆角
玻璃拟态
渐变背景
发光边框
```

禁止示例：

```css
.customButton {
  background: #0d6efd;
  color: white;
  border-radius: 12px;
}
```

---

## 6. AntD v6 主题实现方案

### 6.1 主题状态类型

路径建议：

```text
apps/desktop/src/shared/stores/appearanceStore.ts
```

```ts
import { create } from 'zustand'

export type Appearance = 'light' | 'dark' | 'system'
export type ResolvedAppearance = 'light' | 'dark'

interface AppearanceState {
  appearance: Appearance
  resolvedAppearance: ResolvedAppearance
  setAppearance: (appearance: Appearance) => void
  setResolvedAppearance: (resolvedAppearance: ResolvedAppearance) => void
}

const STORAGE_KEY = 'geowork.appearance'

function getSystemAppearance(): ResolvedAppearance {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

function getInitialAppearance(): Appearance {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const saved = window.localStorage.getItem(STORAGE_KEY)

  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved
  }

  return 'system'
}

const initialAppearance = getInitialAppearance()

export const useAppearanceStore = create<AppearanceState>((set) => ({
  appearance: initialAppearance,
  resolvedAppearance:
    initialAppearance === 'system' ? getSystemAppearance() : initialAppearance,

  setAppearance: (appearance) => {
    window.localStorage.setItem(STORAGE_KEY, appearance)

    set({
      appearance,
      resolvedAppearance:
        appearance === 'system' ? getSystemAppearance() : appearance,
    })
  },

  setResolvedAppearance: (resolvedAppearance) => {
    set({ resolvedAppearance })
  },
}))
```

---

### 6.2 系统主题监听

路径建议：

```text
apps/desktop/src/shared/hooks/useSystemAppearance.ts
```

```ts
import { useEffect } from 'react'
import { useAppearanceStore } from '@/shared/stores/appearanceStore'

export function useSystemAppearance() {
  const appearance = useAppearanceStore((state) => state.appearance)
  const setResolvedAppearance = useAppearanceStore(
    (state) => state.setResolvedAppearance,
  )

  useEffect(() => {
    if (appearance !== 'system') {
      setResolvedAppearance(appearance)
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const update = () => {
      setResolvedAppearance(media.matches ? 'dark' : 'light')
    }

    update()
    media.addEventListener('change', update)

    return () => {
      media.removeEventListener('change', update)
    }
  }, [appearance, setResolvedAppearance])
}
```

---

### 6.3 Bootstrap / Dark 主题配置

路径建议：

```text
apps/desktop/src/app/antdThemes.ts
```

说明：

- `bootstrapTheme` 使用 Ant Design 主题编辑器中的 Bootstrap 预设。
- 如果主题编辑器可以导出 JSON，以导出的 JSON 为准。
- 下面这份是 Bootstrap 风格的工程起始配置，不安装 Bootstrap 框架。

```ts
import { theme, type ThemeConfig } from 'antd'

export const bootstrapTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#0d6efd',
    colorSuccess: '#198754',
    colorWarning: '#ffc107',
    colorError: '#dc3545',
    colorInfo: '#0dcaf0',
  },
}

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
}
```

如果从 Ant Design 主题编辑器导出了更完整的 Bootstrap 配置，应替换 `bootstrapTheme.token`：

```ts
export const bootstrapTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // Paste exported Bootstrap seed token here.
  },
  components: {
    // Paste exported component token here if the theme editor exports it.
  },
}
```

原则：

```text
亮色只使用 Bootstrap 预设。
暗色只使用 Dark 预设。
不要额外混入旧 GeoWork 颜色。
不要额外混入 QoderWorkCopy token。
```

---

### 6.4 AppProviders

路径：

```text
apps/desktop/src/app/AppProviders.tsx
```

```tsx
import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { bootstrapTheme, darkTheme } from './antdThemes'
import { useAppearanceStore } from '@/shared/stores/appearanceStore'
import { useSystemAppearance } from '@/shared/hooks/useSystemAppearance'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  useSystemAppearance()

  const resolvedAppearance = useAppearanceStore(
    (state) => state.resolvedAppearance,
  )

  const antdTheme = useMemo(
    () => (resolvedAppearance === 'dark' ? darkTheme : bootstrapTheme),
    [resolvedAppearance],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={antdTheme}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export { queryClient }
```

---

## 7. main.tsx

路径：

```text
apps/desktop/src/main.tsx
```

目标写法：

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd/dist/reset.css'
import './styles/layout.css'
import { App } from './app/App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

不要再引入：

```ts
import './styles/app.css'
import './styles/global.scss'
import { initGeoWorkTheme } from './design/theme-init'
```

---

## 8. 推荐目录结构

```text
apps/desktop/src/
  main.tsx

  app/
    App.tsx
    AppProviders.tsx
    antdThemes.ts
    routes.tsx

  shell/
    AppShell.tsx
    AppShell.module.css

  pages/
    Dashboard/
    Workspace/
    DataCenter/
    Tasks/
    Settings/
    AgentStudio/

  features/
    map/
    layers/
    tasks/
    agent/
    modelGateway/
    mcp/
    browser/
    terminal/
    editor/
    reports/

  shared/
    api/
    ipc/
    hooks/
      useSystemAppearance.ts
    stores/
      appearanceStore.ts
    types/
    utils/

  styles/
    layout.css
```

不再保留：

```text
components/ui
components/foundation
design
styles/tokens.scss
styles/themes.scss
```

`components/` 如果保留，只允许放业务组件，不允许放基础 UI 组件。

允许：

```text
components/map/LayerTree.tsx
components/tasks/TaskTimeline.tsx
components/editor/ScriptEditor.tsx
```

禁止：

```text
components/ui/Button.tsx
components/foundation/GwCard.tsx
```

---

## 9. 组件工程规范

页面里直接使用 AntD：

```tsx
import {
  Layout,
  Menu,
  Button,
  Card,
  Form,
  Input,
  Select,
  Table,
  Tabs,
  Tag,
  Badge,
  Alert,
  Modal,
  Drawer,
  Space,
  Typography,
} from 'antd'
```

禁止：

```tsx
import { Button } from '@/components/ui/button'
import { GwCard } from '@/components/foundation'
import * as Dialog from '@radix-ui/react-dialog'
```

不封装基础 UI：

```text
不要封装 AppButton
不要封装 BaseButton
不要封装 GwButton
不要封装 UiButton
不要封装 BaseCard
```

允许封装业务组件：

```text
LayerTree
TaskTimeline
RuntimeStatusCard
MapViewport
ModelConfigForm
```

业务组件内部可以组合 AntD 组件。

---

## 10. AppShell 实现规范

AppShell 使用 AntD：

```text
Layout
Header
Sider
Content
Menu
Dropdown
Button
Space
Typography
Badge
Segmented
```

示例：

```tsx
import { Layout, Menu, Typography } from 'antd'
import styles from './AppShell.module.css'

const { Header, Sider, Content } = Layout

export function AppShell() {
  return (
    <Layout className={styles.root}>
      <Header className={styles.header}>
        <Typography.Text strong>GeoWork</Typography.Text>
      </Header>

      <Layout>
        <Sider width={220}>
          <Menu
            mode="inline"
            items={[
              { key: 'workspace', label: '工作台' },
              { key: 'data', label: '数据' },
              { key: 'tasks', label: '任务' },
              { key: 'settings', label: '设置' },
            ]}
          />
        </Sider>

        <Content className={styles.content}>{/* routes */}</Content>
      </Layout>
    </Layout>
  )
}
```

`AppShell.module.css` 只写布局：

```css
.root {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
}

.content {
  padding: 24px;
  overflow: auto;
}
```

不要覆盖 AntD Menu 颜色。

---

## 11. 设置页中的主题切换

设置页只提供三项：

```text
Bootstrap
Dark
System
```

代码示例：

```tsx
import { Segmented } from 'antd'
import { useAppearanceStore } from '@/shared/stores/appearanceStore'

export function AppearanceSetting() {
  const appearance = useAppearanceStore((state) => state.appearance)
  const setAppearance = useAppearanceStore((state) => state.setAppearance)

  return (
    <Segmented
      value={appearance}
      onChange={(value) => setAppearance(value as 'light' | 'dark' | 'system')}
      options={[
        { label: 'Bootstrap', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'System', value: 'system' },
      ]}
    />
  )
}
```

禁止恢复：

```text
light-glass
dark-glass
classic-light
classic-dark
parchment
auto
```

---

## 12. 通知系统

长期统一使用 AntD：

```text
message
notification
modal
App.useApp()
```

页面中使用：

```tsx
import { App, Button } from 'antd'

export function SaveButton() {
  const { message } = App.useApp()

  return (
    <Button
      type="primary"
      onClick={() => {
        message.success('保存成功')
      }}
    >
      保存
    </Button>
  )
}
```

`sonner` 后续可以删除。

---

## 13. 图标系统

使用：

```text
@ant-design/icons
```

示例：

```tsx
import { SettingOutlined, DatabaseOutlined } from '@ant-design/icons'
```

不要再混多套通用图标库。

---

## 14. 依赖安装与删除

### 14.1 安装 AntD v6 最新版

```bash
npm --workspace apps/desktop install antd@latest @ant-design/icons@latest
```

安装后检查版本：

```bash
npm --workspace apps/desktop ls antd
```

当前 npm 上 `antd` 最新版如果是 v6.x，则 lockfile 会固定具体版本。

### 14.2 删除旧 UI 技术栈

```bash
npm --workspace apps/desktop remove @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-radio-group tailwindcss @tailwindcss/vite tailwind-merge class-variance-authority
```

如果还有其他 `@radix-ui/*`，继续删除。

### 14.3 不安装

```text
bootstrap
less
sass
tailwindcss
@radix-ui/*
shadcn/ui
```

注意：

```text
Bootstrap 主题不等于安装 bootstrap 包。
```

---

## 15. ESLint 工程门禁

新增或修改 ESLint 规则，禁止旧体系回流：

```js
export default [
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@radix-ui/*',
            '@/components/ui/*',
            '@/components/foundation/*',
            '@/design/*',
          ],
          paths: [
            {
              name: 'tailwind-merge',
              message: 'GeoWork 已统一使用 Ant Design，不允许使用 tailwind-merge。',
            },
            {
              name: 'class-variance-authority',
              message: 'GeoWork 已统一使用 Ant Design，不允许使用 CVA。',
            },
            {
              name: 'bootstrap',
              message: 'GeoWork 使用 AntD Bootstrap 主题，不安装 Bootstrap 框架。',
            },
          ],
        },
      ],
    },
  },
]
```

---

## 16. UI Clean 检查脚本

新增：

```text
scripts/check-ui-clean.mjs
```

```js
import { execSync } from 'node:child_process'

const forbidden = [
  '@radix-ui',
  'tailwindcss',
  '@tailwindcss',
  'tailwind-merge',
  'class-variance-authority',
  'components/ui',
  'components/foundation',
  'GwButton',
  'GwCard',
  'GwPanel',
  'GwTabs',
  'GwBadge',
  'GwTooltip',
  'initGeoWorkTheme',
  'setGeoWorkTheme',
  'GeoWorkTheme',
  'QoderWorkCopy',
  '--gw-',
  'var(--gw',
  'bootstrap/dist',
]

let failed = false

for (const keyword of forbidden) {
  try {
    const result = execSync(
      `grep -R "${keyword}" apps/desktop/src apps/desktop/package.json package.json`,
      { encoding: 'utf8' },
    )

    if (result.trim()) {
      failed = true
      console.error(`\nForbidden keyword found: ${keyword}`)
      console.error(result)
    }
  } catch {
    // grep not found means OK
  }
}

if (failed) {
  process.exit(1)
}

console.log('UI clean check passed.')
```

package.json 增加：

```json
{
  "scripts": {
    "check:ui-clean": "node scripts/check-ui-clean.mjs"
  }
}
```

---

## 17. 迁移阶段

### Phase 1：旧体系清理

目标：

```text
删除 Radix
删除 Tailwind
删除 CVA
删除 Gw 组件
删除 components/ui
删除旧 theme-init
删除 QoderWorkCopy token
删除写死视觉样式
```

不接 AntD。

### Phase 2：接入 AntD v6

目标：

```text
安装 antd@latest
安装 @ant-design/icons@latest
导入 antd/dist/reset.css
接入 ConfigProvider
接入 Antd App
建立 bootstrapTheme / darkTheme
建立 appearanceStore
建立 light / dark / system 切换
```

### Phase 3：重写 AppShell

目标：

```text
使用 AntD Layout
使用 AntD Header
使用 AntD Sider
使用 AntD Menu
使用 AntD Content
```

### Phase 4：页面迁移

建议顺序：

```text
Settings
Tasks
DataCenter
Dashboard
Workspace
AgentStudio
Map panels
Terminal panels
Editor panels
```

先简单页面，再复杂页面。

### Phase 5：质量门禁

必须通过：

```bash
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run build
npm run check:ui-clean
```

---

## 18. 验收标准

最终验收必须满足：

```text
使用 AntD v6 最新版
亮色主题为 Bootstrap
暗色主题为 Dark
支持 system 跟随系统
没有 Radix
没有 Tailwind
没有 CVA
没有 tailwind-merge
没有 components/ui
没有 components/foundation
没有 GwButton / GwCard / GwPanel
没有 QoderWorkCopy token
没有旧 theme-init
没有 --gw-* token
没有 SCSS 写死 UI 视觉
没有安装 bootstrap CSS 框架
没有 Less 变量覆盖
基础 UI 全部来自 Ant Design
CSS 只负责布局
```

---

## 19. 在线预览示例

下面代码可以直接复制到本地 `index.html` 或 CodePen 运行。它展示的是：亮色 Bootstrap 主题 + 暗色 Dark 主题。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>GeoWork AntD Bootstrap / Dark Demo</title>

  <link rel="stylesheet" href="https://unpkg.com/antd@latest/dist/reset.css" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/dayjs@1/dayjs.min.js"></script>
  <script src="https://unpkg.com/antd@latest/dist/antd.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <style>
    #root { min-height: 100vh; }
    .content { padding: 24px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; }
    .stack { display: grid; gap: 24px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>

<body>
<div id="root"></div>

<script type="text/babel">
const {
  ConfigProvider, App, Layout, Menu, Card, Button, Space, Typography,
  Table, Tag, Input, Select, Tabs, Alert, Progress, Badge, Empty,
  Segmented, theme,
} = antd;

const { Header, Sider, Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const data = [
  { key: 1, name: "Sentinel-2 NDVI", type: "Raster", status: "运行中" },
  { key: 2, name: "杭州行政边界", type: "Vector", status: "已完成" },
  { key: 3, name: "DEM 地形数据", type: "Raster", status: "等待中" },
];

const columns = [
  { title: "图层", dataIndex: "name" },
  { title: "类型", dataIndex: "type" },
  {
    title: "状态",
    dataIndex: "status",
    render: (value) => {
      const color = {
        "运行中": "processing",
        "已完成": "success",
        "等待中": "warning",
      }[value];

      return <Tag color={color}>{value}</Tag>;
    },
  },
];

const bootstrapTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#0d6efd",
    colorSuccess: "#198754",
    colorWarning: "#ffc107",
    colorError: "#dc3545",
    colorInfo: "#0dcaf0",
  },
};

const darkTheme = {
  algorithm: theme.darkAlgorithm,
};

function Demo() {
  const [mode, setMode] = React.useState("light");
  const isDark = mode === "dark";

  return (
    <ConfigProvider theme={isDark ? darkTheme : bootstrapTheme}>
      <App>
        <Layout style={{ minHeight: "100vh" }}>
          <Header style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ color: "#fff", fontWeight: 700, width: 160 }}>GeoWork</div>
            <Menu
              theme="dark"
              mode="horizontal"
              defaultSelectedKeys={["workspace"]}
              items={[
                { key: "workspace", label: "工作台" },
                { key: "data", label: "数据" },
                { key: "analysis", label: "分析" },
                { key: "settings", label: "设置" },
              ]}
              style={{ flex: 1 }}
            />
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { label: "Bootstrap", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
            />
          </Header>

          <Layout>
            <Sider width={220} theme={isDark ? "dark" : "light"}>
              <Menu
                theme={isDark ? "dark" : "light"}
                mode="inline"
                defaultSelectedKeys={["map"]}
                items={[
                  { key: "map", label: "地图工作台" },
                  { key: "layers", label: "图层管理" },
                  { key: "tasks", label: "分析任务" },
                  { key: "files", label: "数据文件" },
                  { key: "reports", label: "报告导出" },
                ]}
              />
            </Sider>

            <Content className="content">
              <div className="grid">
                <div className="stack">
                  <Card>
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <Title level={3} style={{ margin: 0 }}>
                        GeoWork AntD Bootstrap / Dark 主题
                      </Title>
                      <Paragraph type="secondary">
                        亮色使用 Bootstrap 主题，暗色使用 Dark 主题。
                        不安装 Bootstrap 框架，不使用 Less/Sass 重写 AntD。
                      </Paragraph>
                      <Space>
                        <Button>导入数据</Button>
                        <Button type="primary">运行分析</Button>
                        <Button danger>删除任务</Button>
                      </Space>
                    </Space>
                  </Card>

                  <Card title="任务状态">
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Badge status="success" text="Runtime 在线" />
                      <Badge status="processing" text="Worker 运行中" />
                      <Progress percent={68} />
                      <Alert type="info" showIcon message="Ant Design 主题配置生效" />
                    </Space>
                  </Card>

                  <Card title="地图区域">
                    <div style={{ height: 260, display: "grid", placeItems: "center" }}>
                      <Empty description="这里放 MapLibre / deck.gl" />
                    </div>
                  </Card>

                  <Card title="图层列表">
                    <Table columns={columns} dataSource={data} pagination={false} />
                  </Card>
                </div>

                <div className="stack">
                  <Card title="属性面板">
                    <Tabs
                      defaultActiveKey="layer"
                      items={[
                        {
                          key: "layer",
                          label: "图层",
                          children: (
                            <Space direction="vertical" style={{ width: "100%" }}>
                              <Input value="Sentinel-2 NDVI" readOnly />
                              <Select
                                style={{ width: "100%" }}
                                defaultValue="raster"
                                options={[
                                  { value: "raster", label: "Raster" },
                                  { value: "vector", label: "Vector" },
                                ]}
                              />
                              <Button block>重置</Button>
                              <Button type="primary" block>应用</Button>
                            </Space>
                          ),
                        },
                        {
                          key: "task",
                          label: "任务",
                          children: (
                            <Space direction="vertical" style={{ width: "100%" }}>
                              <Alert type="success" showIcon message="任务配置正常" />
                              <Text type="secondary">当前主题：{mode}</Text>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </div>
              </div>
            </Content>
          </Layout>
        </Layout>
      </App>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Demo />);
</script>
</body>
</html>
```

---

## 20. 参考资料

- Ant Design 官网：https://ant.design/
- Ant Design 中文官网：https://ant.design/index-cn/
- Ant Design 主题定制：https://ant.design/docs/react/customize-theme/
- Ant Design ConfigProvider：https://ant.design/components/config-provider/
- Ant Design 从 v4 到 v5 迁移说明：https://5x.ant.design/docs/react/migration-v5-cn/
- npm antd 包：https://www.npmjs.com/package/antd

## 21. 工程化门禁

GeoWork Desktop 前端迁移不能只以“页面能显示”为完成标准，所有前端改动必须通过统一的工程化门禁。

### 21.1 必须通过的检查命令

所有涉及 `apps/desktop` 的前端改动，提交前必须执行并通过：

```bash
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
npm run check:ui-clean
```

### 21.2 各检查项职责

| 检查项           | 职责                                                     |
| ---------------- | -------------------------------------------------------- |
| `typecheck`      | 检查 TypeScript 类型，不能存在类型错误                   |
| `lint`           | 检查禁用导入、未使用变量、Hooks 依赖、代码风格和潜在错误 |
| `test`           | 检查核心组件、store、hooks、工具函数是否可测             |
| `build`          | 检查 Electron main / preload / renderer 是否能够完整构建 |
| `check:ui-clean` | 检查旧 UI 技术栈、旧 token、旧主题系统是否回流           |

### 21.3 需要补充的 package scripts

`apps/desktop/package.json` 建议补充：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "build": "electron-vite build"
  }
}
```

根目录 `package.json` 建议补充：

```json
{
  "scripts": {
    "check:ui-clean": "node scripts/check-ui-clean.mjs",
    "verify:desktop": "npm --workspace apps/desktop run typecheck && npm --workspace apps/desktop run lint && npm --workspace apps/desktop run test && npm --workspace apps/desktop run build && npm run check:ui-clean"
  }
}
```

### 21.4 禁止为了通过检查而降低工程质量

禁止通过以下方式绕过工程门禁：

```text
删除测试文件
关闭 TypeScript strict
添加 // @ts-nocheck
添加 // @ts-ignore
大面积添加 eslint-disable
把 any 当作通用逃生口
删除失败用例但不修复问题
把错误逻辑移出检查范围
```

当前项目中如果存在 `// @ts-nocheck`、`eslint-disable`、宽泛 `any`、被跳过的测试，应视为后续需要清理的技术债。

原则：

```text
工程门禁的目标是暴露问题，不是隐藏问题。
不能为了让 CI 变绿而牺牲类型安全、测试覆盖和长期可维护性。
```

------

## 22. 依赖分级与不可误删清单

Ant Design 重构只针对基础 UI 体系，不等于删除所有前端能力。GeoWork 是地理空间桌面应用，地图、图表、编辑器、终端、任务运行等能力属于业务核心，不能因为 UI 重构被误删。

### 22.1 依赖分级

| 分类       | 允许                                              | 禁止                                         |
| ---------- | ------------------------------------------------- | -------------------------------------------- |
| 基础 UI    | `antd`, `@ant-design/icons`                       | Radix, shadcn/ui, 自研 Button / Card / Input |
| 地图能力   | `maplibre-gl`, `deck.gl`                          | 因 UI 重构误删地图能力                       |
| 图表能力   | `echarts`                                         | 用 UI 框架替代业务图表能力                   |
| 编辑器能力 | Monaco, xterm                                     | 用 AntD 重写代码编辑器或终端                 |
| 面板布局   | `react-resizable-panels`                          | 用临时 div 拖拽逻辑替代成熟面板能力          |
| 状态管理   | React Query, Zustand, AntD Form                   | 把服务端数据塞进 Zustand                     |
| 样式       | CSS Modules, `styles/layout.css`                  | Tailwind, Sass / SCSS 主题、Less 变量        |
| 通知反馈   | AntD `App.useApp()`、message、notification、modal | sonner、自研 toast                           |
| 图标       | `@ant-design/icons`                               | 多套通用图标库混用                           |

### 22.2 不可误删的业务能力

以下依赖或能力属于 GeoWork 的业务基础设施，不属于旧 UI 设计系统，AntD 重构时不能误删：

```text
MapLibre GL
deck.gl
ECharts
Monaco Editor
xterm
react-resizable-panels
React Query
Zustand
Electron main / preload / IPC
本地任务运行能力
地图图层渲染能力
数据导入导出能力
模型、插件、工作区相关业务逻辑
```

### 22.3 必须清理的 UI 技术栈

以下内容属于旧 UI 体系或旧视觉方案，最终必须清理：

```text
@radix-ui/*
tailwindcss
@tailwindcss/vite
tailwind-merge
class-variance-authority
sass
scss 主题文件
sonner
lucide-react
components/ui
components/foundation
GwButton
GwCard
GwPanel
GwTabs
GwBadge
GwTooltip
QoderWorkCopy token
theme-init
tokens.scss
themes.scss
--gw-* token
```

------

## 23. Import 边界规范

目录结构清晰只是第一步，更重要的是依赖方向必须稳定。否则即使文件夹看起来规整，长期仍然会出现页面互相引用、shared 反向依赖业务、features 依赖 pages 等问题。

### 23.1 允许的依赖方向

```text
app -> shell / pages / shared
shell -> shared / AntD
pages -> features / shared / AntD
features -> shared / AntD
shared -> 第三方库 / 纯工具 / 类型
components -> 仅业务组件 / AntD / shared
```

### 23.2 各目录职责

| 目录          | 职责                                       | 允许依赖                              |
| ------------- | ------------------------------------------ | ------------------------------------- |
| `app/`        | 应用入口、Provider、路由、全局配置         | `shell`, `pages`, `shared`            |
| `shell/`      | 应用外壳、导航、布局框架                   | `shared`, `antd`, `@ant-design/icons` |
| `pages/`      | 页面级组合，承载路由页面                   | `features`, `shared`, `antd`          |
| `features/`   | 业务功能模块                               | `shared`, `antd`, 业务第三方库        |
| `shared/`     | 通用 hooks、stores、types、utils、api、ipc | 第三方库，不依赖业务页面              |
| `components/` | 可选，只放业务组件                         | `shared`, `antd`                      |

### 23.3 禁止的依赖关系

禁止出现：

```text
features/map 引入 pages/Workspace
features/tasks 引入 pages/Dashboard
shared/utils 引入 pages
shared/hooks 引入具体页面组件
shared/stores 引入业务页面
pages 之间互相 import
shell 引入具体 feature 的内部实现
components 里放 Button / Card / Input 等基础 UI 封装
```

### 23.4 components 目录规则

`components/` 如果保留，只能放业务组件，不能放基础 UI 组件。

允许：

```text
components/map/LayerTree.tsx
components/tasks/TaskTimeline.tsx
components/editor/ScriptEditor.tsx
components/runtime/RuntimeStatusCard.tsx
```

禁止：

```text
components/ui/Button.tsx
components/ui/Card.tsx
components/ui/Input.tsx
components/foundation/GwCard.tsx
components/foundation/GwButton.tsx
components/base/BaseButton.tsx
components/base/BaseCard.tsx
```

原则：

```text
允许封装业务场景组件。
不允许封装视觉皮肤组件。
允许 RuntimeStatusCard。
不允许 BaseCard。
允许 LayerTree。
不允许 GwTree。
```

------

## 24. AntD 使用规范：避免重新写成 AI 味前端

使用 Ant Design 不代表工程质量自动提升。很多 AI 味前端的问题不是颜色，而是业务语义不足、信息层级混乱、组件堆砌、按钮文案泛泛、空状态没有下一步。

GeoWork 的 AntD 重构必须优先体现地理空间工作台的业务语义，而不是做成通用后台模板。

### 24.1 页面组织规范

```text
页面不能只堆 Card，必须有明确的信息层级。
Dashboard 只展示摘要、趋势和最近活动，不承载复杂操作。
Workspace 是主工作区，允许高密度布局。
DataCenter 以数据资产、图层、文件、元数据为核心。
Tasks 以任务队列、运行日志、状态流转为核心。
Settings 使用 Form + Section，不做花哨卡片墙。
AgentStudio 以模型、工具、插件、上下文配置为核心。
```

### 24.2 AntD 组件使用规范

| 组件       | 必须处理                                              |
| ---------- | ----------------------------------------------------- |
| `Table`    | `rowKey`、`loading`、`pagination`、empty 状态、错误态 |
| `Form`     | 校验规则、错误提示、保存反馈、重置逻辑                |
| `Modal`    | 只处理短流程，不承载复杂配置                          |
| `Drawer`   | 用于复杂表单、详情面板、右侧配置面板                  |
| `Tabs`     | tab 数量不能过多，不能当成页面路由滥用                |
| `Menu`     | 选项必须来自真实导航或业务对象                        |
| `Dropdown` | 选项必须是有效业务动作，不放假功能                    |
| `Button`   | 文案必须是具体业务动作                                |
| `Card`     | 用于组织信息块，不能满屏堆砌                          |
| `Alert`    | 用于明确状态、风险、错误或提示，不做装饰              |
| `Empty`    | 必须提供下一步操作建议                                |

### 24.3 Button 文案规范

禁止泛泛文案：

```text
提交
确定
开始
处理
执行
操作
点击
下一步
```

推荐业务文案：

```text
导入 GeoJSON
导入 Shapefile
运行 NDVI 分析
连接 QGIS
刷新图层
发布地图服务
导出任务报告
停止当前任务
重试失败任务
保存模型配置
```

原则：

```text
用户看到按钮时，应立刻知道这个按钮会对哪个业务对象执行什么动作。
```

### 24.4 空状态规范

禁止只写：

```text
暂无数据
无内容
没有结果
```

推荐写法：

```text
暂无图层。请先导入 GeoJSON、Shapefile 或连接数据源。
暂无运行任务。你可以从工作台选择分析工具并创建任务。
暂无模型配置。请先添加本地模型或连接远程模型服务。
暂无插件。请在插件市场安装或启用 MCP 工具。
```

空状态必须回答三个问题：

```text
现在没有什么？
为什么可能没有？
用户下一步可以做什么？
```

### 24.5 不像 AI 生成的核心标准

```text
页面要有真实业务密度。
组件要服务任务流，而不是服务视觉堆砌。
文案要贴近 GeoWork 的地理空间场景。
操作要有 loading、error、success、empty 的完整状态。
不要满屏 Card + Space + Button。
不要滥用图标。
不要写没有后续功能的假入口。
不要为了“高级感”添加玻璃拟态、渐变、发光边框。
```

------

## 25. 页面级重构模板

每个页面迁移前必须先写页面重构记录，避免一边改一边想，导致页面结构混乱、状态遗漏、组件随意堆砌。

### 25.1 页面重构前必须记录

```text
1. 页面职责
2. 页面核心用户
3. 主要任务流
4. 数据来源
5. loading / error / empty 状态
6. 主要交互
7. 使用的 AntD 组件
8. 需要保留的业务组件
9. 需要删除的旧组件
10. 验收截图或录屏
```

### 25.2 页面重构记录模板

```md
## 页面名称

### 页面职责

说明这个页面负责什么，不负责什么。

### 核心用户

说明这个页面主要面向谁使用。

### 主要任务流

1. 用户进入页面后首先看到什么。
2. 用户可以执行哪些主要动作。
3. 动作完成后系统如何反馈。
4. 异常或空状态如何处理。

### 数据来源

- 服务端数据：
- 本地状态：
- 表单状态：
- IPC / Electron 能力：

### 状态处理

- loading：
- error：
- empty：
- success：
- disabled：

### AntD 组件

- Layout：
- Form：
- Table：
- Tabs：
- Drawer：
- Modal：
- Button：
- Alert：
- Empty：

### 保留的业务组件

- 组件 1：
- 组件 2：

### 删除的旧组件

- 旧组件 1：
- 旧组件 2：

### 验收标准

- [ ] 页面基础 UI 来自 AntD
- [ ] CSS 只负责布局
- [ ] 没有旧 UI 组件
- [ ] loading / error / empty 状态完整
- [ ] 操作文案具有业务含义
- [ ] Bootstrap / Dark / System 下显示正常
- [ ] 已截图或录屏
```

### 25.3 Settings 页面示例

```text
页面：Settings

职责：
管理主题、模型、运行时、插件权限、工作区偏好。

核心用户：
需要配置 GeoWork 桌面端运行环境的用户。

主要任务流：
1. 用户进入 Settings。
2. 查看当前主题、模型、运行时、插件状态。
3. 修改主题为 Bootstrap / Dark / System。
4. 修改模型或插件配置。
5. 保存后获得明确反馈。
6. 配置失败时显示错误原因。

AntD：
Form、Tabs、Card、Alert、Segmented、Switch、Input.Password、Select、Button、Space、Typography。

禁止：
自研 Toggle、自研 Card、旧 theme selector、旧 glass/parchment/classic 主题。

验收：
1. Bootstrap / Dark / System 可以切换。
2. 刷新后主题选择可以持久化。
3. system 可以跟随系统主题。
4. 不再出现旧 theme class。
5. 不再出现 settings.appearance.theme 的旧主题分支。
```

------

## 26. 主题与 Electron 系统集成

GeoWork 是 Electron 桌面应用，但 UI 主题状态应优先由 renderer 管理，避免 main、preload、renderer 多处维护主题状态导致不一致。

### 26.1 主题职责边界

```text
renderer：
负责 AntD ConfigProvider 主题配置。
负责读取 localStorage 中的 appearance。
负责通过 matchMedia 解析 system。
负责监听系统主题变化。
负责渲染 Bootstrap / Dark 主题。

Electron main：
不维护 UI theme 状态。
不写入 renderer 的主题 class。
不注入旧 data-theme。
不保存旧 glass/parchment/classic 主题。

preload：
默认不参与主题逻辑。
如果后续需要接入 Electron nativeTheme，只暴露只读事件。
不在 preload 中写 DOM、不改 class、不改 data-theme。
```

### 26.2 appearance 存储规则

只允许保存用户选择：

```ts
type Appearance = 'light' | 'dark' | 'system'
```

只允许运行时计算结果：

```ts
type ResolvedAppearance = 'light' | 'dark'
```

存储规则：

```text
localStorage 只保存 appearance。
localStorage 不保存 resolvedAppearance。
resolvedAppearance 必须根据 appearance + 系统主题动态计算。
```

### 26.3 system 模式规则

```text
当 appearance = light：
始终使用 Bootstrap 主题。

当 appearance = dark：
始终使用 Dark 主题。

当 appearance = system：
通过 window.matchMedia('(prefers-color-scheme: dark)') 判断系统主题。
系统为 dark 时使用 Dark。
系统为 light 时使用 Bootstrap。
系统主题变化时自动更新 resolvedAppearance。
```

### 26.4 禁止旧主题系统回流

禁止继续使用：

```text
settings.appearance.theme
auto
data-theme
setGeoWorkTheme()
initGeoWorkTheme()
light-glass
dark-glass
classic-light
classic-dark
parchment
dark-parchment
9-variant CSS
```

原则：

```text
GeoWork Desktop 最终只保留 Bootstrap / Dark / System 三种主题入口。
Bootstrap 和 Dark 是 AntD 主题，不是旧 CSS 主题。
```

------

## 27. 旧视觉清理规则

旧 SCSS、旧 token、旧 theme 文件不能简单混入 AntD 项目。AntD 重构后，CSS 只负责布局，不负责重新设计基础组件视觉。

### 27.1 旧 SCSS 清理分级

旧样式按三类处理：

| 类型       | 处理方式                    | 示例                                                 |
| ---------- | --------------------------- | ---------------------------------------------------- |
| 布局类     | 保留并迁移到 `*.module.css` | grid、flex、height、width、overflow、padding         |
| 视觉类     | 删除，交给 AntD token       | button 颜色、card 阴影、menu 选中背景、tabs 颜色     |
| 业务图形类 | 谨慎保留                    | 地图图层颜色、ECharts palette、Monaco/xterm 容器尺寸 |

### 27.2 允许 CSS 处理的内容

允许 CSS 写：

```text
页面布局
容器尺寸
flex / grid
margin / padding
overflow
滚动区域
地图容器高度
Monaco 容器高度
xterm 容器高度
Electron 拖拽区域
Split panel 尺寸
响应式布局
```

### 27.3 禁止 CSS 处理的内容

禁止 CSS 重写：

```text
Button 颜色
Button hover
Card 背景
Card 阴影
Input 边框
Select 样式
Menu 选中颜色
Tabs 颜色
Table 样式
Tag 颜色
Badge 颜色
Alert 颜色
Modal 样式
Drawer 样式
AntD 圆角
玻璃拟态
渐变背景
发光边框
旧主题 token
```

### 27.4 旧视觉检查命令

可以使用以下命令辅助检查旧视觉是否残留：

```bash
grep -R "#[0-9a-fA-F]\{3,8\}" apps/desktop/src
grep -R "linear-gradient\|box-shadow\|backdrop-filter" apps/desktop/src
grep -R "--gw-\|data-theme\|dark-parchment\|light-glass" apps/desktop/src
```

这些命令不是为了禁止所有颜色，而是为了发现需要人工复查的旧视觉残留。

允许存在的颜色场景：

```text
地图图层颜色
ECharts 图表 palette
代码编辑器语法高亮
终端 ANSI 颜色
业务状态颜色映射
```

禁止存在的颜色场景：

```text
UI 外壳背景色
自定义 Button 颜色
自定义 Card 背景
自定义 Menu 选中态
自定义 Tabs 颜色
玻璃拟态背景
渐变装饰背景
发光边框
```

------

## 28. check-ui-clean 脚本增强

当前 `check-ui-clean.mjs` 不能只扫描 `apps/desktop/src` 和 `package.json`，还需要覆盖构建配置、测试配置、lockfile、HTML 入口等位置。

### 28.1 建议扫描范围

```text
apps/desktop/src
apps/desktop/electron.vite.config.ts
apps/desktop/index.html
apps/desktop/tsconfig.json
apps/desktop/vitest.config.ts
apps/desktop/package.json
package.json
package-lock.json
README.md
README.en.md
```

### 28.2 增强版 check-ui-clean.mjs

路径：

```text
scripts/check-ui-clean.mjs
```

建议内容：

```js
import { execSync } from 'node:child_process'

const searchTargets = [
  'apps/desktop/src',
  'apps/desktop/electron.vite.config.ts',
  'apps/desktop/index.html',
  'apps/desktop/tsconfig.json',
  'apps/desktop/vitest.config.ts',
  'apps/desktop/package.json',
  'package.json',
  'package-lock.json',
  'README.md',
  'README.en.md',
]

const forbidden = [
  '@radix-ui',
  'tailwindcss',
  '@tailwindcss',
  'tailwind-merge',
  'class-variance-authority',
  'components/ui',
  'components/foundation',
  'GwButton',
  'GwCard',
  'GwPanel',
  'GwTabs',
  'GwBadge',
  'GwTooltip',
  'initGeoWorkTheme',
  'setGeoWorkTheme',
  'GeoWorkTheme',
  'QoderWorkCopy',
  '--gw-',
  'var(--gw',
  'bootstrap/dist',
  'light-glass',
  'dark-glass',
  'classic-light',
  'classic-dark',
  'dark-parchment',
  'parchment',
]

let failed = false

for (const keyword of forbidden) {
  try {
    const result = execSync(
      `grep -R "${keyword}" ${searchTargets.join(' ')}`,
      { encoding: 'utf8' },
    )

    if (result.trim()) {
      failed = true
      console.error(`\nForbidden keyword found: ${keyword}`)
      console.error(result)
    }
  } catch {
    // grep exits with 1 when no match is found. That means this keyword is clean.
  }
}

if (failed) {
  process.exit(1)
}

console.log('UI clean check passed.')
```

### 28.3 需要人工复查的关键词

以下关键词不一定绝对禁止，但出现后必须人工复查：

```text
#[0-9a-fA-F]
linear-gradient
box-shadow
backdrop-filter
data-theme
theme-init
scss
sass
eslint-disable
@ts-nocheck
@ts-ignore
```

原则：

```text
自动脚本负责兜底。
人工 review 负责判断业务合理性。
不能只依赖 grep 判断工程质量。
```

------

## 29. CI 与提交规范

GeoWork Desktop 前端迁移应使用 PR / commit checklist 管理，避免本地改动看起来完成，但仓库状态不可复现、不可验证。

### 29.1 Commit / PR 必须说明

每个涉及前端重构的 PR 或 commit 必须包含：

```text
1. 变更范围说明
2. 是否涉及 UI 栈迁移
3. 是否删除旧依赖
4. 是否新增 AntD 组件
5. 是否新增 CSS
6. 自测命令结果
7. Bootstrap / Dark / System 截图或录屏
```

### 29.2 UI Engineering Checklist

```md
## UI Engineering Checklist

- [ ] 没有新增 Radix / Tailwind / CVA / Sass / bootstrap
- [ ] 没有新增基础 UI 封装
- [ ] 页面基础组件来自 AntD
- [ ] CSS 只负责布局
- [ ] 没有旧 theme-init / data-theme / --gw-* token
- [ ] 没有 glass / parchment / classic 旧主题残留
- [ ] 通过 typecheck
- [ ] 通过 lint
- [ ] 通过 test
- [ ] 通过 build
- [ ] 通过 check:ui-clean
- [ ] Bootstrap / Dark / System 主题都检查过
- [ ] 空状态、错误态、加载态已处理
- [ ] 关键页面已截图或录屏
```

### 29.3 README 同步要求

如果项目迁移到 Ant Design v6，以下文件必须同步更新：

```text
README.md
README.en.md
技术文档
apps/desktop/package.json
package-lock.json
```

README 中不能继续写：

```text
Ant Design v5
旧主题系统
Tailwind
Radix
自研设计系统
```

应统一描述为：

```text
Electron + React + TypeScript + Ant Design v6
亮色使用 AntD Bootstrap Theme
暗色使用 AntD Dark Theme
支持 system 跟随系统
```

### 29.4 antd@latest 的版本固定规则

安装时可以使用：

```bash
npm --workspace apps/desktop install antd@latest @ant-design/icons@latest
```

但安装完成后必须以 lockfile 固定具体版本。

验收时检查：

```bash
npm --workspace apps/desktop ls antd
npm --workspace apps/desktop ls @ant-design/icons
```

原则：

```text
文档可以写 antd@latest。
仓库必须通过 package-lock.json 固定可复现版本。
不能让 CI 每次安装出不同的 AntD 版本。
```

------

## 30. 提交后审查顺序

本地清理提交后，按以下顺序审查，避免只看页面截图而忽略工程问题。

### 30.1 审查顺序

```text
1. package.json
   检查旧依赖是否真的删干净。
   检查 antd / @ant-design/icons 是否安装并被 lockfile 固定。

2. electron.vite.config.ts
   检查 Tailwind 插件是否删除。
   检查构建配置是否仍然正常。

3. main.tsx
   检查是否只引入 antd/dist/reset.css 和 styles/layout.css。
   检查是否不再引入 app.css、global.scss、themes.scss、tokens.scss。
   检查是否不再调用 initGeoWorkTheme。

4. AppProviders.tsx
   检查是否已经接入 ConfigProvider。
   检查是否已经接入 AntD App。
   检查是否使用 bootstrapTheme / darkTheme。
   检查是否不再使用旧 settings.appearance.theme、auto、data-theme。

5. src/styles
   检查 tokens.scss / themes.scss / global.scss / app.css 是否删除或清空。
   检查是否只保留 layout.css 和必要 CSS Modules。

6. components
   检查是否还存在基础 UI 封装。
   检查 components/ui、components/foundation 是否删除。
   检查是否还存在 GwButton / GwCard / GwTabs 等旧组件。

7. CSS
   检查是否还有大量写死颜色、阴影、渐变、玻璃拟态。
   检查 UI 外壳是否交给 AntD 主题，而不是 CSS 重写。

8. Settings
   检查 Bootstrap / Dark / System 是否能切换。
   检查刷新后是否持久化。
   检查 system 是否能跟随系统主题变化。

9. AppShell
   检查是否使用 AntD Layout / Header / Sider / Content / Menu。
   检查是否不再使用自研壳样式和旧主题 class。

10. 工程脚本
   检查 typecheck / lint / test / build / check:ui-clean 是否能跑。
```

### 30.2 审查结论格式

每次审查建议按以下格式记录：

```md
## 审查结论

### 通过项

- 

### 阻塞问题

- 

### 非阻塞问题

- 

### 建议优化

- 

### 需要补充截图 / 录屏

- 

### 最终判断

- [ ] 可以合并
- [ ] 修改后再审
- [ ] 暂不建议合并
```

------

## 31. 工程化补充验收标准

GeoWork Desktop 前端迁移完成后，不只要求界面看起来像 Ant Design，还必须满足工程化标准。

### 31.1 依赖层面

```text
apps/desktop/package.json 不再包含 Radix、Tailwind、CVA、tailwind-merge、sass、bootstrap、sonner。
只保留 Ant Design 作为基础 UI 组件体系。
地图、图表、编辑器、终端相关依赖作为业务能力保留。
antd 和 @ant-design/icons 的具体版本必须被 lockfile 固定。
```

### 31.2 构建层面

```text
electron.vite.config.ts 不再使用 Tailwind 插件。
main.tsx 只引入 antd/dist/reset.css 和 styles/layout.css。
不再引入 global.scss、themes.scss、tokens.scss、app.css。
Electron main / preload / renderer 都必须可以构建。
```

### 31.3 代码层面

```text
不允许出现 components/ui。
不允许出现 components/foundation。
不允许出现 GwButton / GwCard / GwTabs。
不允许封装 BaseButton、BaseCard、AppButton 等基础 UI。
业务组件必须以业务命名，例如 LayerTree、RuntimeStatusCard、ModelConfigForm。
页面直接组合 AntD 组件完成 UI。
```

### 31.4 样式层面

```text
CSS Modules 只负责布局、尺寸、滚动、容器。
不通过 CSS 重写 Button、Card、Menu、Tabs、Table、Form、Modal、Drawer 的视觉。
不允许旧主题 token、玻璃拟态、渐变 UI、发光边框回流。
地图图层、ECharts、Monaco、xterm 的业务视觉可以保留，但不能伪装成 UI 设计系统。
```

### 31.5 状态层面

```text
React Query 只管理服务端状态。
Zustand 只管理客户端 UI 状态。
AntD Form 管理表单状态。
appearance 只允许 light / dark / system。
resolvedAppearance 只允许 light / dark。
localStorage 只保存 appearance，不保存 resolvedAppearance。
```

### 31.6 质量门禁

必须通过：

```bash
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
npm run check:ui-clean
```

禁止：

```text
不能为了通过检查而删除测试。
不能关闭 TypeScript strict。
不能新增 // @ts-nocheck。
不能大面积新增 eslint-disable。
不能用 any 掩盖类型问题。
```

### 31.7 产品化验收

```text
每个页面必须具备 loading、error、empty 状态。
按钮文案必须体现具体业务动作。
表格、表单、弹窗、抽屉必须有真实业务语义。
不能只堆 Card / Space / Button。
页面截图应能看出这是 GeoWork 地理空间工作台，而不是通用后台模板。
Bootstrap / Dark / System 下都必须可用。
刷新后主题选择必须持久化。
system 模式必须能跟随系统主题变化。
```

### 31.8 最终验收清单

```md
## Final Acceptance Checklist

- [ ] 使用 Ant Design v6
- [ ] 亮色主题为 AntD Bootstrap Theme
- [ ] 暗色主题为 AntD Dark Theme
- [ ] 支持 system 跟随系统
- [ ] 没有 Radix
- [ ] 没有 Tailwind
- [ ] 没有 CVA
- [ ] 没有 tailwind-merge
- [ ] 没有 sass / scss 主题方案
- [ ] 没有 bootstrap CSS 框架
- [ ] 没有 components/ui
- [ ] 没有 components/foundation
- [ ] 没有 GwButton / GwCard / GwPanel / GwTabs
- [ ] 没有 QoderWorkCopy token
- [ ] 没有旧 theme-init
- [ ] 没有 --gw-* token
- [ ] 没有 data-theme 旧主题切换
- [ ] CSS 只负责布局
- [ ] 基础 UI 全部来自 Ant Design
- [ ] 业务组件命名清晰
- [ ] 页面具有真实 GeoWork 业务语义
- [ ] typecheck 通过
- [ ] lint 通过
- [ ] test 通过
- [ ] build 通过
- [ ] check:ui-clean 通过
- [ ] README.md 已同步
- [ ] README.en.md 已同步
- [ ] package-lock.json 已固定依赖版本
```

## 32. Ant Design 可视化规范在 GeoWork 中的应用

GeoWork 是地理空间桌面工作台，不只是普通后台系统。除了基础 UI 统一使用 Ant Design 之外，地图、图表、任务监控、图层统计、空间分析结果也需要统一的数据可视化规范。

Ant Design 的可视化规范可以作为 GeoWork 的数据表达原则，用于指导：

```text
地图图层分析
任务运行统计
数据资产概览
模型调用统计
插件运行状态
空间分析结果
时序变化趋势
图层属性分布
关系网络展示
报告导出图表
```

本章节用于约束 GeoWork 中所有图表、地图叠加层、统计卡片、分析面板和可视化报告的设计方式。

------

## 33. GeoWork 可视化设计原则

GeoWork 的数据可视化必须遵循以下原则：

### 33.1 准确

数据从原始结果转化为可视化表达时，不能歪曲、误导或遗漏关键信息。

要求：

```text
地图图层颜色不能夸大数据差异。
统计图不能截断坐标轴造成误读。
百分比、数量、面积、距离、时间必须标明单位。
空间分析结果必须明确数据来源和计算口径。
任务状态图不能隐藏失败、取消、超时等异常状态。
```

禁止：

```text
为了视觉好看随意修改数值比例。
为了界面干净隐藏异常数据。
用面积、颜色、亮度夸大微小差异。
没有单位的统计数字。
没有数据来源的分析结果。
```

### 33.2 有效

可视化必须有明确目的，优先表达对用户最有用的信息，避免信息过载。

要求：

```text
Dashboard 只展示核心指标和趋势。
Workspace 优先展示当前工作区相关图层和任务。
Tasks 页面重点展示任务状态、耗时、失败原因和日志入口。
DataCenter 页面重点展示数据类型、大小、坐标系、更新时间、数据质量。
Settings 页面不做复杂图表，只展示必要状态。
```

禁止：

```text
为了显得高级而堆砌图表。
一个页面同时出现过多指标卡。
用复杂图表表达简单数字。
把所有数据都放到 Dashboard。
没有业务目的的装饰性图表。
```

### 33.3 清晰

用户应该能在最短时间内理解图表表达了什么，并知道下一步可以做什么。

要求：

```text
图表标题必须说明主题。
图表副标题或注释必须说明数据来源。
图例必须解释颜色、形状、线型含义。
Tooltip 必须展示关键字段、单位和业务含义。
空状态必须告诉用户下一步操作。
错误状态必须说明失败原因。
```

禁止：

```text
只显示英文 key，不显示业务名称。
图表没有标题。
颜色没有图例说明。
Tooltip 只显示 value，不显示单位。
复杂图表没有筛选和聚焦能力。
```

### 33.4 美

GeoWork 的可视化应当干净、专业、克制，服务于数据理解，而不是制造视觉噪声。

要求：

```text
使用 AntD Bootstrap / Dark 主题作为基础视觉。
图表颜色优先使用稳定、可区分、可解释的色板。
地图图层颜色必须和业务语义一致。
暗色模式下保证地图、图表、文字、图例可读。
避免过度阴影、渐变、发光、玻璃拟态。
```

禁止：

```text
炫彩渐变背景。
无业务含义的发光边框。
过多高饱和颜色。
暗色模式下低对比度文字。
为了“科技感”牺牲可读性。
```

------

## 34. GeoWork 图表类型选择规范

不同数据问题必须选择合适的图表类型，不能为了页面丰富随意使用图表。

### 34.1 时间类数据

适用场景：

```text
任务运行耗时趋势
模型调用次数趋势
图层更新时间变化
数据处理吞吐量变化
空间指标随时间变化
遥感指数时序变化
```

推荐图表：

```text
折线图
面积图
时间轴
时序柱状图
```

示例：

```text
最近 7 天任务运行数量 -> 折线图
NDVI 月度变化 -> 折线图
每日数据导入量 -> 柱状图
任务平均耗时变化 -> 折线图
```

### 34.2 比较类数据

适用场景：

```text
不同数据源文件数量对比
不同任务类型耗时对比
不同图层面积对比
不同模型调用次数对比
不同插件执行次数对比
```

推荐图表：

```text
柱状图
条形图
分组柱状图
气泡图
```

示例：

```text
Raster / Vector / Table 数据数量对比 -> 柱状图
不同分析工具平均耗时对比 -> 条形图
不同区域图层数量对比 -> 分组柱状图
```

### 34.3 分布类数据

适用场景：

```text
DEM 高程值分布
NDVI 数值分布
点位密度分布
任务耗时分布
文件大小分布
属性字段数值分布
```

推荐图表：

```text
直方图
散点图
箱线图
密度图
```

示例：

```text
DEM 高程分布 -> 直方图
点位坐标分布 -> 散点图
任务耗时异常值 -> 箱线图
```

### 34.4 流程类数据

适用场景：

```text
任务执行流程
数据处理管线
模型调用链路
插件执行流程
工作区数据导入到分析再到导出的流程
```

推荐图表：

```text
流程图
漏斗图
步骤流
DAG 图
```

示例：

```text
数据导入 -> 坐标转换 -> 空间分析 -> 报告导出 -> 流程图
任务状态流转 -> 步骤流
模型工具调用链路 -> DAG 图
```

### 34.5 占比类数据

适用场景：

```text
数据类型占比
任务状态占比
图层类型占比
模型调用来源占比
插件启用比例
存储空间占比
```

推荐图表：

```text
环图
饼图
百分比堆叠柱状图
进度条
```

使用限制：

```text
分类数量超过 6 个时，不优先使用饼图。
需要精确比较数值时，不优先使用饼图。
占比差异很小时，优先使用条形图。
```

示例：

```text
任务状态占比 -> 环图
数据类型占比 -> 环图
存储空间占用 -> 进度条
多个工作区数据类型占比 -> 百分比堆叠柱状图
```

### 34.6 地理空间类数据

适用场景：

```text
矢量边界展示
栅格图层展示
点位分布展示
轨迹展示
热力分析
空间聚合
区域统计
遥感指数叠加
```

推荐能力：

```text
MapLibre GL
deck.gl
L7 可作为后续可选增强
ECharts 地图能力可用于报告型图表
```

原则：

```text
地图主工作区继续以 MapLibre GL / deck.gl 为核心。
不要因为 Ant Design 可视化规范而强行替换现有地图能力。
AntV L7 可以作为后续地理空间可视分析增强方案评估。
```

------

## 35. GeoWork 图表组件规范

所有图表和可视化面板必须具备完整的信息结构，不能只显示图形本身。

### 35.1 标题

标题用于说明图表主题。

要求：

```text
标题必须具体。
标题必须包含业务对象。
标题不能只是“统计图”“趋势图”“数据图”。
```

推荐：

```text
最近 7 天任务运行趋势
当前工作区图层类型分布
NDVI 指数月度变化
数据导入耗时对比
模型调用成功率
```

禁止：

```text
图表
统计
数据
趋势
分析结果
```

### 35.2 注释

注释用于说明数据来源、计算方式、时间范围或异常说明。

推荐：

```text
数据来源：当前工作区任务记录，统计范围为最近 7 天。
统计口径：仅包含已完成和失败任务，不包含已取消任务。
单位：面积为平方公里，耗时为秒。
说明：NDVI 结果由 Sentinel-2 波段计算得到。
```

必须添加注释的场景：

```text
空间分析结果
遥感指数结果
模型输出结果
跨时间统计
导出报告中的图表
可能被用户截图传播的图表
```

### 35.3 坐标轴

坐标轴用于定义数据在方向和值上的映射关系。

要求：

```text
必须显示单位。
时间轴必须格式化。
数值轴必须避免过密刻度。
长文本分类轴需要旋转、省略或改用条形图。
不能随意截断坐标轴造成误导。
```

示例：

```text
耗时（秒）
面积（平方公里）
文件大小（MB）
任务数量（个）
时间（YYYY-MM-DD）
```

### 35.4 图例

图例用于解释颜色、形状、线型等视觉元素的含义。

要求：

```text
多系列图表必须有图例。
地图多图层必须有图例。
图例文案必须是业务名称，而不是字段 key。
图例颜色必须和图形颜色一致。
暗色模式下图例必须可读。
```

禁止：

```text
用 layer_1、layer_2 当图例名称。
颜色有含义但没有图例。
图例过多导致图表不可读。
```

### 35.5 标签

标签用于直接标注关键数据。

要求：

```text
只标注关键值，不给所有点都贴标签。
异常值、最大值、最小值、当前选中值可以显示标签。
标签不能遮挡地图和图表主体。
```

适合显示标签的场景：

```text
最大任务耗时
失败任务数量
当前选中区域面积
当前图层要素数量
最高 NDVI 区域
```

### 35.6 Tooltip

Tooltip 用于用户悬停或点击时查看详细信息。

GeoWork 中 Tooltip 必须包含：

```text
业务名称
关键数值
单位
时间或空间范围
状态说明
必要时提供下一步操作
```

示例：

```text
图层：Sentinel-2 NDVI
区域：杭州西湖区
NDVI 平均值：0.62
统计时间：2026-06-29
数据来源：Sentinel-2
```

禁止：

```text
只显示 value: 0.62
只显示 name / count
显示数据库字段名但没有业务解释
Tooltip 内容过长导致遮挡主体
```

------

## 36. GeoWork 可视化布局适应

GeoWork 是桌面端应用，但仍然会面对不同窗口尺寸、不同面板宽度、不同分屏布局的问题。图表和地图面板必须具备布局适应能力。

### 36.1 布局规则

```text
主地图区域优先占据最大空间。
右侧属性面板可以承载图表，但不能挤压地图不可用。
图表容器必须响应父级尺寸变化。
面板收起后，图表需要重新计算尺寸。
小宽度面板内优先使用条形图、列表、指标卡。
复杂图表应进入 Drawer、Modal 或独立详情页。
```

### 36.2 响应式规则

```text
宽屏：地图 + 图层树 + 属性面板 + 任务日志可以并列。
中等宽度：保留地图和关键面板，次级面板折叠。
窄宽度：优先展示当前任务和主要操作，复杂图表进入详情。
```

### 36.3 图表适配要求

```text
图表必须监听容器尺寸变化。
图表不能写死宽度。
图表高度可以由业务场景固定，但必须保证可读。
坐标轴标签过密时需要自动省略、旋转或降采样。
表格和图表并列时，表格不能挤压图表到不可读。
```

### 36.4 地图适配要求

```text
地图容器必须有明确高度。
面板展开、收起、拖拽后地图需要 resize。
地图控件不能遮挡关键图层。
图例、比例尺、缩放控件位置必须稳定。
暗色模式下地图底图、图层、控件需要保持可读。
```

------

## 37. GeoWork 可视化交互规范

可视化不能停留在静态展示层面。GeoWork 的图表、地图、任务面板必须支持用户从概览到聚焦再到详情的分析路径。

### 37.1 交互层次

GeoWork 的可视化交互分为三层：

```text
1. 数据获取：用户先看到整体情况。
2. 信息加工：用户通过筛选、排序、缩放、框选、聚焦理解数据。
3. 知识流转：用户将分析结果导出、保存、生成报告或继续作为任务输入。
```

### 37.2 概览优先

用户进入页面后，应先看到整体状态。

示例：

```text
Dashboard 显示工作区数据量、任务状态、最近运行趋势。
Workspace 显示地图范围、当前图层、选中对象摘要。
Tasks 显示任务总数、运行中数量、失败数量、最近失败原因。
DataCenter 显示数据资产数量、类型分布、最近导入记录。
```

### 37.3 聚焦过滤

用户需要能快速缩小关注范围。

必须支持的交互：

```text
按任务状态筛选
按数据类型筛选
按时间范围筛选
按工作区筛选
按图层类型筛选
按模型或插件筛选
地图框选或点击选中对象
表格排序和搜索
```

### 37.4 按需查看详情

复杂信息不应全部堆在主页面。

推荐方式：

```text
点击地图要素 -> 右侧属性面板显示详情
点击任务 -> Drawer 显示日志和参数
点击图表数据点 -> 过滤对应表格
点击图层 -> 显示样式、字段、元数据
点击失败任务 -> 展示错误原因和重试入口
```

### 37.5 知识流转

分析结果不能只停留在页面展示，应支持后续动作。

推荐动作：

```text
保存为图层
导出 GeoJSON
导出 CSV
导出 PNG
生成分析报告
复制图表数据
作为下一个任务输入
定位到地图区域
```

原则：

```text
GeoWork 的可视化不只是“看数据”，还要帮助用户继续完成空间分析工作流。
```

------

## 38. GeoWork 可视化技术选型

Ant Design 可视化规范可以指导设计，但具体实现需要结合 GeoWork 当前技术栈，不能盲目引入过多库。

### 38.1 当前保留

```text
MapLibre GL：继续作为地图底图和基础地图交互能力。
deck.gl：继续作为大规模空间数据可视化能力。
ECharts：继续作为图表、统计、时序数据展示能力。
Monaco Editor：继续作为代码、JSON、脚本编辑能力。
xterm：继续作为终端和运行日志展示能力。
```

### 38.2 可选评估

以下 AntV 能力可以作为后续增强方向，但不作为本次 AntD 重构的强制依赖：

```text
G2 / G2Plot：用于更统一的统计图表体验。
G6：用于任务依赖图、模型调用链路、插件关系图。
L7：用于地理空间数据可视分析增强。
AntV React：用于 React 场景下快速接入 AntV 图表。
```

### 38.3 不建议立即替换

```text
不要用 L7 立即替换 MapLibre GL / deck.gl。
不要为了统一 AntV 而删除 ECharts。
不要为了“可视化规范”引入过多新依赖。
不要在 AntD 重构阶段同时重写地图引擎。
```

### 38.4 推荐策略

```text
第一阶段：
继续使用 MapLibre GL / deck.gl / ECharts。
先统一可视化设计规范、标题、图例、Tooltip、空状态、交互路径。

第二阶段：
如果出现关系图、任务 DAG、模型调用链路需求，可以评估 G6。

第三阶段：
如果需要更强的地理空间可视分析能力，可以评估 L7 与现有 MapLibre / deck.gl 的关系。

第四阶段：
如果 ECharts 图表风格难以统一，再评估 G2Plot 或 AntV React。
```

------

## 39. GeoWork 可视化页面应用建议

### 39.1 Dashboard

Dashboard 适合展示：

```text
当前工作区数据总量
任务运行状态概览
最近 7 天任务趋势
数据类型占比
最近失败任务
最近导入数据
模型调用状态
```

推荐组件：

```text
Statistic
Card
Progress
Table
Alert
ECharts 折线图
ECharts 环图
```

注意：

```text
Dashboard 不做复杂地图编辑。
Dashboard 不承载完整任务管理。
Dashboard 不堆砌无意义指标。
```

### 39.2 Workspace

Workspace 适合展示：

```text
主地图
图层树
当前选中对象属性
图层样式配置
空间分析结果
任务运行浮层
地图图例
比例尺
```

推荐组件：

```text
AntD Layout
Drawer
Tabs
Tree
Descriptions
Table
Segmented
MapLibre GL
deck.gl
```

注意：

```text
地图区域必须优先。
右侧面板不能过度抢占空间。
图表和属性面板服务于地图分析。
```

### 39.3 DataCenter

DataCenter 适合展示：

```text
数据资产列表
数据类型分布
文件大小分布
坐标系统计
最近导入记录
数据质量状态
```

推荐组件：

```text
Table
Tag
Badge
Progress
Descriptions
Upload
ECharts 柱状图
ECharts 环图
```

注意：

```text
表格必须支持搜索、筛选、排序。
数据类型、坐标系、更新时间必须清晰。
空状态要提示用户导入 GeoJSON、Shapefile 或连接数据源。
```

### 39.4 Tasks

Tasks 适合展示：

```text
任务队列
任务状态分布
任务耗时趋势
失败原因统计
运行日志
任务参数
任务输出结果
```

推荐组件：

```text
Table
Timeline
Progress
Tag
Badge
Drawer
Alert
ECharts 折线图
ECharts 条形图
xterm
```

注意：

```text
失败任务必须显示原因和重试入口。
运行中任务必须有实时反馈。
任务详情不应全部堆在列表里，适合放到 Drawer。
```

### 39.5 AgentStudio

AgentStudio 适合展示：

```text
模型列表
工具调用链路
插件关系
上下文配置
调用成功率
调用耗时
错误分布
```

推荐组件：

```text
Form
Table
Tabs
Descriptions
Alert
ECharts
可选 G6
```

注意：

```text
模型和插件关系如果变复杂，可以评估 G6。
不要用普通 Card 堆砌复杂调用链路。
```

------

## 40. GeoWork 图表验收标准

每一个图表上线前必须满足以下要求：

```md
## Chart Acceptance Checklist

- [ ] 图表标题明确说明业务主题
- [ ] 图表有必要的数据来源或统计口径说明
- [ ] 坐标轴有单位
- [ ] 图例文案是业务名称，不是字段 key
- [ ] Tooltip 展示业务名称、数值、单位和状态
- [ ] loading 状态已处理
- [ ] error 状态已处理
- [ ] empty 状态已处理，并提供下一步操作
- [ ] 暗色模式下可读
- [ ] Bootstrap 主题下可读
- [ ] 窗口尺寸变化后布局正常
- [ ] 图表颜色没有和业务状态冲突
- [ ] 没有为了装饰而添加无意义图表
- [ ] 用户能从图表继续执行下一步业务动作
```

------

## 41. GeoWork 地图可视化验收标准

每一个地图相关功能上线前必须满足以下要求：

```md
## Map Visualization Acceptance Checklist

- [ ] 地图容器尺寸稳定
- [ ] 面板拖拽、展开、收起后地图可以正确 resize
- [ ] 图层颜色具有业务含义
- [ ] 图层图例清晰
- [ ] Tooltip / Popup 展示字段名称、数值、单位和业务解释
- [ ] 选中对象有明确反馈
- [ ] 空图层状态有提示
- [ ] 图层加载失败有错误提示
- [ ] 大数据量图层不会阻塞 UI
- [ ] 暗色模式下地图控件和图例可读
- [ ] Bootstrap 主题下地图控件和图例可读
- [ ] 地图操作可以和右侧属性面板联动
- [ ] 分析结果可以保存、导出或继续作为任务输入
```

## 42. Ant Design 图形化规范在 GeoWork 中的应用

GeoWork Desktop 不应只依赖表格、按钮、Card 和地图来表达产品状态。对于空状态、异常状态、任务完成、首次引导、报告导出等场景，可以参考 Ant Design 图形化规范建立一套克制、统一、可复用的图形化表达方式。

图形化不是新的 UI 框架，也不是装饰性插画堆砌。它的作用是：

```text
1. 降低用户理解成本。
2. 增强 GeoWork 的产品识别度。
3. 让空状态、异常状态、完成状态更有业务语义。
4. 避免页面只有“暂无数据”“加载失败”这类机械提示。
5. 让桌面端产品更像真实工程产品，而不是临时拼装页面。
```

GeoWork 的图形化资产必须服务于地理空间工作流，而不是制造无意义的视觉装饰。

------

## 43. GeoWork 图形化使用场景

GeoWork 中适合使用图形化表达的场景包括：

```text
空状态
异常状态
成功状态
首次使用引导
数据导入引导
地图图层为空
任务队列为空
模型未配置
插件未启用
报告导出完成
权限或运行时缺失
离线或本地服务未启动
```

### 43.1 空状态

适合使用图形化的空状态：

```text
当前工作区没有图层
当前没有运行任务
当前没有导入数据
当前没有模型配置
当前没有启用插件
当前搜索没有结果
当前没有分析报告
```

示例文案：

```text
暂无图层。请导入 GeoJSON、Shapefile 或连接数据源后开始空间分析。

暂无运行任务。你可以从工作台选择分析工具，创建一个新的分析任务。

暂无模型配置。请添加本地模型或连接远程模型服务后使用 AgentStudio。

暂无插件。请启用 MCP 工具或安装插件后扩展 GeoWork 能力。
```

### 43.2 异常状态

适合使用图形化的异常状态：

```text
地图加载失败
图层解析失败
任务运行失败
模型服务连接失败
本地运行时未启动
文件格式不支持
权限不足
工作区损坏或无法读取
```

示例文案：

```text
地图加载失败。请检查网络、底图服务或本地地图缓存。

图层解析失败。请确认文件格式、坐标系和字段结构是否正确。

任务运行失败。请查看运行日志，确认输入数据和参数配置。

模型服务连接失败。请检查服务地址、API Key 和本地网络状态。
```

### 43.3 成功状态

适合使用图形化的成功状态：

```text
数据导入完成
分析任务完成
报告导出成功
图层发布成功
模型配置保存成功
插件启用成功
```

示例文案：

```text
数据导入完成。你可以在图层树中查看数据，并开始空间分析。

任务运行完成。分析结果已生成，可以保存为图层或导出报告。

报告导出成功。你可以打开报告文件，或继续生成新的分析结果。
```

------

## 44. GeoWork 图形化风格规则

GeoWork 的图形化风格必须保持专业、克制、清晰，不能使用过度卡通化、过度夸张、过度营销化的插画。

### 44.1 风格关键词

推荐风格：

```text
专业
清晰
克制
科技感
空间感
工程感
地理信息感
数据分析感
桌面工具感
```

不推荐风格：

```text
过度可爱
过度卡通
过度营销
过度拟人
夸张表情
复杂人物插画
大面积炫彩渐变
与 GeoWork 业务无关的装饰
```

### 44.2 图形元素建议

GeoWork 可复用的图形元素包括：

```text
地图网格
经纬线
图层叠片
点线面要素
卫星影像块
等高线
数据文件
任务节点
运行日志
空间分析结果
模型节点
插件节点
报告文档
坐标轴
定位标记
```

这些元素比通用人物插画更适合 GeoWork，因为它们能直接传达地理空间产品语义。

### 44.3 颜色规则

图形化颜色必须服从 GeoWork 的 AntD 主题体系。

```text
亮色模式：基于 AntD Bootstrap Theme。
暗色模式：基于 AntD Dark Theme。
图形化资产可以使用更灵活的颜色，但不能破坏整体主题一致性。
图形颜色不能和业务状态颜色冲突。
```

禁止：

```text
图形化资产自己定义一套 UI 主题色。
图形色彩覆盖 AntD token。
空状态插画使用过高饱和度颜色抢占注意力。
暗色模式下插画亮度过高导致刺眼。
```

### 44.4 尺寸规则

图形化资产尺寸应按场景控制：

| 场景       | 建议尺寸       | 说明             |
| ---------- | -------------- | ---------------- |
| 表格空状态 | 96px - 160px   | 不遮挡表格主体   |
| 页面空状态 | 160px - 240px  | 作为页面核心提示 |
| 异常页     | 200px - 320px  | 可承载更强提示   |
| 成功页     | 160px - 240px  | 不宜过度庆祝     |
| 首次引导   | 240px - 360px  | 可更完整表达场景 |
| 报告封面   | 按导出模板控制 | 不影响报告专业性 |

------

## 45. GeoWork 图形化资产管理

为了避免后期风格混乱，图形化资产必须工程化管理。

### 45.1 推荐目录

```text
apps/desktop/src/assets/illustrations/
  empty/
    empty-layer.svg
    empty-task.svg
    empty-data.svg
    empty-model.svg
    empty-plugin.svg

  error/
    map-load-error.svg
    layer-parse-error.svg
    runtime-error.svg
    model-connect-error.svg

  success/
    import-success.svg
    task-success.svg
    report-success.svg

  onboarding/
    workspace-intro.svg
    data-import-intro.svg
    agentstudio-intro.svg
```

### 45.2 命名规则

图形化资产必须使用业务命名。

允许：

```text
empty-layer.svg
empty-task.svg
map-load-error.svg
model-connect-error.svg
task-success.svg
report-success.svg
```

禁止：

```text
image1.svg
empty.svg
illustration.svg
banner.svg
cute-error.svg
ai-empty.svg
```

### 45.3 使用规则

```text
图形化资产只用于状态表达、引导表达和结果表达。
不用于装饰普通 Card。
不用于填满页面空白。
不用于替代真实数据展示。
不用于制造“科技感”背景。
```

### 45.4 组件封装建议

允许封装业务状态组件，但不能封装基础 UI 组件。

允许：

```text
EmptyLayerState
EmptyTaskState
RuntimeErrorState
ModelConnectErrorState
TaskSuccessState
ReportExportSuccessState
```

禁止：

```text
BaseEmpty
GwEmpty
FancyEmpty
IllustrationCard
```

示例结构：

```tsx
import { Button, Empty, Typography } from 'antd'

interface EmptyLayerStateProps {
  onImportData: () => void
}

export function EmptyLayerState({ onImportData }: EmptyLayerStateProps) {
  return (
    <Empty
      image="/assets/illustrations/empty/empty-layer.svg"
      description={
        <Typography.Text type="secondary">
          暂无图层。请导入 GeoJSON、Shapefile 或连接数据源后开始空间分析。
        </Typography.Text>
      }
    >
      <Button type="primary" onClick={onImportData}>
        导入空间数据
      </Button>
    </Empty>
  )
}
```

------

## 46. 图形化验收标准

每个图形化状态上线前必须满足以下要求：

```md
## Illustration Acceptance Checklist

- [ ] 图形化资产有明确业务场景
- [ ] 图形元素与 GeoWork 地理空间业务相关
- [ ] 没有使用无意义装饰插画
- [ ] 空状态说明了当前没有什么
- [ ] 空状态说明了用户下一步可以做什么
- [ ] 异常状态说明了失败原因或排查方向
- [ ] 成功状态说明了后续动作
- [ ] 亮色主题下显示正常
- [ ] 暗色主题下显示正常
- [ ] 图形颜色没有破坏 AntD 主题
- [ ] 图形尺寸没有挤压主要内容
- [ ] SVG 文件命名清晰
- [ ] 图形资产放在统一目录
```

------

## 47. Ant Design 动效规范在 GeoWork 中的应用

GeoWork Desktop 可以使用动效，但必须克制。动效的目标不是让页面“炫”，而是帮助用户理解状态变化、空间关系和操作反馈。

GeoWork 的动效原则：

```text
1. 自然：动效要符合用户对空间和状态变化的直觉。
2. 高效：动效时间要短，不能拖慢桌面端操作效率。
3. 克制：只在有意义的地方使用动效，不做装饰性动画。
```

动效应该帮助用户理解：

```text
面板从哪里出现
任务状态如何变化
地图对象是否被选中
数据是否正在加载
操作是否已经成功
错误是否需要处理
页面层级是否发生变化
```

------

## 48. GeoWork 动效使用场景

### 48.1 推荐使用动效的场景

```text
侧边栏展开 / 收起
右侧属性面板打开 / 关闭
Drawer 打开 / 关闭
Modal 打开 / 关闭
任务状态从等待中变为运行中
任务进度更新
地图要素选中反馈
图层显隐切换
表格行新增 / 删除后的轻微反馈
加载状态切换
空状态进入
错误提示出现
主题切换
```

### 48.2 不推荐使用动效的场景

```text
地图大面积持续动画背景
普通 Card 悬浮夸张放大
按钮点击后复杂特效
表格每一行循环动画
图标持续旋转但没有加载含义
为了科技感添加的粒子动画
页面进入时所有模块依次飞入
菜单图标反复跳动
```

### 48.3 禁止使用动效的场景

```text
影响地图拖拽、缩放、选择性能的动画
影响任务日志实时刷新的动画
影响 Monaco 编辑器输入性能的动画
影响 xterm 终端输出性能的动画
造成用户误判任务状态的动画
无法关闭的循环动画
暗色模式下高亮闪烁动画
```

------

## 49. GeoWork 动效时长规范

动效时间必须短、稳定、可预期。

| 场景                | 建议时长      | 说明                 |
| ------------------- | ------------- | -------------------- |
| Button / 小控件反馈 | 80ms - 120ms  | 只做轻微反馈         |
| Tooltip / Popover   | 100ms - 160ms | 快速出现，不打断操作 |
| Dropdown / Menu     | 120ms - 180ms | 保持轻快             |
| Drawer / Side Panel | 180ms - 240ms | 表达空间层级         |
| Modal               | 160ms - 220ms | 不拖慢确认流程       |
| 页面级切换          | 200ms - 280ms | 尽量少用             |
| 主题切换            | 160ms - 240ms | 避免闪屏             |
| 地图选中反馈        | 80ms - 160ms  | 只突出选中对象       |

原则：

```text
桌面端工具优先效率。
动效不应超过用户完成任务的节奏。
出场动效应比入场动效更快。
重复高频操作的动效必须更短。
```

------

## 50. GeoWork 动效实现规范

### 50.1 优先使用 AntD 内置动效

AntD 的 Modal、Drawer、Dropdown、Tooltip、Popover、Message、Notification 等组件已经包含基础动效。GeoWork 不应重复实现这些基础组件动效。

推荐：

```text
使用 AntD Modal 动效。
使用 AntD Drawer 动效。
使用 AntD Dropdown 动效。
使用 AntD Tooltip / Popover 动效。
使用 AntD message / notification 反馈。
```

不推荐：

```text
自己重写 Modal 动效。
自己重写 Drawer 动效。
自己写 Toast 动画系统。
给 AntD Button 添加复杂点击动画。
```

### 50.2 CSS transition 只用于布局状态

允许 CSS transition 处理：

```text
侧栏宽度变化
面板显隐
工具栏折叠
选中态轻微过渡
主题切换时的背景和文字过渡
```

禁止 CSS animation 处理：

```text
循环装饰动画
大面积背景动画
持续闪烁动画
复杂路径动画
地图容器整体动画
编辑器内容动画
终端输出动画
```

### 50.3 不新增重型动效依赖

本次 AntD 重构阶段不建议新增重型动效库。

不建议新增：

```text
framer-motion
gsap
lottie-web
animejs
复杂粒子动画库
```

原则：

```text
先使用 AntD 内置动效和少量 CSS transition。
只有明确业务需求时，才评估额外动效库。
不能为了“高级感”增加依赖。
```

------

## 51. prefers-reduced-motion 支持

GeoWork 应尊重用户系统的减少动态效果设置。

### 51.1 CSS 规则

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 51.2 使用原则

```text
如果用户系统开启减少动态效果，GeoWork 应尽量关闭非必要动画。
必要反馈可以保留，但应缩短到接近即时。
地图、终端、编辑器相关动画尤其要克制。
```

------

## 52. GeoWork 具体动效设计建议

### 52.1 AppShell

适合动效：

```text
Sider 展开 / 收起
当前导航项切换
顶部状态 Badge 更新
运行时状态从离线变为在线
```

不适合动效：

```text
导航菜单项逐个飞入
Logo 持续动画
Header 背景渐变动画
```

### 52.2 Workspace

适合动效：

```text
右侧属性面板打开 / 关闭
图层树节点展开 / 折叠
地图要素选中高亮
图层可见性切换
分析结果面板出现
```

不适合动效：

```text
地图整体缩放动画过度包装
图层列表持续闪烁
右侧面板弹跳动画
地图背景粒子动画
```

### 52.3 Tasks

适合动效：

```text
任务进度条更新
任务状态 Tag 变化
失败任务 Alert 出现
任务详情 Drawer 打开
新任务加入队列时轻微高亮
```

不适合动效：

```text
所有任务行持续动画
运行日志滚动动画过度处理
失败状态使用闪烁红色动画
```

### 52.4 DataCenter

适合动效：

```text
数据导入进度
文件上传状态变化
表格筛选结果更新
数据详情 Drawer 打开
```

不适合动效：

```text
表格行大幅移动动画
文件卡片悬浮过度放大
上传完成烟花动画
```

### 52.5 AgentStudio

适合动效：

```text
模型连接状态变化
插件启用 / 禁用反馈
工具调用链路高亮
配置保存成功提示
```

不适合动效：

```text
模型节点持续脉冲动画
插件卡片循环发光
调用链路复杂粒子流动
```

------

## 53. 动效性能规范

GeoWork 是桌面端生产力工具，动效不能影响地图、编辑器、终端和任务运行体验。

### 53.1 性能要求

```text
动效不能导致明显掉帧。
动效不能阻塞地图拖拽和缩放。
动效不能影响 Monaco 输入。
动效不能影响 xterm 日志输出。
动效不能影响任务状态实时刷新。
动效不能导致页面布局频繁重排。
```

### 53.2 推荐动画属性

优先使用：

```text
transform
opacity
```

谨慎使用：

```text
width
height
left
top
box-shadow
filter
backdrop-filter
```

禁止滥用：

```text
大面积 blur
大面积 box-shadow 动画
大面积 backdrop-filter
复杂 clip-path 动画
频繁触发布局重排的动画
```

### 53.3 地图相关性能规则

```text
地图容器不要做复杂入场动画。
图层显隐应交给地图引擎控制。
地图选中反馈应只影响选中对象，不影响整个地图容器。
大数据量图层不要使用 DOM 动画逐个渲染。
```

------

## 54. 动效验收标准

每一个新增动效上线前必须满足以下要求：

```md
## Motion Acceptance Checklist

- [ ] 动效有明确业务目的
- [ ] 动效帮助用户理解状态变化或空间层级
- [ ] 动效不是纯装饰
- [ ] 动效时长符合桌面端效率要求
- [ ] 没有影响地图拖拽、缩放和选中
- [ ] 没有影响 Monaco 编辑器输入
- [ ] 没有影响 xterm 终端输出
- [ ] 没有影响任务日志刷新
- [ ] 支持 prefers-reduced-motion
- [ ] 暗色模式下没有刺眼闪烁
- [ ] 没有新增不必要的动效依赖
- [ ] 没有循环播放的无意义动画
- [ ] 低性能设备下仍然流畅
```

------

## 55. 图形化与动效最终原则

GeoWork 可以使用图形化和动效，但必须坚持以下原则：

```text
图形化用于表达状态，不用于填充空白。
动效用于解释变化，不用于制造热闹。
插画必须贴合地理空间业务。
动效必须贴合桌面工具效率。
所有视觉表达都要服务 GeoWork 的工作流。
```

最终判断标准：

```text
用户看到图形化时，应该更清楚当前状态和下一步操作。
用户看到动效时，应该更清楚界面发生了什么变化。
如果图形化或动效没有帮助用户完成任务，就不应该加入。
```
