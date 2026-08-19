# GeoWork v0.6 前端现代化施工计划（接线 · 砍戏 · 定规矩）

> **文档路径**：`doc/27-Frontend-Modernization-Plan.md`
> **关联文档**：`doc/21-Frontend-Refactor-Plan.md`（工程纪律已落地）/ `doc/26-AntDesignX-Migration.md` / `ADR-002`（diff 双闸）/ `ADR-003`（导航白名单）/ `AGENT.md` §4（DoD）
> **适用对象**：前端 + core 贡献者（含 AI 编程助手）
> **状态**：**已批准，待施工**（2026-08-19 起草；第 0 周产出 = 本文档 + ADR-002/003 + 文档修订）
> **一句话总纲**：后端已备好料，前端欠的是"接线、砍戏、定规矩"——把能接的全接上、该砍的全砍掉、假承诺全部兑现或撤回。

---

## 0. 决策（2026-08-19 用户确认）

| 编号 | 决策点 | 结论 |
|---|---|---|
| **D-27-1** | 计划性质 | ✅ **消费工程为主，不是建造工程**——观测/恢复域后端 100% 就绪、前端 0% 消费；大头是把已建好的端点接进 UI |
| **D-27-2** | 排序逻辑 | ✅ **按"整块域的空置程度"排，不按"哪个 bug 最响"排**——第 1 周先接金矿域（性价比最高），diff 降级为第 2 周三张工单之一，清场放最后 |
| **D-27-3** | 完成定义 | ✅ **DoD 三条**（§3）：真 API、三态齐全、错误兜底，三者不齐的界面不得进导航 |
| **D-27-4** | diff 查看器与审查面板 | ✅ **已定（2026-08-19 用户拍板）：分工**——内联=对话流即时可见性（纯展示），面板=跨会话批量审查闸门；三条边界（单一渲染核/互链成环/写操作只属于面板）见 ADR-002 |
| **D-27-5** | 导航白名单 | ✅ 见 ADR-003：新任务/定时任务/设置保留，扩展四页分诊后定去留，MobileControl/Workspace/DataCenter/AgentStudio 移出导航 |
| **D-27-6** | 存量页面三态补齐 | ✅ **已定（2026-08-19 用户拍板）：第 4 周专项**——3 个保留页面 + shell 弹窗统一 EmptyState 并补齐三态（W4-5），DoD 对存量代码强制执行，否则白名单保留的 Settings 永远不达标 |
| **D-27-7** | 546 处内联样式 | ✅ **已定（2026-08-19 用户拍板）：方案 1 纪律收敛 + 两条落地修正**——① 禁止新增游离 token 的内联色值；四个重灾区全在 v0.6 施工面上（Settings/ProviderEditor/ModelPicker → W3-4 模型路由域，RightWorkspacePanel → W1-W2 面板接线），**"本工单改造到的代码区，内联色值迁入 token/module.css"写进对应工单 DoD，债随真工单消化，不单开专项**；② **W4 末加闸**（W4-6）：grep 四文件非 token 内联色值，残留 >约 20 处再花半天清扫（降级版重灾区专项），否则维持纪律；③ 其余 ~380 处多在 ADR-003 待移除页面里，为将死代码做清洁是负收益，不动；方案 3（全量专项）否决 |

---

## 1. 北极星：五支柱现状与交付映射

对标 Codex/Cursor 式 agent 工作台，骨架五条：

| 现代化支柱 | 那类产品的样子 | GeoWork 现状（2026-08-19 核查） | 谁交付 |
|---|---|---|---|
| Chat-first 单一工作区 | 一个主工作台，不是页面集市 | 13 条路由，约一半是占位/死代码 | 第 0 周白名单 + 第 4 周清场 |
| 工具调用全程透明 | 审批卡、diff、时间线内联对话流 | 审批卡真、时间线真、**内联 diff 已通（v1.10）、审批闸断（ReviewPanel 调未挂载端点）** | 第 2 周 |
| 全键盘可达 | Ctrl+K 面板、快捷键全真 | 全局 keydown 零实现，菜单印着假快捷键标签 | 第 3 周 |
| 会话可恢复 | 检查点、断点续跑 | **后端全套就绪（含 404/409 语义），前端零消费** | 第 1 周 |
| 成本可见 | 每次运行多少钱 | UsageModal 是 mock 常量；后端 usage/summary + usage/{runId} 就绪 | 第 1 周 |

