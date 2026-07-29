# AGENT.md

本文件用于约束所有参与 `GeoFrontend2.0 / GeoWork` 项目的 AI 编程助手、代码代理和自动化开发工具。

任何代理在修改代码前，必须先阅读本文件、`design.md` 以及与当前任务直接相关的源文件。  
除非用户明确要求，不要跳过确认步骤、不要越界重构、不要顺手修改无关代码。

---

## 1. 项目基本信息

- 产品名称：`GeoWork`
- 当前前端项目：`GeoFrontend2.0`
- 项目路径：`E:\code\javascript\project\GeoFrontend2.0`
- 技术栈：Vite + React + TypeScript + Ant Design v6
- 当前形态：Web SPA
- 当前不做：Electron、真实后端调度、真实模型服务、真实文件系统后台能力

`QoderWork`、其他软件截图、参考页面、竞品界面只允许作为“结构与交互参考”，不能作为项目名称、变量名、组件名、注释或 UI 文案出现。

---

## 2. 核心开发原则

### 2.1 先读文件，再给方案，再改代码

每次开发前必须：

1. 阅读 `design.md`
2. 阅读本文件 `AGENT.md`
3. 阅读当前任务直接相关文件
4. 输出理解、修改范围、实现方案、验收方式
5. 等用户确认后再改代码

禁止直接开始大改。

### 2.2 只做当前任务，不顺手做别的

严格遵守用户当前阶段的目标。

不要因为看到别的页面、别的 TODO、别的提交，就顺手修改：

- 路由
- AppShell
- 主题系统
- NewTaskPage
- TasksPage
- MobileControlPage
- ExpertsPage
- package.json
- design.md

除非当前任务明确要求。

### 2.3 能复用就复用

优先复用已有代码：

- 已有组件
- 已有 hooks
- 已有 theme token
- 已有类型定义
- 已有 mock 数据结构
- 已有布局方式
- 已有消息、Modal、Dropdown、Card、Button 组件模式

不要重复造轮子。  
不要为一个页面复制一套几乎相同的按钮、卡片、输入框、弹窗。

### 2.4 小步提交式开发

大任务必须拆阶段。

推荐节奏：

1. 先做基础壳
2. 再补交互
3. 再补状态
4. 再补边界处理
5. 最后做样式修复和 build

不要一次性改几十个文件。  
不要把一个页面写成几千行巨型组件。

---

## 3. 禁止行为

### 3.1 禁止破坏类型检查

禁止：

- `// @ts-ignore`
- `// @ts-nocheck`
- `eslint-disable`
- 通过 `any` 粗暴绕过类型问题
- 删除类型定义来通过 build
- 关闭 TypeScript 检查
- 关闭 ESLint 规则

必须用正确类型解决问题。

### 3.2 禁止乱改无关文件

没有明确要求时，不要修改：

- `package.json`
- `vite.config.*`
- `tsconfig.*`
- `src/app/AppProviders.tsx`
- `src/app/themes/*`
- `src/shell/AppShell.tsx`
- 其他页面的业务逻辑
- 已经完成的功能模块

尤其禁止为了当前页面方便，随手改全局布局。

### 3.3 禁止自动执行 Git 操作

除非用户明确要求，否则不要执行：

- `git pull`
- `git commit`
- `git push`
- `git reset`
- `git checkout`
- `git rebase`
- `git clean`

远端仓库只能用于了解当前开发进度。  
开发应基于用户当前本地项目状态。  
不要把“先 git pull”写进实现提示词，除非用户明确要求。

### 3.4 禁止新增依赖

除非用户明确要求，不要安装新依赖。

禁止随手引入：

- UI 库
- Markdown 渲染库
- 状态管理库
- 图表库
- 动画库
- 文件处理库
- CSS 框架

当前项目已经有 Ant Design v6，应优先使用 AntD 能力。

---

## 4. UI 与主题规范

### 4.1 必须遵守 Ant Design v6

优先使用 AntD 组件：

- Button
- Card
- Modal
- Dropdown
- Tabs
- Segmented
- Form
- Input
- Select
- Switch
- Tag
- Alert
- Empty
- Steps
- Timeline
- Upload
- Typography
- Space
- Tooltip
- App.useApp()

不要自研基础组件：

- 不要自研 Button
- 不要自研 Card
- 不要自研 Modal
- 不要自研 Select
- 不要自研 Tabs

如果 AntD 已有组件，优先用 AntD。

### 4.2 业务 CSS Module 只写布局

