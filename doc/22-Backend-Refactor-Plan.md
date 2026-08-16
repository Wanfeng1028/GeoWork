# GeoWork 后端与 Agent 修复计划（文件级）

> **文档路径**：`doc/22-Backend-Refactor-Plan.md`
> **关联文档**：`doc/21-Frontend-Refactor-Plan.md`（前端六阶段计划）/ `doc/04-GeoWorkAgent.md` / `doc/05~08` 施工图
> **适用对象**：core / server / workers 贡献者（含 AI 编程助手）
> **状态**：**已批准，执行中**（2026-08-17 用户确认：四个决策全按推荐；每完成一个 BP 阶段独立提交）
> **审查依据**：2026-08-17 全量后端审查（aiagent / toolregistry / modelgateway / api 安全层 / server / python worker）

---

## 0. 决策（2026-08-17 用户确认：全按推荐）

| # | 决策 | 结论 |
|---|---|---|
| **D-B1** | 桌面版默认权限级别 | ✅ `DefaultLevel="full"`——本机单用户产品，critical 工具仍被交互审批 + Harness + guardrails 拦截 |
| **D-B2** | 两个 Governor 重命名 | ✅ `toolregistry.Governor` → `QuotaGovernor`；`aiagent.GovernorImpl` → `InteractiveApprover` |
| **D-B3** | Python sandbox runner 处置 | ✅ 诚实降级——只声明真正强制的约束（timeout、cwd、workspace 白名单），内存/网络明确标注"未强制"，run_command 走 Go 层审批；Windows 级隔离独立立项 |
| **D-B4** | modelgateway 四件套 | ✅ RateLimiter + UsageMeter 本轮接线（BP6）；Router/Cache 延后 v0.6 并标注 experimental |

## 1. 原则（来自审查结论）

1. **装配级正确优先于组件级漂亮**——本次 6 个阶段里 4 个是"接线"而非"重写"
2. **错误必须诚实**——假工具返回假成功、审计先记 true、SSE 静默丢事件，全部消灭
3. **每个致命修复必须钉一个"生产装配等价"的回归测试**——审查证明"测试装配 ≠ 生产装配"是最大盲区
4. **与前端计划（doc/21）的耦合点**：前端 P4 的真实 run 轮询依赖 BP1；前端 Session 的 SSE resync 依赖 BP5 的事件可靠性

## 2. 病灶清单（行号已核实，2026-08-17）

### 致命
| # | 病灶 | 位置 |
|---|---|---|
| F1 | 生产装配断层：toolCtx 只注入 runID，无任何代码调用 `WithPolicy` → 全部 write/exec 工具 permission denied | `orchestrator.go:830`、`main.go:127-131`、`toolregistry/permissions.go:27-31` |
| F2 | 审批无记忆：批准后重试 Execute 又生成新 ApprovalRequest → 死循环 | `aiagent/governor.go:99-121`、`orchestrator.go:875-878`（注释与行为相反） |
| F3 | `retryRequest` 最后一次 5xx 返回 `(nil, nil)` → 调用方 nil panic | `openai_compatible.go:299-309` |
| F4 | `EstimateTokens` 中文每字 ≈78 token（真实 ≈1）→ 上下文疯狂误裁、agent 失忆 | `context_budget.go:64-76`；`context_budget_test.go:141-147` 把错误固化 |
| F5 | `run_shell` 沙箱形同虚设：只校验 `args["path"]`，shell 参数是 `command` | `registry.go:244-252`、`builtin_tools.go:224-252` |
| F6 | Python worker 零鉴权（core 有 token，worker 裸奔）；沙箱 `shell=True`+5 命令黑名单，Windows `del`/`powershell` 全放行，512MB/网络限制未强制 | `workers/geo-python/app/main.py`（无任何 auth）、`app/sandbox/runner.py:33-60` |

