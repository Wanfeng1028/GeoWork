# GeoWork v0.6 加固计划（server 审查 / Router·Cache 产品化 / Windows 沙箱隔离）

> **文档路径**：`doc/25-V06-Hardening-Plan.md`
> **关联文档**：`doc/22-Backend-Refactor-Plan.md`（§6 三项延后项的去向落地）/ `doc/09-GeoWork-Communication-Protocol.md` / `doc/12-Engineering-Security.md`
> **适用对象**：core / server 贡献者（含 AI 编程助手）
> **状态**：**已批准，执行中**（2026-08-17 用户确认：Job Object + 受限令牌路线；顺序 server → Router/Cache → 沙箱）
> **审查依据**：2026-08-17 三域全量探索（modelgateway router/cache、sandbox/toolregistry 子进程执行、server/ 全模块）

---

## 0. 决策（2026-08-17 用户确认）

| 编号 | 决策点 | 结论 |
|---|---|---|
| **D-25-1** | Windows 沙箱技术路线 | ✅ **Job Object + 低完整性令牌**——零额外依赖、内存上限 + 进程树终止真实强制；网络隔离诚实标注"未强制"（WFP 需管理员权限，复杂度翻倍，不做） |
| **D-25-2** | 执行顺序 | ✅ server 审查（纯修 bug 风险低）→ Router/Cache v0.6（agent 能力增强）→ Windows 沙箱（最大最险，独立验收） |
| **D-25-3** | Router mode 传递方式 | ✅ context 键（`modelgateway.WithMode`）显式贯通，**删除 `inferMode`**（探索证实是死代码：系统提示从无 `Mode:` 标记）——延续 doc/22 BP6 既定决策 |
| **D-25-4** | Cache 启用策略 | ✅ 默认关闭（`GEOWORK_LLM_CACHE=1` 启用）；仅缓存非流式 Chat 且响应无 tool_calls |

---

## 1. 背景

doc/22 §6"明确不做（本轮）"的三个去向项，本计划逐一落地：

1. **server/ 云端模块专项审查**——探索发现 13 个具体缺陷（含 4 个安全级），rbac/billing/sync 有真实 SQLite 底子、无致命项，但欠账具体
2. **Router 多模型路由产品化**（D-B4 延后项）——Router/Cache 代码存在但标注 EXPERIMENTAL 未接线；探索发现 `inferMode` 死代码、流式零成本记录、Cache 无集成层、价格字段链路断裂
3. **Windows 内存/网络级沙箱隔离**（D-B3-B 独立立项）——当前 run_shell/run_python 子进程零 OS 级约束，超时只杀直接子进程、孙进程逃逸

---

## 2. 第一部分：server/ 专项审查（3 次提交，约 1.5 天）

### S1：安全缺陷修复（最优先）

**修改 `server/internal/auth/service.go`**：
- `Login` 检查 `DeletedAt`——软删用户当前仍可登录（`GetUserByEmail` 返回软删行，Login 不检查）；删除用户时同步吊销其全部 tokens
- 新增过期 token GC：服务启动时清理一次 + `DeleteExpiredTokens()` 方法（tokens 表当前无限增长，只在读时判过期）

**修改 `server/internal/sync/service.go` + `storage/sqlstore.go`**：
- `POST /sync/cleanup` 加 user 过滤——当前 `DeleteSyncRecordsBefore` 无 user 条件，任何登录用户可清空**所有人**的过期 sync 数据（admin 检查是 `_ = user` 空注释）；`sqlstore` 补 `DeleteUserSyncRecordsBefore(userID, cutoff)`

**修改 `server/internal/billing/service.go`**：
- `/checkout/mock` 自我升级漏洞（任何登录用户可自升 team + 铸 490 credits）→ `GEOWORK_BILLING_MOCK=1` 环境变量门禁，未开启返回 404

**修改 `server/internal/crash/service.go`**：
- 报告 ID 从秒级时间戳（并发碰撞）改为 `idgen` 随机 hex；路由挂现有 ratelimit 中间件（端点当前无鉴权无限流）