业务页面的 `.module.css` 只允许写：

- layout
- spacing
- width / height
- flex / grid
- overflow
- transition
- transform
- text-overflow
- responsive rules

业务 CSS Module 禁止写：

- 固定颜色
- `background`
- `color`
- `border-color`
- `box-shadow`
- `linear-gradient`
- `#fff`
- `#000`
- `#1677ff`
- 其他硬编码主题色

如果确实需要背景、边框、阴影，应在 TSX 中通过 `theme.useToken()` 使用 AntD token。

### 4.3 主题文件例外

主题文件可以写主题色值和主题专用样式，例如：

- `src/app/themes/bootstrapTheme.ts`
- `src/app/themes/illustrationTheme.ts`
- `src/app/themes/glassTheme.ts`

但这些颜色不能散落到业务页面里。

### 4.4 默认主题规则

默认亮色主题必须保持为默认。

当前主题原则：

- `light`：默认亮色主题
- `dark`：暗色主题
- `system`：跟随系统
- `illustration`：插画风格主题
- `glass`：玻璃风格主题

如果 localStorage 没有值或读取到未知值，应回退到 `light`。

不要把默认值改成 `system`，除非用户明确要求。

---

## 5. 文案与命名规范

### 5.1 产品名

统一使用：

- `GeoWork`

当前前端项目可以在技术说明中称为：

- `GeoFrontend2.0`

禁止在 UI、变量名、注释中出现参考软件名称。

### 5.2 参考截图使用规则

参考截图只参考：

- 布局
- 信息层级
- 交互模式
- 视觉节奏

禁止照搬：

- 品牌名
- 业务数据
- 用户头像
- 产品文案
- 插件包名
- 安装规则
- 不属于 GeoWork 的行业内容

### 5.3 页面语义

GeoWork 是空间智能 / GIS / 遥感 / 数据工作流工具。  
页面文案应围绕：

- 空间分析
- 遥感解译
- 数据处理
- 专题制图
- 工作流
- 工具调用
- 任务执行
- 工作目录
- 地图、图层、坐标系统、GeoJSON、CSV、DEM、遥感影像

不要写成泛泛的聊天工具或普通办公助手。

---

## 6. 页面开发约束

### 6.1 NewTaskPage

`NewTaskPage` 是核心对话工作台，修改必须谨慎。

已有能力包括：

- Home 态
- Conversation 态
- ChatComposer
- 自动换行输入
- Enter 发送
- Shift + Enter 换行
- 中文 IME 防误发送
- mock 流式输出
- 停止生成
- MarkdownLite
- 复制回复
- RunStatus
- ToolCallTimeline
- WorkflowRunCard
- initialPrompt
- ModelPicker
- 工作目录选择
- 文件 / 图片选择初步功能

修改 NewTaskPage 时，必须确认上述能力不被破坏。

### 6.2 ChatComposer

ChatComposer 视觉要求：

- 默认是一行胶囊式输入栏
- 左侧加号
- 中间 TextArea
- 右侧模式、模型、语音、发送 / 停止
- 少量文字时保持紧凑
- 长文本时自动换行增高
- 工作目录按钮在输入框下方 meta row，不要挤进主胶囊

不要把输入框改成大块后台表单样式。

### 6.3 AppShell

AppShell 是全局壳，不要随意改。

修改侧栏时必须确认：

- 新任务
- 定时任务
- 移动端控制
- 扩展
  - 专家
  - 技能
  - MCP
  - 连接器

导航不被破坏。  
扩展子菜单不要因为当前任务被重写。

### 6.4 主题系统

新增主题时：

- 不删除旧主题
- 不破坏 localStorage
- 不破坏 Dark / System
- 不修改业务页面来适配主题
- 不把主题色写进页面 CSS

### 6.5 专家套件页面

专家套件内容应聚焦：

- GIS
- 遥感
- 空间分析
- 数据处理
- 专题制图
- 灾害评估

不要照搬电商、法律、金融等参考截图业务数据，除非用户明确要求。

### 6.6 移动端控制页面

移动端控制页面已经独立完成。  
后续 NewTaskPage、Experts、Theme 等任务不要再牵扯“IM 频道”。

---

## 7. 状态与数据约束

### 7.1 Mock 优先，真实接口预留

当前多数功能先做前端 mock。

可以做：

- mock 数据
- mock 状态流
- mock 工具调用日志
- mock 上传选择
- mock 安装状态
- mock 执行完成

不要做：

- 假 API 地址
- 假后端请求
- 真实 Electron 调用
- 真实系统文件操作
- 真实模型服务调用

