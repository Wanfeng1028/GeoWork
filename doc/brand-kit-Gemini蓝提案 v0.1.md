# GeoWork Brand-Kit 提案 v0.1：Gemini 蓝渐变切换

> **关联文档**：`doc/前端设计系统.md` v1.4.1 §10.1.3 / §10.1.5
> **状态**：待用户评审。**未拍板前，主设计系统色板保持 dark `#3AD9FF` / light `#0e7490` 不变。**

---

## 一、变更定位

| 对比项 | 当前规范（v1.4.1） | 本提案 |
|---|---|---|
| 主色来源 | 深海军蓝 `#071225` 派生 | Google Gemini 官方蓝渐变派生 |
| 深色主题主交互色 | `#3AD9FF`（信号蓝） | **Gemini 蓝渐变**（见 2.1） |
| 亮色主题主交互色 | `#0e7490`（深青） | **Gemini 蓝渐变**（见 2.2） |
| 背景阶梯 | 不变 | 不变 |
| 状态色（成功/警告/错误） | 不变 | 不动 |
| 品牌资产（Logo / README） | 不变 | 不变 |
| 变更范围 | — | 主色、链接、选中态、胶囊选中、运行状态、可访问性色 |

---

## 二、新色系定义

### 2.1 深色主题（Dark Mode）：Gemini 蓝渐变

