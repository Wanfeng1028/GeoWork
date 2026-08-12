# GeoWork 发布与版本管理规范

> **文档路径**：`doc/17-Engineering-Release.md`
> **关联文档**：`AGENT.md`（项目身份 §1）/ `11-Engineering-CI-CD.md`
> **适用对象**：所有贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：SemVer 策略、CHANGELOG、Electron 自动更新、灰度/回滚 |

---

## 1. 语义化版本（SemVer）

### 1.1 版本号格式

```
MAJOR.MINOR.PATCH[-pre.N]
```

| 部分 | 何时递增 | 示例 |
|---|---|---|
| MAJOR | 不兼容的 API/协议变更 | 2.0.0 |
| MINOR | 向后兼容的新功能 | 1.1.0 |
| PATCH | 向后兼容的 Bug 修复 | 1.0.1 |
| pre.N | 预发布版本 | 1.0.0-alpha.1, 1.0.0-beta.2 |

### 1.2 当前阶段

项目处于 **v0.5.x-dev**（开发预览版），属于预发布阶段。v0.x 允许 breaking change。v0.1–v0.4 为 demo 探索版（已封存），v0.5 起进入正式开发轨道。

进入 v1.0 的条件：

- Agent 核心循环（ReAct）稳定运行
- 审批流（WebSocket）联调通过
- 前端设计系统全页面对齐验收基线
- 测试覆盖率达标（Store/Hook 100%，页面 smoke 100%）

---

## 2. CHANGELOG 规范

采用 [Keep a Changelog](https://keepachangelog.com/) 格式：

```markdown
# Changelog

## [Unreleased]

### Added
- WebSocket 双向控制信令（JSON-RPC 2.0 审批流）

### Changed
- 设计系统 v1.5.1 品牌色微调

### Fixed
- 修复主题切换时的闪烁问题

### Removed
- 废弃旧的 HTTP 审批轮询接口
```

### 2.1 分类

| 标签 | 含义 |
|---|---|
| Added | 新功能 |
| Changed | 行为变更 |
| Deprecated | 即将废弃 |
| Removed | 已删除 |
| Fixed | Bug 修复 |
| Security | 安全修复 |

### 2.2 维护规则

- 每个 PR 必须在 `CHANGELOG.md` 的 `[Unreleased]` 下添加条目
- 发布时把 `[Unreleased]` 改为版本号 + 日期
- AI 助手生成 PR 时必须同步更新 CHANGELOG

---

## 3. Git Tag

- 每次发布创建 tag：`v1.2.3`
- Tag 指向对应的 commit
- Tag message 与 CHANGELOG 条目一致

```bash
git tag -a v0.4.1 -m "v0.4.1: WebSocket 审批流 + 设计系统修复"
git push origin v0.4.1
```

---

## 4. Electron 打包与发布

### 4.1 打包命令

```bash
# Windows NSIS 安装包
npm --workspace apps/desktop run dist:win
# 等价于：electron-builder --win nsis --x64
```

### 4.2 electron-builder 配置要点

- 需要 `package.json` 中有 `version`、`description`、`author` 字段
- 首次打包需设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
- 输出目录：`apps/desktop/dist/`

### 4.3 自动更新（TODO）

使用 `electron-updater` + GitHub Releases：

```
1. 开发者 push tag → CI 自动打包 → 上传 GitHub Release
2. 客户端启动时检查 GitHub Releases 最新版本
3. 有新版本 → 后台下载 → 提示用户重启安装
```

---

## 5. 灰度与回滚

### 5.1 灰度（TODO）

当前不支持灰度。未来可通过以下方式实现：

- GitHub Release 的 pre-release 标记
- electron-updater 的 `allowDowngrade` + channel 机制（`latest` / `beta`）
- 服务端配置下发（Go Cloud 控制哪些用户收到更新推送）

### 5.2 回滚

- Electron 客户端：用户可手动下载旧版本安装包覆盖安装
- 数据兼容：数据库/配置文件的 schema 变更必须向后兼容（新代码能读旧数据，旧代码能读新数据——至少保留一个版本的兼容性）

---

## 6. Feature Flags

### 6.1 机制

使用 localStorage 作为 feature flag 存储（最简单，不需要远程配置服务）：

```typescript
// src/shared/featureFlags.ts（待创建）
const FF_PREFIX = 'geowork.ff.'

export function isFeatureEnabled(flag: string): boolean {
  try {
    return localStorage.getItem(`${FF_PREFIX}${flag}`) === 'true'
  } catch {
    return false
  }
}

export function setFeatureFlag(flag: string, enabled: boolean): void {
  localStorage.setItem(`${FF_PREFIX}${flag}`, String(enabled))
}
```

### 6.2 命名规范

- key 格式：`geowork.ff.<feature-name>`
- 默认全部关闭（opt-in），除非文档标注为"默认开启"
- 示例：`geowork.ff.websocket-control`、`geowork.ff.virtual-scroll`

### 6.3 使用场景

| 场景 | 做法 |
|---|---|
| 实验性功能 | Feature flag 保护，未完成时用户看不到 |
| 灰度发布 | 通过安装包内嵌默认 flag 值控制 |
| 紧急回滚 | 用户手动在 DevTools 里 `localStorage.setItem('geowork.ff.xxx', 'false')` |

### 6.4 规则

- Feature flag **只控制功能开关**，不控制配置值
- 功能稳定后（上线 2 个版本无问题），**必须移除 flag** 和对应的死代码
- Settings 页面提供"实验性功能"区域，列出所有可用 flag（仅 dev 模式显示）

---

## 7. 发布检查清单

发布前对照：

- [ ] CHANGELOG 已更新
- [ ] 版本号已递增（package.json + electron-builder 配置）
- [ ] `npm run build` 通过
- [ ] `npm test` 全部通过
- [ ] Go Core `go build ./...` + `go test ./...` 通过
- [ ] 手动验收关键功能
- [ ] Git tag 已创建
- [ ] GitHub Release 已创建（附 CHANGELOG 内容）
