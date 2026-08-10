# GeoWork 全平台 Logo 资产包 v1.0

本资产包根据你确认的三套视觉方案统一整理：

1. **核心识别符号**：节点、轨道与地球网络构成的简化圆形标志，用于 App 图标、favicon、移动端、桌面端和小尺寸界面。
2. **主标准字组合**：简化符号 + `GeoWork` 横向字标，用于官网导航、登录页、桌面端标题栏、About 页面和宣传物料。
3. **展示型轨道标志**：带球体和发光轨道的版本，仅用于启动页、官网 Hero、封面和大尺寸品牌展示。
4. **详细地球插画**：保留在 `08_Original_References`，建议作为品牌插画使用，不作为 64px 以下的产品图标。

## 直接使用路径

- 官网浅色导航：`02_Web/Navbar/geowork-logo-horizontal-on-light.svg`
- 官网深色导航：`02_Web/Navbar/geowork-logo-horizontal-on-dark.svg`
- 网站 favicon：`02_Web/Favicon/favicon.ico`
- PWA：`02_Web/PWA/manifest.webmanifest`
- Electron：`03_Desktop/Electron/build/icon.png`、`icon.ico`、`icon.icns`
- Windows：`03_Desktop/Windows/geowork-app.ico`
- macOS：`03_Desktop/macOS/GeoWork.icns`
- Linux：`03_Desktop/Linux/hicolor/`
- iOS：`04_Mobile/iOS/AppIcon.appiconset/`
- Android：`04_Mobile/Android/app/src/main/res/`
- 社交分享：`02_Web/Social/og-image-1200x630.png`
- SVG 母版：`01_Master_SVG/`
- 常用透明 PNG：`06_PNG_Exports/`

## 视觉规则

- 主品牌背景：`#040A18` / `#071329`
- 核心高亮：`#25BDF4`
- 高光蓝：`#73DEFF`
- 浅色文字：`#BDD3F3`
- 浅色背景文字：`#102650`
- UI 操作色仍可使用设计系统中的专业青绿色：`#006A61`；不要强行把所有产品按钮都改成 Logo 蓝。

### 最小尺寸

- 完整横向 Logo：数字界面宽度不低于 120px。
- 纯符号：不低于 16px；16–32px 优先使用无发光的扁平版本。
- 发光版本：只在符号高于 96px 或完整 Logo 宽度高于 320px 时使用。
- 详细地球插画：建议不低于 320px。

### 留白

以符号中单个节点圆点的直径作为 `1x`，Logo 四周至少保留 `2x` 安全区。不要让文字、边框或窗口控制按钮进入安全区。

### 禁止事项

- 不要压扁、拉长、倾斜或旋转 Logo。
- 不要在复杂地图底图上直接使用低对比度版本，应增加纯色遮罩或使用卡片容器。
- 不要在小尺寸使用详细地球插画或强发光。
- 不要将青色高亮节点改为随机颜色。
- 不要把多套符号同时放在同一产品导航中；产品级识别统一使用简化网络符号。

## 文件命名说明

- `on-light`：用于浅色背景。
- `on-dark`：用于深色背景。
- `gradient`：透明背景的品牌渐变版本。
- `mono-black` / `mono-white`：单色印刷、雕刻、蒙版和水印。
- `glow-on-dark`：大尺寸深色展示版本。

## 工程接入

`07_Implementation` 中提供颜色变量、品牌 token 和 React 示例组件。SVG 已将文字转成路径，不依赖用户电脑安装 Inter 字体；资产包不包含或分发任何字体文件。

## 版本策略

- `v1.x`：只允许新增尺寸、文件格式和使用模板，不改变核心符号轮廓。
- `v2.0`：只有在品牌重构时才允许改变符号几何结构。
- 代码仓库中建议固定放置于 `public/brand/` 或 Electron 的 `build/` 资源目录，禁止从截图中二次裁切作为正式资产。
