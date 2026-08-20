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
| **D-27-8** | UI 组件选型优先级 | ✅ **已定（2026-08-19 用户拍板）**：① AI 组件优先用 **Ant Design X**（AI 组件范围可拓展——GeoWork 是现代 Agent 应用，凡 Agent 交互语义都算），能用的就都要用；② 自定义组件次之（Gemini 风格胶囊族等自有设计语言）；③ Ant Design 普通组件兜底，但必须走 editorial/editorial-dark token 体系。**封存主题（bootstrap/illustration/glass）删除，入口一并移除**（挂 W4-1）。已同步写入 AGENT.md §11.6 |
| **D-27-9** | 整体版本路线 | ✅ **已定（2026-08-19 用户拍板）**：**v0.6–v0.7** 现代化 Agent 应用前端+后端完成（可迭代 0.6.x–0.7.x，本计划五周排期属 v0.6 段）→ **v0.8** GIS 与遥感能力介入 → **v0.9** 发布前测试版本 → v1.0 正式发布。GIS 地图工作区、datasets/map layers/papers/knowledge/ndvi 等端点归属 v0.8，v0.6 不装（与 ADR-003 一致） |
| **D-27-10** | 侧栏现代化（2026-08-20 用户拍板） | ✅ **三条结论**：① **会话列表迁移 antdx Conversations**——对 doc/26 §3.2"侧栏 Conversations 保留自研（语义或数据模型不匹配）"的**正式翻案**。翻案依据：antdx Conversations API 已逐项核对（items/activeKey/onActiveChange；groupable 按 group 字段分组且支持折叠；menu 属性继承 antd MenuProps；creation 新会话配置 2.0.0+；shortcutKeys 2.0.0+），仓库 `@ant-design/x` 版本 ^2.9.0 满足全部要求。现有侧栏八成功能可被直接吞下，实际缝隙仅两处：组操作菜单（置顶组/在文件夹中打开/归档整组）需经 groupable.label 渲染器自行包 antd Dropdown；pinned 置顶排序组件不管、需在传 items 前自行排好——两处均为小活，撑不起"保留自研"结论。② **导航三项（新任务/定时任务/移动端控制）+ 扩展折叠区（专家/技能/MCP/连接器）换自研 NavRow 组件**——antdx 没有导航菜单等价物（其组件域是 AI 交互件：Bubble/Conversations/Sender 等，导航属应用外壳）。对标 Codex/ChatGPT/Claude/Cursor：此类产品侧栏导航无一家用现成菜单组件，全是自绘圆角行（button + 图标 + 文字，hover 整行圆角高亮，active 态浅色胶囊底）。NavRow 属 D-27-8 第二级"自定义胶囊族"的合法用例（第一级不存在时用第二级）。视觉规格：active 态 = Gemini 蓝 10~12% 透明底胶囊（CapsuleTag 同款语言），行高 36~40px，radius 9999；hover 态透明度浅一档；样式走 module.css；AppShell 现有 BorderBeam 亮色流光包装器保留适用。③ **顶部 CapsuleTabs 双胶囊切换器保留**（用户指定保留 Gemini 蓝胶囊形状）。已知问题：第二档 channels 由路由 /mobile-control 派生，而 MobileControl 在 ADR-003 裁撤名单——页面删除后切换器只剩单档失去意义。第二档归宿作为附注决策项与 ADR-003 的 MobileControl 处置联判，候选方案：改为"会话 / 已归档"视图切换（把现有 archived 过滤逻辑升级为显式视图）。**禁止让 ADR-003 落地时它变成指向 404 的开关** |

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

**横切债**（不属于任何单域）：DashboardPage 死代码未挂路由；ThemePreviewPage 下线但文件保留；`components/ErrorBoundary` 死代码（与 shell/feedback/ 重复）；4 个 @deprecated 主题；CSS Modules 92 处引用悬空 `var(--ant-color-*)`（ConfigProvider 未开 cssVar）；index.css `!important` 全局按钮覆盖与主题 token 打架；546 处内联样式；EmptyState 仅 2 页使用、其余裸 `<Empty>`；存量三态不齐；41 处"后续接入/敬请期待"文案。**处置归属**：死代码与废弃主题 → ADR-003 删除清单 + W4-1；cssVar 与 `!important` → W4-3；546 处内联样式 → D-27-7 纪律收敛；EmptyState 统一与存量三态 → W4-5（D-27-6）；占位文案 → W4-1。**41 处占位文案的点名实例（2026-08-20 补，W4-1 执行时按点名优先）**：AppMenu 任务菜单四条待裁路由入口、帮助菜单"帮助文档后续接入"、AppShell handleExportChat"导出对话后续接入"、AppShell handleOpenFolder"打开文件夹后续接入"（处置详见 W4-1 假承诺兑现批次 ①~④）。

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

