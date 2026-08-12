<!-- language: en -->
<!-- license: PolyForm NC 1.0.0 -->

<p align="center">
  <img src="./assets/GeoWork_Logo_Kit_v1.0/01_Master_SVG/geowork-marketing-orbit-horizontal.svg" width="700" alt="GeoWork - Spatial Intelligence Core" />
</p>

<p align="center"><strong>A local-first desktop AI Agent workbench for GIS, remote sensing, and geospatial workflows</strong></p>

<p align="center">
  <a href="README.md">English</a> &nbsp;·&nbsp; <a href="README.en.md">简体中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/QGIS-589632?style=flat-square&logo=qgis&logoColor=white" alt="QGIS">
  <img src="https://img.shields.io/badge/GDAL-5CAE58?style=flat-square&logo=osgeo&logoColor=white" alt="GDAL">
  <img src="https://img.shields.io/badge/GEE-4285F4?style=flat-square&logo=googleearth&logoColor=white" alt="Google Earth Engine">
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/macOS-arm64-blue?style=flat-square&logo=apple&logoColor=white" alt="macOS arm64">
  <img src="https://img.shields.io/badge/Windows-x64-blue?style=flat-square&logo=windows&logoColor=white" alt="Windows x64">
  <img src="https://img.shields.io/badge/license-PolyForm--NC--1.0.0-yellow?style=flat-square" alt="PolyForm Noncommercial License">
</p>

---

## Current Version Status

> **v0.5.x-dev (Development Preview)** — **This project has not been officially released yet.** The current code is provided for developers to start locally, test, and continue development. v0.1–v0.4 were demo/exploration versions (now archived). v0.5 is the development preview, and v1.0.x will be the first official release.
>
> Some capabilities remain in development state, including Cloud Server in-memory, partial GIS/GEE/QGIS/GDAL capabilities, local sandbox policy, plugin marketplace, team collaboration, and billing system. **Please do not treat the current version as production-ready.**
>
> See [Dev Version Checklist](doc/DEV_VERSION_CHECKLIST.md) for details.

---

## What GeoWork Can Do

Tackle complex geospatial and scientific workflows through conversation — empowering anyone to analyze the planet 🌏, produce professional maps, and automate research pipelines.

| Capability | Scope | Examples |
|---|---|---|
| 🗺️ **QGIS** | **All hundreds of algorithms** in QGIS Processing | Spatial analysis, vector/raster batch processing, format conversion, accessibility analysis... |
| 🛰️ **Google Earth Engine** | **Full GEE Python API** — any remote sensing task you can express | Temporal compositing, classification, change detection, land surface temperature, image download... |
| 🐍 **Python** | Run **arbitrary Python scripts** in an isolated env, full scientific computing stack | Geospatial processing, thematic mapping, deep learning, data science... |
| 📄 **Paper Reading** | AI-powered literature analysis and research summarization | Extract insights, summarize papers, manage research references... |
| 📝 **Report Writing** | Generate professional Office documents with maps and charts | Automated report generation, formatted tables, publication-ready figures... |
| ⚡ **Automation** | Workflow automation and task scheduling | Chain tools together, automate repetitive geospatial pipelines, cron-based workflows... |
| 🤖 **Model Routing** | Flexible AI model configuration and management | Switch between models, configure API keys, optimize costs and performance... |

---

## How to Use

> **Note: The following instructions apply to the unreleased development preview (v0.5.x-dev).** Project structure and startup procedures may change at any time before the official release.

### 1. What environment do you need?

No complex setup required. Before running GeoWork, ensure the following are on your machine:

- **[QGIS](https://qgis.org/download/)** — desktop GIS app, GeoWork calls its algorithms
- **A Python environment manager** (recommend [Miniconda](https://docs.anaconda.com/miniconda/)) — isolates Python dependencies so workflows don't interfere with each other

> [!TIP]
> Give GeoWork a **dedicated Python environment** (create a fresh one with Conda / Mamba). The agent will install, uninstall, and upgrade Python packages on its own as it works — a dedicated env keeps your other projects clean and helps the agent run more reliably.

### 2. Installation

```bash
npm install
npm run dev
```

**Individual checks:**

```bash
npm run test:core      # Run Go core tests
npm run test:worker    # Run Python worker tests
npm test               # Run desktop tests
npm run build          # Build desktop app
```

---

## Architecture

GeoWork follows a modular three-layer architecture:

| Layer | Technology | Responsibility |
|---|---|---|
| **Desktop** | Electron + React + TypeScript + Ant Design v5 | UI layer, state management, map rendering (MapLibre + DeckGL), charting (ECharts, Plotly, Monaco Editor) |
| **Core** | Go runtime with HTTP APIs, SSE events | Tool orchestration, skill registry, MCP connectors, security checks, model routing, automation engine |
| **Geo Worker** | Python FastAPI | GEE workflows, GDAL/QGIS-adjacent processing, paper parsing, Office report generation, NDVI analysis |

---

## How to Write Your Own Skill

All GeoWork skills live under [`skills/`](skills/) — anyone can add a new one. The standard structure of a skill package:

```
skills/<your-skill-id>/
├── manifest/
│   ├── README.md       # Human-facing skill description
│   └── meta.json       # Metadata: version / description / author / tags...
└── skill/
    ├── SKILL.md        # Required, core prompt (LLM-facing, with frontmatter)
    └── <dir>/          # Optional, any name and nesting — references, templates, scripts, etc.
```

Submission flow:

1. Create your skill directory under `skills/`
2. Fill in `manifest/` and `skill/` following the structure above
3. Add your skill ID to `skills/official-skills.json`
4. Test with `npm run dev` — the agent will load your skill automatically

> [!TIP]
> Skills are loaded into the agent's prompt and directly affect its behavior. Follow the frontmatter convention in `SKILL.md` to declare version, description, author, and tags.

---

## License

GeoWork is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE).

- ✅ **Allowed**: Non-commercial evaluation, learning, research, and personal use
- ❌ **Requires Commercial License**: Commercial use, resale, hosted service operation, paid plugin distribution, enterprise deployment, or embedding into commercial products

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
