# GeoWork Icon Pack

A high-end icon set designed for GeoWork, a local-first desktop AI Agent workbench for GIS, remote sensing, automation, Skills, Plugins and MCP workflows.

## Included assets

- `app/geowork-app-icon.svg` - main full-word desktop app icon with `GeoWork` text.
- `app/geowork-app-icon-compact.svg` - compact launcher icon, still includes `GeoWork` but prioritizes small-size legibility.
- `app/png/geowork-icon-*.png` - app PNG exports from 16 px to 1024 px.
- `app/png/geowork-icon-compact-*.png` - compact PNG exports from 16 px to 1024 px.
- `app/geowork.ico` - Windows multi-size icon.
- `app/geowork.icns` - macOS icon, included when supported by the renderer.
- `readme/geowork-readme-hero.svg` / `.png` - GitHub README header banner.
- `readme/geowork-readme-badge.svg` / `.png` - smaller README badge.
- `readme/README_SNIPPET.md` - copy-paste Markdown/HTML snippets.

## Design meaning

- **Globe + orbital route**: geography, Earth observation and remote-sensing workflow.
- **Workbench node blocks**: AI Agent tool orchestration, Skills, Plugins and MCP connectors.
- **Topographic/grid background**: GIS analysis, raster/vector processing and spatial computation.
- **Full `GeoWork` wordmark**: stronger product recognition for desktop launcher and README.

## Recommended usage

For GitHub README, use the SVG hero:

```html
<p align="center">
  <img src="./assets/geowork-readme-hero.svg" alt="GeoWork - local-first desktop AI Agent workbench for GIS and remote sensing" width="920" />
</p>
```

For Electron apps, copy `app/geowork.ico` to the Windows build icon location and copy `app/geowork.icns` or `app/png/geowork-icon-1024.png` for macOS/Linux packaging.