> **第 0 项（工程前置，2026-08-20 补）：CI 触发方式确认**——仓库 CI 为 pr-check.yml，名称暗示仅 PR 触发；近期提交均 bypass 直推 master。若确认仅 PR 触发，则 W1 起的代码提交将不跑任何门禁（lint/typecheck/build/test/Go core/Python worker 全部旁路），与第 0 周建立的纪律不对称。开工前二选一：**W1 起改走 PR 流**（让分支保护从障碍变护栏），或**给 workflow 补 push 触发**。两分钟的确认动作，先于 W1-1 执行。

| 工单 | 内容 | 验收 |
|---|---|---|
| W1-1 运行历史视图 | `GET /api/agent/runs` 列表 + pause/resume/stop/delete 按钮，替换 TasksPage 假映射"执行记录"，删 `MOCK_EXECUTIONS`。**追加（2026-08-20）：侧栏会话列表数据源分诊**——现状 taskStore/conversationStorage 走 localStorage 仅存 20 条会话壳，后端 run store 有全量真实历史，与 skills 三源同款病的前端版；W1-1 完成后侧栏应从 run store 投影，localStorage 版降级为缓存或退役，别让侧栏和 Tasks 页各记各的账 | 列表真实、四个动作可用 |
| W1-2 检查点恢复 | checkpoints 全套端点消费；404（无存档）/409（仍在跑）分流渲染（语义见 routes.go:322-333）。**追加（2026-08-20）：409（仍在跑）的文案必须给用户出口（一键跳回进行中的会话），不是只报错** | 渲染"运行在第 N 轮因 X 暂停"，恢复可点 |
| W1-3 成本徽章 | `GET /api/agent/usage/{runId}` 挂到每条 run。**追加（2026-08-20）：区分"未配置价格"与"零成本"**——GEOWORK_LLM_PRICE_INPUT/OUTPUT 未配置时显示"未配置价格"或"—"，禁止渲染 $0.00（流式成本记录是真实能力，但价格靠环境变量喂；不区分会让真实数据被用户当成 mock） | 每条 run 显示真实 token/成本 |
| W1-4 UsageModal 真数据 | 换 `GET /api/agent/usage/summary`，五个 mock 常量退役。**前置（§10.3 拍板）：开工前先砍 project_handler 版 `/api/usage` 两条——诱饵不是哑弹，接错照样 200 返回 project 维度数据，先拆才接不错**。**追加（2026-08-20）：plan limits 是信息性而非硬约束**（usage 计量为 honor-system，server S3 已注释注明），UI 禁止把配额渲染成强制限制 | 数字来自后端 |

**整体验收**：跑一个任务→暂停→面板出现暂停态→恢复→成本数字滚动。这五秒钟就是"聊天壳"变"工作台"的时刻。

### 第 2 周：闭环卖点域（skills 为主，diff 是其中一张工单）

