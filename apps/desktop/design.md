# GeoFrontend2.0 design.md

> 放置路径：`E:\code\javascript\project\GeoFrontend2.0\design.md`  
> 适用项目：GeoFrontend2.0  
> 适用对象：AI 编程助手、前端开发者、代码审查者  
> 文档定位：**项目级长期设计约束**，不是某一次任务的修复记录。  
> 核心原则：**全面拥抱 Ant Design，默认不自行设计基础 UI。**

---

## 1. 项目定位

GeoFrontend2.0 是 GeoWork 的新 Web 前端项目，当前优先做 Web SPA，不做 Electron 桌面封装。

项目目标：

```text
使用 Ant Design v6 作为唯一基础 UI 体系。
使用 Ant Design 官网 ThemePreview 的 Bootstrap 拟物化主题作为亮色主题。
使用 Ant Design 官方 darkAlgorithm 作为暗色主题。
使用 Ant Design / ProComponents / Ant Design Charts / AntV 体系完成中后台、图表和可视化页面。
除非用户明确要求，否则 AI 编程助手不得自行设计基础 UI 视觉。
```

---

## 2. AI 编程助手工作规则

AI 编程助手在修改 GeoFrontend2.0 前，必须遵守：

```text
先阅读本 design.md。
先确认当前任务属于哪一步。
先列出执行计划。
先列出要修改和新增的文件。
等待用户确认后再执行。
每一步只做当前目标，不提前做后续页面。
```

禁止：

```text
一次性做完整项目。
用户没有要求时自行新增复杂功能。
用户没有要求时自行设计视觉风格。
用户没有要求时引入新 UI 库。
用户没有要求时复制旧 GeoWork 前端代码。
```

如果用户要求“写提示词”，必须包含：

```text
任务背景
当前状态
本步骤目标
允许修改范围
禁止事项
验收标准
执行命令
提交要求
```

---

## 3. Ant Design For Agents 规则

开发本项目时，应优先参考 Ant Design 官方面向 AI Agent 的资料：

```text
https://ant.design/docs/react/for-agents-cn
https://ant.design/docs/react/for-agents-cn.md
https://ant.design/llms.txt
https://ant.design/llms-full-cn.txt
```

如果环境允许，可以使用 Ant Design CLI：

```bash
npm install -g @ant-design/cli
```

常用命令：

```bash
antd info Button
antd doc Button
antd demo Select basic
antd token DatePicker
antd design.md
antd semantic Table
antd lint ./src
antd usage ./src
antd doctor
```

原则：

```text
写 AntD 代码前，应确认当前 antd 版本的组件 API。
不确定组件 API 时，不要凭记忆写旧版本写法。
涉及 classNames / styles / semantic DOM 时，优先查询 AntD 官方文档或 CLI。
```

---

## 4. 固定技术栈

当前基础技术栈：

```text
Vite
React
TypeScript
Ant Design v6
@ant-design/icons
antd-style
clsx
React Router
Zustand
```

后续按阶段引入：

```text
@ant-design/pro-components
@ant-design/charts
@tanstack/react-query
MapLibre GL
deck.gl
Vitest
Testing Library
```

禁止引入：

```text
Tailwind
Radix
shadcn/ui
Bootstrap CSS
Less 变量覆盖主题
Sass / SCSS 主题系统
自研基础 UI 组件库
旧 GeoWork components/ui
旧 GeoWork components/foundation
旧 GwButton / GwCard / GwPanel
```

---

## 5. 固定主题体系

项目只允许三种主题入口：

```text
Bootstrap
Dark
System
```

内部状态类型固定为：

```ts
type Appearance = 'light' | 'dark' | 'system'
type ResolvedAppearance = 'light' | 'dark'
```

语义映射：

```text
appearance = light  -> Bootstrap Theme
appearance = dark   -> Dark Theme
appearance = system -> 根据系统 prefers-color-scheme 解析为 light 或 dark
```

localStorage 只保存：

```text
geowork.appearance
```

禁止保存：

```text
resolvedAppearance
旧 theme name
data-theme
glass
parchment
classic
auto
```

---

## 6. Bootstrap 主题规则

Bootstrap 主题必须来自 Ant Design 官网 ThemePreview 的 Bootstrap 实现。

项目应保留以下主题结构：

```text
src/app/themes/bootstrapTheme.ts
src/app/themes/darkTheme.ts
src/app/themes/index.ts
```

Bootstrap 主题不是简单配置：

```ts
colorPrimary: '#0d6efd'
```

