# Editorial 主题实现方案

## 目标

在现有 5 套主题（晴空/暗色/跟随系统/插画/玻璃）基础上，新增 2 套 editorial 风格主题：

| Key | 显示名 | 基于 |
|-----|--------|------|
| `editorial` | 亮色 | doc/baseline/frontend-prototype/index.html |
| `editorial-dark` | 暗色 | doc/baseline/frontend-prototype/index-dark.html |

---

## 涉及文件

```
apps/desktop/src/
├── app/themes/
│   ├── index.ts                  ← 修改：注册新主题分支
│   ├── editorialTheme.ts         ← 新建：亮色 editorial
│   └── editorialDarkTheme.ts     ← 新建：暗色 editorial
├── shared/stores/
│   └── appearanceStore.ts        ← 修改：扩展 Appearance 类型 + VALID 集合
├── shell/
│   └── AppShell.tsx              ← 修改：侧栏主题菜单增加两项
└── pages/ThemePreview/
    └── ThemePreviewPage.tsx      ← 修改：Segmented 增加选项
```

---

## 1. 扩展类型与 Store

**文件：`shared/stores/appearanceStore.ts`**

```ts
// 修改 Appearance 类型
export type Appearance =
  | 'light' | 'dark' | 'system'
  | 'illustration' | 'glass'
  | 'editorial' | 'editorial-dark'  // 新增

// 修改 VALID_APPEARANCES
const VALID_APPEARANCES = new Set<Appearance>([
  'light', 'dark', 'system', 'illustration', 'glass',
  'editorial', 'editorial-dark',
])

// resolveAppearance 逻辑：editorial-dark → 'dark'，editorial → 'light'
export function resolveAppearance(a: Appearance): ResolvedAppearance {
  if (a === 'dark' || a === 'editorial-dark') return 'dark'
  if (a === 'system') return matchMedia(...).matches ? 'dark' : 'light'
  return 'light'
}
```

---

## 2. 亮色主题 — editorialTheme.ts

**文件：`app/themes/editorialTheme.ts`（新建）**