需要真实接口时，先设计 adapter，不要把请求写死在 UI 组件里。

### 7.2 localStorage 使用

使用 localStorage 时：

- key 必须带 `geowork.` 前缀
- 读取失败要兜底
- 未知值要回退合理默认
- 不保存 File 对象
- 不保存 DirectoryHandle
- 不保存敏感信息
- 不保存大体积内容

### 7.3 异步与中断

流式、timer、异步任务必须支持清理。

要求：

- AbortController 可中断
- 组件卸载时清理 timer
- 停止生成后不继续追加内容
- 新任务重置后旧回调不能污染新状态
- 快速连续发送不能导致状态串线

---

## 8. 组件设计规范

### 8.1 拆组件

当页面逻辑变复杂时，应拆分组件。

推荐：

- `Page.tsx` 负责编排
- `components/*` 负责局部 UI
- 类型定义集中管理
- mock 数据可以独立文件
- adapter 可以独立文件

不要把所有逻辑堆进一个页面文件。

### 8.2 Props 明确

组件 Props 要明确，不要传一整个巨大对象给所有组件。  
组件应只接收自己需要的数据和回调。

### 8.3 业务逻辑不要写进纯展示组件

展示组件不要直接：

- 操作 localStorage
- 发请求
- 改全局状态
- 操作路由
- 写复杂状态机

这些应放在页面层或 hook / adapter 里。

---

## 9. 代码质量要求

### 9.1 TypeScript

必须：

- 类型明确
- 避免隐式 any
- 避免重复类型
- 复用已有类型
- 复杂 union 类型集中定义

### 9.2 React

必须：

- 遵守 Hooks 规则
- 不条件调用 Hook
- 不在循环 / 条件里调用 Hook
- useEffect 依赖完整
- 需要清理的 effect 必须 return cleanup

尤其主题 hook：

如果多个主题 hook 都依赖 React Hook，必须无条件调用后再按条件返回，避免 hook 顺序变化。

### 9.3 命名

命名应表达业务含义。

推荐：

- `ExpertSuite`
- `WorkflowStep`
- `ToolCallLog`
- `RunStatus`
- `MobileControlChannel`
- `ScheduledTask`
- `ConversationMessage`

禁止使用无意义命名：

- `data1`
- `aaa`
- `temp`
- `newData`
- `test`
- `demo2`

---

## 10. 构建与验收

每次改完必须执行：

```bash
npm run build
```

如果用户要求，还需要执行相关扫描或手动验收。

汇报时必须说明：

1. 修改 / 新增了哪些文件
2. 完成了哪些功能
3. 哪些功能没有做
4. 是否改动了无关文件
5. 是否安装新依赖
6. build 是否通过

不要只说“完成了”。

---

## 11. 任务开始前模板

每次开始编码前，先输出：

```text
当前理解：
准备修改 / 新增文件：
不修改文件：
实现方案：
如何复用已有代码：
如何避免影响已有功能：
验收方式：
等待确认后再改代码。
```

---

## 12. 任务完成后模板

每次完成后，必须汇报：

```text
完成情况：
修改 / 新增文件：
功能说明：
未做事项：
是否影响已有页面：
是否安装新依赖：
build 结果：
需要用户重点验收的地方：
```

---

## 13. 当前重点提醒

近期开发中出现过的问题，后续必须避免：

1. 不要把前一阶段的验收项带到后一阶段。
2. 移动端控制页面完成后，不要再在 NewTaskPage 阶段提 IM 频道。
3. 远端仓库用于了解进度，不要自动写 git pull 进提示词。
4. 修布局时优先修布局，不要借机搬状态逻辑。
5. 新增组件后要检查父容器布局，避免内容被 flex 挤成窄列。
6. ChatComposer 要保持胶囊式，不要退化成大块 TextArea。
7. 默认亮色主题必须保持默认，不要默认回退 system。
8. 参考软件名字不能进入 GeoWork 代码和 UI。
9. 专家套件页面内容要围绕 GIS / 遥感，不要照搬参考行业数据。
10. 大任务必须拆阶段，不要一次性做完所有未来规划。

---

## 14. 最后原则

GeoWork 的目标是一个工程质量可靠、主题一致、空间智能语义明确的前端项目。

任何修改都应满足：

- 小范围
- 可回滚
- 可解释
- 可验收
- 不破坏现有功能
- 不污染全局
- 不偷懒绕过类型
- 不把参考项目变成我们的项目名