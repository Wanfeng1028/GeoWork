from __future__ import annotations

import json
import tempfile
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "workers" / "geo-python"))

from app.main import (  # noqa: E402
    ToolRequest,
    generate_ndvi_script,
    index_knowledge,
    inspect_dataset,
    openalex_search,
    parse_pdf,
    qgis_check,
    write_report,
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def read(path: str) -> str:
    target = ROOT / path
    require(target.exists(), f"missing {path}")
    return target.read_text(encoding="utf-8")


def verify_worker_flows() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        workspace = Path(tmp)

        ndvi = ToolRequest(workspace=str(workspace), taskId="ndvi", prompt="NDVI 实验报告", mode="Analysis")
        ndvi_script = generate_ndvi_script(ndvi)
        ndvi_report = write_report(ndvi)
        require(ndvi_script["ok"] and ndvi_report["ok"], "NDVI flow failed")
        require((workspace / "scripts" / "ndvi_gee_ndvi.py").exists(), "NDVI script missing")
        require((workspace / "reports" / "ndvi_report.md").exists(), "NDVI report missing")
        require((workspace / "artifacts" / "ndvi_artifact_manifest.json").exists(), "NDVI manifest missing")

        research = ToolRequest(workspace=str(workspace), taskId="research", prompt="遥感 NDVI 论文综述", mode="Research")
        literature = openalex_search(research)
        paper_notes = parse_pdf(research)
        knowledge = index_knowledge(research)
        require(literature["ok"] and paper_notes["ok"] and knowledge["ok"], "research flow failed")
        require((workspace / "knowledge" / "research_literature_matrix.csv").exists(), "literature matrix missing")
        require((workspace / "knowledge" / "research_paper_notes.md").exists(), "paper notes missing")
        require((workspace / "knowledge" / "geowork_index.json").exists(), "knowledge index missing")

        gis = ToolRequest(workspace=str(workspace), taskId="gis", prompt="GIS 工程数据检查和 QGIS 环境检测", mode="Data")
        quality = inspect_dataset(gis)
        qgis = qgis_check(gis)
        report = write_report(gis)
        require(quality["ok"] and qgis["ok"] and report["ok"], "GIS flow failed")
        require((workspace / "artifacts" / "gis_dataset_quality.json").exists(), "GIS quality report missing")
        require((workspace / "artifacts" / "gis_qgis_status.json").exists(), "QGIS status missing")


def verify_static_contracts() -> None:
    router = read("core/internal/api/router.go")
    app = read("apps/desktop/src/app/App.tsx")
    runtime = read("core/internal/runtime/runtime.go")
    worker = read("workers/geo-python/app/main.py")

    for event in [
        "task_started",
        "plan_created",
        "step_started",
        "approval_required",
        "tool_call",
        "tool_result",
        "artifact_created",
        "step_completed",
        "task_completed",
        "task_failed",
    ]:
        require(event in runtime, f"missing runtime event {event}")

    for api in [
        "/api/automations/{id}/trigger",
        "/api/security/decisions/{id}",
        "/api/usage/records",
        "/api/eino/schema",
        "/api/projects/{id}/files",
        "/api/projects/{id}/delivery",
        "/api/datasets",
        "/api/map/layers",
        "/api/deliveries",
        "/api/environment/checks",
    ]:
        require(api in router, f"missing API contract {api}")

    for frontend_hook in [
        "api.saveModel",
        "api.saveSettings",
        "api.createAutomation",
        "api.resolveSecurityDecision",
        "api.indexKnowledge",
        "api.papers",
        "api.registerDataset",
        "api.updateLayer",
        "api.createDelivery",
    ]:
        require(frontend_hook in app, f"missing frontend operation {frontend_hook}")

    for tool in [
        "geo.gee.generate_ndvi_script",
        "geo.office.write_report",
        "geo.gdal.inspect_dataset",
        "research.openalex.search",
        "papers.parse_pdf",
        "knowledge.index",
        "qgis.check",
    ]:
        require(tool in runtime, f"missing registered tool {tool}")

    for output_type in [
        "GeoWork generated GEE NDVI workflow",
        "Artifact Manifest",
        "Literature Matrix CSV",
        "QGIS Environment Status",
    ]:
        require(output_type in worker, f"missing worker output {output_type}")

    skills = json.loads((ROOT / "skills" / "official-skills.json").read_text(encoding="utf-8"))
    require(len(skills) == 12, f"expected 12 official skills, found {len(skills)}")


def verify_server_contracts() -> None:
    """Verify v0.5.0 server API endpoints and database persistence contracts."""
    main = read("server/cmd/geowork-api/main.go")
    store = read("server/internal/storage/store.go")
    sqlstore = read("server/internal/storage/sqlstore.go")
    migrations_sql = read("server/internal/storage/migrations/001_initial_schema.sql")
    routes = read("server/internal/api/routes.go")
    auth_service = read("server/internal/auth/service.go")
    billing_service = read("server/internal/billing/service.go")

    # Check server module initialization with SQLite
    require("storage.NewStore" in main or "NewStore" in main, "server: NewStore not found in main.go")
    require("migrations.Run" in main or "Run migrations" in main, "server: migrations not run in main.go")
    require("EnsureDefaults" in main, "server: EnsureDefaults not called in main.go")

    # Check SQLite persistence layer
    require("sql.Open" in store or "sql.Open" in sqlstore, "server: sql.Open not found")
    require("PRAGMA journal_mode=WAL" in sqlstore, "server: WAL mode not configured")
    require("PRAGMA foreign_keys=ON" in sqlstore, "server: foreign_keys not enabled")
    require("PRAGMA busy_timeout" in sqlstore, "server: busy_timeout not configured")

    # Check all 11 tables in schema
    required_tables = [
        "users", "tokens", "teams", "team_members", "usage_events",
        "billing_data", "sync_records", "marketplace_items",
        "telemetry_events", "crash_reports", "collab_records",
    ]
    for table in required_tables:
        require(f"CREATE TABLE" in migrations_sql and table in migrations_sql,
                f"server: missing table {table} in schema")

    # Check server API endpoints
    required_endpoints = [
        "/auth/register",
        "/auth/login",
        "/auth/refresh",
        "/auth/logout",
        "/auth/verify",
        "/sync/records",
        "/sync/state",
        "/billing/checkout/mock",
        "/billing/usage",
        "/account/permissions",
        "/account/profile",
        "/marketplace/items",
        "/telemetry/events",
        "/crash/reports",
    ]
    for endpoint in required_endpoints:
        require(endpoint in routes, f"server: missing endpoint {endpoint} in routes.go")

    # Check auth service uses SQL store
    require("CreateUser" in auth_service, "server: CreateUser not used in auth service")
    require("GetUserByEmail" in auth_service, "server: GetUserByEmail not used in auth service")
    require("CreateToken" in auth_service, "server: CreateToken not used in auth service")
    require("GetToken" in auth_service, "server: GetToken not used in auth service")
    require("InvalidateUserTokens" in auth_service, "server: InvalidateUserTokens not used in auth service")

    # Check billing service uses SQL store
    require("GetUsageSummary" in billing_service or "GetUsageByUser" in billing_service,
            "server: usage summary not used in billing service")
    require("GetBillingData" in billing_service, "server: GetBillingData not used in billing service")
    require("UpsertBillingData" in billing_service, "server: UpsertBillingData not used in billing service")

    # Check v0.5.0 health version
    require("v0.5.0" in main or 'v0.5.0' in main, "server: v0.5.0 version not set in main.go")

    # Check plan definitions
    require("free" in billing_service, "server: free plan not referenced")
    require("pro" in billing_service, "server: pro plan not referenced")
    require("team" in billing_service, "server: team plan not referenced")

    # Check sync prohibited data validation
    require("isValidPayload" in sqlstore or "isValidPayload" in store, "server: isValidPayload not found in sync")
    require("API_KEY" in sqlstore, "server: API_KEY pattern blocking not found")


def main() -> None:
    verify_worker_flows()
    verify_static_contracts()
    verify_server_contracts()
    print("GeoWork V1 flow verification ok")


if __name__ == "__main__":
    main()
