# Changelog

> **状态：活跃维护**
> 本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## 格式规范

### 分类

- `Added` — 新功能
- `Changed` — 对现有功能的变更
- `Deprecated` — 即将移除的功能
- `Removed` — 移除的功能
- `Fixed` — 对现有功能的修复
- `Security` — 安全相关修复

---

## [Unreleased]

### Added — v0.6 前端现代化第 0 周定盘子：doc/27 + ADR-002/003 + DoD + 文档纠偏（2026-08-19 · ZCode）
- **doc/27-Frontend-Modernization-Plan.md 新建**：五支柱北极星 + 九域现状表（观测/恢复域后端就绪前端零消费、diff 审批闸断链、skills 三源、41 处占位）+ DoD 三条 + 导航白名单 + 五周排期（W1-1~W4-6 逐张工单带验收）；纯文档周，零代码改动
- **ADR-002（diff 双闸）**：事前 ApprovalCard / 事后 ReviewPanel 双闸模型；用户拍板 DiffViewer 与 ReviewPanel 分工，三条边界钉死（单一渲染核 / 互链成环 / 写操作只属于面板）；接线五步前提含删旧路由防 ServeMux panic
- **ADR-003（导航白名单）**：保留 3 页 / 分诊 4 页 / 移出 4 页 / 删除 4 份死代码，只减不增，恢复需走 ADR 修订
- **AGENT.md**：§4.5 新增 DoD 三条（真 API + 三态齐全 + 错误兜底，不齐不得进导航）；§7 终端通道改实（node-pty IPC，WS 标注规划未接线）+ 端点边界纪律与 preload 幽灵桥禁令；ADR 索引登记 002/003；版本表补 v1.14；§1 版本口径归一 v0.6.x-dev
- **DEV_VERSION_CHECKLIST 纠偏**："后端尚未就绪"过期作废，联调状态按域列表（已联调 4 域 / 待接 3 域）；F2-2 模板分发废弃（与 chat-first 背道而驰）；FP3-2 CSS 数值目标改纪律；已知限制补七项真实债（diff 断链 / 悬空变量 / 假快捷键 / 死条目 / 占位文案 / Extensions mock / 版本三口径悬案）；版本升 v0.6.0-dev
- **doc/02**：F0-2 后补记 cssVar 决策（92 处悬空 var(--ant-color-*) 与 !important 并入 Button token）与样式纪律
- **doc/15**：新增 §2.6 契约测试即边界（渲染层只可调契约测试钉住的端点 + preload 幽灵桥禁令，教训：ReviewPanel 断链）
- **README.md / README.en.md**：版本口径同步 v0.6.x-dev
- **D-27-7 内联样式终版拍板（同日补充）**：债随工单消化——W2-2/W3-4 工单 DoD 附加"本工单改造到的代码区，内联色值迁入 token/module.css"；W4-6 残留闸门（四重灾区文件非 token 内联色值 >约 20 处再半天清扫，否则维持纪律）；~380 处在 ADR-003 待移除页面不动（负收益）；**新增 W3-4 settings/models 域接线工单**（SettingsPage→/api/settings、模型配置→/api/models+test，充当 D-27-7 载体并填补 settings 域无排期工单的缺口，施工先分诊 app.Models()/app.Settings() 数据源真伪）
- 影响代码文件：无（零代码改动）

### Changed — 许可临时切换为 MIT（2026-08-17 · ZCode）
- **根 LICENSE 换为 MIT License**（Copyright (c) 2026 Wanfeng1028），开发预览阶段临时采用
- **原 GeoWork Community License（PolyForm Noncommercial 1.0.0）未删除**：`LICENSE` 移入 `licenses/LICENSE-COMMUNITY` 保留，正式发布时切回
- README.md / README.en.md 许可章节与徽章同步更新，并注明临时切换安排；AGENT.md 许可行同步

### Added — Windows 沙箱 W3：MaxMemoryMB 真实强制 + NetworkAccess 删除 + 诚实清单更新（doc/25 收官，2026-08-17 · ZCode）
- **MaxMemoryMB 真实强制**：`SandboxPolicy.MaxMemoryMB` 从死字段变为 Job Object 每进程提交上限的真实来源（policy → Spawn → jobobject.New）；新增 Service 级钉桩测试（256MB 上限拦截 512MB 分配，Windows）。builtin tools 的硬编码 512MB 改为 `GEOWORK_SANDBOX_MEM_MB` 环境变量可覆盖（与 LOW_INTEGRITY 开关同模式）
- **NetworkAccess 字段删除**：Job Object 不管网络，保留该字段是说谎的旋钮——删除而非假装。`network_policy.go` 的 NetworkValidator 保留（上层校验器，非子进程强制），SandboxPolicy 注释说明二者关系
- **诚实清单三处同步**：SandboxPolicy 结构体注释 + spawn.go 头注释 + Python runner docstring——内存上限✅(Windows)、进程树终止✅、低完整性写盘✅(best-effort)、网络隔离❌未强制（WFP 需管理员，明确不做）
- 测试：`go test ./...` 全绿（含新增 TestRunPythonScript_MemoryLimitEnforced）

