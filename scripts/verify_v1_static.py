from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def read(path: str) -> str:
    target = ROOT / path
    require(target.exists(), f"missing {path}")
    return target.read_text(encoding="utf-8")


def main() -> None:
    required_files = [
        "package.json",
        "apps/desktop/electron/main.ts",
        "apps/desktop/electron/runtime.ts",
        "apps/desktop/src/app/App.tsx",
        "apps/desktop/src/app/App.module.scss",
        "core/cmd/geowork-runtime/main.go",
        "core/internal/api/router.go",
        "core/internal/runtime/runtime.go",
        "core/internal/runtime/modules.go",
        "core/internal/runtime/store.go",
        "core/internal/tools/tool.go",
        "core/internal/worker/client.go",
        "core/internal/worker/process.go",
        "workers/geo-python/app/main.py",
        "marketplace/index.json",
        "mcp/connectors.json",
        "licenses/LICENSE",
        "docs/SPRINT_COVERAGE.md",
        "docs/DOCX_READING_SUMMARY.md",
    ]
    for path in required_files:
        require((ROOT / path).exists(), f"missing required file: {path}")

    app = read("apps/desktop/src/app/App.tsx")
    for label in ["工作台", "项目文件", "地图与图层", "论文搜索", "知识库", "数据中心", "专家", "技能", "自动化", "定时任务", "扩展", "插件市场", "模型与 API", "用量统计", "设置"]:
        require(label in app, f"missing nav label: {label}")
    require("tailwind" not in app.lower(), "desktop app must not use Tailwind")
    require("shadcn" not in app.lower(), "desktop app must not use shadcn/ui")

    router = read("core/internal/api/router.go")
    for route in [
        "/api/health",
        "/api/projects",
        "/api/projects/{id}",
        "/api/deliveries",
        "/api/datasets",
        "/api/map/layers",
        "/api/tasks",
        "/api/tasks/{id}/retry",
        "/api/skills",
        "/api/plugins",
        "/api/plugins/{id}/disable",
        "/api/models",
        "/api/usage/summary",
        "/api/settings",
        "/api/security/diff",
        "/api/security/rollback",
        "/api/security/recycle-delete",
        "/api/environment/checks",
        "/api/worker/geo/check",
        "/api/automations",
        "/api/v1/cron/due",
        "/api/v1/files/watch/scan",
        "/api/experts",
        "/api/papers",
        "/api/knowledge",
        "/api/tools",
        "/api/eino/schema",
        "/api/mcp",
    ]:
        require(route in router, f"missing API route: {route}")

    worker = read("workers/geo-python/app/main.py")
    for endpoint in [
        "/tools/gee/search-dataset",
        "/tools/gee/check-auth",
        "/tools/gee/generate-ndvi-script",
        "/tools/office/write-report",
        "/tools/office/write-ppt",
        "/tools/office/write-excel",
        "/tools/office/write-notebook",
        "/tools/gdal/inspect-dataset",
        "/tools/raster/metadata",
        "/tools/raster/clip",
        "/tools/raster/reproject",
        "/tools/raster/write-cog",
        "/tools/vector/metadata",
        "/tools/vector/buffer",
        "/tools/vector/clip",
        "/tools/vector/reproject",
        "/tools/map/layout-export",
        "/tools/papers/openalex-search",
        "/tools/papers/parse-pdf",
        "/tools/knowledge/index",
        "/tools/qgis/check",
        "/tools/qgis/check-env",
        "/tools/qgis/run-processing",
    ]:
        require(endpoint in worker, f"missing worker endpoint: {endpoint}")

    for frontend_hook in [
        "api.registerDataset",
        "api.updateLayer",
        "api.createDelivery",
        "DataPanel",
        "MapPanel",
        "ProjectPanel",
    ]:
        require(frontend_hook in app, f"missing frontend data/map/delivery hook: {frontend_hook}")

    skills = [p for p in (ROOT / "skills").iterdir() if p.is_dir() and (p / "manifest.json").exists()]
    require(len(skills) >= 12, f"expected at least 12 skills, found {len(skills)}")
    for skill in skills:
        manifest = json.loads((skill / "manifest.json").read_text(encoding="utf-8"))
        for key in ["id", "name", "version", "required_tools", "permissions"]:
            require(key in manifest, f"{skill.name} missing {key}")

    plugins = [p for p in (ROOT / "plugins").iterdir() if p.is_dir() and (p / "plugin.json").exists()]
    require(len(plugins) >= 4, f"expected at least 4 plugins, found {len(plugins)}")
    for plugin in plugins:
        manifest = json.loads((plugin / "plugin.json").read_text(encoding="utf-8"))
        require("permissions" in manifest, f"{plugin.name} missing permissions")

    mcp = json.loads((ROOT / "mcp" / "connectors.json").read_text(encoding="utf-8"))
    require(len(mcp) >= 7, f"expected at least 7 MCP connectors, found {len(mcp)}")

    print("GeoWork V1 static coverage ok")


if __name__ == "__main__":
    main()