| 工单 | 内容 | 验收 |
|---|---|---|
| W2-1 skills 单一真相源（最重） | **三步走，顺序不可颠倒**：① core 接线 `skills.Loader→Registry→orchestrator.WithSkills`（main.go 装配，此步完成前 `/api/skills` 供什么都是假的）② `/api/skills` 改供 Registry ③ 前端 SkillsPage + antdx promptData（`/` 联想，commit 335e00f）同步切换数据源——**联想必须同步切，否则造出第四个源** | 界面启用的技能 Agent 真能加载；`/` 联想名单 = 后端真相源 |
| W2-2 diff 审批闸 | 前提两条：删 diff_handler.go 三条旧 security 路由（防 ServeMux 重复注册 panic）→ main 构造 Generator/Manager → 挂载 `core/internal/diff` 路由 → 契约测试补钉 → ReviewPanel 订阅 `diff.created` 刷新。**同 PR 砍 `/api/diffs` 六条（§10.3 拍板：挂载即取代不留双轨期；grep 零消费前置，有消费者回来重议）**。**DoD 附加：本工单改造到的 RightWorkspacePanel 代码区，内联色值迁入 token/module.css（D-27-7）** | ReviewPanel 列表/审批/apply-all 全通，不再 404；全仓库只剩一套 diff 端点 |
| W2-2b 内联纯展示收口 | 按 ADR-002 边界三条落地：DiffViewer 确认零写操作调用 + 共用渲染核 + 加"在审查面板中打开"深链（runID/path 过滤）；面板条目回链对话轮次 | ADR-002 三条边界全部可验证 |
| W2-3 mcp 分诊 | 分诊 `/api/mcp` 是壳还是真、未挂载包里有无真能力；产出扩展四页"接/留/砍"清单 | 清单落档，四页去留拍板 |
| W2-4 侧栏现代化（D-27-10 载体） | **前置 = W1-1 已完成**（数据源定型后再换渲染层；顺序颠倒 = 对着即将变形的数据层做迁移，白干）。a) **antdx Conversations 接管会话列表**：items/activeKey/onActiveChange/groupable（工作空间分组+折叠）/menu（重命名/置顶/导出/归档菜单原样搬）/creation；**数据层零改动**——taskStore、useSession 同步逻辑、conversationCache 全不动，仅换渲染层（延续 doc/26 迁移打法）。b) 组操作菜单经 groupable.label 渲染器包 antd Dropdown。c) 导航三项 + 扩展折叠区换自研 NavRow（规格见 D-27-10 ②），扩展区折叠沿用现有 extOpen state。d) **⌘K 冲突处置**：antdx shortcutKeys 的 creation 默认绑定 Win/⌘+K，与 W3-2 命令面板计划冲突——迁移时必须禁用或改绑 creation 快捷键，⌘K 留给命令面板独占；Alt+数字切换会话可保留（白赚能力）。e) CapsuleTabs 第二档归宿附注决策项（与 ADR-003 联判，见 D-27-10 ③）。**备注：与 W3 扩展区转正是复用关系不是冲突——届时扩展四页入口直接用同一 NavRow** | ① antdx 接管列表/分组/操作菜单/creation 全部生效；② doc/26 §3.2 翻案补记完成（原文"保留自研"结论作废并注明理由与新结论）；③ ⌘K 冲突处置落地；④ doc/02 胶囊家族补 NavRow 一件；⑤ 侧栏从上到下统一胶囊语言，antd 退至弹窗/下拉等无形状暴露处（第三级合法用法） |

### 第 3 周：手感层

| 工单 | 内容 | 验收 |
|---|---|---|
| W3-1 真快捷键 | 全局 keydown 绑 Ctrl+F/Ctrl+N/Ctrl+,/Ctrl+B/Ctrl+Shift+F（注意输入框焦点冲突） | 菜单标签与实际能力一致 |
| W3-2 Ctrl+K 命令面板 | 数据源 = 路由白名单 + taskStore 任务 + 技能 + 动作（切主题/开面板/切会话）；升级 GlobalSearchModal 并删 theme-preview 死条目。**注记（2026-08-20）：⌘K 归命令面板独占；antdx Conversations 的 creation 快捷键已在 W2-4 禁用/改绑，此处无需再处理，仅登记防回退** | 静态 19 条退役 |
| W3-3 ShortcutsModal 改实 | 从说明书变真实映射，删"设置快捷键"假按钮 | 所列快捷键全部可用 |
| W3-4 settings/models 域接线（D-27-7 载体） | SettingsPage 从 settingsStorage 切 `GET/POST /api/settings`；模型配置从 modelProviderStore 切 `/api/models` + `/api/models/test`（ProviderEditor 连接测试真调）；**施工第一步先分诊 `app.Models()`/`app.Settings()` 数据源真伪（skills 硬编码教训——端点真数据源假则先修后端）** | 设置与模型配置换机不丢；ProviderEditor 测试按钮真实测通。**DoD 附加：本工单改造到的代码区（SettingsPage/ProviderEditor/ModelPicker），内联色值迁入 token/module.css（D-27-7 债随工单消化）** |