### Fixed — E2E smoke 适配 antdx 默认输入区：testid 漂移修复（doc/20，2026-08-17 · ZCode）
- **根因**：doc/26 迁移后 `aiComponentsV2` 默认 true，`/new-task` 渲染 SenderX（testid `sender-x`），smoke 仍断言旧 `chat-composer` 锚点，e2e-smoke / e2e-smoke-windows 自 R1 起持续红
- **修复**：新增 `tests/e2e/pages/sender-x.page.ts`（根锚点 `sender-x` + antd-x Sender 内部稳定 class 锚点 `textarea.ant-sender-input` / `.ant-sender-actions-list button.ant-btn-primary`），desktop-smoke 与 task-flow 两个 spec 切换；doc/20 §2.2 锚点表补 sender-x 条目、§2.3 补充第三方库 class 锚点例外规则

### Added — AI 组件 Ant Design X 迁移二期：Prompts 接真实数据 + Suggestion 输入联想（doc/26 收官，2026-08-17 · ZCode）
- **Prompts 真实数据**：新增 `antdx/promptData.ts` 共享数据层（与 ContextPickerModal 同一 skillsStorage/expertStorage 数据源）；WelcomeX 推荐区从写死文案改为已安装+启用技能（点击填入「使用技能「X」：」引导语），无技能时回退 GIS 场景文案
- **Suggestion 输入联想**：SenderX 用 antd-x `Suggestion` 包裹 `Sender`——输入 `/` 弹出已安装技能与专家快捷命令（`/缓冲区分析` 等），方向键导航、Enter 选中填入输入框（Sender onKeyDown 返回 false 阻断提交）
- **虚拟滚动调优**：ConversationX estimateSize 固定 120 → 按角色分层（user 72 / assistant 220），measureElement 实测修正
- **评估结论**：审批卡片/工作流卡片/侧栏 Conversations 保留自研（语义或数据模型不匹配，详见 doc/26 §3.2）；AssistantChatPanel 暂不迁移；暗色主题零改动（antdx 树零硬编码色值）
- 测试：新增 4 条，前端 114/114 全绿；vendor-antd +62.7KB（Suggestion 组件，仍仅懒加载页面引用）

### Added — AI 组件 Ant Design X 迁移一期：自研组件入口关闭，antdx 渲染树接管主对话页（doc/26，2026-08-17 · ZCode）
- **开关分流**：`GeoWorkSettings.aiComponentsV2`（默认开）+ 设置页「实验特性」区 Switch；关闭即回退自研组件（doc/23 资产保留不删，入口关闭 ≠ 删除）
- **antdx 渲染树**（`pages/NewTask/components/antdx/`）：MessageBubbleX（Bubble + ThoughtChain，assistant 内容复用 MarkdownStream，thinkingSteps → ThoughtChain loading 态）/ ConversationX（Bubble.List 无内置虚拟化，自持 @tanstack/react-virtual 保住 A5 长会话性能，贴底跟随；审批卡片复用 ApprovalCard）/ SenderX（Sender + allowSpeech 内置语音替代手写 Web Speech + 附件菜单 + 模式/模型选择）/ WelcomeX（Welcome + Prompts 按工作模式推荐 GIS 任务）
- **数据层零改动**：Session 对象层 / SSE 状态机 / conversationCache 不动，useSession 快照是唯一数据源，仅换渲染层；MarkdownStream/DiffViewer/ToolCallTimeline/WorkflowRunCard 等自研组件挂进 X 组件复用
- **包体积**：@ant-design/x 进 vendor-antd chunk（+284KB），仅 NewTaskPage 懒加载 chunk 引用，不进首屏
- 测试：新增 antdx 7 条，前端 110/110 全绿；test/setup.ts 补 ResizeObserver polyfill（jsdom 缺失）

### Security — server/ 专项审查 S1：六项安全缺陷修复（doc/25，2026-08-17 · ZCode）
- **软删用户仍可登录**：Login/Refresh/auth 中间件现在都检查 `DeletedAt`；DeleteAccount 同步吊销全部 token（此前软删账号的旧 token 可用到自然过期）
- **sync cleanup 越权**：`POST /sync/cleanup` 此前执行无 user 条件的 DELETE（admin 检查是空注释），任何登录用户可清空所有人的过期 sync 数据；改为严格 per-user（新增 `DeleteUserSyncRecordsBefore`）
- **billing mock 自我升级**：`/checkout/mock` 任何登录用户可自升 team + 铸 credits；现由 `GEOWORK_BILLING_MOCK=1` 门禁，未开启返回 404
- **crash 报告 ID 碰撞**：秒级时间戳 ID 并发改为 idgen 随机 hex；无鉴权的 crash 端点挂专用限流器
- **token 表无限增长**：auth 服务启动时清理过期 token（新增 `DeleteExpiredTokens`）
- **CORS file:// 全放行**：收紧为仅 `GEOWORK_DEV=1` 允许 file:// 源
- 测试：每项修复一条回归测试（auth 4 条、sync/billing/crash/CORS 各 1-4 条）

### Fixed — server/ 专项审查 S2：数据完整性（doc/25，2026-08-17 · ZCode）
- **迁移 006 从未执行**：`006_cursor_milliseconds.sql` 在磁盘上但未注册进 migrations.go，ns→ms sync cursor 归一化对任何数据库都不生效；已注册
- **modelproxy 配置重启即丢**：providers 从内存 map 持久化到 SQLite（迁移 007 建 `model_providers` 表），启动时加载回内存
- **modelproxy Chat/Stream 恒 400**：`provider_id` 此前读无人写入的 context key；改从请求体读取并在转发前剥离；补 modelproxy 测试（此前为零）

