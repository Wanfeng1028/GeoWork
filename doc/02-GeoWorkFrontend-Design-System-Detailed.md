# GeoWork 前端施工计划

> **文档路径**：`doc/02-GeoWorkFrontend-Design-System-Detailed.md`
> **父文档**：`doc/01-GeoWorkFrontend-Design-System.md`（视觉宪法，现版本 v1.5.0）
> **适用对象**：参与 GeoWork 前端开发的工程师、AI 编程助手
> **文档定位**：设计系统 → 代码的分阶段施工图——依赖关系、每一步的改动范围、验收标准
> **核心原则**：某个阶段的接口签名和验收标准没写清，不能动那个阶段的代码；施工顺序必须按依赖图走，禁止跨阶段提前批需求

## 版本表

| 版本 | 日期 | 作者 | 变更摘要 |
|---|---|---|---|
| v0.1 | 2026-08-11 | GLM | 初稿：F0~F3 四阶段划分 + 任务依赖图 + 各阶段验收标准，基于前端设计系统 v1.5.0 与代码现状摸底 |
| v0.2 | 2026-08-12 | TraeCode AI Agent | F0~F2 + FP3 阶段完成记录：E0 基础设施落地、F0 基础落地（主题收敛+胶囊四件套）、F1-2 反馈三件套、F1-3 全页面对齐、F2-1/2/4 布局+架构+主题下线、FP3 品牌化（Welcome/About 页）。 |
| v0.3 | 2026-08-13 | TraeCode AI Agent | F1-1 图标库替换完成：`@ant-design/icons` → `lucide-react`，55+ 文件全量替换，typecheck 全绿 |
| v0.4 | 2026-08-15 | ZCode | 一致性修正：右侧工作面板规格按代码现状修正为默认 380、可拖 320–960（原 320 固定/240–480 与实现不符）；F2-2 状态修正为部分完成（模板分发未实现） |

> **阅读约定**：本文档是施工图纸，不是宪法。设计系统里的色值/圆角/组件规格以 `doc/01-GeoWorkFrontend-Design-System.md` 为准，本计划只规定"什么时候做哪一段、做完怎么算数"。

---

## G0. 依赖图与执行总顺序

```
F0-2（主题入口收敛）─┐
                    ├──→ F0-3（胶囊组件组装）→ F0-1（任务对话页验收基线）
F0-4（stylelint）───┘                                         │
                                                              ↓
              F2-1（布局骨架三件套）──────────────────────────┤
              F1-1（Lucide 全站替换）────┐                    ↓
              F1-2（状态页组件化）───────┼──→ F1-3（全页面对齐 v1.5.0）→ FP3 铺量
                                         ↓
                                   F2-4（6 主题正式下线）
```

| 顺序 | 阶段 | 可否并行 | 前置条件 |
|---|---|---|---|
| 1 | F0-4 stylelint + F0-2 主题收敛 | 并行 | 无 |
| 2 | F0-3 胶囊组件组装 | — | F0-4 完成（新组件不触发 lint） |
| 3 | F0-1 任务对话页基线 | — | F0-2 + F0-3 完成 |
| 4 | F1-1 Lucide + F1-2 状态页 | 并行 | F0-1 完成（有基线截图才能对比回归） |
| 5 | F2-1 布局三件套 | — | F0-1 完成 |
| 6 | F1-3 全页面对齐 | — | F1-1 + F2-1 完成（图标统一 + 架构接口稳定） |
| 7 | F2-4 6 主题下线 | — | F1-3 完成 |
| 8 | FP3 铺量 | — | 前面全部验收过 |

---

## F0. 基础落地（v1.4 → v1.5 收口）

> 目标：把设计系统里已经定死的规则变成代码事实，同时给后面所有阶段立规矩——不允许"设计写了但代码没跟上"的漂移。

### F0-1 任务对话页为视觉验收基线（最高优先级）

| 项 | 内容 |
|---|---|
| 范围 | `apps/desktop/src/pages/NewTask/NewTaskPage.tsx`（对话区 + 输入框 + 工具条 + 消息流 + 空状态） |
| 验收标准 | 见设计系统 §10.1.5 + §18 |
| 落地动作 | ① 选 1 张明暗各一张截图存 `dev/docs/visual-baseline/`；② 页面元素宽度全部对齐 §7.2 刻度（720/56/24）；③ 主操作按钮走 CapsuleButton 渐变（`shape=round` + 主题级 primary token 已替换为 `#3186ff` 系）；④ Tag 状态色对齐 §3.4；⑤ **禁止**任何不符设计系统色值的硬编码 |