不对称结论：五条里两条（可恢复、成本）后端已完工到连错误语义都为前端写好了注释的程度（`core/internal/aiagent/routes.go:322-333`）。

---

## 2. 九域现状表（2026-08-19 全量核查，行号为当前实际位置）

| # | 域 | 后端 | 前端 | 断点/证据 |
|---|---|---|---|---|
| 1 | 对话/会话 | ✅ conversations CRUD + SSE 全通 | ✅ Session 对象层消费（doc/21） | 无断点；唯一受契约测试保护的域之一 |
| 2 | **观测/恢复（金矿）** | ✅ runs 全套（list/start/stop/pause/resume/delete）+ checkpoints 全套（list/get/resume/delete，404/409 分流）+ trajectory + usage/summary + usage/{runId}（`aiagent/routes.go:29-63`） | ❌ 仅消费 `GET /api/agent/runs/{id}` 轮询一处 | TasksPage 用任务列表假映射"执行记录"；`MOCK_EXECUTIONS` 死代码（TasksPage.tsx:64-65）；UsageModal 五个 mock 常量（UsageModal.tsx:31-40） |
| 3 | **diff/审查** | ⚠️ 双轨：内联链通（DiffRecorder→go-difflib→`diff.created` SSE→DiffViewer，AGENT.md v1.10）；`core/internal/diff/` 1063 行完整 Manager+8 条路由**从未挂载** | ⚠️ DiffViewer 内联渲染已通；ReviewPanel 调 `GET /api/security/diff`、approve/reject/apply-all（preload.ts:83-90）→ **活路由上全部 404** | 活路由仅有 `POST /api/security/diff`+rollback+recycle-delete（diff_handler.go:49-51）；挂载死包前须先删这三条防 ServeMux panic |
| 4 | **skills** | ⚠️ **三源**：① `/api/skills` 返回 `runtime.App.defaultSkills()` 硬编码（runtime.go:1169）② aiagent `skills.Loader/Registry` 目录加载器**从未接线**（全仓库无 `WithSkills` 调用方，main.go 装配清单无 skills）③ 前端 localStorage | ❌ SkillsPage + antdx `/` 联想（promptData）都读 localStorage 假名单 | 用户在界面启用技能，Agent 不知道；工单必须三步走（见 §5 第 2 周） |
| 5 | mcp/plugins/experts | ⚠️ 待分诊：`GET /api/mcp`（project_handler.go:126）疑为壳；真能力或在未挂载包 | ❌ 四页全 localStorage mock（mcpStorage/skillsStorage/connectorsStorage/expertStorage） | 产出"接/留/砍"清单，四页可能收敛成一页（产品决策） |
| 6 | tasks/调度 | ✅ `/api/db/tasks` CRUD 全通；`/api/agent/schedule`+triggers 就绪未接 | ⚠️ TasksPage 接了 db/tasks；执行记录是假映射；schedule/triggers 零消费 | 见域 2 的 executions 问题 |
| 7 | workspace/文件 | ✅ tree/read/write/import/list 齐全 | ⚠️ 仅 FileTreePanel 接 tree/read；WorkspacePage 是 21 行占位页 | write/import 闲置；preload.ts 有幽灵桥（`POST /api/workspaces` 后端不存在） |
| 8 | settings/models | ✅ `/api/settings`、`/api/models`+test 就绪 | ❌ 全走 localStorage（settingsStorage/modelProviderStore） | 换机即丢配置；接线工单 W3-4（施工时先分诊 `app.Models()`/`app.Settings()` 数据源真伪——skills 硬编码教训） |
| 9 | 桌面手感 | —（纯前端） | ❌ 全局 keydown 零实现；GlobalSearchModal 硬编码 19 条静态数据且含死路由 theme-preview；ShortcutsModal 是"指引不存在功能的说明书" | AppMenu.tsx:81/93 印着 Ctrl+F/Ctrl+Shift+F 标签，按键无响应 |