### Changed — server/ 专项审查 S3：诚实化收尾（doc/25，2026-08-17 · ZCode）
- usage 上报 sanity 校验：拒绝负数与单次 >1e9 的异常值（计量仍是 honor-system，plan limits 为信息性，已注释注明）
- `role_permissions` 死表在迁移 004 标注 unused（不删表，保迁移链稳定）；marketplace 占位签名双处标注"未实现验签"
- doc/09 新增 §10 云端同步协议语义：LWW、毫秒游标、无 tombstone、无设备身份——与代码现状对齐

### Changed — Router/Cache 产品化 R1：显式 mode 贯通 + Router 接线（doc/25，2026-08-17 · ZCode）
- **mode 走 context**：新增 `modelgateway.WithMode(ctx, mode)`，orchestrator 在流式/兜底模型调用前注入 `run.Mode`；Router 从 ctx 读 mode 路由——删除 `inferMode` 死代码（系统提示从未嵌入 "Mode:" 标记，扫描永远返回空）
- **Router 进生产链路**：gateway 栈改为 Router(AddProvider) → RateLimitedGateway；单 provider 无规则走默认，加第二个 provider 或 mode 规则变成纯配置改动
- **成本不再恒 0**：`ProviderRegistry.Add` 更新路径此前丢弃 `PricePer1KInput/Output`，已修；`initModelGateway` 新增 `GEOWORK_LLM_PRICE_INPUT/OUTPUT` 环境变量填价格
- 测试：ctx mode 路由命中/默认/fallback + ModeFromContext 边界

### Added — Router/Cache 产品化 R2：流式成本记录 + 预算控制接线 + MaxRetries 实现（doc/25，2026-08-17 · ZCode）
- **流式成本记录**：`StreamChatWithFallback` 返回的 channel 包一层观察 goroutine，捕获尾部 usage chunk（stream_options.include_usage），流结束后按 provider 自身定价记入 CostController——此前流式调用零成本记录，预算守卫永远看不到真实花费
- **预算接线**：`GEOWORK_LLM_DAILY_BUDGET`/`GEOWORK_LLM_MONTHLY_BUDGET`（美元，0/未设=不启用）→ `router.SetCostController`；超限调用在发 HTTP 前以 `ErrBudgetExceeded` 拒绝，run 失败带明确原因
- **MaxRetries 落地**：`RoutingRule.MaxRetries` 此前声明未用；现为主 provider 失败后的路由级重试次数（ctx 取消立即停止），再走 fallback
- 测试：流式 usage 进 CostController、流式预算拦截、MaxRetries=2 共 3 次尝试、ctx 取消不重试

### Added — Router/Cache 产品化 R3：CachedGateway 装饰器，Router/Cache 转正（doc/25，2026-08-17 · ZCode）
- **CachedGateway**：新增 ModelGateway 装饰器（复制 RateLimitedGateway 形态），生产栈变为 Cache→Router→RateLimit；`GEOWORK_LLM_CACHE=1` 启用（默认关，TTL 15min/256 条）。只缓存非流式、无 tools 请求、响应无 tool_calls 的 Chat——摘要类重复调用是主要受益者；mode 参与 key，Paper 模式答案不会在 Code 模式重放
- **cache 缺陷修复**：key 改 hex 编码（此前 "mw:" 后是任意字节）；Get 命中刷新时间戳（LRU 语义，此前是 FIFO 会逐出热条目）；Get 时清除过期项（此前过期条目永驻内存）；HashTools/HashContext 同步 hex 化
- **转正**：cache.go 头部 EXPERIMENTAL 注释移除；doc/22 D-B4 与 §6 对应条目更新为已完成
- 测试：命中/未命中、TTL 过期、tools 请求不缓存、tool_calls 响应不缓存、流式直通、mode 分区、hex key、LRU 逐出、过期清除