Bootstrap 主题必须保留官网 ThemePreview 风格能力：

```text
theme.defaultAlgorithm
token
components
wave
modal classNames
button classNames
alert className
dropdown classNames
select classNames
switch classNames
progress classNames
colorPicker classNames
```

禁止把 Bootstrap 主题退化成只配置几个 token。

---

## 7. Dark 主题规则

Dark 主题使用 Ant Design 官方暗黑算法：

```ts
import { theme } from 'antd'

export const darkTheme = {
  algorithm: theme.darkAlgorithm,
}
```

允许：

```text
AntD primary 蓝色作为菜单选中态。
AntD primary 蓝色作为按钮主色。
AntD darkAlgorithm 自动生成背景、文字、边框和状态色。
```

禁止：

```css
background: #000;
color: #fff;
border-color: #333;
```

暗色模式不能靠手写黑色 CSS 实现，必须交给 Ant Design token 和 darkAlgorithm。

---

## 8. AppProviders 规则

全局 Provider 必须集中管理：

```text
ConfigProvider
AntD App
```

允许后续加入：

```text
React Query Provider
RouterProvider
```

原则：

```text
ConfigProvider 必须统一包裹全应用。
AntD App 必须统一提供 message / notification / modal 上下文。
页面中使用 message / modal / notification 时，优先使用 App.useApp()。
```

禁止：

```text
页面里重复创建 ConfigProvider。
页面里绕过 AntD App 自己写 toast。
页面里自己写 modal 系统。
```

---

## 9. AppShell 规则

AppShell 必须使用 Ant Design 组件：

```text
Layout
Layout.Header
Layout.Sider
Layout.Content
Menu
Button
Segmented
Typography
Dropdown
Badge
Avatar
```

AppShell 不能自行设计视觉主题。

### 9.1 AppShell 颜色必须来自 token

允许使用：

```tsx
import { theme } from 'antd'

const { token } = theme.useToken()
```

Header / Sider / Content 的背景、文字和分割线必须来自：

```text
token.colorBgContainer
token.colorBgLayout
token.colorText
token.colorBorderSecondary
```

示例：

```tsx
<Header style={{ background: token.colorBgContainer, color: token.colorText }} />
<Sider style={{ background: token.colorBgContainer }} />
<Content style={{ background: token.colorBgLayout }} />
```

### 9.2 AppShell 禁止写死颜色

禁止在 `AppShell.module.css` 或 `AppShell.tsx` 中写：

```css
background: #001529;
background: #001f33;
background: #000;
background: #fff;
color: #fff;
border-color: #333;
```

### 9.3 Menu 主题规则

Menu theme 必须根据 `resolvedAppearance`：

```text
resolvedAppearance = light -> Menu theme="light"
resolvedAppearance = dark  -> Menu theme="dark"
```

禁止：

```tsx
<Menu theme="dark" />
```

除非用户明确要求固定暗色导航。

### 9.4 AppShell.module.css 只允许布局

允许：

```css
.root {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: 24px;
}

.content {
  padding: 24px;
  overflow: auto;
}
```

禁止：

```css
.logo {
  color: #fff;
}

.header {
  background: #001529;
}
```

---

## 10. AntD 组件优先规则

### 10.1 基础 UI 必须用 AntD

必须优先使用：

```text
Button
Card
Alert
Input
InputNumber
Select
DatePicker
Form
Table
Tabs
Tag
Badge
Modal
Drawer
Dropdown
Menu
Tooltip
Popover
Progress
Segmented
Switch
Checkbox
Radio
Typography
Space
Flex
Result
Empty
Descriptions
Statistic
Upload
Tree
Timeline
Steps
Breadcrumb
Avatar
QRCode
ColorPicker
```

禁止自己封装基础 UI：

```text
BaseButton
BaseCard
BaseInput
BaseModal
BaseSelect
AppButton
UiButton
GwButton
GwCard
GwTabs
```

### 10.2 可以封装业务组件

允许：

```text
LayerTree
TaskTimeline
RuntimeStatusCard
MapViewport
ModelConfigForm
DataAssetTable
TaskDetailDrawer
WorkspaceMapPanel
```

原则：

```text
封装业务语义，不封装视觉皮肤。
业务组件内部继续组合 AntD 组件。
```

---

## 11. ProComponents 规则

后续引入 `@ant-design/pro-components` 后，优先使用：

```text
ProLayout
PageContainer
ProCard
ProTable
ProForm
ProDescriptions
```

使用规则：