### 严重
| # | 病灶 | 位置 |
|---|---|---|
| S1 | `EventBridge.Publish` 满则静默丢事件（缓冲 64）——done 丢失 = 前端永挂 | `api/task_event.go:98-136` |
| S2 | 流式 usage 丢失：IsDone 即 break，usage chunk 永远收不到 | `orchestrator.go:1148-1152`、`openai_compatible.go:351-363` |
| S3 | 内存泄漏三连：`o.runs` 只增不减、SubAgentManager 不清理、`Recovery.Cleanup` 无人调用（TempDir checkpoint 无限累积） | `orchestrator.go:459-462`、`subagent.go:116-119`、`recovery.go` |
| S4 | 事件路径竞态：`eventBuf` 懒初始化无锁；`run.Plan`/`run.Status=StatusRecovery`/`run.done` 重 arm 违反自家锁约定 | `orchestrator.go:1612-1616, 497, 1072, 1086` |
| S5 | guardrails 双绕过：不解析符号链接；Windows 大小写敏感比较 | `safety/guardrails.go:55-99` |
| S6 | 四件套未接线：main.go 直用裸 client；Router 的 `inferMode` 解析不存在的 `"Mode:"` 标记；成本两套口径 | `main.go:127-131`、`router.go:331-371` |
| S7 | 投机执行器负优化：Cleanup 在 streamModelCall defer 执行，复用检查恒 miss → 只读工具跑两遍 | `orchestrator.go:1136-1141, 851`、`speculative_executor.go:187-192` |

### 中等（BP5 一并处理）
- 假工具：`run_python/run_shell` 恒报 `exit:0, stderr:""`（CombinedOutput 合并、退出码丢弃，`builtin_tools.go:205-252`）；`run_git_add` 空壳（:410-413）；`create_artifact` 假数据（:278-286）
- 审计失真：执行前记 `Success:true`，失败再补 false（`registry.go:207-217`）
- `inferStateFromTool` 子串匹配 + 三处工具名硬编码漂移（`state_machine.go:88-105`、`orchestrator.go:1237-1262`、`permissions.go:70-75`）
- 权限引擎无界增长 + `permissions.PermissionPolicy` 与 `toolregistry.PermissionPolicy` 同名异型
- `waitForApproval` 零测试；`context_budget_test.go:115` 断言写成 `t.Log`（永不失败）
- worker：`app/tools/` 空目录、1084 行 main.py、几乎无超时

---

## 3. 阶段计划

### BP1：装配止血——让 agent 真正能干活（1.5 天，1 次提交）★最优先 ✅ 已完成（2026-08-17）

> 实施记录：`WithPermissionPolicy`/`WithWorkspacePath` 双注入落地；高风险检查改为按权限类判定；`extractAbsolutePaths` 扫描 run_shell 命令串（含 `rm -rf /` 根路径用例）；retryRequest nil 兜底；E2E 三测 **先红后绿**（无策略时 write_file 静默失败=生产症状）。TrajectoryRecorder 无存储实现可用，最小接线并入 BP6。

**新建 `core/internal/aiagent/policy_provider.go`**（约 40 行）：
```go
// PermissionPolicyProvider 按 run 返回 toolregistry.PermissionPolicy。
// 桌面单用户默认策略（D-B1 选 A）：
//   DefaultLevel: "full"，Actions: {read/write/exec: allow}
//   critical 工具不在此放行——由审批流（BP2）与 Harness 规则拦截
func DefaultDesktopPolicy() *toolregistry.PermissionPolicy
```

**修改 `orchestrator.go`**：
- L217 `Orchestrator` 结构体 + `WithPermissionPolicy(p)` 链式选项（对齐既有 `WithHarness` 模式，`orchestrator.go:369`）
- L830 `toolCtx := toolregistry.WithRunID(ctx, run.ID)` → 追加 `toolCtx = toolregistry.WithPolicy(toolCtx, o.permPolicy)`
- L875-877 修正错误注释（"第二次不会再阻塞"→ 指向 BP2 修复）

**修改 `cmd/geowork-runtime/main.go`**（L127-131 附近）：
- `orchestrator.WithPermissionPolicy(aiagent.DefaultDesktopPolicy())`
- 同段补 `WithTrajectoryRecorder` / `WithUsageMeter` 的最小接线（否则 `/api/agent/trajectory`、`/usage` 恒 503；完整接线在 BP6）