### Added — Windows 沙箱 W1：Job Object 进程树终止 + 统一 spawn helper（doc/25，2026-08-17 · ZCode）
- **Job Object 地基**：新包 `sandbox/jobobject`（build tag 分平台）——`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 关句柄即杀全进程树，`JOB_OBJECT_LIMIT_PROCESS_MEMORY` 可选每进程提交上限；非 Windows 为诚实 no-op stub（内存限制明确标注未强制）
- **统一 spawn helper**：`sandbox.Spawn` 成为两条执行路径的唯一咽喉——sandbox.Service（HTTP API）与 toolregistry builtin tools（run_shell/run_python，模型真正驱动的路径）共用；此前 builtin tools 完全没有 SysProcAttr，超时只杀直接子进程、孙进程逃逸。git 类工具不进 job（低风险且需正常权限）
- **Unix 对等**：Setpgid 基础上补进程组杀——启动时捕获 PGID（Wait 回收后 Getpgid 会失败，必须提前捕获），cleanup 时 kill(-PGID)
- **诚实降级**：job 创建/assign 失败记 warn 日志并继续执行，不假装拥有隔离能力
- 测试：孙进程随超时被杀（Windows start /b + Unix 后台 &）、256MB job 上限拦截 512MB 分配（含无上限对照）、基线命令正常完成

### Added — Windows 沙箱 W2：低完整性令牌启动子进程，失败诚实降级（doc/25，2026-08-17 · ZCode）
- **低完整性令牌**：新包 `sandbox/lowintegrity`（build tag 分平台）——OpenProcessToken→DuplicateTokenEx→SetTokenInformation(TokenIntegrityLevel, S-1-16-4096)→SysProcAttr.Token；子进程只能写 Low IL 路径（如 %LOCALAPPDATA%\Low），无法写用户正常文件与大部分注册表。非 Windows 返回 (nil, nil)（不适用，非错误）
- **默认关 + 诚实降级**：`SandboxPolicy.LowIntegrity`（Service 路径）与 `GEOWORK_SANDBOX_LOW_INTEGRITY=1`（builtin tools 路径）双开关，默认 OFF——Low IL 子进程写不了 Medium IL 的 workspace，会破坏 agent 产出文件的核心工作，仅在 workspace 重标 Low IL 或纯计算场景启用。令牌创建失败记 warn 日志 + 返回降级 note，不阻塞执行
- **降级 note 贯通审计**：`Spawn` 返回 note（空=隔离完整生效）；Service 路径写入 `SandboxProcess.IsolationNote`（API 可见），builtin tools 路径经保留 key `_sandbox_isolation_note` 由 Registry.Execute 提取进 `AuditEntry.IsolationNote` 并从模型可见结果中剥离——审计永远诚实记录"隔离未生效"
- **修复堆损坏**：x/sys `StringToSid` 返回 Go 堆副本且自行释放原生缓冲，首版误对其 LocalFree 导致 STATUS_HEAP_CORRUPTION（0xc0000374）进程崩溃，已修
- 测试：`whoami /groups` 断言子进程 Mandatory Label\Low（S-1-16-4096）真实生效

### Added — P7-1 三进程联调 E2E testbed：Electron 壳 + core + worker + server 真实进程联调（doc/24，2026-08-17 · ZCode）
- **testbed fixture**：`tests/e2e/fixtures/processes.fixture.ts`（worker 级）预启 server(8767)/core(8765)/worker(8766)，全部 `GEOWORK_INSECURE_NO_AUTH=1`；支持 `GEOWORK_SERVER_BIN`/`GEOWORK_CORE_BIN` 预构建二进制（CI 快启）或 `go run` 回退；端口冲突 fail fast；健康门轮询三端点；teardown 逆序 kill（Windows `taskkill /T /F` 杀进程树）+ 清理临时 workspace/SQLite。`electron.fixture.ts` 用 `_electron.launch()` 加载 electron-vite 构建产物，测真实生产渲染路径
- **11 个 `@integration` 用例**（`projects/electron/`）：ipc-bridge（window.geowork 注入 + runtime.health/getStatus/checkHealth 经 IPC 到 core）、approval-flow（Electron 安全审批状态机：请求→待批→批准→缓存放行/拒绝移除/安全类目直放）、sandbox-real（runCommand 经 IPC 启动进程、捕获 stdout、真实 workspace 落盘、sudo 被封锁拒绝）
- **独立配置 + CI**：`playwright.electron.config.ts`（workers:1，无 webServer）；`.github/workflows/e2e-electron.yml` nightly + workflow_dispatch + paths 过滤（不进每次 push 门禁），build Electron → 预构建 Go 二进制 → worker 轻量子集 → xvfb-run 联调 E2E → 上传 report + testbed 日志

### Fixed — P7-1 生产装配修复：tray 防御 + core worker 端口附着（2026-08-17 · ZCode）
- **`electron/local/tray.ts` initTray 加防御**：图标缺失（打包路径差异）或无系统托盘（headless CI / 部分 Linux 桌面）时返回 null 不抛错——原实现 `new Tray()` 抛错会中断 `createWindow()`，导致其后 `runtime:status`/`runtime:token`/`runtime:health` 三个关键 IPC handler 全部跳过注册
- **`core/cmd/geowork-runtime/main.go` worker 自启前检测 8766 端口占用**（镜像 runtime.ts 的 isPortInUse）：外部预启 worker（P7-1 testbed 或运维进程）则附着而非重复 spawn 一个 bind 失败的僵尸进程

### Changed — A5 性能：路由级代码分割 + vendor 拆分 + 消息列表虚拟滚动（doc/23 收官，2026-08-17 · ZCode）
- **路由级代码分割**：`routes.tsx` 14 个页面全部改 react-router `lazy` 路由（AppShell 壳保持静态导入）——此前所有页面静态打进单一 5.0MB 主 chunk；现在每个页面独立 chunk 按需加载
- **vendor 拆分**：`electron.vite.config.ts` manualChunks 拆 vendor-react（759KB）/ vendor-antd（2.6MB）独立缓存 chunk，依赖不升级时哈希不变可长期缓存；不设兜底 vendor chunk，页面专属依赖（如 xterm）留在各自懒加载 chunk。首屏从 5.0MB 单 chunk 降为 3 个可缓存 chunk
- **消息列表虚拟滚动**：NewTaskPage 接入 @tanstack/react-virtual（estimateSize + measureElement 动态测量 + overscan 6 + 稳定键），长会话只挂载可视区节点；贴底跟随（距底 <80px 才自动滚动，上滑看历史不打扰，发送时重置）；顺带把 lastAssistantIdx 从 map 内 O(n²) 提到渲染前 O(n) 一次算出
- 测试：routes 懒加载冒烟 2 条（所有路由声明 lazy + 每个 lazy() 解析出 Component），前端 103/103 全绿

### Added — A4 Diff 查看器：core unified diff 生成 + diff.created 路由 + 前端内联渲染（doc/23，2026-08-17 · ZCode）
- **core 接通 diff.created 完整链路**：此前 `diff.created` 事件无会话路由（发不到会话 SSE）且 core 只产行级 diff——write_file/create_artifact 现在经 `DiffRecorder` 上下文注入上报写前/写后内容，orchestrator 用 go-difflib（真实 LCS，替换原单 hunk 简化算法）生成多 hunk unified diff 并发 `diff.created`（带 runID → EventBridge → 会话 SSE，复用既有事件路由）；payload 仅含 path/toolCallId/unified（自包含，不带全文，SSE 帧与重放缓冲保持精简）
- **前端消费**：Session 监听 `diff.created` 按 path 去重 upsert 进 assistant 消息 `fileDiffs`；新增 `DiffViewer` 组件（@git-diff-view/react 动态导入 ~320KB 独立 chunk 不进主包，antd Collapse 每文件一面板 + 增删行数徽标 + 明暗主题）接入 ConversationMessage
- 测试：Go diff 生成器 4 条（多 hunk/新文件/无变更/删行）+ recorder 3 条；前端 Session 3 条（事件填充/同路径去重留最新/缺字段忽略），前端 101/101 全绿

### Security — BP4 安全加固：guardrails 双绕过 + worker 鉴权（doc/22，2026-08-17 · ZCode）
- **修复 guardrails 符号链接逃逸（S5）**：`ValidatePath` 此前不解析符号链接——workspace 内一个指向 `/etc` 或 `C:\Windows` 的 symlink 即可穿过前缀检查；现在对目标与 allowed/blocked 根都做 EvalSymlinks（不存在的写入目标解析最长存在前缀后拼接）
- **修复 Windows 大小写绕过（S5）**：路径前缀比较在 Windows 上改为折叠比较（`c:\windows` 此前绕过 `C:\Windows` 黑名单）；本机 TEMP 恰在 `C:\Windows\TEMP` 下，顺带暴露并修复了三个测试夹具的环境碰撞
- **worker 鉴权全链路（F6，致命）**：Go core 铸造 `GEOWORK_WORKER_TOKEN` 注入 worker 子进程并逐请求携带 `X-GeoWork-Token`；Python 侧 fail-closed 中间件（常量时间比较、`/health` 豁免、未配置 token 即拒绝服务、`GEOWORK_INSECURE_NO_AUTH=1` 显式开发逃生口）+ CORS loopback 白名单——此前 127.0.0.1:8766 上任何本地进程可无鉴权调用 GEE/GDAL 工具写盘
- **沙箱诚实化（D-B3）**：runner 头部改为"强制/未强制"两栏清单，删除未被任何机制执行的 `max_memory_mb`/`network_access` 字段——不再留说谎的配置项
- **Go worker 客户端超时 20s→10min**：GEE 合成/QGIS 处理/报告渲染这类分钟级合法任务此前被 20 秒腰斩
- 测试：safety 3 个新回归 + worker 6 个鉴权测试（worker 全套 140 通过）；core_worker_contract.py 适配 insecure 启动

### Fixed — BP3 中文 token 估算修复（doc/22，2026-08-17 · ZCode）
- **修复 agent 中文失忆（F4，核心体验）**：旧 `EstimateTokens` 对每个汉字记约 78 token（真实约 1），中文系统提示"用掉"数万 token 预算 → `trimForTokens` 把历史砍到 3 条、L4 摘要/L5 记忆固化被疯狂误触发 → 对话中途失忆。新估算：CJK≈1 token/字、ASCII≈1/4 token/字符（覆盖假名/谚文/全角/中文标点）
- **修复永不失败的断言**：`TestEnforceTokenBudget` 把核心裁剪行为的断言写成了 `t.Log`——该测试此前结构上不可能失败；已改为 `t.Error` 并加大测试夹具（旧夹具在正确估算下本不该超预算）

### Fixed — BP2 审批状态机修复（doc/22，2026-08-17 · ZCode）
- **修复批准死循环（F2，致命）**：`InteractiveApprover` 新增决策记忆——按 (runID|工具|参数哈希) 记住已批准/已拒绝的调用（TTL 10 分钟），批准后的重试不再弹出重复审批请求；拒绝同样记忆、超时不记忆（超时不是用户决策）
- **修复状态机白名单死锁（实施中新发现的致命项）**：run_shell / delete_file / git_push / run_git_reset / browser_control / network_request 被 `inferStateFromTool` 推入 Editing 状态、又被 Editing 自己不完整的显式工具清单拒绝——这些工具在 ReAct 路径**永远不可达**，交互审批流也因此从未真正触发过。Editing 清单已与推断映射对齐
- **D-B2 双 Governor 重命名**：`toolregistry.Governor`（频次/配额）→ `QuotaGovernor`；`aiagent.GovernorImpl`（交互审批）→ `InteractiveApprover`——两个同名不同物的 Governor 曾让审批问题排查指向错误文件
- **审批测试从 0 到 8**：批准-重试不再重复询问（F2 回归钉）、拒绝触达模型、参数变化重新审批、拒绝记忆、超时不记忆、TTL 过期、双重 Resolve 幂等、真实 run_shell 端到端批准执行

### Fixed — BP1 装配止血：agent 端到端真正可写可执行（doc/22，2026-08-17 · ZCode）
- **修复生产装配断层（F1，致命）**：orchestrator 构造 toolCtx 只注入 runID、全仓库无人调用 `WithPolicy`，导致真实装配下 write_file/run_python/run_shell/delete_file 全部 "permission denied"——agent 只能读。新增 `aiagent.DefaultDesktopPolicy()`（D-B1：full 级，critical 工具仍走审批+Harness）并经 `WithPermissionPolicy` 接入 main.go 与每次工具调用的 ctx
- **修复高风险检查语义 bug**：`CheckPermission(ctx, name)` 传工具名，永远匹配不上按权限类（read/write/exec）键控的 Actions 表；改为 `CheckPermission(ctx, t.Permission())`
- **run_shell 沙箱最小止血（F5）**：命令串内嵌绝对路径（POSIX 与 Windows 盘符形态）逐一过 `validateSandboxPath`（`rm -rf /` 根路径用例覆盖）；run_shell/run_python 的 `cmd.Dir` 钉在运行 workspace（新增 `toolregistry.WithWorkspacePath` ctx 注入）
- **修复 retryRequest (nil,nil) 返回（F3，崩溃级）**：最后一次尝试为可重试状态时返回明确错误而非让调用方解引用 nil response
- **新增生产装配 E2E 测试**：`assembly_e2e_test.go` 复刻 main.go 装配链（builtin 工具+沙箱根+策略+Harness+PolicyTable+workspace），write_file 真实落盘/沙箱逃逸拒绝/命令扫描三测——**先红后绿**验证（无策略时复现"文件静默未写"生产症状）；现有 orchestrator 测试只注册无权限 read 工具、恰好绕开此路径的系统性盲区由此补上

### Removed — 删除第二套死代码 API 客户端，统一前端请求入口（2026-08-16 · ZCode）
- 删除 `apps/desktop/src/utils/apiClient.ts`（318 行零引用死代码）：默认指向无服务监听的 `localhost:8080`、按 `{ok, data, error}` 信封解包与 Go Core 裸 JSON 响应不兼容、鉴权读取全前端无人写入的 `access_token`、无 SSE 能力——留着必被未来开发（尤其 AI 辅助编码）误 import，是一颗"接口全部连不上"的地雷
- `shared/api/client.ts` 成为唯一 HTTP 入口（底层 `coreApi.ts` 负责 token，见下条 Security）：apiGet/apiPost/apiPut/apiDelete/apiPatch 签名不变、新增可选 `RequestOptions`（`timeoutMs` 超时覆盖、`signal` 外部取消）；`ApiError` 三分类 `kind = timeout | network | http`，`network` 可用于触发本地缓存降级、`http` 自动解析 core 业务错误码（`core/internal/api/errors.go`）
- 测试：`api.test.ts` 新增 5 用例（超时 / 网络不可达 / 业务码 / 外部取消 / 不限时），前端 75/75 全绿；契约文档 `doc/15` 升 v1.1（新增 §2.5 前端统一客户端约定）

### Security — Electron 侧安全加固 + runtime token 对接（2026-08-16 · ZCode）
- **P1-8a openExternal 协议白名单**：`shell:openExternal` / `desktop:openExternal` 此前对任意 URL 直接放行，被注入的渲染进程可用 `file://`、自定义协议唤起本地程序。新增 `url-guard.ts`，仅放行 `https:` / `http:` / `mailto:`
- **P1-8b apiKey 迁 safeStorage**：模型供应商 API Key 此前以明文存于 localStorage（XSS 可读、LevelDB 文件可直接翻出）。新增 `secret-store.ts`（Electron safeStorage，OS 级加密：Windows DPAPI / macOS Keychain / Linux libsecret），密文存 `userData/secrets.json`；`modelProviderStore` 写入时剥离明文、读取时经内存缓存回填，应用启动时自动迁移遗留明文并预热缓存；删除 provider 时同步清理 secret
- **P0-4 对接（Go 侧见 2d0dd62）**：Electron 主进程铸造随机 token（`runtime-token.ts`），经 `GEOWORK_RUNTIME_TOKEN` 注入 Go runtime 子进程；主进程 IPC 代理与健康检查自动携带 `X-GeoWork-Token`；渲染进程新增 `coreApi.ts`（`coreFetch` 带 header、`coreEventSource` 带 `?token=` query），替换 4 个文件里 8 处裸 `fetch`/`EventSource` 直连；`GEOWORK_INSECURE_NO_AUTH=1` 时全链路降级为无鉴权（仅开发态）
- 顺带修复：typecheck 3 处既有 TS6133（未使用变量）、lint 2 处既有 eqeqeq error（`== null` 改等价严格比较），`npm run typecheck` / `oxlint` 恢复全绿

