<p align="center">
  <img src="./assets/geowork-readme-hero.svg" width="700" alt="GeoWork" />
</p>

<p align="center"><strong>A local-first desktop AI Agent workbench for GIS, remote sensing, and geospatial workflows</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/QGIS-589632?style=flat-square&logo=qgis&logoColor=white" alt="QGIS">
  <img src="https://img.shields.io/badge/GDAL-5CAE58?style=flat-square&logo=osgeo&logoColor=white" alt="GDAL">
  <img src="https://img.shields.io/badge/GEE-4285F4?style=flat-square&logo=googleearth&logoColor=white" alt="Google Earth Engine">
  <img src="https://img.shields.io/badge/macOS-arm64-blue?style=flat-square&logo=apple&logoColor=white" alt="macOS arm64">
  <img src="https://img.shields.io/badge/Windows-x64-blue?style=flat-square&logo=windows&logoColor=white" alt="Windows x64">
  <a href="licenses/LICENSE">
    <img src="https://img.shields.io/badge/license-PolyForm--NC--1.0.0-yellow?style=flat-square" alt="PolyForm Noncommercial License">
  </a>
</p>

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

## How to Use

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

### 3. Plugin Marketplace

GeoWork ships a local plugin marketplace for extended functionality. Browse, install, and manage plugins directly from the app — no manual file shuffling required.

**Available plugins:**

| Plugin | Category | Description |
|---|---|---|
| 🔗 **QGIS Bridge** | GIS | Bridge to QGIS Processing algorithms for spatial analysis |
| 📚 **OpenAlex Literature Search** | Research | Search academic papers and citations via OpenAlex API |
| 📑 **Zotero Connector** | Research | Integrate with Zotero for reference management |

> [!TIP]
> Plugin permissions are transparent — each plugin declares its required permissions (network, file_read, file_write, process, local_app) so you know exactly what it can access.

## Architecture

GeoWork follows a modular three-layer architecture:

| Layer | Technology | Responsibility |
|---|---|---|
| **Desktop** | Electron + React + TypeScript + Ant Design v5 | UI layer, state management, map rendering (MapLibre + DeckGL), charting (ECharts, Plotly, Monaco Editor) |
| **Core** | Go runtime with HTTP APIs, SSE events | Tool orchestration, skill registry, MCP connectors, security checks, model routing, automation engine |
| **Geo Worker** | Python FastAPI | GEE workflows, GDAL/QGIS-adjacent processing, paper parsing, Office report generation, NDVI analysis |

## Skills Showcase

GeoWork ships with **12 built-in Skills** covering remote sensing, GIS analysis, academic writing, and research workflows. Skills are on-demand capability packs that let GeoWork grow as you need — pull community-built packs anytime, build the geospatial AI ecosystem together.

| Skill | Category | Description |
|---|---|---|
| 🌿 **NDVI Time Series Analysis** | Remote Sensing | Extract and analyze NDVI time series from Sentinel-2 or Landsat |
| ☁️ **Sentinel-2 Cloud-free Composite** | Remote Sensing | Create cloud-free composites using GEE temporal compositing |
| 🌡️ **Landsat LST Retrieval** | Remote Sensing | Retrieve land surface temperature from Landsat thermal bands |
| 🗺️ **Land Cover Classification** | Remote Sensing | Supervised classification of land cover using spectral signatures |
| 🏙️ **Urban Expansion Analysis** | GIS | Detect and quantify urban sprawl using multi-temporal imagery |
| 💧 **Water Extraction (NDWI)** | Remote Sensing | Extract water bodies using Normalized Difference Water Index |
| ⛰️ **DEM Terrain Analysis** | GIS | Slope, aspect, hillshade, and watershed analysis from DEM data |
| 📰 **Paper Reading (Geography)** | Research | Guided reading and analysis of geography and GIS papers |
| 📚 **Literature Review (Remote Sensing)** | Research | Structure and write literature reviews for remote sensing topics |
| 🎓 **Undergraduate Experiment Report** | Academic Writing | Generate formatted experiment reports with figures and analysis |
| 🎓 **Graduate Thesis Outline** | Academic Writing | Structure and outline graduate theses with chapter planning |
| 🗺️ **Map Layout & Export** | GIS | Professional cartographic layout design and high-quality export |

> [!TIP]
> Each skill includes a `SKILL.md` prompt, `manifest.json` metadata, and optional reference materials. Skills are loaded into the agent's prompt and directly affect its behavior.

### How to write your own Skill

All GeoWork Skills live under [`skills/`](skills/) — anyone can add a new one. The standard layout of a Skill package:

```
skills/<your-skill-id>/
├── manifest/
│   ├── README.md       # Human-facing description of the Skill
│   └── meta.json       # Metadata: version / description / author / tags ...
└── skill/
    ├── SKILL.md        # Required, the core prompt (LLM-facing, with frontmatter)
    └── <dir>/          # Optional, any name and any nesting — references, templates, scripts, etc.
```

Submission flow:

1. Create your Skill directory under `skills/`
2. Fill in `manifest/` and `skill/` following the layout above
3. Add your skill ID to `skills/official-skills.json`
4. Test with `npm run dev` — the agent will load your skill automatically

> [!TIP]
> Skills are loaded into the agent's prompt and directly affect its behavior. Follow the frontmatter convention in `SKILL.md` to declare version, description, author, and tags.

## V1.0 Scope

The implementation follows the `/docx/v0.1.0` Markdown specification and targets the V1.0 development-complete boundary: Research/Data/GeoCode/Analysis/Write modes, 15 navigation modules, 12 official Skills, local Plugin marketplace, MCP management framework, model/API configuration, usage statistics, safety guardrails, automation and full artifact delivery paths.

## Icon Design

GeoWork features a professional visual identity designed for geospatial AI software:

- **Globe + orbital route** — geography, Earth observation and remote-sensing workflow
- **Workbench node blocks** — AI Agent tool orchestration, Skills, Plugins and MCP connectors
- **Topographic/grid background** — GIS analysis, raster/vector processing and spatial computation
- **Full GeoWork wordmark** — stronger product recognition for desktop launcher and README

> **Palette**: Deep Navy `#071225` · Geo Cyan `#8BFFE2` · Signal Blue `#3AD9FF` · Sand Gold `#F4D77E`

## License

GeoWork is source-available under the [PolyForm Noncommercial License 1.0.0](licenses/LICENSE). 

- ✅ **Allowed**: Non-commercial evaluation, learning, research, and personal use
- ❌ **Requires Commercial License**: Commercial use, resale, hosted service operation, paid plugin distribution, enterprise deployment, or embedding into commercial products

See [LICENSE](licenses/LICENSE) and [NOTICE](licenses/NOTICE) for details.