**整体验收**：键盘完成 新建→输入→发送→暂停→恢复 全程不碰鼠标。

### 第 4 周：清场 + 拆神像 + 守门

| 工单 | 内容 |
|---|---|
| W4-1 清场 | 删 §4 白名单中 🗑 项 + 白名单外占位入口；WorkspacePage 重定向。**FeedbackModal 降级为真动作（用户拍板，默认项）**：保留入口，提交改为 `openExternal` 跳 GitHub Issues，正文预填版本/系统/工作模式；**不建后端反馈端点**——cloud server 尚属 in-memory 开发态，在其上建反馈收集是制造新假承诺；工时不够则退回纯撤入口（二选一，默认前者）。**封存主题删除**（D-27-8）：bootstrap/illustration/glass 三主题文件 + antd-style 依赖引用 + 主题入口一并移除。**后端减法批次**（§10.3 拍板，每项纯删除不夹重构、go build + go test 验收）：① 四包 routes 层（toolregistry/modelgateway/safety/diagnostics，包体保留）② `/api/tasks*` 内存版 7 条 + plugins 包（砍前 grep 全前端 + tests/e2e 确认零消费）③ preload 幽灵桥全清（跟随其桥接端点同批）④ `/api/security/decisions` 3 条按条件判决执行（grep 零消费且 W2 审批工单不消费则砍，否则留并标注）。**假承诺兑现批次（2026-08-20 扩充六项，均属"41 处后续接入文案"点名实例，执行时按点名优先）**：① **AppMenu 菜单栏同步清理**——任务菜单当前挂着 /workspace（地图工作区）、/data-center（数据资产）、/agent-studio（Agent 编排）、/mobile-control 四条待裁路由；ADR-003 裁导航时盯的是 IconRail 与路由表，菜单栏这处易漏；不同步清理的后果是页面删了菜单还在，点进去 404。② **帮助菜单"帮助文档后续接入"**（AppMenu.tsx，message.info 假承诺）降级为真动作——openExternal 跳 GitHub 仓库 README（url-guard 白名单已放行 https，与 FeedbackModal 降级同模式同 PR）。③ **导出对话"后续接入"**（AppShell.tsx handleExportChat，message.info 假承诺）二选一——真实现（数据在 conversationCache/taskStore，导出 JSON 或 Markdown）或隐藏入口；默认真实现，工时不够退隐藏。④ **"在文件夹中打开"**（AppShell.tsx handleOpenFolder，message.info 假承诺）接上而非砍——桌面端能力半存在（AppMenu 已在调 window.geowork.desktop.chooseFolder IPC 桥），主进程补一个 shell.showItemInFolder handler 即可，十几分钟小活，与第 ② 条同批。⑤ **IconRail 孤儿处置**——shell/IconRail.tsx（约 2KB）不在当前 AppShell.tsx 的 import 表中，大概率被 8 月中旬 Gemini 侧栏改版顶替；二选一：删文件，或复活（若 ADR-003 裁完导航只剩 3+1 项，56px 窄图标栏 + NavRow hover 态是适配组合）；**留待用户拍板，先登记**。⑥ 以上 ①~④ 条在横切债处置行下有点名引用（见 §2） |
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

- GIS 地图工作区真做（v0.8，D-27-9）
- Extensions 四页新增功能（先分诊定去留）
- `/api/ws` 信令替换 HTTP 审批（第 5 周起评估）
- 任何新页面（白名单冻结，只减不增）

---

## 9. 执行记录

| 周 | 提交 | 与计划的偏差 |
|---|---|---|
| 第 0 周 | ca8b67b / fb09ecd / 65bf8da / ee8e06d | 无 |
| 第 0 周补档（2026-08-20） | （本次） | 侧栏现代化讨论拍板落档：D-27-10 + W2-4 + W1 四工单设计细节 + W3-2 注记 + W4-1 扩充六项 + CI 触发前置第 0 项；纯文档，零代码改动 |

---

## 10. 后端死代码分诊清单（第 0 周收尾交付物，2026-08-19 落表）