### Fixed — Orchestrator 执行核心去重与修复（2026-08-15 · ZCode）
- **修复 resume 崩溃**：`ResumeFromCheckpoint` 复用已关闭的 `run.done`，`executePlanFromTurn` 收尾再次 close 导致 `panic: close of closed channel`（goroutine 内无 recover，直接崩进程）。现在 resume 前重新创建 done channel
- **修复 hook 分叉**：`executePlanFromTurn` 缺失 `OnRunStart` / `OnTurnStart` / `OnRunEnd` 三个生命周期钩子，恢复的 run 会静默绕过 per-turn 限流/审计。两个循环体合并为单一 `executePlan(ctx, run, rc, chatHistory, startTurn, resumed)`，删除 350 行重复代码
- **工具输出校验**：`OutputSchema` 此前只作为 API 元数据展示、从不校验。现在 `Registry.Execute` 对声明了 OutputSchema 的工具强制执行结构校验（type/properties/required/items 子集，零新依赖），违规输出被拒绝并记入审计日志；无 schema 的动态工具（Python Worker）不受影响
- **CI 修复**：`pr-check.yml` 的 core-check 使用 Go 1.21，无法构建 `go 1.25.0` 模块（每个 PR 必挂），已改为 1.25

### Added — Orchestrator 测试覆盖（2026-08-15 · ZCode）
- 新增 `orchestrator_test.go`：scripted gateway mock + 4 个测试（maxTurns 停止条件、无工具调用正常结束、完整 hook 序列、resume 路径 hook 行为 + 无 panic）
- 新增 `output_schema_test.go`：校验器单元测试 + Registry.Execute 集成测试（拒绝违规 / 接受合规 / 无 schema 跳过），共 8 个测试