**修改 `toolregistry/registry.go`**：
- L228-238 高风险检查的语义 bug：`CheckPermission(ctx, name)` 传的是**工具名**而非权限类（`read/write/exec`），`policy.Actions` 键是权限类 → 永远 miss 落到 DefaultLevel。改为 `CheckPermission(ctx, t.Permission())` 并在 `DefaultLevel=="full"` 时放行

**修改 `toolregistry/builtin_tools.go`**（F5 最小止血）：
- `run_shell` executor（L239-252）：`cmd.Dir = workspace`（新增 args 或 ctx 注入 workspace，复用 `sandbox/filesystem_scope.go` 的 workspace 解析）；`validateSandboxPath` 扩展——对 `command` 做绝对路径扫描（`[A-Za-z]:\\` 与 `/` 开头的 token），命中 allowedRoots 外路径即拒绝。**完整命令级沙箱不在本阶段**（见 BP4 D-B3）

**修改 `modelgateway/openai_compatible.go`**（F3）：
- L309 `return resp, err` 前加：`if resp == nil && err == nil { err = fmt.Errorf("all %d attempts failed", c.maxRetries) }`

**新建 `core/cmd/geowork-runtime/assembly_test.go`**（审查指出的"最需要的那一个测试"，约 120 行）：
- 把 main.go 的依赖装配抽成 `buildRuntimeDependencies(cfg)` 可测函数（main.go 瘦身为调用它）
- 测试：scripted gateway 返回 write_file 工具调用 → 真实 Registry/Policy/Harness 装配下 `StartRun` → 断言文件真实落盘、run 状态 completed、审计记录一条且 Success=true
- 再加一个负例：`delete_file` 指向 workspace 外路径 → 断言被 sandbox 拒绝

**验收**：`go test ./...` 全绿；assembly_test 在**修复前**先写好并确认其失败（红）→ 修复后转绿（这是本阶段的核心验收仪式）。
**提交**：`fix(core): 装配断层修复——默认权限策略接线+高风险检查语义修正+retry nil panic+run_shell 沙箱最小止血，附生产装配 E2E 测试`

---

### BP2：审批状态机修复（1 天，1 次提交）✅ 已完成（2026-08-17）

> 实施记录：决策记忆按 (runID|tool|argsHash) 键、TTL 10 分钟、上限 256 条；deny 同样记忆、timeout 不记忆；双 Governor 已改名（QuotaGovernor / InteractiveApprover）。实施中发现并顺带修复**状态机白名单死锁**——run_shell 等 7 个工具被 inferStateFromTool 推入 Editing 又被 Editing 自己的不完整清单拒绝，ReAct 路径永远不可达（审批流也因此从未可达）。8 个审批测试 + 修正 1 个把 bug 当规格的旧断言。

**修改 `aiagent/governor.go`**（F2）：
- `GovernorImpl` 增加已决策记忆：
```go
approved map[string]approvalMemo // key: runID|toolName|argsHash
type approvalMemo struct { result toolregistry.ApprovalResult; at time.Time }
```
- `CheckPermission`（L99 入口处）先查记忆：TTL 内 approved → 返回 `nil, nil`（放行）；denied → 返回拒绝错误
- `ResolveApproval` 落写记忆（批准/拒绝都记）
- argsHash：`sha256(json.Marshal(args))` 前 16 hex——同参数复用决策，参数变了重新审批

**重命名（D-B2 批准后）**：`toolregistry/governor.go` 的 `Governor` → `QuotaGovernor`；`aiagent.GovernorImpl` → `InteractiveApprover`。gofmt 全局替换 + `router.go` 中 `Governor()` 访问器同步改名

**新建 `aiagent/governor_approval_test.go`**（当前 waitForApproval 零测试）：
1. 批准 → 重试成功且**不再弹第二个审批**（钉死 F2 回归）
2. 拒绝 → 模型收到 denial 工具结果
3. 超时（5min）→ run 暂停 + 状态正确
4. 批准记忆 TTL 过期 → 同参数重新审批
5. 参数变化 → argsHash 不同 → 重新审批
6. 双重 Resolve 同一 ID → 幂等

**验收**：测试 1 在修复前失败、修复后通过；`go vet` + `-race` 全绿。
**提交**：`fix(agent): 审批已决策记忆——修复批准死循环；Governor 双胞胎重命名；补 6 个审批路径测试`