> **判决规则**（用户拍板）：有前端工单消费→**接**；P0-P3 能力但 v0.6 白名单外→**留**（标注理由与决策点）；纯死代码→**砍**。输入源附加：ADR-003 移除页面的后端对应域优先问"砍"。
> **执行方式**（用户拍板）：清单现在出（本节），执行按判决并入——"接"挂各自载体工单，"砍"集中挂 W4-1 与撤假承诺同批减法，"留"标注理由与决策点。判不了的进"待拍板"列攒一批一次性问用户。

### 10.1 十三个未挂载包（均有 routes.go，均无 NewRoutes 调用方）

| 包 | 行数/测试 | 现状 | 判决 | 载体工单 | 状态 |
|---|---|---|---|---|---|
| diff | 1063/1 | 未挂载；Manager/Generator 真实现；ReviewPanel 调它的端点（404 断链） | **接** | W2-2（先删 diff_handler.go 三条旧路由防 panic） | 已定 |
| mcp | 1020/0 | 未挂载；Manager 真实现（Connect/CallTool）；活路由 `GET /api/mcp` 疑为壳 | **接**（分诊后） | W2-3 | 已定 |
| workspace | 496/0 | 未挂载；与活 workspace_handler（tree/read/write/import 已注册）**重复** | **砍** | W4-1 | 已定 |
| automation | 263/0 | 未挂载；与活 `/api/automations` + aiagent schedule **重复** | **砍** | W4-1 | 已定 |
| artifacts | 339/0 | 未挂载；与活 artifact_handler（`/api/artifacts`）**重复** | **砍** | W4-1 | 已定 |
| plugins | 579/0 | 未挂载；活 `/api/plugins` 走 runtime.App，不经此包 | **砍**（若 W2-3 判 plugins 要接，走活端点） | W4-1（砍前 grep 全前端 + tests/e2e 确认零消费） | 已定 |
| toolregistry | 5829/6 | 未挂载（routes 层）；**包体是 orchestrator 内部依赖不能砍**；12 条路由与活端点重复（/api/tools 在 project_handler、checkpoints 在 aiagent） | **砍 routes 层、保包体**（纯删除不夹重构） | W4-1（go build + go test 验收） | 已定 |
| modelgateway | 3594/7 | 未挂载（routes 层）；**包体是 LLM 主通道（doc/25 刚加固）**；7 条路由与活 `/api/models` 重复 | **砍 routes 层、保包体**；前端接活端点 | W4-1（routes 层）/ W3-4（接活端点） | 已定 |
| sandbox | 2554/2 | 未挂载（routes 层）；Service 真实现；终端走 node-pty IPC 不经此；包体或被工具链内部引用 | **留**（P0-P3 真实现，砍了 v1.0 要重写） | 标 W4 沙箱设置消费点 | 已定 |
| permissions | 2362/4 | 未挂载（routes 层）；Engine/Policy 真实现（BP1 权限引擎）；main.go 已接 policy table；白名单外无取代者 | **留**（P0-P3 安全能力） | v1.0 决策点；preload 幽灵桥无论端点去留都砍（W4-1） | 已定 |
| safety | 648/1 | 未挂载（routes 层）；**包体是 guardrails 实现（doc/22 BP4 刚修过）**；2 条路由未挂载 | **砍 routes 层、保包体** | W4-1 | 已定 |
| diagnostics | 1161/0 | 未挂载（routes 层）；**包体被活 diagnostics_handler 依赖**（health 已通）；5 条路由与活端点重复 | **砍 routes 层、保包体** | W4-1 | 已定 |
| browserbridge | 817/0 | 未挂载；CDPAdapter 真实现；前端 BrowserPanel 走 webview 直连不经此 | **留**（P0-P3 能力，白纸/论文检索关联 v0.8） | — | 留，v1.0 决策点 |

**小结**（2026-08-19 全部拍板）：接 2（diff/mcp）· 砍 4 整包（workspace/automation/artifacts 纯重复 + plugins）+ 4 个 routes 层（toolregistry/modelgateway/safety/diagnostics，包体保留）· 留 3 整包（sandbox/permissions/browserbridge）+ 4 包体。routes 层删除为纯删除提交、不夹重构，go build + go test 验证编译即验收。

