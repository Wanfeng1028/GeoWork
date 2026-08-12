# GeoWork Git 工作流规范

> **文档路径**：`doc/10-Engineering-Git-Workflow.md`
> **关联文档**：`AGENT.md`（全局约束 §8）
> **适用对象**：所有贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：分支策略、commit 规范、PR 模板、CODEOWNERS |

---

## 1. 分支策略

采用 **trunk-based development**（主干开发），适合当前小团队 + AI 协作模式。

| 分支 | 用途 | 生命周期 |
|---|---|---|
| `main` | 唯一长期分支，始终可构建 | 永久 |
| `feat/xxx` | 功能开发 | 完成后合入 main 即删除 |
| `fix/xxx` | Bug 修复 | 同上 |
| `docs/xxx` | 纯文档修改 | 同上 |
| `refactor/xxx` | 重构（不改行为） | 同上 |

**规则**：

- 禁止直接在 `main` 上 push（通过 branch protection 强制）
- 短期分支合入后立即删除，不留僵尸分支
- 不使用 `release/x.x` 分支（版本号通过 tag 管理，见 `17-Engineering-Release.md`）
- 不使用 `develop` 分支（trunk-based 不需要）

---

## 2. Commit Message 规范

采用 **Conventional Commits** 格式：

```
<type>(<scope>): <subject>

[body]

[footer]
```

### 2.1 Type

| Type | 用途 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat(core): add WebSocket approval flow` |
| `fix` | Bug 修复 | `fix(desktop): resolve theme flash on startup` |
| `docs` | 纯文档 | `docs: update AGENT.md routing table` |
| `style` | 格式调整（不改逻辑） | `style: fix indentation in AppShell` |
| `refactor` | 重构（不改行为） | `refactor(core): extract ws_session from handler` |
| `perf` | 性能优化 | `perf(desktop): lazy-load settings page` |
| `test` | 测试相关 | `test: add workspace store unit tests` |
| `chore` | 构建/工具/依赖 | `chore: bump electron to 34.1.0` |
| `ci` | CI/CD 配置 | `ci: add bundle size check to pipeline` |

### 2.2 Scope

| Scope | 含义 |
|---|---|
| `core` | Go Core（`core/`） |
| `server` | Go Cloud（`server/`） |
| `worker` | Python Worker（`workers/`） |
| `desktop` | 桌面前端（`apps/desktop/`） |
| `doc` | 文档（`doc/`） |
| `skill` | 技能包（`skills/`） |
| 省略 | 跨模块或根配置 |

### 2.3 规则

- subject 不超过 72 字符，用英文，祈使语气（"add" 不是 "added"）
- body 解释"为什么"，不是"做了什么"（diff 已经说明做了什么）
- footer 关联 issue：`Closes #123`
- 禁止无意义 message：`"update"`、`"fix"`、`"wip"`、`"tmp"`

---

## 3. PR 模板

```markdown
## 变更说明
<!-- 一句话描述这个 PR 做了什么 -->

## 变更类型
- [ ] 新功能（feat）
- [ ] Bug 修复（fix）
- [ ] 重构（refactor）
- [ ] 文档（docs）
- [ ] 构建/工具（chore）

## 涉及模块
- [ ] core/
- [ ] server/
- [ ] workers/
- [ ] apps/desktop/
- [ ] doc/

## 验收清单
- [ ] `npm run build` 通过（前端改动必须）
- [ ] `go build ./...` 通过（Go 改动必须）
- [ ] 新增/修改了测试
- [ ] 不影响无关模块
- [ ] doc/ 下相关文档已同步

## 截图（UI 改动必须）
<!-- 明暗模式各一张 -->

## 备注
<!-- 需要 reviewer 特别关注的地方 -->
```

---

## 4. CODEOWNERS

当前单人项目，预留结构：

```
# 默认 owner
*                           @Wanfeng1028

# 模块 owner（团队扩展后启用）
# core/                     @backend-lead
# apps/desktop/             @frontend-lead
# doc/                      @tech-writer
# skills/                   @domain-expert
```

---

## 5. AI 助手特别规则

- AI 禁止自动执行 `git pull` / `commit` / `push` / `reset` / `checkout` / `rebase`（AGENT.md §8）
- AI 可以执行 `git status` / `git log` / `git diff` 用于了解现状
- AI 生成的 commit message 必须符合 §2 规范
- AI 不得 force push 到 `main`
- AI 不得删除分支（由用户手动清理）
