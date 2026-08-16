# GeoWork 前端重构计划（文件级）

> **文档路径**：`doc/21-Frontend-Refactor-Plan.md`
> **关联文档**：`doc/15-Engineering-API-Contract.md` §2.5（统一 API 客户端）/ `doc/03-GeoWorkFrontend-Engineering-Standards.md`
> **适用对象**：前端贡献者（含 AI 编程助手）
> **状态**：待批准（2026-08-16 起草，等待用户确认后按阶段执行）
> **前置**：Phase 0 已完成——`shared/api/client.ts` 统一（token/超时/ApiError 三分类，commit 98cdde6）

---

## 0. 已拍板决策（用户确认，2026-08-16）

| # | 决策 | 内容 |
|---|---|---|
| D1 | **mock 静默降级 → 隐藏，不删除** | 假 AI 流式代码保留，但移入显式"演示模式"开关之后（`?demo=1` 或 localStorage `geowork.demo.enabled`）。默认路径后端不可达时显示**离线提示条**，不再假装 AI 在回答；演示模式开启时正常走 mock，但 UI 明确标注"演示模式（未连接后端）" |
| D2 | **假执行按钮 → 真实 run 轮询** | `handleConfirmRun` 的 `setTimeout` 假完成删除，改为轮询 `GET /api/agent/runs/{runId}` 真实状态；core 已有的 `/api/ws` 审批通道列为后续独立任务（本轮不接，届时 P4 加 0.5 天） |

## 1. 重构原则（对齐 ZCode / DeepSeek Harness / OpenCode / pi / TraeWork / Codex 六家调研结论）

1. **UI 是事件流的投影**：流式状态住进 React-free 对象层，组件只订阅不可变快照（dsh 模式）
2. **组合靠注册不靠 import**：跨模块协作走单一服务/store，消灭数据多真相源
3. **协议即命门**：类型从 Go core 镜像到唯一 `types.ts`，组件不许手写 wire 类型
4. **差分更新纪律**：未变更子树引用不动；N 帧变更微任务合批成 1 次渲染
5. **宁可诚实地空着，不假装在工作**（D1 的精神）

## 2. 病灶清单（2026-08-16 精读确认，行号为当前实际行号）

| 文件 | 问题 | 行号 |
|---|---|---|
| `pages/NewTask/NewTaskPage.tsx`（825 行） | 7 个 useEffect；**每个流式 token 触发全量会话写 localStorage**；假执行按钮；硬编码开发机目录 | L339-359 / L552-559 / L599-600 |
| `pages/NewTask/components/streamAdapters.ts`（638 行） | 约 340 行 mock 假 AI 在生产代码；`autoStreamAdapter` 静默降级假流式；SSE/WS 空壳 | L52-388 / L641-652 / L392-404 |
| `pages/NewTask/components/conversationStorage.ts`（174 行） | 类型与持久化混装；上限 20 条且每条含全部消息 | 全文件 |
| `shared/stores/taskSidebarStore.ts`（234 行） | 名为 store 实为 localStorage 函数集 + CustomEvent 通知；与 core 三重合并 | L72-153 |
| `pages/Tasks/TasksPage.tsx`（662 行） | `INITIAL_TASKS`/`MOCK_EXECUTIONS` mock 初始态；core→cache→mock 三重降级 | L287-288 / L299-308 |
| `shell/AppShell.tsx`（910 行） | 从 localStorage 初始化侧栏 + CustomEvent 同步 | L116-117 |

## 3. 目标目录结构（改造后）

```
src/shared/
├── api/
│   ├── coreApi.ts              # 不动（token 层）
│   ├── client.ts               # 不动（HTTP 入口）
│   └── types.ts                # 【新建 P1】core 协议镜像
├── session/                    # 【新建 P2-P3】React-free 对象层
│   ├── types.ts                #   视图模型 + 快照契约
│   ├── notifier.ts             #   微任务合批
│   ├── demoMode.ts             #   演示模式开关（D1）
│   ├── demoAdapter.ts          #   mock 流式迁入此处，仅演示模式可达
│   ├── Session.ts              #   会话状态机 + SSE 驱动
│   ├── SessionManager.ts       #   实例池 + 列表
│   ├── conversationCache.ts    #   降级缓存（唯一写 localStorage 的地方之一）
│   ├── react.ts                #   useSession / useInvoke（本目录唯一 React 文件）
│   └── __tests__/              #   纯 TS 测试，无 jsdom
├── storage/
│   └── index.ts                # 【新建 P6】geowork.* 命名空间统一入口
└── stores/
    └── taskStore.ts            # 【新建 P5】zustand 真 store，替代 taskSidebarStore

src/pages/NewTask/
├── NewTaskPage.tsx             # 825 行 → 约 300 行
└── components/                 # ChatComposer / ConversationMessage 等 props 不变
```