```text
页面框架优先 PageContainer。
复杂数据表优先 ProTable。
复杂表单优先 ProForm。
信息区块优先 ProCard。
详情页优先 ProDescriptions。
```

禁止：

```text
自己写一整套 Table 搜索、筛选、分页、工具栏，然后绕过 ProTable。
自己写一整套表单布局系统，然后绕过 ProForm。
```

---

## 12. 图表和可视化规则

GeoFrontend2.0 的图表和数据可视化遵循 Ant Design 可视化规范。

优先使用：

```text
@ant-design/charts
AntV
```

地图和空间可视化使用：

```text
MapLibre GL
deck.gl
```

图表必须具备：

```text
标题
数据来源或统计口径
单位
图例
Tooltip
loading
error
empty
```

禁止：

```text
无意义装饰性图表。
没有单位的统计图。
只有 value 没有业务说明的 Tooltip。
为了页面丰富而堆图表。
```

---

## 13. 图形化规则

GeoFrontend2.0 的空状态、异常状态、成功状态可以参考 Ant Design 图形化规范。

允许图形化场景：

```text
空状态
异常状态
成功状态
首次使用引导
数据导入引导
地图图层为空
任务队列为空
模型未配置
插件未启用
报告导出完成
```

推荐元素：

```text
地图网格
经纬线
图层叠片
点线面要素
卫星影像块
数据文件
任务节点
运行日志
模型节点
插件节点
报告文档
定位标记
```

禁止：

```text
过度卡通
过度营销
无业务含义人物插画
高饱和炫彩插画
为了填空白而加图
```

---

## 14. 动效规则

GeoFrontend2.0 的动效遵循 Ant Design Motion 规范。

原则：

```text
自然
高效
克制
```

允许：

```text
Drawer 打开关闭
Modal 打开关闭
Sider 折叠展开
任务状态变化
地图对象选中反馈
图层显隐反馈
loading 状态切换
```

禁止：

```text
粒子背景
大面积循环动画
按钮复杂点击特效
表格行持续动画
失败状态闪烁动画
影响地图拖拽和缩放的动画
影响 Monaco 输入的动画
影响 xterm 输出的动画
```

第一阶段不引入：

```text
framer-motion
gsap
lottie-web
motion
```

默认使用：

```text
AntD 内置动效
少量 CSS transition
prefers-reduced-motion
```

---

## 15. CSS 规则

项目样式只允许：

```text
CSS Modules
少量全局 layout.css
AntD token
antd-style
```

CSS 只负责：

```text
布局
宽高
间距
grid
flex
overflow
滚动区域
地图容器尺寸
响应式布局
```

禁止 CSS 负责：

```text
Button 视觉
Card 视觉
Alert 视觉
Modal 视觉
Menu 视觉
Tabs 视觉
Table 视觉
Select 视觉
主题颜色
阴影系统
玻璃拟态
渐变装饰
发光边框
```

如果必须设置颜色，优先通过：

```tsx
const { token } = theme.useToken()
```

不要手写色值。

---

## 16. 亮色主题的组件表面与按钮色彩规则

Bootstrap / light 模式下，组件表面和按钮需遵循以下色彩规则：

```text
1. 页面不能大面积使用纯白卡片和纯白按钮，避免默认后台模板感。
2. 普通区域表面不应直接大量使用 token.colorBgContainer，除非该组件本身就是 AntD 原生输入、弹窗或表格容器。
3. 自定义业务面板、工作流引导、状态提示区域，优先使用 AntD token 语义背景色：
   - token.colorPrimaryBg
   - token.colorInfoBg
   - token.colorSuccessBg
   - token.colorWarningBg
   - token.colorFillQuaternary
   - token.colorFillTertiary
   - token.colorFillSecondary
   - token.colorBgElevated
4. 不允许手写固定白色、蓝色、灰色值。
5. 不允许通过 CSS 覆盖 AntD Button 的 background、border、box-shadow。
6. 主要操作按钮使用 Button type="primary"。
7. 危险操作使用 Button type="primary" danger。
8. 次级操作优先使用 AntD 的 token / color / variant 能力，或使用 Tag、Alert、Segmented、Card 等语义组件，不要全部做成白色按钮。
9. 亮色主题可以使用 AntD 语义色（info、success、warning、primary）的 token 做层次区分，但必须克制，不能做成花哨彩色面板。
10. Dark 模式仍然交给 darkAlgorithm 和 token，不手写黑色。
```

---

## 17. 页面开发规则

每个页面至少考虑：

```text
loading
error
empty
success
disabled
```