### 10.2 活路由上无前端消费者的端点（按域归组）

| 端点组 | 现状 | 判决 | 载体工单 | 状态 |
|---|---|---|---|---|
| aiagent runs 全套（list/pause/resume/stop/delete） | 挂载无消费者 | **接** | W1-1 | 已定 |
| aiagent checkpoints 全套 | 挂载无消费者（404/409 语义齐备） | **接** | W1-2 | 已定 |
| aiagent usage/{runId} + usage/summary | 挂载无消费者 | **接** | W1-3 / W1-4 | 已定 |
| aiagent approvals/{runId} 列表 | 挂载无消费者（approve/reject 已接） | **接** | W1-1 顺带 | 已定 |
| `/api/skills` + run | 挂载无消费者（数据源硬编码） | **接**（先接线 Loader） | W2-1 | 已定 |
| `/api/models` 系列 | 挂载无消费者 | **接**（先分诊数据源） | W3-4 | 已定 |
| `/api/settings` | 挂载无消费者 | **接**（先分诊数据源） | W3-4 | 已定 |
| `/api/mcp`（活） | 挂载无消费者，疑为壳 | **接**（分诊后） | W2-3 | 已定 |
| aiagent trajectory 系列 | 挂载无消费者 | **留** | 第 5 周起增值（回放视图） | 已定 |
| aiagent schedule/triggers | 挂载无消费者 | **留** | v0.7 决策点 | 已定 |
| aiagent events/stream（全局） | 挂载无消费者（会话级 SSE 已够用） | **留** | v0.7 决策点 | 已定 |
| `/api/projects*` + `/api/deliveries`（5 条） | 挂载无消费者 | **留**（P0-P3 项目管理，白名单外） | v1.0 决策点 | 已定 |
| `/api/datasets` + `/api/map/layers*`（4 条） | 挂载无消费者 | **留**（GIS/遥感 = v0.8，D-27-9） | v0.8 | 已定 |
| `/api/papers` + `/api/knowledge` + v1 papers/knowledge/ndvi（~10 条） | 挂载无消费者 | **留**（v0.8 域） | v0.8 | 已定 |
| `/api/environment/checks` + `/api/worker/geo/check` | 挂载无消费者 | **留**（v0.8 GIS 环境检查） | v0.8 | 已定 |
| `/api/automations*` + automation-runs（3 条） | 挂载无消费者 | **留**（定时任务扩展能力） | v0.7 决策点 | 已定 |
| `/api/artifacts*`（活，3 条） | 挂载无消费者 | **留**（成果物能力，白名单外） | v1.0 决策点 | 已定 |
| `/api/tools` + `/api/eino/schema` | 挂载无消费者 | **留**（工具透明化或 v0.7 消费） | v0.7 决策点 | 已定 |
| `/api/v1/workflows*` + runs（AgentStudio 域） | 挂载无消费者；ADR-003 已移除 AgentStudio 页 | **留**（W4 自动化域载体候选） | W4 工单第一步分诊数据源真伪 | 已定 |
| `/api/tasks*`（内存版，7 条） | 挂载无消费者；已被 `/api/db/tasks` 取代，preload 存幽灵桥 | **砍**（连同 preload 幽灵桥） | W4-1（砍前 grep 全前端 + tests/e2e 确认零消费） | 已定 |
| `/api/sandbox/*`（4 条） | 挂载无消费者（终端走 node-pty） | **留**（P0-P3 真实现，砍了 v1.0 要重写） | 标 W4 沙箱设置消费点 | 已定 |
| `/api/permissions/*`（3 条） | 挂载无消费者；preload 存幽灵桥（approve/deny 路径后端不存在） | **留**（BP1 权限引擎真实现，白名单外无取代者） | v1.0 决策点；幽灵桥无论端点去留都砍（W4-1） | 已定 |
| `/api/security/decisions` + approvals POST + decisions/{id}（3 条） | 挂载无消费者；决策记录真源是 AuditEntry，API 版疑似重复 | **条件拍板**：grep 零消费且 W2 审批工单不消费→**砍**挂 W4-1；有消费→留并标注 | 判决随 grep 直接落表 | 已定（条件） |
| `/api/diffs*`（活，6 条） | 挂载无消费者；与 W2-2 将挂载的 diff 包 `/api/security/diff` 系列两套并存 | **砍**（保 security/diff 组——正统性来自消费方与能力匹配，apply/rollback 只在新包） | **与 W2-2 挂载同一个 PR**——挂载即取代，不留双轨期（活路由双轨期就是 ReviewPanel 接错线的窗口）；grep 零消费前置，有消费者回来重议 | 已定 |
| `/api/usage/summary` + records（project_handler 版） | 挂载无消费者；与 aiagent usage（W1-4 消费）**重复** | **砍**（诱饵不是哑弹：接错照样 200，返回 project 维度数据，界面照常渲染只是数字错） | **提前到 W1-4 开工前砍**——先拆，W1-4 就接不错 | 已定 |
| `/api/experts` | 挂载无消费者 | **待拍板**（随 W2-3 扩展四页去留） | W2-3 | 待拍板 |
| `/api/v1/cron/due` + `/api/v1/files/watch/scan` | 挂载；server/内部消费疑 | **留**（内部调度） | v0.7 核实 | 已定 |
| `/api/ws` | 挂载无消费者 | **留**（ADR-001 规划，第 5 周起评估） | 第 5 周起 | 已定 |
| preload 幽灵桥（`POST /api/workspaces`、`POST /api/permissions/requests/{id}/approve\|deny`） | 桥接后端不存在的路由 | **砍**（幽灵桥禁令，doc/15 §2.6） | W4-1 | 已定 |