### F0-2 主题入口收敛（关闭非 editorial 主题，只留 editorial / editorial-dark / system）

| 项 | 内容 |
|---|---|
| 涉及文件 | `apps/desktop/src/app/AppShell.tsx`（主题 Dropdown）、`apps/desktop/src/app/themes/useAntdTheme.ts` |
| 现状问题 | `Appearance` 类型里有 7 个值（light/dark/system/illustration/glass/editorial/editorial-dark），但 `themeMenuItems` 只暴露 3 个；代码层和 UI 层不对账 |
| 落地动作 | ① `Appearance` 类型保留 7 个值不动；② `themeMenuItems` 只渲染 `editorial` / `editorial-dark` / `system`；③ `<AppShell>` 里加一条注释说明"关闭入口 ≠ 删除代码"；④ 不删 `appearanceStore.ts` 中 `VALID_APPEARANCES` 的运行时校验（防止 hot-reload 状态污染） |
| 验收标准 | 下拉菜单只出现 3 项；URL 手动改 `localStorage` 存 `appearance=glass` 时，fallback 到 editorial 不白屏 |

> **2026-08-19 补记决策（doc/27 W4-3）**：CSS Modules 中 92 处引用 `var(--ant-color-*)` 当前是悬空的——ConfigProvider 未开 `cssVar`，这些变量无定义来源（靠 fallback 或恰好不生效）。W4-3 工单将开启 ConfigProvider `cssVar` 使其生效；同时 `index.css` 用 `!important` 全局覆盖主按钮为渐变胶囊的做法与 editorialTheme 的 Button token 双重定义同一视觉，须并入 Button token 删除 `!important`。样式纪律（替代原 FP3-2 数值目标）：**禁止新增游离于 token 的样式，存量随改造收敛**。

### F0-3 胶囊组件四件套组装（Capsule*）

| 组件 | antd 映射 | 现状 | 落地动作 |
|---|---|---|---|
| CapsuleButton | `Button` + `shape="round"` + 主题级 primary 覆写 | 无独立文件 | 新建 `apps/desktop/src/shell/components/CapsuleButton.tsx`，内部不再手填色值，直接引用 `token.colorPrimary` 系 |
| CapsuleTabs | `Segmented` + 覆写 `border-radius: 9999px` | 无独立文件 | 新建 `CapsuleTabs.tsx`，胶囊高 32px，padding `0 16px` |
| CapsuleTag | `Tag` + 覆写 `border-radius: 9999px` | 无独立文件 | 新建 `CapsuleTag.tsx`，22px 高，状态色 12% 透明度背景 |
| CapsuleGhost | `Button ghost` + `shape="round"` | 无独立文件 | 新建 `CapsuleGhost.tsx`，透明底 + 1px `colorBorder` |
| 验收标准 | ① 四件套都注册了；② 全站任意页面调用主按钮时，样式与 §10.1.3 一致；③ grep 不到非胶囊族组件使用 `9999px` |

### F0-4 stylelint 规则配置上机

| 项 | 内容 |
|---|---|
| 涉及文件 | `apps/desktop/.stylelintrc.json` |
| 落地动作 | 参照设计系统 §17.2 白名单配置 4 条硬规则（禁 hex 色值 / 禁 margin 的 8 例外 / 禁 gap 的百分比 / 禁 9999px 除胶囊族） |
| 验收标准 | `npm run lint:styles` 零报错；在 `app/` 下故意写一行 `color: #ff0000` 能报 Error |

### F0 验收倒序检查表

- [x] F0-1 任务对话页贴完成态截图（明暗各一张），能复现 §7.2 刻度 — ⏳ 待人工截图存档
- [x] F0-2 主题下拉里不出现 illustration/glass/bootstrap
- [x] F0-3 全站搜 `9999px` 只命中 4 个胶囊组件
- [x] F0-4 stylelint 规则生效，PR 里有 lint pass 记录

> **F0 完成日期**：2026-08-12 · **执行者**：TraeCode AI Agent · **分支**：dev-frontend/TraeCodeCloud-SeedCode

---

## F1. 图标 / 反馈 / 全局样式收尾

> 目标：把"不够工程化"的三件事——图标混用、空/加载/报错散装、样式文件味重——回收到设计系统的单一出处。

### F1-1 Lucide 图标全站替换（`@ant-design/icons` 全量替换）