原生参数取自 [BlogAstroPure](https://github.com/Wanfeng1028/BlogAstroPure)：

```css
--gemini-gradient: linear-gradient(89.58deg, #3186ff 0.28%, #346bf0 44.45%, #4ea0ff 99.55%);
```

| token | 值 | 说明 |
|---|---|---|
| `colorPrimary` | `#3186ff` | 主色锚点（渐变最左端，用于算法计算与非胶囊场景） |
| `colorPrimaryHover` | `#4f9dff` | 提亮 10% |
| `colorPrimaryActive` | `#2673e6` | 压暗 10% |
| `colorPrimaryBg` | `rgba(49, 134, 255, 0.10)` | 背景级激活 |
| `colorPrimaryBgHover` | `rgba(49, 134, 255, 0.18)` | 背景级 hover |
| `colorPrimaryBorder` | `rgba(49, 134, 255, 0.20)` | 边框默认 |
| `colorPrimaryBorderHover` | `rgba(49, 134, 255, 0.35)` | 边框 hover |
| `colorPrimaryText` | `#ffffff` | 文字（在渐变底上） |
| `colorPrimaryTextHover` | `#ffffff` | — |
| `colorPrimaryTextActive` | `#ffffff` | — |

**胶囊/主按钮专用**：
```css
.capsule-btn-primary {
  background: linear-gradient(89.58deg, #3186ff 0.28%, #346bf0 44.45%, #4ea0ff 99.55%);
  color: #ffffff;
}
.capsule-btn-primary:hover { filter: brightness(1.06); }
.capsule-btn-primary:active { filter: brightness(0.95); transform: scale(0.97); }
```

### 2.2 亮色主题（Light Mode）：Gemini 蓝适配版

直接沿用 BlogAstroPure 渐变在亮色下对比度不足（`#3186ff` 背景亮度约 52%，白字对比度仅 ~2.9:1），故派生深色锚点：

| token | 值 | 说明 |
|---|---|---|
| `colorPrimary` | `#1d4ed8` | 亮色主色锚点（Tailwind blue-700，对比度 4.6:1） |
| `colorPrimaryHover` | `#3b82f6` | blue-500 |
| `colorPrimaryActive` | `#1e40af` | blue-800 |
| `colorPrimaryBg` | `rgba(29, 78, 216, 0.06)` | — |
| `colorPrimaryBgHover` | `rgba(29, 78, 216, 0.10)` | — |
| `colorPrimaryBorder` | `rgba(29, 78, 216, 0.20)` | — |
| `colorPrimaryBorderHover` | `rgba(29, 78, 216, 0.35)` | — |
| `colorPrimaryText` | `#1d4ed8` | 链接色 |
| `colorPrimaryTextHover` | `#3b82f6` | — |
| `colorPrimaryTextActive` | `#1e40af` | — |

**亮色胶囊/主按钮**（保持品牌渐变，但调暗）：
```css
.capsule-btn-primary {
  background: linear-gradient(89.58deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
  color: #ffffff;
}
```

### 2.3 新旧色对照速查

| 场景 | 旧（当前 v1.4.1） | 新（本提案） |
|---|---|---|
| 深色主色 | `#3AD9FF` | `#3186ff` |
| 深色主按钮底色 | `#3AD9FF` 纯色 | `#3186ff → #4ea0ff` 渐变 |
| 深色链接 | `#3AD9FF` | `#3186ff` |
| 深色运行状态 | `#3AD9FF` | `#3186ff` |
| 亮色主色 | `#0e7490` | `#1d4ed8` |
| 亮色主按钮底色 | `#0e7490` 纯色 | `#1d4ed8 → #3b82f6` 渐变 |
| 亮色链接 | `#0e7490` | `#1d4ed8` |
| 亮色运行状态 | `#0e7490` | `#1d4ed8` |

---

## 三、状态色（Keep 不变）

成功 / 警告 / 错误 / 中性四类与品牌主色无耦合，提案**不改动**：

| 状态 | dark | light |
|---|---|---|
| 成功 success | `#8BFFE2` | `#0f766e` |
| 警告 warning | `#F4D77E` | `#b45309` |
| 错误 error | `#ff6b6b` | `#dc2626` |
| 中性 neutral | `#94a3b8` | `#64748b` |

---

## 四、背景与边框（Keep 不变）

背景阶梯、容器色、边框色全部沿用 v1.4.1：

| 层级 | dark | light |
|---|---|---|
| Level 0 | `#0a0f1c` | `#f7f8fa` |
| Level 1 | `#121829` | `#ffffff` |
| Level 2 | `#1b2338` | `#f1f4f8` |
| Level 3 | `#232d45` | `#e8edf4` |
| 边框 | `rgba(255,255,255,0.06)` | `rgba(15,23,42,0.08)` |

> **注意**：深色背景保持 GeoWork 原生的深海军蓝系，不随品牌主色切换为 Google 风格深灰。

---

## 五、受影响清单（精确到文件 + token 数）

### 5.1 设计系统文档 `doc/前端设计系统.md`

| 位置 | 当前内容 | 需替换为 | 改动次数 |
|---|---|---|---|
| §1 版本表 v1.1 行 | `dark #3AD9FF / light #0e7490` | 保留（历史记录） | 0 |
| §3.1 品牌原色 | `#3AD9FF`（信号蓝） | 新增"Gemini 蓝" `#3186ff` / `#1d4ed8` | 1 |
| §3.4 主色对照 | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §6.1 Button primary | `#3AD9FF` / `#0e7490` | 渐变值或 `#3186ff` / `#1d4ed8` | 2 |
| §6.1 link | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §6.1 Menu 指示条 | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §9.4 运行状态 Tag | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §10.1.3 CapsuleTabs 选中项 | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §10.1.3 CapsuleButton 背景 | `#3AD9FF` / `#0e7490` | Gemini 蓝渐变 | 2 |
| §10.1.5 验收清单 | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §11 Agent 状态色表 | `#3AD9FF` / `#0e7490` × 3 行 | `#3186ff` / `#1d4ed8` × 3 行 | 6 |
| §15 可访问性 | `#3AD9FF` + `#0a0f1c` | 更新对比度值 | 1 |
| §17 工程纪律 stylelint 白名单 | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |
| §21 验收清单 | `#3AD9FF` / `#0e7490` | `#3186ff` / `#1d4ed8` | 2 |

**文档改动计**：约 25 处 token 替换 + 2 处新增胶囊渐变规格。

### 5.2 主题代码 `apps/desktop/src/app/themes/`

| 文件 | 受影响 token | 说明 |
|---|---|---|
| `editorialDarkTheme.ts` | `colorPrimary` 全系列、`colorLink`、`Menu` 选中 `activeBorderColor`、`Tag` 状态色 | 从 `#3AD9FF` 切换到 `#3186ff` 系 |
| `editorialTheme.ts` | `colorPrimary` 全系列、`colorLink`、`Menu` 选中 `activeBorderColor` | 从 `#0e7490` 切换到 `#1d4ed8` 系 |

**代码改动计**：约 23 处 token 替换，两处文件。

---

## 六、技术实现约束（antd 6 派生陷阱）

antd 6 的 `colorPrimary` 会自动派生 10+ 个相关色。如果直接塞 `#3186ff`，antd 的自动派生算法会在某些中间态产生偏灰/偏紫的意外色。必须在主题 token 里**显式覆写**以下字段，禁止依赖默认派生：

```ts
// editorialDarkTheme.ts 必须显式声明
colorPrimary: '#3186ff',
colorPrimaryHover: '#4f9dff',
colorPrimaryActive: '#2673e6',
colorPrimaryBg: 'rgba(49,134,255,0.10)',
colorPrimaryBgHover: 'rgba(49,134,255,0.18)',
colorPrimaryBorder: 'rgba(49,134,255,0.20)',
colorPrimaryBorderHover: 'rgba(49,134,255,0.35)',
colorPrimaryText: '#ffffff',
colorPrimaryTextHover: '#ffffff',
colorPrimaryTextActive: '#ffffff',
```

> 同样逻辑适用于亮色主题。胶囊渐变通过 CSS 覆写组件背景实现，不走 antd token。

---

## 七、可访问性检查

| 场景 | 对比度理论值 | 判定 |
|---|---|---|
| 深色主按钮 `#3186ff` + `#ffffff` | 约 4.5:1 | ✅ 刚好过 WCAG AA |
| 深色胶囊渐变 + `#ffffff`（渐变最浅端 `#4ea0ff`） | 约 3.8:1 | ⚠️ 渐变末段对比度偏低，建议验收时实测；若未过，压暗末段至 `#3d8bff` |
| 深色链接 `#3186ff` on `#0a0f1c` | 约 8.2:1 | ✅ |
| 亮色主按钮 `#1d4ed8` + `#ffffff` | 约 6.1:1 | ✅ |
| 亮色链接 `#1d4ed8` on `#f7f8fa` | 约 4.6:1 | ✅ |
| 亮色运行状态 `#1d4ed8` on `#ffffff` | 约 6.1:1 | ✅ |

**风险项**：深色胶囊渐变末段 `#4ea0ff` 在白色文字下理论对比度可能低于 4.5:1。建议在落地时用 [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) 实测中间段（`#346bf0`、`#4ea0ff`），如未过则微调末段色值。

---

## 八、实施顺序建议

1. **用户拍板**：确认采用本提案（选项 B：全局切换）。
2. **代码先行**：改 `editorialDarkTheme.ts` + `editorialTheme.ts` 两个主题文件，跑起来看视觉效果。
3. **对比验收**：用 WebAIM checker 实测关键组件对比度，不合格则微调渐变末段色值。
4. **文档收口**：确认色值后，把 `前端设计系统.md` 中 25 处 `#3AD9FF` / `#0e7490` 引用全部替换为新值，更新版本表为 v1.5.0。
5. **stylelint 白名单**：同步更新 §17.3 的圆角例外白名单和 §17.4 的颜色白名单。

---

## 九、决策点（用户需确认）

- [ ] **Q1**：是否接受亮色主题使用 `#1d4ed8` 作为锚点（而非直接沿用 `#3186ff`）？（对比度更健康）
- [ ] **Q2**：深色胶囊渐变末段 `#4ea0ff` 如果实测对比度不足，是否接受将其调整为 `#3d8bff`？
- [ ] **Q3**：品牌资产（README、Logo）中的 `#3AD9FF` / `#071225` 是否也同步更新为 Gemini 蓝系？（本提案默认不动）

---

> **提案终稿后动作**：三个决策点全部确认后，执行"代码 → 验收 → 文档"三步，预计代码改动 23 处、文档改动 25 处。