**横切债**（不属于任何单域）：DashboardPage 死代码未挂路由；ThemePreviewPage 下线但文件保留；`components/ErrorBoundary` 死代码（与 shell/feedback/ 重复）；4 个 @deprecated 主题；CSS Modules 92 处引用悬空 `var(--ant-color-*)`（ConfigProvider 未开 cssVar）；index.css `!important` 全局按钮覆盖与主题 token 打架；546 处内联样式；EmptyState 仅 2 页使用、其余裸 `<Empty>`；存量三态不齐；41 处"后续接入/敬请期待"文案。**处置归属**：死代码与废弃主题 → ADR-003 删除清单 + W4-1；cssVar 与 `!important` → W4-3；546 处内联样式 → D-27-7 纪律收敛；EmptyState 统一与存量三态 → W4-5（D-27-6）；占位文案 → W4-1。

---

## 3. DoD（Definition of Done，写入 AGENT.md §4）

一个界面"完成"当且仅当三条全齐，否则不得进导航：

1. **真 API**：数据来自契约测试钉住的端点，禁止 localStorage mock 顶替、禁止调未挂载端点
2. **三态齐全**：loading（Skeleton/Spin）+ 空态（统一 `EmptyState` 组件）+ 错误态（可重试）
3. **错误兜底**：网络失败/4xx/5xx 有明确 UI 反馈，不静默、不假成功

---

## 4. 导航白名单（详见 ADR-003）

| 处置 | 页面 |
|---|---|
| ✅ 保留 | 新任务（NewTask）、定时任务（Tasks）、设置（Settings/About） |
| ⏳ 分诊后定去留 | Extensions 四页（Skills/MCP/Connectors/Experts）——第 2 周产出接/留/砍清单 |
| ❌ 移出导航 | MobileControl、Workspace、DataCenter、AgentStudio（GIS 地图是 v1.0 的事，v0.6 不装） |
| 🗑 删除 | DashboardPage（死代码）、ThemePreviewPage、components/ErrorBoundary、4 个 deprecated 主题 |

---

## 5. 五周施工排期（2026-08-20 起）

### 第 0 周：定盘子（2 天，只写决策不写码）✅ 本次产出

doc/27（本文档）+ ADR-002 + ADR-003 + 文档修订清单执行（§6）。

### 第 1 周：接金矿（观测与恢复域，纯前端，零后端改动）

| 工单 | 内容 | 验收 |
|---|---|---|
| W1-1 运行历史视图 | `GET /api/agent/runs` 列表 + pause/resume/stop/delete 按钮，替换 TasksPage 假映射"执行记录"，删 `MOCK_EXECUTIONS` | 列表真实、四个动作可用 |
| W1-2 检查点恢复 | checkpoints 全套端点消费；404（无存档）/409（仍在跑）分流渲染（语义见 routes.go:322-333） | 渲染"运行在第 N 轮因 X 暂停"，恢复可点 |
| W1-3 成本徽章 | `GET /api/agent/usage/{runId}` 挂到每条 run | 每条 run 显示真实 token/成本 |
| W1-4 UsageModal 真数据 | 换 `GET /api/agent/usage/summary`，五个 mock 常量退役 | 数字来自后端 |

**整体验收**：跑一个任务→暂停→面板出现暂停态→恢复→成本数字滚动。这五秒钟就是"聊天壳"变"工作台"的时刻。

### 第 2 周：闭环卖点域（skills 为主，diff 是其中一张工单）

