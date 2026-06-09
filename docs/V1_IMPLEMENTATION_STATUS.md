# GeoWork V1 Implementation Status

This repository implements the V1.0 development-complete plan from `/docx/v0.1.0`.

## Implemented

- Sprint 0: monorepo scripts, Electron runtime launcher, Go health, Python Worker health.
- Sprint 1: top bar, 15-module sidebar, workbench three-column layout, bottom event log, map preview.
- Sprint 2: task creation, Planner, Executor, event history, SSE endpoint.
- Sprint 3: Python Worker tools for GEE NDVI scripts, reports, dataset inspection and paper notes.
- Sprint 4: project workspace directories, workspace-scoped writes, risk events and task JSONL archive.
- Sprint 5: 12 official Skills represented in runtime and file manifests.
- Sprint 6: OpenAI-compatible model provider registry, testing endpoint and usage summary.
- Sprint 7: research and knowledge-base UI entries plus worker paper-note endpoint.
- Sprint 8: plugin manifests, local marketplace, permissions and enable/disable API.
- Sprint 9: automation and cron rule API/UI entries.

## Release Boundary

This is a development-complete local build target, not an installer package. QGIS is detected/invoked as a local dependency and is not bundled.