---

## Phase 1：协议类型镜像（0.5 天，1 次提交）

**新建 `src/shared/api/types.ts`**（约 150 行），从 Go 侧逐字镜像：

```typescript
// ===== 镜像 core/internal/api/conversation_handler.go =====
export interface CoreConversation { id: string; workspaceId?: string; title?: string;
  mode?: string; status?: string; createdAt?: string; updatedAt?: string }
export interface CoreMessage { id: string; conversationId?: string; role: string;
  content: string; toolCalls?: string; metadata?: string; tokenCount?: number; createdAt?: string }
export interface CoreMessageListResponse { total: number; messages: CoreMessage[] }

// ===== 镜像 core/internal/api/agent_handler.go + task_event.go =====
export type CoreSSEEventName = 'plan' | 'step_start' | 'step_done' | 'done' | 'error' | 'tool_call_failed'
export interface CoreEventPayload { type: string; taskId?: string; message?: string;
  data?: Record<string, unknown>; error?: string }
export interface CoreRunStep { id: string; title: string; tool?: string; status?: string }
export interface CoreRun { id?: string; plan?: CoreRunStep[]; status?: string }

// ===== 镜像 core/internal/api/tasks（/api/db/tasks，取并集）=====
export interface CoreTask { id: string; workspaceId: string; name: string; description?: string;
  status: string /* pending|running|completed|failed|cancelled|paused|recovered */;
  mode: string; prompt?: string; plan?: string; progress: number;
  startedAt?: string; completedAt?: string; createdAt: string; updatedAt: string }
```

**修改 4 个文件**（删本地重复定义，改 import）：

| 文件 | 动作 |
|---|---|
| `NewTaskPage.tsx` | 删 L57-77 `CoreConversation`/`CoreMessage` → `import type {...} from '../../shared/api/types'` |
| `streamAdapters.ts` | 删 L446-461 `CoreEventPayload`/`CoreRunStep` → 同上 |
| `taskSidebarStore.ts` | 删 L33-44 `CoreTask`（字段并集版）→ 同上 |
| `TasksPage.tsx` | 删 L176-190 `CoreTask`（全字段版）→ 同上 |

**验收**：`npx tsc --noEmit -p tsconfig.app.json` + `npx vitest run` 全绿；`grep -rn "interface Core" src/pages/ src/shell/` 归零。
**提交**：`refactor(types): 新建 shared/api/types.ts 镜像 core 协议，删除 4 处本地重复定义`

---

## Phase 2：React-free 会话对象层（2 天，1 次提交）★核心战役

**新建 7 个文件**（合计约 900 行，除 `react.ts` 外零 React import）：

### `session/notifier.ts`（约 40 行）
```typescript
export class Notifier {
  markDirty(flush: () => void): void   // 微任务合批：N 次调用 → 1 次 flush + 1 次 notify
  notifyNow(flush: () => void): void   // 仅用户手势回显（输入框光标场景）
  subscribe(fn: () => void): () => void
}
```

### `session/types.ts`（约 120 行）
迁移 `conversationStorage.ts` L7-111 的全部类型（`ConversationMessage`/`RunStatus`/`ToolCallLog`/`WorkflowStep`/`WorkMode`/`Conversation` 等，**原样搬运零改名**，调用方 import 路径后面统一处理），外加：
```typescript
export type SessionPhase = 'idle' | 'loading' | 'live' | 'frozen' | 'error'
// live    = core 在线，正常收发
// frozen  = core 不可达但本地缓存命中（只读视口，学 dsh 会话冻结）
// error   = core 不可达且无缓存
export interface ConversationSnapshot {
  readonly phase: SessionPhase
  readonly runStatus: RunStatus
  readonly messages: readonly ConversationMessage[]
  readonly title: string
  readonly coreConversationId?: string
  readonly currentRunId?: string     // D2：确认执行轮询用
  readonly isDemo?: boolean          // D1：演示模式标注
  readonly lastError?: string
}
export interface ObservableSnapshot<T> { getSnapshot(): T; subscribe(fn: () => void): () => void }
```