### 10.3 拍板记录（2026-08-19 用户攒批拍板，7 项全部落定）

| # | 事项 | 判决 |
|---|---|---|
| 1 | 四包 routes 层（toolregistry/modelgateway/safety/diagnostics，26 条重复路由） | W4-1 统一删 routes 层、保包体；纯删除不夹重构，go build + go test 验收；"无害保留"不成立——apiClient.ts 318 行同款理由：未挂载死路由是给 AI 辅助开发埋的地雷 |
| 2 | /api/tasks* 内存版 + plugins 包 | 全砍挂 W4-1（取代者已上线、无近期消费工单），砍前 grep 全前端 + tests/e2e 确认零消费；preload 幽灵桥跟随其桥接的端点同批清 |
| 3 | /api/usage project_handler 版 | **提前到 W1-4 开工前砍**——诱饵不是哑弹：接错照样 200，返回 project 维度数据，界面照常渲染只是数字错。先拆，W1-4 就接不错 |
| 4 | diff 两套并存 | 砍 /api/diffs 六条、保 /api/security/diff（core/internal/diff）；**与 W2-2 挂载同一个 PR，挂载即取代不留双轨期**；"先注册即正统"不成立——正统性来自消费方与能力匹配，apply/rollback 只在新包，保旧族要重写 ADR-002 + preload，零收益 |
| 5 | /api/sandbox/* | 留——P0-P3 真实现，砍了 v1.0 要重写；标 W4 沙箱设置消费点 |
| 6 | /api/v1/workflows* | 留——W4 自动化域载体候选，W4 工单第一步分诊数据源真伪 |
| 7 | /api/permissions/* + /api/security/decisions | permissions 留（BP1 权限引擎真实现，白名单外无取代者，v1.0 决策点）；security/decisions 条件拍板——grep 零消费且 W2 审批工单不消费则砍挂 W4-1（决策记录真源是 AuditEntry，API 版疑似重复），有消费则留并标注。**幽灵桥无论端点去留都砍** |

**减法五原则**（本轮拍板提炼，后续所有砍/留判决沿用）：

1. **诱饵先拆，哑弹可等**——接错照样 200 的重复端点（如 project 维度 usage）必须在消费工单开工前砍；未挂载死路由可以排到 W4-1
2. **减法在前，门禁在后**——契约测试该锁定唯一真端点，重复端点活着只会污染契约面；否决"等契约门禁后再砍"
3. **挂载即取代，不留双轨期**——新路由挂载与旧路由删除同一个 PR；活路由双轨期就是前端接错线的窗口
4. **正统性来自消费方与能力匹配，不来自先注册**
5. **删除提交必须纯删除、不夹重构**，编译 + 测试绿即验收
