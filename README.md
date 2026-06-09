# GeoWork

GeoWork is a local-first desktop AI Agent workbench for GIS, remote sensing, research reading, GEE/QGIS/GDAL workflows, report writing, Skills, Plugins, MCP connectors, automation, and model routing.

## Architecture

- Desktop: Electron + React + TypeScript + Ant Design v5 + CSS Modules + SCSS Modules + CSS Variables
- Core: Go Core Runtime with HTTP APIs, SSE events, Tool Registry, security checks, Skills, Plugins, MCP, automation, model and usage management
- Geo Worker: Python FastAPI worker for GEE, GDAL/QGIS-adjacent workflows, paper parsing and Office reports

## Development

```bash
npm install
npm run dev
```

Individual checks:

```bash
npm run test:core
npm run test:worker
npm test
npm run build
```

## V1.0 Scope

The implementation follows the `/docx/v0.1.0` Markdown specification and targets the V1.0 development-complete boundary: Research/Data/GeoCode/Analysis/Write modes, 15 navigation modules, 12 official Skills, local Plugin marketplace, MCP management framework, model/API configuration, usage statistics, safety guardrails, automation and full artifact delivery paths.
