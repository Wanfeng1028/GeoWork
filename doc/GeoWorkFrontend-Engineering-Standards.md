# GeoWork 前端工程规范

> **文档路径**：`doc/GeoWorkFrontend-Engineering-Standards.md`
> **关联文档**：`doc/GeoWorkFrontend-Design-System.md`（视觉宪法）/ `doc/GeoWorkFrontend-Design-System-Detailed.md`（施工图）/ `AGENT.md`（全局约束）
> **适用对象**：参与 GeoWork 前端开发的工程师、AI 编程助手
> **文档定位**：设计系统管"长什么样"，本文档管"代码怎么写"
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：状态管理、数据层、测试、性能、响应式、表单、通知、快捷键、Electron UI、组件文档、Token 管线、国际化 |

---

## 1. 状态管理规范

### 1.1 技术选型

项目使用 Zustand v5 作为唯一的状态管理库。禁止引入 Redux、MobX、Jotai、Recoil 等其他方案。

### 1.2 Store 组织

```
src/shared/stores/
├── appearanceStore.ts      # 外观 / 主题
├── modelProviderStore.ts   # 模型 Provider
└── taskSidebarStore.ts     # 侧栏任务
```

- 每个 Store 一个文件，文件名以 `Store` 结尾
- Store 只放**跨组件共享**的状态；页面内部状态用 `useState` / `useReducer`
- Store 之间**禁止互相引用**；如需组合，在组件层合并

### 1.3 命名规则

| 类别 | 规则 | 示例 |
|---|---|---|
| Store 文件 | `camelCase + Store.ts` | `taskSidebarStore.ts` |
| Store 内 state | `camelCase` 名词 | `tasks`, `selectedWorkspace` |
| Store 内 action | `动词 + 名词` | `addTask`, `removeSidebarTask` |
| TypeScript 类型 | `I + PascalCase + State` | `ITaskSidebarState` |

### 1.4 localStorage 持久化

当前项目**不使用** `zustand/middleware` 的 `persist`，而是手动 `localStorage.getItem` / `setItem` + `try/catch` 兜底。保持此模式。

- key 必须带 `geowork.` 前缀（AGENT.md §11.3）
- key 必须带版本号后缀（如 `.v1`），方便后续迁移
- 读取失败静默回退默认值，不抛异常
- 跨组件同步用 `CustomEvent`（如 `geowork:sidebar-tasks-updated`），不引入全局状态轮询

### 1.5 何时建 Store vs useState

| 场景 | 选择 |
|---|---|
| 只有一个组件用 | `useState` |
| 父子组件共享 | `useState` + props 下传 |
| 跨路由 / 跨面板共享 | Zustand Store |
| 需要持久化到 localStorage | Zustand Store + 手动 persist |

### 1.6 异步状态三态模式

Store 中的异步数据必须管理 `loading` / `error` / `data` 三个状态：

```typescript
interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}
```

- 请求开始时：`loading = true, error = null`
- 请求成功时：`data = result, loading = false`
- 请求失败时：`error = message, loading = false`
- 禁止只有 `data` 没有 `loading` 和 `error`（无法区分"还没加载"和"加载完是空"）

### 1.7 竞态条件处理

用户快速切换任务时，旧请求可能在新请求之后返回，导致状态被旧数据覆盖。

**规则**：

- 使用 `AbortController` 取消旧请求——新请求发出时，先 abort 上一个
- 如果无法 abort（如 WebSocket），用请求序号对比——只有最新序号的响应才更新状态

```typescript
// 示例：请求序号防竞态
let requestId = 0

async function fetchConversation(convId: string) {
  const thisRequestId = ++requestId
  const data = await apiGet(`/api/conversations/${convId}`)
  // 只有最新请求才更新状态
  if (thisRequestId === requestId) {
    set({ messages: data.messages, loading: false })
  }
}
```

### 1.8 乐观更新

对于用户操作（如删除任务、标记完成），可以先更新 UI 再发请求，失败时回滚：

```typescript
function deleteTask(taskId: string) {
  const previousTasks = get().tasks
  // 乐观更新
  set({ tasks: previousTasks.filter(t => t.id !== taskId) })
  
  apiDelete(`/api/tasks/${taskId}`).catch(() => {
    // 失败回滚
    set({ tasks: previousTasks })
    message.error('删除失败，已恢复')
  })
}
```

**规则**：