| 工单 | 内容 | 验收 |
|---|---|---|
| W2-1 skills 单一真相源（最重） | **三步走，顺序不可颠倒**：① core 接线 `skills.Loader→Registry→orchestrator.WithSkills`（main.go 装配，此步完成前 `/api/skills` 供什么都是假的）② `/api/skills` 改供 Registry ③ 前端 SkillsPage + antdx promptData（`/` 联想，commit 335e00f）同步切换数据源——**联想必须同步切，否则造出第四个源** | 界面启用的技能 Agent 真能加载；`/` 联想名单 = 后端真相源 |
| W2-2 diff 审批闸 | 前提两条：删 diff_handler.go 三条旧 security 路由（防 ServeMux 重复注册 panic）→ main 构造 Generator/Manager → 挂载 `core/internal/diff` 路由 → 契约测试补钉 → ReviewPanel 订阅 `diff.created` 刷新。**DoD 附加：本工单改造到的 RightWorkspacePanel 代码区，内联色值迁入 token/module.css（D-27-7）** | ReviewPanel 列表/审批/apply-all 全通，不再 404 |
| W2-2b 内联纯展示收口 | 按 ADR-002 边界三条落地：DiffViewer 确认零写操作调用 + 共用渲染核 + 加"在审查面板中打开"深链（runID/path 过滤）；面板条目回链对话轮次 | ADR-002 三条边界全部可验证 |
| W2-3 mcp 分诊 | 分诊 `/api/mcp` 是壳还是真、未挂载包里有无真能力；产出扩展四页"接/留/砍"清单 | 清单落档，四页去留拍板 |

### 第 3 周：手感层

| 工单 | 内容 | 验收 |
|---|---|---|
| W3-1 真快捷键 | 全局 keydown 绑 Ctrl+F/Ctrl+N/Ctrl+,/Ctrl+B/Ctrl+Shift+F（注意输入框焦点冲突） | 菜单标签与实际能力一致 |
| W3-2 Ctrl+K 命令面板 | 数据源 = 路由白名单 + taskStore 任务 + 技能 + 动作（切主题/开面板/切会话）；升级 GlobalSearchModal 并删 theme-preview 死条目 | 静态 19 条退役 |
| W3-3 ShortcutsModal 改实 | 从说明书变真实映射，删"设置快捷键"假按钮 | 所列快捷键全部可用 |
| W3-4 settings/models 域接线（D-27-7 载体） | SettingsPage 从 settingsStorage 切 `GET/POST /api/settings`；模型配置从 modelProviderStore 切 `/api/models` + `/api/models/test`（ProviderEditor 连接测试真调）；**施工第一步先分诊 `app.Models()`/`app.Settings()` 数据源真伪（skills 硬编码教训——端点真数据源假则先修后端）** | 设置与模型配置换机不丢；ProviderEditor 测试按钮真实测通。**DoD 附加：本工单改造到的代码区（SettingsPage/ProviderEditor/ModelPicker），内联色值迁入 token/module.css（D-27-7 债随工单消化）** |

**整体验收**：键盘完成 新建→输入→发送→暂停→恢复 全程不碰鼠标。

### 第 4 周：清场 + 拆神像 + 守门

| 工单 | 内容 |
|---|---|
| W4-1 清场 | 删 §4 白名单中 🗑 项 + 白名单外占位入口；WorkspacePage 重定向 |
| W4-2 AppShell 拆分 | 35KB→15KB 以内：拖拽抽 `usePanelResize`、侧栏抽 `SidebarTasks`、弹窗归拢 `ShellModals`、静态 `Modal.confirm`（AppShell.tsx:416/496）改上下文版 |
| W4-3 样式修复 | ConfigProvider 开 `cssVar`（92 处悬空变量起死回生）；index.css `!important` 并入 Button token |
| W4-4 契约 CI 门禁 | 契约测试（desktop_contract_test.go）扩到**前端实际消费的全部端点**；CI 脚本 grep 渲染层 API 调用与契约清单 diff——ReviewPanel 式断链从"靠人眼两周"变"CI 必红" |
| W4-5 存量三态补齐（D-27-6 用户拍板） | 3 个保留页面（NewTask/Tasks/Settings）+ shell 弹窗（GlobalSearch/Shortcuts/Usage 等）统一 EmptyState 替换裸 `<Empty>`；Settings 补 loading/错误态；Extensions 四页若分诊后保留则一并补——DoD 三条对存量代码强制执行 |
| W4-6 内联样式残留闸（D-27-7 用户拍板） | grep 四个重灾区文件（SettingsPage/ProviderEditor/ModelPicker/RightWorkspacePanel）的非 token 内联色值：**残留 >约 20 处 → 花半天清扫（降级版重灾区专项）；≤20 处 → 维持纪律收工**。其余 ~380 处在 ADR-003 待移除页面，不动 | 闸门结果记入执行记录 |