**修改 `server/cmd/geowork-api/main.go`**：
- CORS `file://` 全放行收紧：仅 `GEOWORK_DEV=1` 时允许 file:// 任意源，生产只认 `GEOWORK_ALLOWED_ORIGINS` 白名单

**验收**：每个修复一条回归测试（软删登录拒绝、cleanup 只删自己、mock 门禁 404、token GC 清过期留有效）。
**提交**：`fix(server): 软删登录/cleanup 越权/mock 门禁/crash ID/token GC/CORS 收紧`

### S2：数据完整性

**修改 `server/internal/storage/migrations/migrations.go`**：
- 注册 006 迁移（`006_cursor_milliseconds.sql` 在磁盘上但从未 embed/执行，ns→ms cursor 修复对存量数据不生效）

**修改 `server/internal/modelproxy/service.go` + 新增迁移 007**：
- providers 从内存 map 持久化到 SQLite（重启丢失全部配置含加密 API key）；迁移 007 建 `model_providers` 表
- Chat/Stream 恒 400 修复：`provider_id` 改从请求体字段读取（当前 `c.GetString("provider_id")` 读的 key 无任何写入方）
- 补 modelproxy 测试（当前为零）：provider CRUD 持久化、Chat 路由到正确 provider、缺 provider_id 报错

**验收**：`go test ./internal/modelproxy/` 从 0 到有；重启不丢 provider 的存储层测试。
**提交**：`fix(server): 迁移 006 注册+modelproxy 持久化与 provider_id 修复`

### S3：诚实化收尾

**修改 `server/internal/usage/service.go`**：
- 上报值 sanity 校验：拒绝负数、拒绝单次异常大额（>1e9）；plan limits 维持信息性，注释注明 honor-system 现状

**修改 `server/internal/rbac/service.go` + 迁移注释**：
- 维持 per-user 数据隔离现状（workspace 级 RBAC 为建议性）；`role_permissions` 死表在迁移文件加 unused 注释（不删表，避免迁移链断裂）

**修改 `doc/09-GeoWork-Communication-Protocol.md`**：
- sync 冲突语义（last-write-wins、无 tombstone、无设备身份）写入协议文档，与代码现状对齐

**marketplace 占位签名**：`server/README` 或模块注释注明"签名校验未启用，占位值"，不实现真实验签。

**验收**：`cd server && go test ./...` 全绿。
**提交**：`chore(server): usage 校验+rbac 死表标注+sync LWW 语义文档化`

---

## 3. 第二部分：Router/Cache v0.6 产品化（3 次提交，约 2 天）

### R1：显式 mode 贯通 + Router 接线

**修改 `core/internal/modelgateway/`（新增 `routing_context.go`）**：
- `WithMode(ctx, mode) context.Context` + `ModeFromContext(ctx) string`——沿用 `toolregistry.WithRunID` 的 ctx 键模式，ModelGateway 接口零改动

**修改 `core/internal/modelgateway/router.go`**：
- `Chat`/`StreamChat` 从 ctx 读 mode（替代 `inferMode(messages)`）；**删除 `inferMode`** 及其测试
- 修 `ProviderRegistry.Add` 更新既有 provider 时丢 `PricePer1KInput/Output` 的 bug（providers.go:67-74）

**修改 `core/internal/aiagent/orchestrator.go`**：
- `streamModelCall`/`fallbackModelCall` 调 gateway 前 `ctx = modelgateway.WithMode(ctx, run.Mode)`

**修改 `core/cmd/geowork-runtime/main.go`**：
- `initModelGateway` 增加 `GEOWORK_LLM_PRICE_INPUT`/`GEOWORK_LLM_PRICE_OUTPUT` 环境变量填充价格（当前成本恒 0）
- 装配改为 Router 包装：`NewRouter(provider.ID) → AddProvider → SetRules(默认规则) → NewRateLimitedGateway(router, limiter)`；保持 nil-interface 纪律（无 provider 时 agentGateway 为真 nil）

**验收**：mode 命中规则路由、无规则走默认、fallback 生效三测试；`go build ./...` 干净。
**提交**：`feat(gateway): Router 接线——ctx 显式 mode 贯通，删除 inferMode 死代码`