### Added — 前端 Gemini 胶囊风格统一（2026-08-14，master）
- 三个主题 primary 色统一为 Gemini 蓝 `#3186ff`（`f16497c`）
- 全局蓝色按钮统一为 Gemini 胶囊渐变风格（`index.css` 全局样式）（`58a2de8`、`5256c86`、`5262580`、`22b3652`、`f832d3f`）
- ChatComposer 输入框重做为 Gemini 胶囊风格 + 多行输入适配 + 发送按钮圆角胶囊（`5a596a2`、`f8b0e7f`、`32afc2e`）
- Shell 组件（UsageModal / GlobalSearchModal）统一为 Gemini 胶囊风格（`8bd9098`、`7a2e743`）
- CapsuleTabs 修复指示器切换飞出问题 + resize 监听类型修正 + 切换平滑动画（`321e65c`、`04d6990`、`12a75ec`、`100eb48`、`985f736`、`ab4ae25`）
- AppShell / TitleBar / MainWorkspace 布局逻辑优化，右侧工作面板完善，连接器页响应式布局（`2e7de69`、`210200b`、`8355035`、`284351f`、`aa810c2`、`2f36f63`、`19cb2fe`、`b4ad995`、`a41304c`、`92ebc7f`）

### Added — 提交门禁（2026-08-15 · ZCode）
- 引入 husky + lint-staged：提交前对 `apps/desktop` 下 JS/TS 跑 oxlint + prettier，CSS 跑 stylelint --fix + prettier
- 引入 commitlint：commit type 白名单 `feat/fix/docs/style/refactor/test/chore/merge/revert`，关闭 subject-case 规则以兼容中文提交
- 新增 `.editorconfig`（2 空格缩进 + LF，与 Prettier 对齐；Python 4 空格、Go/Makefile tab）