### `session/demoMode.ts`（约 20 行，D1）
```typescript
export function isDemoModeEnabled(): boolean
// 读取顺序：URL ?demo=1 > localStorage 'geowork.demo.enabled' === 'true'
// 默认 false。开启后 Session.send 在 core 不可达时走 demoAdapter
export function setDemoMode(enabled: boolean): void
```

### `session/demoAdapter.ts`（约 340 行，从 `streamAdapters.ts` L52-388 迁移）
`MOCK_TOOL_CALLS`/`MOCK_WORKFLOW_STEPS`/`MOCK_RESPONSE_WORK|CODE|MAP`/`generateMockResponse`/`createInterruptibleDelay`/`mockStreamAdapter` **整体迁入**，导出接口改为返回结构化事件（供 Session 消费），不直接碰 React。文件头注释声明：仅演示模式可达，生产默认路径不会执行。

### `session/Session.ts`（约 300 行）
吸收 `realStreamAdapter` 全部逻辑（`streamAdapters.ts` L406-631）：
```typescript
export class Session implements ObservableSnapshot<ConversationSnapshot> {
  readonly id: string
  private coreId?: string              // 替代 coreConvIdCache（L421-431）
  private phase: SessionPhase
  private messages: ConversationMessage[] = []
  private notifier = new Notifier()
  private es: EventSource | null = null

  async open(): Promise<void>          // = loadConversationFromCore（NewTaskPage L96-133）
                                       //   core 成功 → live + 回填 cache
                                       //   core 失败 + cache 命中 → frozen
                                       //   core 失败 + 无 cache  → error
  async send(input: string, opts: SendOptions): Promise<void>
    // 乐观插入 user + assistant 占位 → ensureCoreConversation（L464-487 迁入）
    // → POST /api/conversations/{coreId}/messages → 订阅 /events SSE
    // 网络失败分支（D1）：
    //   isDemoModeEnabled() → demoAdapter 驱动，snapshot.isDemo = true
    //   否则 → phase 保持 frozen/error，UI 离线提示条
  cancel(): void                       // es.close() + runStatus='stopped'
  resync(): Promise<void>              // 清窗口重 open；SSE 断开后指数退避（500ms×2 → 10s，学 dsh）
  getSnapshot(): ConversationSnapshot  // 永远返回缓存引用（uSES 契约）
  subscribe(fn): () => void
}
```
SSE 事件迁移映射（`streamAdapters.ts` L548-628 → Session 私有方法）：

| 现有代码 | 迁移为 |
|---|---|
| `plan` 监听 + 拉取 run 详情（L548-573） | `private onPlan(runId)` |
| `step_start`（L576-587） | `private onStepStart(d)` → 更新对应 toolCall |
| `step_done`（L590-602） | `private onStepDone(d)` |
| `done`（L605-611） | `private onDone()` → runStatus='completed'，**此处回填 conversationCache（唯一写点）** |
| `error`（L614-628） | `private onError()` → 区分服务端错误/连接中断；中断触发 resync |

### `session/SessionManager.ts`（约 120 行）
```typescript
export class SessionManager {
  private sessions = new Map<string, Session>()
  ensure(localId: string): Session     // 惰性建、常驻（切走再回秒开，学 dsh）
  reset(localId: string): void         // 替代 NewTaskPage resetKey 手动清理
}
export const sessionManager = new SessionManager()  // 模块级单例
```

### `session/conversationCache.ts`（约 60 行）
收编 `conversationStorage.ts` L129-174 读写。**只在 `Session.open()`（降级读）与 `onDone()`（回填写）两处调用**——流式过程中零 localStorage 写入，修掉现在每 token 全量写的性能 bug。