### R2：流式成本 + 预算 + 重试

**修改 `core/internal/modelgateway/router.go`**：
- `StreamChatWithFallback` 返回的 channel 包一层观察 goroutine：捕获尾部 Usage chunk → `recordCost`（当前流式调用零成本记录）
- 实现悬空的 `RoutingRule.MaxRetries`：`ChatWithFallback` 主 provider 失败时按规则重试（尊重 ctx 取消），再 fallback

**修改 `core/cmd/geowork-runtime/main.go`**：
- `CostController` 接线：`GEOWORK_LLM_DAILY_BUDGET`/`GEOWORK_LLM_MONTHLY_BUDGET`（0=不启用）→ `router.SetCostController`；预算超限 run 失败带明确原因（ErrBudgetExceeded 透传）

**验收**：流式 usage 进 CostController、预算拦截返回 ErrBudgetExceeded、MaxRetries 次数断言三测试。
**提交**：`feat(gateway): 流式成本记录+预算控制接线+MaxRetries 实现`

### R3：CachedGateway 装饰器

**新增 `core/internal/modelgateway/cached_gateway.go`**：
- `CachedGateway{inner ModelGateway, cache *Cache}`——复制 `RateLimitedGateway` 装饰器形态
- 缓存条件（D-25-4）：仅非流式 `Chat` 且 `stream=false` 且响应无 tool_calls（纯文本响应才安全；摘要类调用是主要受益者）；请求带 tools 定义不缓存（工具结果不可复现）
- key：`cache.Key(provider.DefaultModel, lastUserMessage, HashTools, HashContext)`

**修改 `core/internal/modelgateway/cache.go`**：
- key 改 hex 编码（当前含任意字节）；`Get` 命中过期项时删除（当前只返 miss 不清理）；`Get` 刷新 Timestamp（LRU 语义，当前是插入序淘汰）

**修改 `core/cmd/geowork-runtime/main.go`**：
- `GEOWORK_LLM_CACHE=1` 启用（默认关）；接线顺序 `Cache → Router → RateLimit`（缓存命中不消耗限流配额之外的资源，放最外层）

**验收**：命中/未命中、TTL 过期、带 tools 不缓存、tool_calls 响应不缓存四测试；Router/Cache 头部 EXPERIMENTAL 注释移除。
**提交**：`feat(gateway): CachedGateway 装饰器+cache LRU/hex 修复，Router/Cache 转正`

---

## 4. 第三部分：Windows 沙箱隔离 D-B3-B（3 次提交，约 2.5 天）

> 探索关键发现：两条执行路径互相独立——`sandbox.Service`（HTTP API）与 `toolregistry` builtin tools（**模型真正驱动的路径，完全没有 SysProcAttr**）。只隔离一条等于没隔离。`service_windows.go` 的 `setSysProcAttr` 是空结构体，天然插入点。

### W1：Job Object 地基

**新增依赖**：`golang.org/x/sys/windows`（core/go.mod）

**新增 `core/internal/sandbox/jobobject/`**（build tag 分平台）：
- `jobobject_windows.go`：`New(memLimitMB int64) (*Job, error)`——CreateJobObject + `JOB_OBJECT_LIMIT_PROCESS_MEMORY`（committed 上限）+ `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`（关句柄杀全树）；`Assign(cmd *exec.Cmd)` 在 `cmd.Start()` 后 AssignProcessToJobObject
- `jobobject_other.go`：no-op 桩（非 Windows 编译通过）
- 语义：超时/取消 → 关 job 句柄 → 子孙进程树全灭（修复当前"只杀直接子进程"逃逸）

**新增统一 spawn helper `core/internal/sandbox/spawn.go`**：
- `Spawn(ctx, cfg SpawnConfig) (*exec.Cmd, error)`：cwd 固定 + job object（Windows）/ Setpgid + 进程组杀（Unix，`syscall.Kill(-pgid)`）
- `sandbox.Service.RunCommand/RunPythonScript` 与 `toolregistry` run_shell/run_python 执行器共用；git 类工具不进 job（低风险、需正常凭据访问）