### 第 5 周起：增值可选项

trajectory 回放视图、`/api/ws` 审批信令（HTTP 够用则缓）、文件编辑（write/import 后端与桥俱在）、地图工作区真做（v1.0 范畴）。

---

## 6. 文档纠偏清单（2026-08-19 以当前文件实际内容复核）

| 文件 | 问题 | 改法 | 状态 |
|---|---|---|---|
| DEV_VERSION_CHECKLIST:90 | "与 Go Core API 联调｜后端尚未就绪"——**与事实相反**（conversations/runs/approvals/db-tasks 早已联调且受契约测试保护），正是这条过期信息掩护了 diff 断链没人怀疑 | 改为已就绪端点清单 + 待接端点清单，联调状态按域标注 | 本次执行 |
| DEV_VERSION_CHECKLIST:18,45,92 | F2-2"AppShell 按路由分发 A/B/C/D 模板"——模板分发是页面思维，与 chat-first 背道而驰 | 整项删除，替换为"AppShell 拆分至 <15KB" | 本次执行 |
| DEV_VERSION_CHECKLIST:91 | FP3-2"module.css 64→8"数值目标不现实也无收益 | 改为"禁止新增游离于 token 的样式，存量随改造收敛" | 本次执行 |
| DEV_VERSION_CHECKLIST 已知限制表 | 缺真实债 | 补入：diff 审批闸断链、悬空 CSS 变量、假快捷键、死路由条目、双 ErrorBoundary、41 处占位 | 本次执行 |
| AGENT.md §4 | 缺 DoD 纪律 | 写入 §3 三条 | 本次执行 |
| AGENT.md §7 | 声称 WS 承载终端 I/O（实际终端走 node-pty IPC，见 electron/ipc/terminalIpc.ts） | 终端通道描述改实 | 本次执行 |
| AGENT.md §1 许可/阶段/版本表 | ~~三处过期~~ **复核后撤回**：当前文件许可已是 MIT、阶段已是 P0-P3 完成、版本表已到 v1.13（GLM 首轮引用了过期快照） | 不改 | 已撤回 |
| doc/02 / doc/15 | — | 记 cssVar 决策；加"契约测试即边界"与 preload 幽灵桥禁令 | 本次执行 |
| CHANGELOG | — | v0.6 每周一条，延续"执行记录落档"习惯 | 每周随施工 |

---

## 7. 风险与回滚

| 风险 | 缓解 |
|---|---|
| W2-1 skills 接线动 core 装配层，影响面大 | 三步走每步独立验收；①完成前前端不动 |
| W2-2 挂载 diff 包时漏删旧路由 → ServeMux panic | 工单前提第一条就是删旧路由；Go 测试 + 启动冒烟 |
| 第 4 周清场砍掉的页面后续又想要 | 白名单进 ADR-003，恢复需走 ADR 修订，不许顺手加回 |
| 每周回归 | 每周提交前 tsc + vitest + build + 边界检查四绿（延续 doc/21 纪律） |

## 8. 明确不做（v0.6）

- GIS 地图工作区真做（v1.0）
- Extensions 四页新增功能（先分诊定去留）
- `/api/ws` 信令替换 HTTP 审批（第 5 周起评估）
- 任何新页面（白名单冻结，只减不增）

---

## 9. 执行记录

| 周 | 提交 | 与计划的偏差 |
|---|---|---|
| 第 0 周 | （本次） | 无 |
