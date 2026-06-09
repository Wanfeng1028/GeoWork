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


def main() -> None:
    verify_worker_flows()
    verify_static_contracts()
    print("GeoWork V1 flow verification ok")


if __name__ == "__main__":
    main()
