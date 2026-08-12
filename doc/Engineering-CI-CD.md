# GeoWork CI/CD 规范

> **文档路径**：`doc/Engineering-CI-CD.md`
> **关联文档**：`AGENT.md`（构建命令 §6）/ `Engineering-Git-Workflow.md`（分支策略）
> **适用对象**：所有贡献者 + CI 系统
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：CI pipeline、环境管理、自动化检查门禁 |

---

## 1. CI 平台

使用 **GitHub Actions**（项目托管在 GitHub）。

---

## 2. Pipeline 定义

### 2.1 PR 检查（每次 PR 触发）

```yaml
# .github/workflows/pr-check.yml
name: PR Check
on:
  pull_request:
    branches: [main]

jobs:
  frontend-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm --workspace apps/desktop run lint     # oxlint
      - run: npm --workspace apps/desktop run build     # 编译检查
      - run: npm --workspace apps/desktop test          # vitest
      - run: npm --workspace apps/desktop run typecheck  # tsc --noEmit（待配置）

  core-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
      - run: cd core && go build ./...
      - run: cd core && go test ./...
      - run: cd core && go vet ./...

  worker-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: cd workers/geo-python && pip install -e ".[dev]"
      - run: cd workers/geo-python && python -m pytest

  doc-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for broken internal links
        run: python scripts/check_doc_links.py  # 待编写
```

### 2.2 门禁规则

| 检查项 | 阻断合并？ | 说明 |
|---|---|---|
| 前端 build | **是** | 编译不过不能合 |
| 前端 lint（oxlint） | **是** | 有 lint error 不能合 |
| 前端 test（vitest） | **是** | 测试不过不能合 |
| Go build | **是** | 编译不过不能合 |
| Go test | **是** | 测试不过不能合 |
| Go vet | **是** | 静态分析不过不能合 |
| Python test | **是** | 测试不过不能合 |
| 文档链接检查 | **否** | 仅警告 |
| Bundle size | **否**（v1 仅警告） | 超预算时 warning，不阻断 |

---

## 3. 环境管理

| 环境 | 用途 | 配置来源 |
|---|---|---|
| `development` | 本地开发 | `apps/desktop/.env.development` |
| `production` | 打包发布 | `apps/desktop/.env.production` |

当前环境变量：

| 变量 | dev 值 | prod 值 | 说明 |
|---|---|---|---|
| `VITE_API_BASE_URL` | `/api` | `/api` | Go Core 代理路径 |
| `VITE_WORKER_BASE_URL` | `/worker` | `/worker` | Python Worker 代理路径 |
| `VITE_APP_MODE` | `dev` | `prod` | 运行模式标识 |

**规则**：

- `.env` 和 `.env.local` 已 gitignore，不入库
- `.env.development` 和 `.env.production` 入库，只放非敏感配置
- 敏感信息（API key、token）通过 `.env.local` 或系统环境变量注入，永远不入库
- 需要新增环境变量时，同时更新 `.env.development` 和 `.env.production`

---

## 4. 本地开发流程

```bash
# 全栈启动（推荐）
npm run dev
# 等价于 concurrently 启动 4 个进程：
# - Go Core (:8765)
# - Python Worker (:8766)
# - Go Cloud (:8767)
# - Electron Desktop (electron-vite dev)

# 单独启动前端
npm run dev:desktop

# 构建
npm run build

# 测试
npm test              # 前端 vitest
npm run test:core     # Go Core
npm run test:cloud    # Go Cloud
npm run test:worker   # Python Worker
```

---

## 5. 待建设（TODO）

| 项目 | 优先级 | 说明 |
|---|---|---|
| `typecheck` 脚本 | P1 | `tsc --noEmit` 独立脚本，CI 和 pre-commit 复用 |
| Bundle size 检查 | P2 | `size-limit` 或 `bundlesize` 集成到 CI |
| 文档链接检查脚本 | P2 | `scripts/check_doc_links.py` 扫描 md 文件内部引用 |
| Pre-commit hooks | P2 | `husky` + `lint-staged` 本地拦截 |
| 部署流水线 | P3 | electron-builder 自动打包 + GitHub Release（见 `Engineering-Release.md`） |