---

### BP3：中文 token 估算与上下文预算（0.5 天，1 次提交）✅ 已完成（2026-08-17）

> 实施记录：CJK≈1 token/字、ASCII≈1/4 token/字符（覆盖 CJK 统一表意/扩展 A/假名/谚文/中文标点/全角）；修正 t.Log 假断言；旧夹具在新估算下不再超预算，已加大到真实越界；MaxPromptTokens=32000 默认值维持（新估算下更宽松，方向正确）。

**修改 `aiagent/context_budget.go`**（F4）：
```go
// EstimateTokens：CJK ≈1 token/字（按主流 tokenizer 经验值），ASCII ≈0.25 token/字符
func EstimateTokens(text string) int {
    cjk, ascii := 0, 0
    for _, r := range text {
        switch {
        case r >= 0x4E00 && r <= 0x9FFF, r >= 0x3040 && r <= 0x30FF,
             r >= 0xAC00 && r <= 0xD7AF, r >= 0x3000 && r <= 0x303F:
            cjk++
        case r < 128:
            ascii++
        default: // 其他非 ASCII（emoji 等）按 1 记
            cjk++
        }
    }
    return cjk + ascii/4
}
```
- 检查所有 `EstimateTokens` 调用点的阈值语义（`grep -rn EstimateTokens core/`），MaxPromptTokens 默认值如为按旧估值标定的需同步下调

**修改 `context_budget_test.go`**：
- L115 `if !result.Truncated { t.Log(...) }` → 改为真断言 `if !result.Truncated { t.Errorf(...) }`
- `TestEstimateTokens`（L141-147）重写：中文 1000 字 ≈ 1000±20%；英文 1000 字符 ≈ 250±20%；混合样例

**验收**：新测试绿；跑一个真实长中文会话（>20 轮）观察 `trimForTokens` 不再被误触发（手动验证记录进提交说明）。
**提交**：`fix(agent): EstimateTokens 中文失真修复(78→1 token/字)，修永不失败的断言`

---

### BP4：安全加固——guardrails + worker（1.5 天，1 次提交）

**修改 `safety/guardrails.go`**（S5）：
- `ValidatePath`（L66-99）：`filepath.Abs` 后追加 `filepath.EvalSymlinks`（目标与 allowed/blocked 根都解析；目标不存在时 EvalSymlinks 报错 → 对存在的最长前缀解析后拼回）
- `pathMatchesPrefix`（L55-63）：`runtime.GOOS == "windows"` 时改用 `strings.EqualFold` 比较（Windows 路径大小写不敏感是 OS 语义，不是风格问题）
- 新增测试：symlink 逃逸（workspace 内 symlink → /etc 或 C:\Windows）、大小写绕过（`c:\windows`）、保留 `/etcetera` 回归

**修改 worker 鉴权（F6 前半）**：
- `core/internal/worker/client.go`：启动 worker 子进程时注入 `GEOWORK_WORKER_TOKEN`（复用 `runtime-token.ts`→`main.go` 同源 token 或独立 32 字节随机），所有请求带 `X-GeoWork-Token` 头
- 新建 `workers/geo-python/app/middleware/auth.py`（约 30 行）：FastAPI middleware，校验 header 常量时间比较（`hmac.compare_digest`），未配置 env 时启动即拒绝（fail-closed，开发用 `GEOWORK_INSECURE_NO_AUTH=1` 显式跳过并打日志——与 Go core 行为对称）
- `app/main.py`：注册 middleware + 显式 `CORSMiddleware(allow_origins=["http://127.0.0.1:*","http://localhost:*"], allow_methods=["POST","GET"])`

**修改 `workers/geo-python/app/sandbox/runner.py`**（F6 后半，按 D-B3 方案 A）：
- 文件头改为**诚实清单**：`Enforced: timeout, cwd=workspace, workspace 白名单`；`NOT enforced (documented): memory, network, command filtering`
- `blocked_cmds` 黑名单保留但注释降级为"纵深防御，非安全边界"；`network_access`/`max_memory_mb` 字段从 policy dict 删除（不留说谎的字段）
- `run_command` 调用方（main.py 端点）在 Go 侧已标 critical + 审批——本阶段只加一个 TODO 注释指向 D-B3-B