### 测试 `session/__tests__/session.test.ts`（10 个用例，纯 Node，无 jsdom）
1. 乱序帧按 seq 排序　2. 重复帧去重　3. open 失败 + cache 命中 → frozen　4. open 失败 + 无 cache → error
5. cancel 后不再收 delta　6. done 回填 cache 恰好一次　7. resync 清窗口重建
8. 快照引用稳定性（未变更消息 === 旧引用）　9. **演示开关关闭时 core 失败不触发 demoAdapter（D1 回归）**　10. **演示开关开启时走 demoAdapter 且 isDemo=true（D1 回归）**

### 同步删除（`streamAdapters.ts`）
- `autoStreamAdapter` 静默降级（L641-652）**删除，被 D1 显式开关替代**
- `sseStreamAdapter`/`websocketStreamAdapter` 空壳（L392-404）删除
- 本阶段结束时 `streamAdapters.ts` 仍存在（NewTaskPage 还在用 `activeAdapter`），内容只剩：类型 re-export + `realStreamAdapter` 薄壳（内部已可转发到 Session，P4 接线后整个文件删除）

**验收**：`grep -rn "from 'react'" src/shared/session/ --include="*.ts" | grep -v react.ts` 归零；新测试 10/10；现有页面行为不变（未接线）。
**提交**：`feat(session): React-free 会话对象层；mock 流式迁入显式演示开关，删除静默降级`

---

## Phase 3：React 绑定层（0.5 天，1 次提交）

**新建 `session/react.ts`**（约 120 行）：
```typescript
export function useSession(localId: string | null): ConversationSnapshot | null
// useSyncExternalStore 直连 Session（getSnapshot 返回缓存引用，天然满足契约）
export function useInvoke<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): { trigger: (...args: A) => void; pending: boolean; error: Error | null }
// 稳定引用 + 计数 pending；替代散落的 setIsLoading/setError
```

**验收**：typecheck 全绿；`useSyncExternalStore` 仅存在于 `react.ts`。
**提交**：`feat(session/react): useSession/useInvoke 绑定层`

---

## Phase 4：NewTaskPage 接线（1.5 天，1 次提交）

`NewTaskPage.tsx` 逐段改造（825 → 约 300 行）：

| 现有代码 | 改造后 |
|---|---|
| L142-149 `messages/isStreaming/runStatus/isConversationLoading` | `const snap = useSession(convId)`；`isStreaming` 由 runStatus 派生 |
| `prompt`/`model`/`workDir`/`workMode` | **保留**为本地 UI 状态（输入瞬时态，不进对象层） |
| L180-235 resetKey/initialPrompt effect | 保留，内部改 `sessionManager.reset()` 替代 6 个 setXxx |
| L238-298 加载会话 effect（61 行） | `useEffect(() => { if (convId) void sessionManager.ensure(convId).open() }, [convId])` |
| L301-304 自动滚动 | 保留 |
| **L311-336 侧栏同步 effect** | 删除，taskStore 订阅接管（P5；此处留 TODO） |
| **L339-359 每 token 全量写 localStorage** | 删除（cache 回填已收进 Session.onDone） |
| L415-534 handleSend（119 行） | 保留乐观插入 + `session.send(prompt, {model, workMode, workDirName, contexts})`；六个回调全删 |
| L537-549 handleStop | `session.cancel()` |
| **L552-559 假执行（D2）** | 删除 setTimeout。点击后轮询 `GET /api/agent/runs/{snap.currentRunId}`（1s 间隔，上限 5 分钟），run.status → runStatus 映射：completed/failed/cancelled 终止轮询。若 runId 缺失则按钮禁用 + 提示"无可执行的运行" |
| **L599-600 硬编码目录** | 从 settingsStorage 读最近目录，无则空列表 |
| L612-688 homeView / L691-782 conversationView | JSX 不动，数据源换 snap.*；新增两条提示条：`phase==='frozen'/'error'` → 离线黄条；`snap.isDemo` → 演示模式标注条（D1） |

**验收**：手查 6 条路径（新会话发送/停止/刷新恢复/URL 直连/离线提示条/演示模式条）；vitest + build 全绿；行数 ≤ 320。
**提交**：`refactor(new-task): 接入 Session 对象层；假执行改真实 run 轮询；删除硬编码目录`

---

## Phase 5：taskStore + 侧栏/任务页（1 天，1 次提交）