- 乐观更新只用于**高置信度**的操作（删除、标记完成）
- 创建操作不用乐观更新（服务端可能生成不同的 ID / 时间戳）
- 回滚时必须通知用户

---

## 2. 数据层 / API 适配层

### 2.1 架构约束

```
React 组件 → api/client.ts → Go Core (:8765)
                                  ↓
                            Python Worker (:8766)  [组件禁止直连]
```

- 前端**只与 Go Core 通信**，禁止直接调用 Python Worker
- 所有 HTTP 请求走 `src/shared/api/client.ts` 导出的 `apiGet / apiPost / apiPut / apiDelete / apiPatch`
- 禁止在组件内直接 `fetch()` 或 `axios()`

### 2.2 SSE 流式消费

当前 SSE 通过原生 `EventSource` 消费。规范：

- 统一使用 `createSSEStream(path, onMessage)` 创建，禁止组件内直接 `new EventSource()`
- 必须在组件卸载时调用 `eventSource.close()`（在 `useEffect` 的 cleanup 里）
- 必须用 `AbortController` 支持中断
- 新任务开始时，旧 SSE 连接必须先关闭再建新连接，防止状态串线

### 2.3 WebSocket 双向控制信令

> 完整协议规范见 `doc/GeoWork-Communication-Protocol.md`

SSE 负责只读事件流，WebSocket 负责双向控制信令（审批、abort、终端 I/O）。两者并存，不互相替代。

**连接规范**：

- 连接地址：`ws://127.0.0.1:{port}/api/ws?runId={runId}`
- 消息格式：JSON-RPC 2.0（JSONL 编码，每行一个 JSON 对象）
- 心跳：客户端每 30s 发 `ping` 通知
- 断线重连：指数退避 1s → 2s → 4s → 8s → 最大 30s

**文件组织**：

- `src/shared/api/wsClient.ts` — WebSocket 客户端（连接/重连/心跳/消息路由）
- `src/shared/api/wsProtocol.ts` — JSON-RPC 类型定义 + Method 常量
- 禁止在组件内直接 `new WebSocket()`，必须通过 `WsClient` 类

**使用规则**：

- WebSocket 只传控制信令（approval、abort、terminal），不传事件流
- 组件卸载时必须调用 `wsClient.disconnect()`
- 审批请求通过 `wsClient.on('approval/request', handler)` 监听，通过 `wsClient.respond(id, result)` 回复
- 禁止在 WebSocket 上发送大量数据（如文件内容），大文件走 HTTP

### 2.4 错误处理

- API 响应非 ok 时，`client.ts` 统一抛 `Error(API Error: ${status})`
- 组件层用 `try/catch` 捕获后展示用户可读的错误信息（遵循设计系统 §8.3 报错规范）
- 禁止 `catch(e) {}` 吞错误
- 禁止在组件里直接 `console.error` 不展示——用户必须看到发生了什么

### 2.5 Mock 与真实 API 切换

- 当前无 Mock 层。如需 Mock，在 `src/shared/api/` 下新建 `mock/` 目录
- 通过 `import.meta.env.VITE_USE_MOCK === 'true'` 切换
- Mock 数据不进入 production build

---

## 3. 测试策略

### 3.1 工具链

| 层级 | 工具 | 配置 |
|---|---|---|
| 单元测试 | Vitest + jsdom | `vitest.config.ts` |
| 组件测试 | Vitest + @testing-library/react | 同上 |
| E2E 测试 | 待定（Playwright 候选） | 暂无配置 |

### 3.2 测试文件组织

```
src/__tests__/          # 共享测试 + 工具层测试
src/pages/X/__tests__/  # 页面级测试（与页面同目录）
src/shared/**/__tests__/ # Store / Hook / 工具函数测试
```

- 测试文件名：`*.test.ts` / `*.test.tsx`
- 每个 Store 必须有对应的 `.test.ts`
- 每个 Hook 必须有对应的 `.test.ts`

### 3.3 覆盖要求

| 层级 | 要求 |
|---|---|
| Store（状态逻辑） | **必须**有单元测试 |
| Hook / 工具函数 | **必须**有单元测试 |
| 页面组件 | 至少 1 个 smoke test（能渲染不报错） |
| 纯展示组件 | 不强制，鼓励写 |

### 3.4 禁止

