# GeoWork Lint 与格式化规范

> **文档路径**：`doc/Engineering-ESLint-Prettier.md`
> **关联文档**：`GeoWorkFrontend-Design-System.md`（stylelint §17）/ `Engineering-TypeScript.md`
> **适用对象**：前端贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：oxlint 现状、Prettier 配置、import 排序、与 stylelint 的协作 |

---

## 1. 当前状态

| 工具 | 状态 | 命令 |
|---|---|---|
| oxlint | ✅ 已配置 | `npm --workspace apps/desktop run lint` |
| stylelint | ✅ 已配置（设计系统 §17） | — |
| ESLint | ❌ 未配置 | — |
| Prettier | ❌ 未配置 | — |

oxlint 是 Rust 编写的高性能 linter，兼容大部分 ESLint 规则。当前用 oxlint 替代 ESLint 做 JS/TS lint。

### 1.1 oxlint 定位

**oxlint 是当前阶段的最终选择**，不是过渡方案。理由：

- oxlint 速度是 ESLint 的 50-100 倍，适合大项目
- 覆盖了 ESLint 推荐规则集的 80%+
- 不覆盖的规则（如 React Hooks 规则）通过其他方式补充（见 §7 TODO）

**迁移到 ESLint 的触发条件**（满足任一即评估迁移）：

- oxlint 连续 3 个月未支持项目需要的关键规则
- 团队扩展后需要与外部贡献者的 ESLint 配置兼容
- 需要 ESLint 生态特有的插件（如 `eslint-plugin-security`）

---

## 2. oxlint 规则

oxlint 默认启用推荐规则集。补充规则通过 `oxlintrc.json`（待创建）配置：

```jsonc
// apps/desktop/oxlintrc.json（待创建）
{
  "rules": {
    "no-console": "warn",
    "no-debugger": "error",
    "no-alert": "error",
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": "error",
    "eqeqeq": ["error", "always"],
    "no-eval": "error",
    "no-implied-eval": "error"
  }
}
```

---

## 3. Prettier 配置（待引入）

建议引入 Prettier 统一代码格式。配置：

```jsonc
// apps/desktop/.prettierrc（待创建）
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true
}
```

**与 oxlint 的关系**：oxlint 负责逻辑错误检测，Prettier 负责格式。两者不冲突。

---

## 4. Import 排序

规则（oxlint `import/order` 或 Prettier plugin）：

```
1. Node.js 内置模块（path, fs, os）
2. 外部依赖（react, antd, zustand）
3. 内部别名（@shared/*, @shell/*）
4. 相对路径（./, ../）
5. 样式文件（.css, .module.css）
6. 类型导入（type imports 放最后，或单独 import type）
```

组间空一行。类型导入使用 `import type { Xxx } from '...'` 语法。

---

## 5. stylelint 协作

CSS 相关检查由 stylelint 负责（设计系统 §17 已定义），oxlint/Prettier 不处理 CSS。

分工：

| 文件类型 | 负责工具 |
|---|---|
| `.ts` / `.tsx` | oxlint + Prettier |
| `.css` / `.module.css` | stylelint |
| `.json` | Prettier |
| `.md` | Prettier（可选） |

---

## 6. 执行时机

| 时机 | 工具 | 阻断？ |
|---|---|---|
| 保存文件（IDE） | Prettier（formatOnSave） | — |
| Pre-commit（待配置） | lint-staged + oxlint + Prettier | 是 |
| CI PR 检查 | oxlint + Prettier --check | 是 |
| 手动 | `npm run lint` | — |

---

## 7. Import 边界约束

### 7.1 禁止的 import 路径

| 规则 | 说明 |
|---|---|
| `src/pages/A/*` 禁止 import `src/pages/B/*` | 页面间隔离——各页面独立，不互相依赖 |
| `src/shared/*` 禁止 import `src/pages/*` | 共享层不依赖页面层（依赖方向单向：pages → shared） |
| `src/app/themes/*` 禁止 import 任何业务组件 | 主题层只定义 token 和 ConfigProvider，不知道业务组件的存在 |
| `src/shell/*` 禁止 import `src/pages/*` | Shell 层不依赖具体页面 |

### 7.2 执行方式

| 阶段 | 方式 | 说明 |
|---|---|---|
| 当前 | **Code review 人工检查** | oxlint 暂不支持 `no-restricted-imports` |
| 目标 | oxlint 或 ESLint 自动化规则 | 当 oxlint 支持或迁移到 ESLint 时配置 |
| 可选增强 | `dependency-cruiser` | 独立工具，生成依赖图可视化 |

### 7.3 依赖方向

```
pages/ ──→ shell/ ──→ shared/ ──→ app/
  │                      │
  └──────────────────────┘
        (pages 可直接用 shared)

themes/ ← 被 app/AppProviders 引用，不主动 import 任何业务代码
```

---

## 8. TODO

| 项目 | 优先级 | 说明 |
|---|---|---|
| 创建 `oxlintrc.json` | P1 | 补充安全相关规则 |
| 引入 Prettier | P1 | 统一代码格式 |
| 配置 `lint-staged` | P2 | Pre-commit 自动格式化 |
| 引入 `eslint-plugin-react-hooks` | P2 | 如果 oxlint 不支持 React Hooks 规则检查 |