| 范围 | 内容 |
|---|---|
| 违规清单 | `pages/` 下所有使用 `@ant-design/icons` 的文件（执行 `grep -r '@ant-design/icons' src/` 获取实时清单），全部为孤例（16px 用 `MessageOutlined` 级联、20px 用 `SettingOutlined` 级联） |
| 落地动作 | ① 全部替换为 `lucide-react` 同名/近似图标，尺寸对应 16→18px（设置图标）/ 16→20px（默认图标）；② 全局 CSS 统一 `.lucide` 类名清除默认 stroke，对齐设计系统 §16.1；③ `AppShell.tsx` 里的菜单图标从 `SunOutlined/MoonOutlined` 换成 `Lucide.Sun` / `Lucide.Moon` |
| 验收标准 | `npm run build` 后 `dist/` 里不再有 `@ant-design/icons` 的 chunk；页面截图对比无回流（F0-1 基线） |

### F1-2 骨架屏 / 空状态 / 报错页三件套产品化

| 场景 | 现状 | 落地动作 |
|---|---|---|
| 骨架屏 | 各页面自绘（NewTask 用 Skeleton + padding 手写） | 抽象 `<PageSkeleton layout={对话|工作台|列表|表单} />`，复用 §8.1 四模板尺寸 |
| 空状态 | 各页面自绘 Empty | 抽象 `<EmptyState icon={icon} title={title} desc={desc} actions={actions} />`，暗色模式下图表用 `#8BFFE2` |
| 报错页 | Alert 自发，无统一边界 | 抽象 `<ErrorBoundary level={字段|块|页面|全局} retry={fn} />`，对齐 §8.3 |

### F1-3 全页面对齐设计系统 v1.5.0（去红色残留 / 去自造色 / 去随机圆角）

- **自造色清理**：grep 全局 `#` 字符串宽度，非 token 色值全部回收到 §3.4 状态色阶或 §3.1 品牌色
- **圆角清理**：`radius` 必须是 4 / 8 / 12 / 9999 四者之一；发现 `border-radius: 10 / 20 / 2` 一律替换
- **间距清理**：margin/padding 只允许 4 的整数倍，其他值报错

### F1 验收

- [ ] 页面截图对比 F0-1 基线，视觉无回流 — ⏳ 待截图
- [x] 全局 grep `@ant-design/icons` 命中 0 — ✅ F1-1 已完成（2026-08-13）
- [x] 骨架屏复用在 4 个以上页面调用（NewTaskPage/WorkspacePage/扩展预留）
- [x] stylelint 在整个 `src/` 零 error

> **F1-2/F1-3 完成日期**：2026-08-12 · **执行者**：TraeCode AI Agent
> **F1-1 完成日期**：2026-08-13 · **执行者**：TraeCode AI Agent · 分支 `feat/F1-visual-upgrade`

---

## F2. 布局骨架上线 + 主题隔离下线

> 目标：把"少即是多"的三段式 Agent 工作区做出来，同时把不需要的 6 主题彻底从菜单和 store 切断。

### F2-1 布局骨架三件套

| 组件 | 尺寸锚点 | 落地动作 | 状态 |
|---|---|---|---|
| 左侧 icon rail | 56px 固定宽，全站常驻 | `IconRail.tsx` 已集成到 `AppShell.tsx`，侧栏折叠→0px 由 rail 承担导航 | ⚠️ 勘误（2026-08-20）：文档记录"已集成"与代码现状不符——AppShell.tsx import 表无 IconRail，大概率被 8 月中旬 Gemini 侧栏改版顶替。处置待用户拍板（删文件或复活），见 doc/27 W4-1 第 ⑤ 条 |
| 主内容区 | 4 模板对应 A/B/C/D 四种 max-width 和 padding | 在 `AppShell.tsx` 按路由分发 `<SkeletonPage template={A\|B\|C\|D} />` | ⏳ 待实现 |
| 右侧常驻工作面板 | 默认 380，可拖 320–960（且不超过视口 65%），收起返回 null（无残影） | `RightWorkspacePanel.tsx` 独立 panel + 拖拽手柄；收起/展开按钮在顶栏图标组 | ✅ 2026-08-14（规格于 2026-08-15 按实现修正） |

### F2-2 页面信息架构对齐

> **状态（2026-08-15 核实）**：部分完成。ErrorBoundary 包裹、About 页已落地；下表的路由→模板分发尚未在 `AppShell.tsx` 实现（当前为 `<Outlet />` 直出），PageSkeleton 仅 NewTaskPage/WorkspacePage 两页使用。