**修改 worker 超时**：
- `app/main.py` GEE/长任务端点统一包 `asyncio.wait_for(..., timeout=600)`（sync def 端点改 async + `run_in_threadpool` + wait_for）
- 新建 `workers/geo-python/tests/test_auth.py`：无 token 401、错 token 401、对 token 200、insecure 模式放行

**验收**：worker 测试绿；curl 无 token 打 8766 得 401；core 经 client 调 worker 正常。
**提交**：`fix(worker+safety): guardrails 符号链接/大小写双绕过修复；worker token 鉴权+CORS+超时；沙箱诚实化`

---

### BP5：泄漏、竞态、假工具、审计（1.5 天，1 次提交）

**内存与竞态（S3/S4）——修改 `orchestrator.go`**：
- 新增 `DeleteRun(id)`（run.done 已关且非 running 才可删）；teardown（L618 后）按保留策略清理：**最近 100 个已完成 run 保留，超限删最旧**（桌面单用户够用）
- `SubAgentManager`：run 结束时 `cleanupChildren(runID)`（children/parentOf 双向删除）
- `Recovery`：`main.go` shutdown 钩子调 `Cleanup()`；checkpoint 文件保留策略（每 run 最近 3 份，`recovery.go` Load 时顺带清理过期）
- L1612-1616 `eventBuf` 懒初始化移入 `rc.mu` 保护；L497 `run.Plan`、L1072 `run.done = make`、L1086 `run.Status = StatusRecovery` 三处写入加 `o.mu`（与 `WaitForRun` L1327 的读对齐）
- S7 投机执行器：`defer rc.specExec.Cleanup()` 从 `streamModelCall`（L1138-1141）移到 **ReAct 循环 turn 尾**（工具执行完之后）——一行位置改动让 P3-3 的加速真正生效；补一个"投机结果被复用（执行计数==1）"的测试

**假工具做实——修改 `toolregistry/builtin_tools.go`**：
- `run_python`/`run_shell`（L205-252）：`cmd.Stdout`/`cmd.Stderr` 分离 buffer；`exit` 从 `exec.ExitError.ExitCode()` 取真实值（err 非 ExitError 时 exit=-1 并把 err 放入 stderr）
- `run_git_add`（L410-413）：真实执行 `git add <path>`（workspace 为 cwd，找不到 git 时返回明确错误而非假成功）
- `create_artifact`（L278-286）：真实写文件到 artifacts 目录、返回真实 id；无法写时返回错误

**审计——修改 `toolregistry/registry.go`**：
- L207-217 "执行前记 Success:true" 块整体后移到执行完成后，单条记录真实结果（含 duration、approval 标志）

**状态推断统一**：
- `ToolBuilder` 增加 `.StateHint(state string)`；`inferStateFromTool`（L1234-1262）优先读元数据，删除三处硬编码清单（`state_machine.go:88-105`、`permissions.go:70-75` 的写动作清单改为从 `Permission()` 推导：exec/write → 写动作）
- `read_file` 补 `Sandbox(true)` 声明（读也限制在 allowedRoots 内，allowedRoots 未配置时行为不变）

**事件可靠性（S1）——修改 `api/task_event.go`**：
- Subscribe 缓冲 64 → 256；`Publish` 命中 drop 时计数 + `zap.Warn`（每秒聚合一次，避免刷屏）；终端事件（done/error/state_snapshot）drop 时额外 PublishToAll 重试一次
- 注：最终恢复靠前端 Session resync（doc/21 P2），此处是止血

**验收**：`go test ./... -race` 全绿；新增：run 清理策略测试、specExec 复用计数测试、审计单条性测试、假工具三件的真实行为测试。
**提交**：`fix(core): run/子代理/checkpoint 泄漏清理+事件竞态收口；假工具做实(真实退出码/git add/artifact)；审计改执行后单条记录；投机执行修复`

---

### BP6：网关接线与演示代码清算（1 天，1 次提交，依赖 D-B4）

