# Design Tokens

## Workspace UI (Light)

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| --bg-app | #f5f5f4 | 页面底色 |
| --bg-sidebar | #fafaf9 | 侧栏背景 |
| --bg-panel | #ffffff | 对话面板背景 |
| --bg-hover | #f0efed | 侧栏 hover |
| --bg-active | #e7e5e4 | 侧栏选中 |
| --bg-input | #fafaf9 | 输入框/表头底色 |
| --border | #e7e5e4 | 通用边框 |
| --border-light | #f5f5f4 | 表格行分隔 |
| --text-primary | #1c1917 | 标题/强调 |
| --text-body | #44403c | 正文 |
| --text-secondary | #57534e | 侧栏文字 |
| --text-tertiary | #78716c | 辅助说明 |
| --text-muted | #a8a29e | 时间戳/placeholder |
| --accent-blue | #2563eb | 操作链接 |
| --accent-blue-bg | #eff6ff | 操作链接底色 |
| --accent-green | #16a34a | After 列/勾选 |
| --accent-stone | #9B8976 | editorial 左边框 |
| --send-btn | #1c1917 | 发送按钮底 |

### Typography

| Token | Value |
|-------|-------|
| --font-ui | Inter, -apple-system, sans-serif |
| --font-size-base | 13px |
| --font-size-sm | 11px |
| --font-size-xs | 10px |
| --font-weight-regular | 400 |
| --font-weight-medium | 500 |
| --font-weight-semibold | 600 |

### Spacing & Radius

| Token | Value |
|-------|-------|
| --radius-sm | 5px |
| --radius-md | 6px |
| --radius-lg | 10px |
| --sidebar-width | 220px |
| --chat-width | 400px |

---

## Preview Browser Chrome (Dark)

| Token | Value | Usage |
|-------|-------|-------|
| --chrome-bg | #1c1917 | 预览区外壳 |
| --chrome-toolbar | #292524 | tab 栏 |
| --chrome-border | #44403c | 工具栏边框 |
| --chrome-tab | #a8a29e | 非活跃 tab |
| --chrome-tab-active | #fafaf9 | 活跃 tab |
| --chrome-url | #78716c | URL 文字 |
| --chrome-url-bg | #1c1917 | URL 栏底色 |

---

## Website (Editorial-European)

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| --site-bg | #FDFCFA | 页面底色（暖白） |
| --site-text | #1A1A1A | 标题 |
| --site-body | #4A4A4A | 正文 |
| --site-muted | #7A7A7A | tagline / tag / meta |
| --site-accent | #9B8976 | 暖石灰点缀 |
| --site-accent-hover | #7D6E5E | 链接 hover |
| --site-border | #E0DCD7 | 分隔线 / tag 边框 |

### Typography

| Token | Value |
|-------|-------|
| --site-font | Cormorant Garamond, Georgia, serif |
| --site-font-ui | Inter, sans-serif (标签/section label) |
| --site-title-size | 72px / weight 300 |
| --site-body-size | 17px / weight 400 |
| --site-line-height | 1.85 |
| --site-tagline-size | 18px |
| --site-label-size | 11px / 600 / uppercase / 0.18em |
| --site-tag-size | 10px / 600 / uppercase / 0.12em |
| --site-meta-size | 10px / 600 / uppercase / 0.12em |

### Spacing

| Token | Value |
|-------|-------|
| --site-max-width | 680px |
| --site-padding-top | 100px |
| --site-section-gap | 64px (divider margin) |
| --site-paragraph-gap | 24px |
| --site-card-padding | 24px |
| --site-footer-margin | 100px |

### Components

| Component | Style |
|-----------|-------|
| Tag | 方形无圆角, 1px border #E0DCD7, hover → #9B8976 |
| Project card | 透明底, 1px transparent border, hover → #9B8976 |
| Connect link | serif italic, hover underline + #7D6E5E |
| Divider | 1px #E0DCD7 两侧 + 居中 uppercase label |
| Compass mark | SVG stroke #9B8976, 32×32, opacity 0.7 |

---

## Workspace UI (Dark)

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| --bg-app | #0c0a09 | 页面底色 |
| --bg-sidebar | #1c1917 | 侧栏背景 |
| --bg-panel | #1c1917 | 对话面板背景 |
| --bg-hover | #292524 | 侧栏 hover |
| --bg-active | #292524 | 侧栏选中 |
| --bg-input | #292524 | 输入框/表头/dropdown 底色 |
| --border | #292524 | 面板边框 |
| --border-strong | #44403c | 输入框边框/表格行 |
| --text-primary | #fafaf9 | 标题/强调 |
| --text-body | #d6d3d1 | 正文 |
| --text-secondary | #a8a29e | 侧栏文字/辅助 |
| --text-tertiary | #78716c | 辅助说明 |
| --text-muted | #57534e | 时间戳/placeholder/section label |
| --accent-blue | #93c5fd | 操作链接 |
| --accent-blue-bg | #172554 | 操作链接底色 |
| --accent-green | #4ade80 | After 列/勾选 |
| --accent-stone | #9B8976 | editorial 左边框 |
| --send-btn | #fafaf9 | 发送按钮底（反转） |
| --send-btn-icon | #1c1917 | 发送按钮图标 |

### Preview Chrome (Dark)

| Token | Value | Usage |
|-------|-------|-------|
| --chrome-bg | #0c0a09 | 预览区外壳 |
| --chrome-toolbar | #1c1917 | tab 栏 |
| --chrome-border | #292524 | 工具栏边框 |
| --chrome-tab | #57534e | 非活跃 tab |
| --chrome-tab-active | #fafaf9 | 活跃 tab |
| --chrome-url | #78716c | URL 文字 |
| --chrome-url-bg | #292524 | URL 栏底色 |

---

## Website Dark (Editorial-European)

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| --site-bg | #1c1917 | 页面底色（暖黑） |
| --site-text | #fafaf9 | 标题 |
| --site-body | #d6d3d1 | 正文 |
| --site-muted | #a8a29e | tagline / tag / meta |
| --site-accent | #b8a898 | 暖石灰点缀（提亮） |
| --site-accent-hover | #b8a898 | 链接 hover |
| --site-border | #44403c | 分隔线 / tag 边框 |
| --site-label | #78716c | section label |

### Components (Dark)

| Component | Style |
|-----------|-------|
| Tag | 方形无圆角, 1px border #44403c, hover → #b8a898 |
| Project card | 透明底, 1px transparent border, hover → #b8a898 |
| Connect link | serif italic #d6d3d1, hover underline + #b8a898 |
| Divider | 1px #44403c 两侧 + 居中 uppercase label #78716c |
| Compass mark | SVG stroke #b8a898, 32×32, opacity 0.8 |