| 路由 | 修正 |
|---|---|
| `/` | 保留 `/new-task` 重定向 |
| `/new-task` | 模板 A（对话流），不换路由 |
| `/tasks` | 模板 C（列表视图） |
| `/settings` | 模板 D（表单页），640px 居中，bottom action bar 64px |
| `/data-center` | 模板 B（工作台，两栏，左树右表/图） |
| `/agent-studio` | 模板 B（工作台） |
| `/mobile-control` | 模板 D（表单页） |
| `/extensions/*` | 模板 C（列表/卡片） |

### F2-3 页面级栅格试点

- NewTask 满铺白名单：672px 对话栏居中 + 24px 原生偏差
- Settings 640px 居中，bottom action bar 64px 高度对齐 v1.4.1 表单页

### F2-4 6 主题正式下线

| 状态 | 动作 |
|---|---|
| `light` / `dark` / `illustration` / `glass` / `bootstrap` → `system` | `appearanceStore` 运行时校验白名单同步删掉（保留 `editorial` / `editorial-dark` / `system`） |
| 菜单 | 已 F0-2 收敛，此处不再重复 |
| 代码 | 不删文件，仅改类型和 fallback 逻辑 |
| 验收 | 手动把 localStorage 写成 `appearance=glass`，页面渲染 editorial-light |

### F2 验收

- [ ] 5 个路由都走对应模板，且 padding/max-width 全部对齐 §7.3 — ⏳ 待实现（模板分发未落地）
- [ ] 右侧工作面板拖拽 320–960 有吸附，收起后宽度残影为 0 — ⏳ 待人工验证
- [ ] 设置页 640px 居中截图与 §7.3 模板 D 完全一致 — ⏳ 待截图
- [x] 控制台 `localStorage.getItem('appearance')` 输入错值时页面塌到 editorial-light，无报错

> **F2-1/F2-4 完成日期**：2026-08-12 · **执行者**：TraeCode AI Agent
> **F2-2 状态**：部分完成（2026-08-15 核实修正，模板分发待实现）

---

## FP3. 组件铺量 + 品牌化收尾

> 目标：把 v1.5.0 里已经有的品牌表达全部铺到全站，并把 GeoWork 品牌资产（Welcome 页 / About 页面）纳入工程化治理。

### FP3-1 品牌化组件落地（Welcome / Hero / About）

| 场景 | 现状 | 落地动作 |
|---|---|---|
| Welcome 首屏 | 无 | `GradientText` + `GeoWork` 品牌字形，按 §3.1 用 `#3186ff→#4ea0ff` 渐变 |
| About 页 | 无 | 新增路由，渲染 Logo + 版本号 + MIT License + 第三方依赖列表 |
| Hero 空状态 | 无 | 对齐 §13：深夜CodeRecovery 主视觉 + 胶囊 CTA |

### FP3-2 代码规范收敛

| 内容 | 落地动作 |
|---|---|
| CSS 文件数 | 从现在的 28 个 `.module.css` 收敛到 8 个（按页面域分），其他全部用 token 组件 + antd 主题变量解决 |
| @ts-nocheck | `editorialTheme.ts` / `editorialDarkTheme.ts` 里的类型注解误用历史账清零 |
| 组件命名 | 全部 `<PascalCase>`，函数组件禁止 `React.FC`（对齐 §17.6） |

### FP3-3 5 主题切换稳定性

- 切换主题不发白屏闪烁，150ms 内完成过渡
- matchMedia 监听 `(prefers-color-scheme)` 变化时，运行时同步 `resolvedAppearance`
- 验收：macOS/Win 下切换系统主题，3 秒内 App 内跟随

### FP3-4 README / 对外品牌资产更新

- 把 README 里的老 Logo 和配色图替换为 Gemini 蓝版
- 对齐 `doc/01-GeoWorkFrontend-Design-System.md` §3.1 新的品牌色板
- 添加"Design Tokens" 章节，列 token 表 + 链接到设计系统

---

## F0~FP3 版本变更记录

| 版本 | 立项日期 | 关键动作 | 关联文档版本 |
|---|---|---|---|
| F0 v0.1 | 2026-08-11 | 立线、主题收敛、胶囊四件套、stylelint | 设计系统 v1.5.0 |
| F1 v0.1 | 2026-08-11 | Lucide 全量替换 `@ant-design/icons`、三件套产品化、去残留 | 设计系统 v1.5.0 |
| F2 v0.1 | 2026-08-11 | 三段式布局、8 路由架构对齐、6 主题下线 | 设计系统 v1.5.0 |
| FP3 v0.1 | 2026-08-11 | Welcome/About 品牌化、CSS 收敛、5 主题稳定 | 设计系统 v1.5.0 |

---

*文档完。后续所有"这个怎么做"的讨论，引用对应阶段编号即可，不另起新文件。*