- 禁止测试里写死 API 响应——用 `vi.mock()` 模拟 `client.ts`
- 禁止测试依赖网络请求或真实 Electron IPC
- 禁止 `@ts-ignore` 绕过测试里的类型错误

---

## 4. 性能预算

### 4.1 Bundle

| 指标 | 上限 | 说明 |
|---|---|---|
| 首屏 JS（gzipped） | 500KB | Electron 本地加载，但仍需控制 |
| 单页 chunk | 200KB | 超过则必须代码分割 |
| 第三方库新增 | 需审批 | 见 AGENT.md §9 依赖规则 |

### 4.2 代码分割

- 路由级 `React.lazy()` + `<Suspense>`：**推荐但非强制**（当前全量导入，后续按页面复杂度逐步拆分）
- 重型第三方库（如地图、图表）：**必须** `React.lazy()` 动态导入
- 骨架屏作为 `Suspense` 的 `fallback`，遵循设计系统 §8.1

### 4.3 大列表

- 超过 100 条数据的列表：**必须**使用虚拟滚动（推荐 `@tanstack/react-virtual`，待引入）
- 当前无虚拟滚动实现，作为 TODO 跟踪

### 4.4 地图 / 画布

- 地图渲染帧率不低于 30fps
- 大量 GeoJSON 要素时须做简化（Douglas-Peucker）或分层加载
- 内存占用超过 200MB 时须主动释放

---

## 5. 响应式 / 窗口尺寸

### 5.1 最小窗口

Electron `BrowserWindow` 配置：

```
minWidth: 960
minHeight: 640
```

所有 UI 必须在 960×640 下可用。

### 5.2 断点体系

| 断点名 | 值 | 用途 |
|---|---|---|
| `sm` | 960px | 最小窗口，单栏布局降级 |
| `md` | 1280px | 默认窗口，标准布局 |
| `lg` | 1920px | 大屏，宽松布局 |

- CSS 中使用 `@media (min-width: XXXpx)`，不使用 max-width
- 断点值必须从设计系统 §7.2 的刻度值中选取，禁止自创断点
- 当前代码中 640px / 720px 断点在 960px 最小窗口下**永远不会触发**，应清理或上移到 960px

### 5.3 右面板降级

- 窗口宽度 < 1280px 时，右侧工作面板建议自动收起（TODO，当前未实现）
- 收起后用户仍可手动展开

---

## 6. 表单验证 UX

### 6.1 验证触发时机

| 场景 | 时机 |
|---|---|
| 必填字段 | `onBlur` 时首次校验 |
| 格式校验（邮箱/URL） | `onBlur` 时校验 |
| 长度校验 | `onChange` 实时校验（带 debounce 300ms） |
| 提交时 | 全量校验，不通过的字段标红 |

### 6.2 错误文案模板

- 格式：`"请 + 动词 + 名词"` 或 `"名词 + 不能 + 条件"`
- 示例：`"请输入任务名称"` / `"名称不能为空"` / `"端口号必须在 1-65535 之间"`
- 禁止技术术语：不写 `"Invalid format"` / `"null reference"`

### 6.3 提交按钮状态

- 校验不通过时：按钮 `disabled`，`tooltip` 提示"请修正上方错误"
- 提交中：按钮 `loading`，文案不变
- 提交成功：关闭表单或跳转，`message.success` 提示
- 提交失败：`message.error` 提示，保留表单内容

---

## 7. 通知 / Toast 系统

### 7.1 映射关系

统一使用 Ant Design 的 `message` API（通过 `App.useApp()` 获取），禁止直接调 `notification` 或自造 Toast。

| 级别 | API | 时长 | 用途 |
|---|---|---|---|
| 成功 | `message.success()` | 3s | 操作完成 |
| 信息 | `message.info()` | 3s | 一般提示 |
| 警告 | `message.warning()` | 5s | 需注意但不阻塞 |
| 错误 | `message.error()` | 8s | 操作失败 |

### 7.2 规则

- 同时只显示 1 条（`maxCount: 1`），新消息替换旧消息
- 位置：顶部居中（antd 默认）
- 禁止用 Toast 展示需要用户操作的信息（用 Modal）
- `App.useApp()` 返回的 `message` 引用每次渲染变化，需用 `useRef` 保存（避免 effect 重跑）

---

## 8. 键盘快捷键

### 8.1 全局快捷键表

