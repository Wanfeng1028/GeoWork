# GeoWork TypeScript 规范

> **文档路径**：`doc/13-Engineering-TypeScript.md`
> **关联文档**：`03-GeoWorkFrontend-Engineering-Standards.md`（前端工程规范 §12）
> **适用对象**：前端贡献者（含 AI 编程助手）
> **最后更新**：2026-08-12

## 版本表

| 版本 | 日期 | 变更摘要 |
|---|---|---|
| v1.0 | 2026-08-12 | 初稿：tsconfig 配置、strict 模式、类型工具函数、禁止 any 范围 |

---

## 1. tsconfig 配置

### 1.1 当前状态

`apps/desktop/tsconfig.app.json` 已启用的严格检查：

- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `erasableSyntaxOnly: true`

**未启用** `strict: true`。建议逐步开启。

### 1.2 目标配置

```jsonc
// apps/desktop/tsconfig.app.json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    
    // 严格模式（逐步开启）
    "strict": true,                    // 总开关
    "noUncheckedIndexedAccess": true,  // 数组/对象索引返回 T | undefined
    "exactOptionalPropertyTypes": true, // undefined 不能赋给 optional property
    
    // 路径别名（待配置）
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["src/shared/*"],
      "@shell/*": ["src/shell/*"]
    },
    
    // 已有的 lint 检查
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 1.3 开启策略

`strict: true` 一次性开启会导致大量报错。建议分阶段：

1. **第一阶段**：开启 `strict: true`，用 `// @ts-expect-error` 标记暂时修不了的（每处必须附 TODO 注释）
2. **第二阶段**：逐个消除 `@ts-expect-error`
3. **第三阶段**：开启 `noUncheckedIndexedAccess`

---

## 2. 类型定义规范

### 2.1 文件组织

| 类型 | 位置 | 命名 |
|---|---|---|
| 全局共享类型 | `src/shared/types/` | `camelCase.ts` |
| 页面专属类型 | `src/pages/Xxx/types.ts` | — |
| API 响应类型 | `src/shared/api/types.ts` | — |
| 组件 Props | 组件文件内 | `XxxProps` |

### 2.2 命名规则

| 类别 | 规则 | 示例 |
|---|---|---|
| Interface | `I` + PascalCase（仅复杂接口） | `ITaskSidebarState` |
| Type alias | PascalCase | `RunStatus`, `ConversationMessage` |
| Enum | PascalCase + 成员 PascalCase | `RunStatus.Running` |
| Union | PascalCase | `Appearance = 'light' \| 'dark' \| 'system'` |
| Props | `组件名 + Props` | `ApprovalModalProps` |

### 2.3 禁止

- 禁止 `any`——用 `unknown` + 类型守卫替代
- 禁止 `@ts-ignore`——用 `@ts-expect-error`（必须有注释说明原因）
- 禁止 `@ts-nocheck` 整个文件
- 禁止 `as any` 类型断言
- 禁止删除类型定义来通过编译

---

## 3. 类型工具函数

常用的类型守卫和工具函数集中定义在 `src/shared/types/guards.ts`：

```typescript
// 类型守卫示例
export function isNonNullish<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

// 工具类型示例
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>
```

---

## 4. 路径别名

当前**未配置路径别名**，import 使用相对路径。当项目规模增大后建议启用（见 §1.2）。

启用后的规则：

- 跨目录引用用别名（`@shared/api/client`）
- 同目录引用用相对路径（`./utils`）
- 禁止混用（同一文件里不能既有 `@shared/` 又有 `../../../shared/`）

---

## 5. 运行时校验

TypeScript 类型检查只在编译时生效。Go Core 返回的 JSON 在运行时可能与 interface 不匹配（后端改了字段名、类型变更等）。

### 5.1 策略

**当前阶段**：不引入 zod/valibot 等运行时校验库。API 响应通过 `try/catch` + 可选链（`?.`）做防御性编程。

**触发引入的条件**（满足任一即引入 zod）：

- 出现 3 次以上"后端改字段名导致前端静默崩溃"的 bug
- 团队扩展到 3+ 人，需要前后端契约自动化校验

### 5.2 引入后的规则

```typescript
import { z } from 'zod'

// 所有写入 Store 的 API 响应必须用 schema 校验
const RunResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'waiting']),
  steps: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
  })),
})

// 校验失败时的兜底行为
function safeParse<T>(schema: z.ZodSchema<T>, data: unknown, fallback: T): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error('[API schema mismatch]', result.error)
    Sentry.captureException(result.error)  // 上报到错误监控
    return fallback
  }
  return result.data
}
```

### 5.3 校验范围

| 数据类型 | 是否校验 | 说明 |
|---|---|---|
| 写入 Store 的 API 响应 | **必须** | 防止脏数据污染全局状态 |
| SSE 事件 data | 推荐 | 事件格式较稳定，可选 |
| localStorage 读取 | **必须** | 用户可能手动修改、版本升级后结构变化 |
| 组件 Props | 不校验 | TypeScript 编译时已保证 |