按钮文案必须有业务含义。

禁止：

```text
提交
确定
开始
处理
操作
点击
```

推荐：

```text
导入 GeoJSON
导入 Shapefile
运行 NDVI 分析
连接 QGIS
刷新图层
导出任务报告
停止当前任务
重试失败任务
保存模型配置
```

空状态必须说明下一步。禁止只写“暂无数据”。

---

## 17. 页面职责

### Dashboard

```text
工作区概览
任务趋势
数据资产统计
最近活动
失败任务提醒
```

### Workspace

```text
地图主工作区
图层树
图层属性
空间分析结果
地图交互
```

### DataCenter

```text
数据资产列表
数据导入
文件类型
坐标系
数据质量
元数据
```

### Tasks

```text
任务队列
任务进度
失败原因
运行日志
任务结果
重试和停止
```

### Settings

```text
主题设置
模型配置
运行时配置
插件权限
工作区偏好
```

### AgentStudio

```text
模型列表
工具调用
插件关系
上下文配置
调用结果
```

---

## 18. 路由规则

基础路由：

```text
/                 -> Dashboard
/workspace        -> Workspace
/data-center      -> DataCenter
/tasks            -> Tasks
/settings         -> Settings
/agent-studio     -> AgentStudio
/theme-preview    -> ThemePreview
```

规则：

```text
/theme-preview 是验证页，不放进主菜单。
主菜单只放正式业务页面。
未知路径重定向到 /。
```

---

## 19. ThemePreview 规则

`/theme-preview` 是主题验证页，必须保留。

它用于验证：

```text
Bootstrap 主题是否接近官网 ThemePreview。
Dark 主题是否正确进入 darkAlgorithm。
System 是否正确解析系统主题。
Button / Modal / Progress / Select / Dropdown 等 classNames 是否生效。
```

禁止删除 `/theme-preview`，除非用户明确要求。

---

## 20. 禁止事项总表

禁止：

```text
引入 Tailwind
引入 Radix
引入 shadcn/ui
引入 Bootstrap CSS
引入 Sass/SCSS 主题系统
复制旧 GeoWork components/ui
复制旧 GeoWork components/foundation
写 BaseButton / BaseCard / BaseInput
写自定义主题 token
写 --gw-* token
使用 data-theme 旧主题切换
在 AppShell 写死深色背景
在亮色主题下强制 dark Menu
为了好看自己设计渐变背景
为了高级感加入玻璃拟态
没有用户要求时自行设计 UI 视觉
```

---

## 21. 允许自行设计的条件

只有用户明确说以下内容时，AI 才可以自行设计：

```text
请你自己设计一版
不要按 AntD 默认样式
我要更个性化的视觉
这个页面需要单独设计
允许你自定义样式
```

即便允许自定义，也必须遵守：

```text
不破坏 Bootstrap / Dark / System 主题。
不引入额外 UI 框架。
不覆盖基础组件核心视觉。
优先通过 AntD token 和 classNames / styles 实现。
```

---

## 22. 每次修改后的验收

每一步修改后必须执行：

```bash
npm run build
```

如果涉及路由或页面，需要验证：

```text
/ 
/workspace
/data-center
/tasks
/settings
/agent-studio
/theme-preview
```

如果涉及主题，需要验证：

```text
Bootstrap
Dark
System
刷新后持久化
```

如果涉及 AppShell，需要验证：

```text
Header / Sider / Content 没有写死颜色
Bootstrap 下外壳为浅色
Dark 下外壳为暗色
Menu 选中态正常
Sider 可折叠
```

---

## 23. AI 输出要求

AI 编程助手必须这样输出：

```text
1. 当前理解
2. 本步骤目标
3. 准备修改的文件
4. 准备执行的命令
5. 等待用户确认
```

禁止：

```text
直接改很多文件不说明。
一次性跨多个阶段。
没有验收就说完成。
构建失败后继续做新功能。
```

---

## 24. 文档维护规则

本文件是项目级长期约束文档，不记录某一次具体 bug、某一次提交、某一次当前截图问题。

允许写入：

```text
长期设计原则
长期技术栈约束
长期主题规则
长期组件使用规范
长期验收标准
AI 编程助手通用工作规范
```

禁止写入：

```text
当前某个 bug 的修复提醒
下一步立刻要改哪个文件
某次截图暴露的临时问题
某次提交的短期状态
“现在先修 xxx”这类任务指令
```

短期任务、bug 修复、下一步计划应写在单独的任务提示词或 issue 中，不写进 design.md。