| 快捷键 | 功能 | 作用域 | 状态 |
|---|---|---|---|
| `Ctrl+N` | 新建任务 | 全局 | 已注册 |
| `Ctrl+K` | 全局搜索 | 全局 | 已注册 |
| `Ctrl+,` | 打开设置 | 全局 | 已注册 |
| `Ctrl+\` | 切换右面板 | 全局 | 已注册 |
| `Enter` | 发送消息 | 输入框 | 已实现 |
| `Shift+Enter` | 换行 | 输入框 | 已实现 |

### 8.2 规范

- 快捷键绑定统一在 `electron/local/shortcuts.ts`（全局）或页面级 `useEffect`（局部）
- 禁止在多个地方重复绑定同一快捷键
- 快捷键冲突时：Electron 全局 > 页面级 > 组件级
- 所有快捷键必须在 `ShortcutsModal.tsx` 中登记，保持文档与实现一致
- 新增快捷键时必须同步更新 `ShortcutsModal.tsx`

---

## 9. Electron 特有 UI

### 9.1 标题栏

- 隐藏原生标题栏（`titleBarStyle: 'hidden'`）
- 自定义 `TitleBar.tsx` 渲染拖拽区 + 工具栏 + 窗口控制按钮
- 标题栏高度 36px，`padding-top: 36px` 透亮色
- 暗色模式 overlay `#141414`，亮色模式 `#F7FBFD`

### 9.2 窗口控制按钮

- 最小化 / 最大化 / 关闭由 `TitleBar.tsx` 右侧渲染
- 通过 IPC `window:minimize` / `window:maximize` / `window:close` 调用

### 9.3 系统托盘

- 托盘图标由 `electron/local/tray.ts` 管理
- 托盘菜单：显示 / 隐藏窗口、新建任务、退出

### 9.4 文件拖入

- 支持拖拽文件到窗口导入（通过 IPC `file:import` 处理）
- 拖入时显示半透明遮罩 + "释放以导入" 提示
- 禁止拖入导致整个窗口跳转到文件路径（`e.preventDefault()`）

---

## 10. 组件文档

### 10.1 共享组件

`src/shared/components/` 下的每个组件必须有 JSDoc 注释：

```typescript
/**
 * 胶囊按钮 —— 全站主按钮的默认形态
 *
 * @param variant - 按钮变体：'primary' | 'default' | 'ghost'
 * @param size - 尺寸：'large' | 'middle' | 'small'
 * @example
 * <CapsuleButton variant="primary" size="middle">提交</CapsuleButton>
 */
```

### 10.2 页面组件

页面级组件不强制 JSDoc，但必须在文件顶部注释说明页面用途和对应路由。

### 10.3 Storybook

当前不使用 Storybook。组件视觉验证通过页面截图 + 设计系统验收清单完成。

---

## 11. 设计 Token 交付管线

### 11.1 当前状态

设计 Token 定义在 `doc/GeoWorkFrontend-Design-System.md` 的 Markdown 表格里，代码中通过 `src/app/themes/*.ts` 手动同步。

### 11.2 规则

- `themes/*.ts` 是代码侧的 **single source of truth**
- 设计系统文档是规范侧的 **single source of truth**
- 两者必须手动保持同步；修改任一处时，必须在汇报模板的"doc 同步检查"项中标注
- 未来可引入 `tokens.json` 作为自动化管线的中间层（TODO）

### 11.3 色值使用

- 代码中**禁止硬编码 hex 色值**（stylelint `color-no-hex` 规则）
- 必须通过 `token.colorXxx` 或 `theme.useToken()` 获取
- 例外：`themes/*.ts` 定义 token 本身时可用 hex

---

## 12. 国际化立场

### 12.1 当前决策

**不做 i18n。** 全部文案硬编码中文。Ant Design 使用 `zhCN` locale。

### 12.2 预留规则

虽然不做 i18n，但遵循以下预留规则以便未来扩展：

- 用户可见文案集中在组件的 JSX 返回值中，不散落在逻辑代码里
- 错误消息模板（§6.2）使用中文自然语言，不拼接变量名
- 日期格式使用 `Intl.DateTimeFormat` 或 dayjs，不手写格式化字符串
- 数字/货币格式使用 `Intl.NumberFormat`，不手写 `toLocaleString` 参数

### 12.3 不做的事

- 不引入 `react-i18next` / `react-intl` 等 i18n 库
- 不抽取文案到 JSON/YAML 文件
- 不做运行时语言切换