### Added

### Added — 后端/Agent P0-P3 全阶段实现（TraeCodeCloud，2026-08-12，分支 `dev/TraeCodeCloud`）
- **P0**：ReAct 循环 + 状态机三者对齐 + per-run RunContext 隔离 + ContextBuilder 接线（L1-L3 三级裁剪）+ workflow/worker 工具改走 ToolRegistry（`e17c026`、`10f4305`）
- **P1**：ApprovalGovernor 审批流 + Trajectory/UsageMeter 可观测性 + SSE 断线重连（Last-Event-ID）+ WebSocket JSON-RPC 2.0 双向通信 + Pause/Resume + WorkerPool 资源限制 + Checkpoint 断点续传（`33883ec`）
- **P2**：Skills 体系（两阶段加载）+ MCP transport 集成 + 6 钩子点 Lifecycle + Cron Scheduler/Trigger + 多模型 Router（ModelGateway 实现 + 降级 + 成本控制）+ Eval 评估体系 + 浏览器工具/CDP/URL 沙箱（`3fb4646`）
- **P3**：Sub-agent（NewChildOrchestrator + spawn_subagent）+ Harness 统一规则引擎 + 流式推测执行（SpeculativeExecutor + ReadOnly）+ 5 层压缩完整版 L4/L5（Summarizer + SolidifyMemory）（`cc69658`）

### Changed
- AGENT.md §1 当前阶段更新为「P0-P3 后端施工全部完成，待验收」
- `doc/05-GeoWorkAgent-P0-Detailed-Design.md` 追加 v0.6 实现记录
- `doc/06-GeoWorkAgent-P1-Detailed-Design.md` 追加 v0.5 实现记录
- `doc/07-GeoWorkAgent-P2-Detailed-Design.md` 追加 v0.5 实现记录
- `doc/08-GeoWorkAgent-P3-Detailed-Design.md` 追加 v0.3 实现记录
- AGENT.md v1.4（2026-08-15 · ZCode）：§5 修改后 + §15.3 新增「代码改完必须同步文档」规则；§14 补记 2026-08-14 Gemini 胶囊化施工记录
- `doc/02` v0.4（2026-08-15 · ZCode）：右侧工作面板规格按代码现状修正为默认 380、可拖 320–960；F2-2 状态修正为部分完成（模板分发未实现）
- `doc/DEV_VERSION_CHECKLIST.md`（2026-08-15 · ZCode）：F2-2 状态修正、F0-3 命中数更新（6 处）、骨架屏复用项改回未完成（实际 2 处）、已知限制刷新

