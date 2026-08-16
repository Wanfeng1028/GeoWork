"""Tests for the worker tool catalog (GET /tools).

The catalog is the contract between this worker and the Go core's
worker.Client.ListTools / RunTool dispatch table, so these tests pin the
envelope shape, field types, and name uniqueness.
"""

from fastapi.testclient import TestClient

from app.main import app
from app.tool_catalog import TOOL_CATALOG, tool_names, validate_catalog

client = TestClient(app)

VALID_RISK_LEVELS = {"low", "medium", "high"}


def test_list_tools_envelope():
    res = client.get("/tools")
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {"tools"}
    assert isinstance(body["tools"], list)
    assert len(body["tools"]) == len(TOOL_CATALOG)


def test_catalog_entries_match_worker_tool_def_contract():
    for entry in TOOL_CATALOG:
        assert set(entry.keys()) == {"name", "description", "input_schema", "risk_level"}, entry.get("name")
        assert isinstance(entry["name"], str) and entry["name"]
        assert isinstance(entry["description"], str) and entry["description"]
        assert entry["risk_level"] in VALID_RISK_LEVELS
        schema = entry["input_schema"]
        assert schema["type"] == "object"
        # Every tool accepts the shared ToolRequest envelope.
        for field in ("workspace", "taskId", "prompt", "mode", "params"):
            assert field in schema["properties"], f"{entry['name']} missing envelope field {field}"
        assert schema["required"] == ["workspace"]


def test_catalog_names_are_unique_and_namespaced():
    names = tool_names()
    assert len(names) == len(set(names))
    for name in names:
        assert "." in name, f"tool name must be namespaced: {name}"


def test_catalog_names_cover_core_dispatch_table():
    # Mirrors the RunTool dispatch keys in core/internal/worker/client.go.
    # scripts/core_worker_contract.py cross-checks both sides at runtime.
    core_dispatch_names = {
        "geo.gee.search_dataset",
        "geo.gee.check_auth",
        "geo.gee.generate_ndvi_script",
        "geo.ndvi.analyze",
        "geo.office.write_report",
        "geo.office.write_ppt",
        "geo.office.write_excel",
        "geo.office.write_notebook",
        "geo.gdal.inspect_dataset",
        "geo.raster.metadata",
        "geo.raster.clip",
        "geo.raster.reproject",
        "geo.raster.cog",
        "geo.vector.metadata",
        "geo.vector.buffer",
        "geo.vector.clip",
        "geo.vector.reproject",
        "research.openalex.search",
        "papers.parse_pdf",
        "knowledge.index",
        "qgis.check",
        "qgis.check_env",
        "qgis.processing.run",
        "geo.map.layout_export",
    }
    assert set(tool_names()) == core_dispatch_names


def test_validate_catalog_rejects_bad_entries(monkeypatch):
    import app.tool_catalog as catalog_mod

    good = catalog_mod.TOOL_CATALOG
    try:
        catalog_mod.TOOL_CATALOG = [
            {"name": "a.b", "description": "ok", "risk_level": "low", "input_schema": {"type": "object"}},
            {"name": "a.b", "description": "dup", "risk_level": "low", "input_schema": {"type": "object"}},
        ]
        try:
            validate_catalog()
            raise AssertionError("duplicate name must be rejected")
        except ValueError as exc:
            assert "duplicate" in str(exc)

        catalog_mod.TOOL_CATALOG = [
            {"name": "a.b", "description": "ok", "risk_level": "extreme", "input_schema": {"type": "object"}},
        ]
        try:
            validate_catalog()
            raise AssertionError("invalid risk_level must be rejected")
        except ValueError as exc:
            assert "risk_level" in str(exc)
    finally:
        catalog_mod.TOOL_CATALOG = good