```ts
import { createStyles } from 'antd-style'
import type { ConfigProviderProps } from 'antd'

const useEditorialStyles = createStyles(({ css }) => ({
  // Button: 方形无圆角
  button: css`
    border-radius: 0 !important;
    font-weight: 500;
    letter-spacing: 0.02em;
  `,
  // Tag: 方形
  tag: css`
    border-radius: 0 !important;
  `,
  // Card: 透明底 + hover 描边
  card: css`
    background: transparent;
    border: 1px solid transparent;
    box-shadow: none;
    transition: border-color 0.25s;
    &:hover { border-color: #9B8976; }
  `,
  // Input: 微圆角
  input: css`
    border-radius: 2px;
  `,
  // Modal: 方形
  modal: css`
    .ant-modal-content { border-radius: 0; }
  `,
}))

export function useEditorialTheme(): ConfigProviderProps {
  const { styles } = useEditorialStyles()

  return {
    theme: {
      token: {
        // 色彩
        colorPrimary: '#9B8976',
        colorInfo: '#9B8976',
        colorBgLayout: '#f5f5f4',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: '#e7e5e4',
        colorBorderSecondary: '#f0efed',
        colorText: '#1c1917',
        colorTextSecondary: '#44403c',
        colorTextTertiary: '#78716c',
        colorTextQuaternary: '#a8a29e',
        colorSuccess: '#16a34a',
        colorLink: '#2563eb',

        // 圆角：全部归零（方形建筑感）
        borderRadius: 0,
        borderRadiusLG: 0,
        borderRadiusSM: 0,
        borderRadiusXS: 0,
        borderRadiusOuter: 0,

        // 字体
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 13,

        // 线条
        lineWidth: 1,
        controlHeight: 34,
      },
      components: {
        Button: {
          borderRadius: 0,
          borderRadiusLG: 0,
          borderRadiusSM: 0,
          fontWeight: 500,
        },
        Tag: {
          borderRadiusSM: 0,
        },
        Card: {
          borderRadiusLG: 0,
        },
        Input: {
          borderRadius: 2,
          borderRadiusLG: 2,
        },
        Menu: {
          itemBorderRadius: 6,
          itemSelectedBg: '#e7e5e4',
          itemSelectedColor: '#1c1917',
          itemHoverBg: '#f0efed',
        },
        Table: {
          headerBg: '#fafaf9',
          headerColor: '#78716c',
          borderColor: '#f5f5f4',
        },
        Dropdown: {
          borderRadiusLG: 10,
        },
      },
    },
    button: { classNames: { root: styles.button } },
    tag: { classNames: { root: styles.tag } },
    card: { classNames: { root: styles.card } },
    modal: { classNames: { content: styles.modal } },
  }
}
```

---

## 3. 暗色主题 — editorialDarkTheme.ts

**文件：`app/themes/editorialDarkTheme.ts`（新建）**

```ts
import { theme as antTheme } from 'antd'
import { createStyles } from 'antd-style'
import type { ConfigProviderProps } from 'antd'

const useEditorialDarkStyles = createStyles(({ css }) => ({
  button: css`
    border-radius: 0 !important;
    font-weight: 500;
    letter-spacing: 0.02em;
  `,
  tag: css`
    border-radius: 0 !important;
  `,
  card: css`
    background: transparent;
    border: 1px solid transparent;
    box-shadow: none;
    transition: border-color 0.25s;
    &:hover { border-color: #b8a898; }
  `,
  input: css`
    border-radius: 2px;
  `,
  modal: css`
    .ant-modal-content { border-radius: 0; }
  `,
}))

export function useEditorialDarkTheme(): ConfigProviderProps {
  const { styles } = useEditorialDarkStyles()

  return {
    theme: {
      algorithm: antTheme.darkAlgorithm,
      token: {
        // 色彩
        colorPrimary: '#b8a898',
        colorInfo: '#b8a898',
        colorBgLayout: '#0c0a09',
        colorBgContainer: '#1c1917',
        colorBgElevated: '#292524',
        colorBorder: '#292524',
        colorBorderSecondary: '#44403c',
        colorText: '#fafaf9',
        colorTextSecondary: '#d6d3d1',
        colorTextTertiary: '#a8a29e',
        colorTextQuaternary: '#78716c',
        colorSuccess: '#4ade80',
        colorLink: '#93c5fd',

        // 圆角归零
        borderRadius: 0,
        borderRadiusLG: 0,
        borderRadiusSM: 0,
        borderRadiusXS: 0,
        borderRadiusOuter: 0,

        // 字体
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 13,

        lineWidth: 1,
        controlHeight: 34,
      },
      components: {
        Button: {
          borderRadius: 0,
          borderRadiusLG: 0,
          borderRadiusSM: 0,
          fontWeight: 500,
        },
        Tag: { borderRadiusSM: 0 },
        Card: { borderRadiusLG: 0 },
        Input: { borderRadius: 2, borderRadiusLG: 2 },
        Menu: {
          itemBorderRadius: 6,
          itemSelectedBg: '#292524',
          itemSelectedColor: '#fafaf9',
          itemHoverBg: '#292524',
        },
        Table: {
          headerBg: '#292524',
          headerColor: '#a8a29e',
          borderColor: '#292524',
        },
        Dropdown: { borderRadiusLG: 10 },
      },
    },
    button: { classNames: { root: styles.button } },
    tag: { classNames: { root: styles.tag } },
    card: { classNames: { root: styles.card } },
    modal: { classNames: { content: styles.modal } },
  }
}
```

---

## 4. 注册到 useAntdTheme

**文件：`app/themes/index.ts`（修改）**

```ts
import { useEditorialTheme } from './editorialTheme'
import { useEditorialDarkTheme } from './editorialDarkTheme'

export function useAntdTheme(appearance: Appearance, resolved: ResolvedAppearance): ConfigProviderProps {
  // 无条件调用所有 hooks（Rules of Hooks）
  const bootstrapProps = useBootstrapTheme()
  const illustrationProps = useIllustrationTheme()
  const glassProps = useGlassTheme()
  const editorialProps = useEditorialTheme()        // 新增
  const editorialDarkProps = useEditorialDarkTheme() // 新增

  // editorial-dark 走暗色算法，优先判断
  if (appearance === 'editorial-dark') return editorialDarkProps

  // 原有暗色逻辑
  if (resolved === 'dark') return { theme: darkTheme }

  // 亮色分支
  switch (appearance) {
    case 'illustration': return illustrationProps
    case 'glass': return glassProps
    case 'editorial': return editorialProps  // 新增
    default: return bootstrapProps
  }
}
```

---

## 5. UI 入口

**文件：`shell/AppShell.tsx`（修改侧栏主题菜单）**

在"主题风格"子菜单中追加两项：

```ts
{ key: 'editorial', label: '石灰·亮' },
{ key: 'editorial-dark', label: '石灰·暗' },
```

**文件：`pages/ThemePreview/ThemePreviewPage.tsx`（修改 Segmented）**

```ts
const options = [
  { label: '晴空', value: 'light' },
  { label: '暗色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
  { label: '插画', value: 'illustration' },
  { label: '玻璃', value: 'glass' },
  { label: '石灰·亮', value: 'editorial' },    // 新增
  { label: '石灰·暗', value: 'editorial-dark' }, // 新增
]
```

---

## 6. 设计规则总结（编码时对照）

| 规则 | 值 |
|------|-----|
| 全局圆角 | 0（Button/Tag/Card/Modal） |
| Input 圆角 | 2px（保留微圆角避免过于生硬） |
| Menu item 圆角 | 6px（侧栏导航保留圆润） |
| Dropdown 圆角 | 10px（浮层保留圆润） |
| 字体 | Inter 13px |
| 线条 | 1px |
| 控件高度 | 34px |
| 亮色 primary | #9B8976 |
| 暗色 primary | #b8a898 |
| Card hover | 描边 primary 色，无阴影 |
| 亮色布局层级 | #f5f5f4 → #fafaf9 → #ffffff |
| 暗色布局层级 | #0c0a09 → #1c1917 → #292524 |

---

## 7. 验收标准

- [ ] 切换到"亮色"后，整体呈现暖白底 + 方形按钮 + stone 色点缀
- [ ] 切换到"暗色"后，整体呈现暖黑底 + 方形按钮 + 提亮 stone 色
- [ ] Button/Tag/Card/Modal 均为直角（0 radius）
- [ ] Input/Dropdown/Menu 保留微圆角
- [ ] 刷新页面后主题持久化（localStorage）
- [ ] "跟随系统"不受影响，仍走原有 light/dark
- [ ] ThemePreview 页面 7 个选项均可切换