**新建 `shared/stores/taskStore.ts`**（zustand，约 150 行）：
```typescript
interface TaskState {
  tasks: SidebarTaskItem[]
  workspaces: SidebarWorkspaceMeta[]
  source: 'core' | 'cache'    // UI 据此显示离线条
  refreshFromCore(): Promise<void>   // 吸收 taskSidebarStore L72-114 合并逻辑
  upsertLocal(item: SidebarTaskItem): void
  // 置顶/归档/改名等元数据操作
}
```
- `AppShell` 一处通过 `useSession` 把 phase/runStatus 同步进 taskStore（替代 NewTaskPage L311-336 effect）
- **删除 `taskSidebarStore.ts`**；类型迁 `session/types.ts`
- **`AppShell.tsx`**：L116-117 `useState(() => loadSidebarTasks())` + CustomEvent 监听 → `useTaskStore()`，预计减 60-80 行
- **`TasksPage.tsx`**：三重降级（L299-308）改 core→cache 两级 + 顶部离线提示；`MOCK_EXECUTIONS` 顶部标注 `/** @demo 执行记录 mock，接 /api/db/tasks/{id}/executions 后删除 */`

**提交**：`refactor(tasks): zustand taskStore 重写侧栏数据流，TasksPage 去 mock 兜底`

---

## Phase 6：storage 统一 + CI 静态守护 + 文档（1 天，1 次提交）

**新建 `shared/storage/index.ts`**（约 80 行）：
```typescript
export function readJSON<T>(key: string, fallback: T, guard?: (v: unknown) => v is T): T
export function writeJSON(key: string, value: unknown): void
// 统一 geowork. 前缀校验、解析 try/catch、配额异常静默
```
6 套 storage（skills/mcp/expert/connectors/settings/mobileControl）内部改调用统一入口，**对外导出签名不变**（调用方零改动）。

**新建 `scripts/check_frontend_boundaries.mjs`**（CI 三条守护，学 dsh 机器检查）：
1. `src/shared/session/` 除 `react.ts` 外零 `from 'react'`
2. `src/` 除 `shared/api/`、`shared/session/` 外零 `fetch(`/`EventSource(`
3. `src/` 除 `shared/storage/`、`shared/session/conversationCache.ts` 外零 `localStorage`
接入 `.github/workflows/pr-check.yml` 前端 job。

**文档同步**（AGENT.md §15.3）：本文件状态改"已批准/执行中"；AGENT.md 施工记录；CHANGELOG 补记。

**提交**：`chore(guard): storage 统一入口 + CI 前端边界静态检查`

---

## 4. 依赖关系、里程碑与工作量

```
P1(0.5d) → P2(2d) → P3(0.5d) → P4(1.5d) → P5(1d)
                          └──────→ P6(1d，可与 P4/P5 并行)
总计约 6.5 个工作日；每阶段独立提交、独立验收、可单独回滚
```

| 里程碑 | 完成标志 |
|---|---|
| M1（P2 末） | "偶发 bug"两大温床（静默降级、每 token 全量写）已消灭，页面行为暂不变 |
| M2（P4 末） | NewTaskPage ≤320 行、6 条手查路径通过 |
| M3（P6 末） | CI 边界守护生效，localStorage/fetch/react import 三项越界即红 |

## 5. 风险与回滚

| 风险 | 缓解 |
|---|---|
| Session 状态机遗漏现有边缘行为（URL 直连、resetKey） | P2 不接线、P4 才切；P4 前后行为对照清单（见 P4 验收 6 条路径） |
| 演示模式被误开启 | 默认 false；开启仅经显式 `?demo=1` 或 localStorage；UI 常驻标注 |
| core `/api/agent/runs/{id}` 响应字段与预期不符 | P4 实施前先打真实接口核对 `run.status` 枚举，不符则以 core 为准更新 types.ts |
| 每阶段回归 | 每阶段提交前 typecheck + vitest + build 三绿；M3 后加 CI 边界检查 |

## 6. 明确不做（本轮）

- Cordis 插件树 / 动态插件加载 / HMR（dsh 专属产品哲学）
- 40 包 monorepo 拆分（目录级模块约定 + CI 边界检查即可）
- `/api/ws` 审批流接入（独立任务，D2 备注）
- Extensions 四页接真数据（等 core skills/MCP 端点稳定，另立计划）
