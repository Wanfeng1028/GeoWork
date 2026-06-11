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
        "server/go.mod",
        "server/go.sum",
        "server/cmd/geowork-api/main.go",
        "server/internal/storage/store.go",
        "server/internal/storage/sqlstore.go",
        "server/internal/storage/sqlstore_test.go",
        "server/internal/storage/migrations/migrations.go",
        "server/internal/storage/migrations/001_initial_schema.sql",
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
    nav_mock = read("apps/desktop/src/mocks/navigation.mock.ts")
    left_sidebar = read("apps/desktop/src/components/layout/LeftSidebar/LeftSidebar.tsx")
    for label in ["专家系统", "助理系统", "自动化", "技能", "扩展 / 插件", "MCP", "定时任务", "文件系统", "论文检索", "知识库", "地图与图层", "GEE 平台"]:
        require(label in nav_mock, f"missing nav label in navigation.mock.ts: {label}")
    require("tailwind" not in app.lower(), "desktop app must not use Tailwind")
    require("shadcn" not in app.lower(), "desktop app must not use shadcn/ui")

    router = read("core/internal/api/router.go")
    project_handler = read("core/internal/api/project_handler.go")
    task_handler = read("core/internal/api/task_handler.go")
    all_router_content = router + project_handler + task_handler
    for route in [
        "/api/health",
        "/api/projects",
        "/api/tasks",
    ]:
        require(route in all_router_content, f"missing API route: {route}")

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

    # Check frontend hooks in component files
    quick_actions = read("apps/desktop/src/pages/Dashboard/QuickActions.tsx")
    for frontend_hook in [
        "api.registerDataset",
    ]:
        require(frontend_hook in quick_actions, f"missing frontend data/map/delivery hook: {frontend_hook}")

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