**修改 `cmd/geowork-runtime/main.go` + `modelgateway`**（S6）：
- RateLimiter 接线：`OpenAICompatibleClient` 外包一层限流（或 `httpClient.Transport` 装饰器，零侵入）
- UsageMeter 接线：`orchestrator.WithUsageMeter(meter)`（若 BP1 已做最小接线则此处完善：把 S2 的流式 usage 修复接上——`orchestrator.go:1148-1152` 改为 IsDone 后继续 drain 至 usage chunk 或 500ms 超时）
- Router：按 D-B4 处理——延后则在 `router.go` 头部加 `// EXPERIMENTAL: 未接入生产，v0.6 决策` 并把固定 $0.002/1K 的 `estimateCost` 删除（保留 orchestrator.go:1105 的 provider 价格表口径）；接线则 `inferMode` 改为显式参数（orchestrator 调 gateway 时传 `run.Mode`，删除 prompt 解析）
- Cache：同 D-B4（推荐延后 + 标注）

**修改 `permissions/engine.go`**（中等项）：
- `requests`/`decisions`/`policies` 增加 TTL 清理（`GetPendingRequests` 顺带扫过期已决请求）；`Evaluate` 的 `context` 死参数删除；`isWriteAction` 硬编码清单改为从 `toolregistry.Permission()` 类别推导（exec/write → 写）
- 同名异型：`internal/permissions.PermissionPolicy` 重命名 `TaskPermissionPolicy`（与 `toolregistry.PermissionPolicy` 区分）

**验收**：`/api/agent/usage` 返回真实 token 数（用一个真实 run 验证 S2 修复）；`go test ./...` 全绿。
**提交**：`feat(gateway): RateLimiter/UsageMeter 接线+流式 usage 修复；Router/Cache 标注 experimental；权限引擎 TTL 清理`

---

## 4. 依赖关系、里程碑与工作量

```
BP1(1.5d 装配止血) → BP2(1d 审批) → BP3(0.5d token) → BP4(1.5d 安全) → BP5(1.5d 泄漏/假工具) → BP6(1d 网关)
     │                                                        ↑
     └── 与前端 doc/21 的顺序建议：BP1 先行（或与前端 P1-P3 并行），
         前端 P4（真实 run 轮询）应在 BP1 之后
总计约 7 个工作日，6 次独立提交；每阶段先写"会红的测试"再修复（红→绿是验收仪式）
```

| 里程碑 | 完成标志 |
|---|---|
| M1（BP1 末） | **agent 端到端能真实写文件**（assembly_test 从红到绿）；retry 不再可能 panic |
| M2（BP2+BP3 末） | 审批可用不死循环；长中文会话不失忆 |
| M3（BP4 末） | worker 无 token 不可调用；guardrails 无已知绕过 |
| M4（BP5+BP6 末） | 72h 长驻运行内存平稳；模型看到的工具结果全部真实 |

## 5. 风险与回滚

| 风险 | 缓解 |
|---|---|
| D-B1 选 full 后 agent 可写任意 workspace 内文件 | critical 工具仍有交互审批 + Harness 规则 + guardrails；且这本来就是产品意图（GIS agent 要产出数据） |
| EvalSymlinks 对不存在路径报错 | 实现为"解析最长存在前缀 + 拼接余下部分"，测试覆盖新建文件场景 |
| worker 鉴权后旧 core 不带 token 调不通 | 同一提交内 Go client 侧同步加 header；契约测试（scripts/core_worker_contract.py）更新 |
| run 清理策略误删活跃 run | 只删 `done` 已关且 running=false 的；删除前 double-check 持锁 |
| token 估算修正后预算行为变化 | MaxPromptTokens 默认值同步校准；真实 20 轮会话手测记录 |

## 6. 明确不做（本轮）

- Windows 内存/网络级沙箱隔离（Job Object / 容器）——D-B3-B 独立立项
- Router 多模型智能路由产品化——D-B4 延后 v0.6
- server/ 云端模块（rbac/billing/sync 已有真实 SQLite 底子，无致命项，待桌面端稳定后专项审查）
- `Scheduler.Stop` 二次 panic（7bc7eae 已修 ratelimit 同款；scheduler 侧 BP5 顺带 `sync.Once` 化，若未涉及则列入遗留清单）