**验收**：孙进程随超时被杀（Windows `cmd /C start /b` + Unix `sh -c 'sleep 100 &'` 各一条）；job 未启用时行为不变。
**提交**：`feat(sandbox): Job Object 进程树终止+统一 spawn helper`

### W2：低完整性令牌

**修改 `core/internal/sandbox/jobobject/`（Windows 侧）**：
- 子进程以低完整性 level token 启动：OpenProcessToken → DuplicateTokenEx → SetTokenInformation(TokenIntegrityLevel, Low SID) → `SysProcAttr.Token`
- 写盘效果：低 IL 进程对普通用户目录（中 IL）无写权限，逃逸写盘被 OS 拒绝
- **诚实降级**：令牌创建失败（权限不足/策略限制）→ warn 日志 + 返回标注"隔离未生效"，不阻塞执行（延续 D-B3 诚实化原则）

**验收**：令牌创建成功路径测试；失败降级路径测试（注入失败或 t.Skip 标记环境依赖）。
**提交**：`feat(sandbox): 低完整性令牌启动子进程，失败诚实降级`

### W3：策略贯通 + 诚实清单更新

**修改 `core/internal/sandbox/models.go` + 配置链路**：
- `SandboxPolicy.MaxMemoryMB` 从死字段变为 job object 内存上限真实来源（policy → SpawnConfig → jobobject.New）
- `NetworkAccess` 字段删除（Job Object 不管网络，留着就是再次说谎——诚实化）

**修改 `workers/geo-python/app/sandbox/runner.py` docstring + Go 侧文档**：
- 强制清单更新：内存上限 ✅（job object）、进程树终止 ✅（KILL_ON_JOB_CLOSE）、低完整性写盘限制 ✅（best-effort，失败降级）；网络隔离 ❌ 未强制（明确标注）

**验收**：`go test ./...` 全绿；手工验证 run_shell 派生孙进程场景被完整终止；Python runner 测试不受影响。
**提交**：`feat(sandbox): MaxMemoryMB 真实强制+诚实清单更新`

---

## 5. 依赖关系与工作量

```
S1(0.5d 安全) → S2(0.5d 数据) → S3(0.5d 诚实化)
    → R1(0.5d mode+接线) → R2(0.75d 流式成本) → R3(0.75d 缓存)
        → W1(1d Job Object) → W2(0.75d 低 IL) → W3(0.75d 策略贯通)
总计约 6 个工作日，9 次独立提交
```

## 6. 明确不做（本计划）

- WFP 网络过滤（需管理员权限，复杂度翻倍）；Docker 容器路线（GIS 桌面用户重依赖）
- server 真实支付集成（Stripe）、marketplace 真实验签、sync tombstone/多设备版本化
- Router 按 taskType 细分路由（当前无消费方，RoutingRule 保留字段不实现）
- `sandbox.Service` 的 `CommandPolicy`/`FilesystemScope`/`NetworkValidator` 闲置基建接线（与本计划正交，另议）

## 7. 执行纪律

- 每阶段先写会红的测试再修绿（红→绿是验收仪式）
- 每阶段一次独立提交（短标题，commitlint <100 字符）
- 显式文件路径 `git add`（并行会话仍在活动，禁止 `git add -A`）
- 每阶段完成后同步本文档执行记录 + `CHANGELOG.md [Unreleased]`
- 本机无 gcc：core 侧 `-race` 不可跑，竞态相关靠审查 + 并发测试，CI ubuntu 补跑列入备注

## 8. 执行记录

| 阶段 | 提交 | 与计划的偏差 |
|---|---|---|
| S1 安全缺陷 | 1f80094 | 无；token GC 放 NewService 启动时一次（未加定期任务，桌面场景启动清理够用） |
| S2 数据完整性 | a67c7ad | 无；modelproxy 持久化用 upsert + 启动加载，内存 map 保持进程内权威 |
| S3 诚实化 | a2c9722 | 无；marketplace 占位签名在 store.go 种子处 + 结构体字段双标注 |
