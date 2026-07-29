# GEOWORK Pixel Grass SVG

这版按你的最新要求重做：

- GEOWORK 全部大写
- 字母是像素风，由 SVG 小方块拼出
- 字母下面是一层“铺开的像素草坪”
- 蓝绿配色参考 GeoCode 项目的地理感，但没有复制原 SVG 路径
- 提供动态版、静态版、透明版和预览页

## 文件说明

- `geowork-pixel-grass-animated.svg`：主动态 SVG
- `geowork-pixel-grass-static.svg`：静态兜底版
- `geowork-pixel-grass-transparent.svg`：透明背景版
- `geowork-logo-animated.svg`：兼容旧命名的动态版
- `geowork-logo-static.svg`：兼容旧命名的静态版
- `geowork-pixel-grass-preview.png`：PNG 预览图
- `preview.html`：本地预览页

## 建议用法

React / HTML 都可以直接引用：

```html
<img src="/assets/geowork-pixel-grass-animated.svg" alt="GEOWORK" />
```

如果担心动效影响性能或无障碍体验，可以使用静态版：

```html
<img src="/assets/geowork-pixel-grass-static.svg" alt="GEOWORK" />
```

SVG 内部已经包含 `prefers-reduced-motion: reduce`，系统开启减少动态效果时会自动停用动画。