### Fixed
- `orchestrator.go` `ExecutionMode` int→string 转换 vet 警告（改用 `.String()`）
- `pr-check.yml` Go 版本 1.21 → 1.25，匹配 `core/go.mod` 的 go 1.25.0 要求（2026-08-15 · ZCode）
- `pr-check.yml` 前端 job 补 build + test 步骤：E0 记录声称 CI 含 build+test 但实际缺失，本次补齐使 CI 与文档声明一致（2026-08-15 · ZCode）

## [1.0.0] - 2026-08-12
- **E0 基础设施**（2026-08-12 · TraeCode AI Agent · 分支 `dev-frontend/TraeCodeCloud-SeedCode`）
  - 新增 `.prettierrc` / `.prettierignore` 统一代码格式
  - 新增 `.stylelintrc.json` CSS 样式检查规则
  - 更新 `.oxlintrc.json` 补充安全规则（no-debugger/no-eval/eqeqeq 等）
  - tsconfig 开启 `strict: true` + 路径别名（`@shared`/`@shell`/`@pages`/`@app`）
  - `electron.vite.config.ts` 同步路径别名
  - 新增 `.gitattributes` 统一行尾
  - 新增 `.github/workflows/pr-check.yml` CI pipeline（前端 lint+typecheck+build+test / Go core / Python worker）
  - 新增 `.env.example` 环境变量模板
  - `package.json` 新增 `typecheck` / `lint:styles` / `format` 脚本

- **F0 基础落地**（2026-08-12 · TraeCode AI Agent）
  - 主题入口收敛：`appearanceStore` 白名单改为 `editorial`/`editorial-dark`/`system`
  - 新增胶囊四件套：`CapsuleButton`/`CapsuleTabs`/`CapsuleTag`/`CapsuleGhost`
  - `AppShell.tsx` Segmented → CapsuleTabs，状态 Tag → CapsuleTag，主按钮 → CapsuleButton
  - `NewTaskPage.tsx` Segmented → CapsuleTabs，状态 Tag → CapsuleTag

- **F1-2 反馈三件套**（2026-08-12 · TraeCode AI Agent）
  - 新增 `PageSkeleton`（4 种模板变体：conversation/workspace/list/form）
  - 新增 `EmptyState`（3 档尺寸：sm/md/lg）
  - 新增 `ErrorBoundary`（运行时错误捕获 + 重试按钮）
  - 新增 `feedback/index.ts` 桶出口

- **F2-1 布局骨架**（2026-08-12 · TraeCode AI Agent）
  - 新增 `IconRail` 组件（56px 固定宽度，图标+tooltip 导航，三段式布局）

- **F1-3 全页面对齐**（2026-08-12 · TraeCode AI Agent）
  - NewTaskPage 接入 PageSkeleton conversation 加载态
  - TasksPage 接入 EmptyState 空态
  - WorkspacePage 接入 PageSkeleton + EmptyState
  - SettingsPage 新增"关于 GeoWork"导航

- **F2-2 页面架构**（2026-08-12 · TraeCode AI Agent）
  - AppShell 整体包裹 ErrorBoundary

- **F2-4 主题下线**（2026-08-12 · TraeCode AI Agent）
  - ThemePreview 路由注释下线
  - 废弃主题标注 `@deprecated`

- **FP3 品牌化**（2026-08-12 · TraeCode AI Agent）
  - 新增 `WelcomePage` 品牌落地页（6 项功能网格 + CTA）
  - 新增 `AboutPage` 产品信息页（版本/技术栈/许可证）
  - 根路径 `/` 指向 WelcomePage

### Changed

- `useAntdTheme` 只处理 3 种白名单值（editorial/editorial-dark/system），其余 fallback 到 editorial
- `appearanceStore` 默认主题从 `light` 改为 `editorial`

### Removed

- **F1-1 图标库替换**（2026-08-13 · TraeCode AI Agent · 分支 `feat/F1-visual-upgrade`）
  - 移除 `@ant-design/icons` 依赖（~60 种图标全量替换为 `lucide-react`）
  - 图标映射：Outlined 风格 → Lucide line 风格，保持语义一致
  - `spin` 属性替换为 CSS `@keyframes spin` 动画（全局 index.css）
  - 涉及 55+ 文件，覆盖 shell/、pages/Settings/、pages/Tasks/、pages/NewTask/、pages/Extensions/、pages/MobileControl/、pages/Welcome/、pages/Dashboard/、pages/ThemePreview/

### Dependency Changes

- 新增 `lucide-react ^0.469.0`
- 移除 `@ant-design/icons ^6.3.2`

---

## [0.5.0-dev] - 2026-08-11

### Added

- GeoWork v0.5.x-dev 开发预览版基线
- 前端设计系统 v1.5.1 定稿（Gemini 蓝系品牌色）
- 施工图 v0.1 初版（F0~F3 四阶段划分）
- 工程计划 v1.0 初版（E0~E2 三阶段）

---

## 相关文档

- 版本发布流程：`doc/17-Engineering-Release.md`
- 文档变更规则：`AGENT.md §15.3`

---

*最后更新：2026-08-12（TraeCodeCloud 补充 P0-P3 后端/Agent 全阶段实现记录）*
*最后更新：2026-08-12 · TraeCode AI Agent · 前端 F0~F2 + FP3 阶段完成记录*
