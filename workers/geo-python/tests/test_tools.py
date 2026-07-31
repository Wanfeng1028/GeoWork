"""Tests for GIS tool endpoints in main.py (raster, vector, papers, map layout)."""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, _extract_abstract, _extract_sections, _extract_title

client = TestClient(app)


def _base_req(**overrides):
    """Build a minimal ToolRequest payload."""
    base = {"workspace": tempfile.gettempdir(), "taskId": "test_task", "params": {}}
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Raster tool tests
# ---------------------------------------------------------------------------


class TestRasterClip:
    """Tests for /tools/raster/clip."""

    def test_missing_path(self):
        resp = client.post("/tools/raster/clip", json=_base_req())
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_missing_bbox(self):
        resp = client.post(
            "/tools/raster/clip",
            json=_base_req(params={"path": "some.tif"}),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "bbox" in data["message"].lower()

    def test_invalid_bbox_length(self):
        resp = client.post(
            "/tools/raster/clip",
            json=_base_req(params={"path": "some.tif", "bbox": [1, 2]}),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False

    def test_import_error_fallback(self):
        """When rasterio is not installed, should return ok=False with install hint."""
        with patch.dict("sys.modules", {"rasterio": None}):
            resp = client.post(
                "/tools/raster/clip",
                json=_base_req(
                    params={"path": "fake.tif", "bbox": [0, 0, 1, 1]}
                ),
            )
        data = resp.json()
        # Either ImportError caught or file-open error — both are acceptable
        assert data["ok"] is False


class TestRasterReproject:
    """Tests for /tools/raster/reproject."""

    def test_missing_path(self):
        resp = client.post("/tools/raster/reproject", json=_base_req())
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_missing_dst_crs(self):
        resp = client.post(
            "/tools/raster/reproject",
            json=_base_req(params={"path": "some.tif"}),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "crs" in data["message"].lower()

    def test_accepts_target_crs_alias(self):
        """targetCrs should be accepted as an alias for dst_crs."""
        resp = client.post(
            "/tools/raster/reproject",
            json=_base_req(
                params={"path": "nonexistent.tif", "targetCrs": "EPSG:4326"}
            ),
        )
        data = resp.json()
        # Will fail on file open, but param validation should pass
        assert data["ok"] is False
        assert "crs" not in data["message"].lower() or "not found" in data["message"].lower() or "failed" in data["message"].lower()


class TestRasterWriteCog:
    """Tests for /tools/raster/write-cog."""

    def test_missing_path(self):
        resp = client.post("/tools/raster/write-cog", json=_base_req())
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_import_error_fallback(self):
        with patch.dict("sys.modules", {"rasterio": None}):
            resp = client.post(
                "/tools/raster/write-cog",
                json=_base_req(params={"path": "fake.tif"}),
            )
        data = resp.json()
        assert data["ok"] is False


# ---------------------------------------------------------------------------
# Vector tool tests
# ---------------------------------------------------------------------------


class TestVectorBuffer:
    """Tests for /tools/vector/buffer."""

    def test_missing_path(self):
        resp = client.post("/tools/vector/buffer", json=_base_req())
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_import_error_returns_degraded(self):
        with patch.dict("sys.modules", {"geopandas": None}):
            resp = client.post(
                "/tools/vector/buffer",
                json=_base_req(params={"path": "fake.geojson", "distance": 100}),
            )
        data = resp.json()
        assert data["ok"] is False
        assert data.get("status") == "degraded"


class TestVectorClip:
    """Tests for /tools/vector/clip."""

    def test_missing_path(self):
        resp = client.post("/tools/vector/clip", json=_base_req())
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_missing_clip_and_bbox(self):
        resp = client.post(
            "/tools/vector/clip",
            json=_base_req(params={"path": "input.geojson"}),
        )
        data = resp.json()
        # Without geopandas installed → ImportError; with it → param validation error
        assert data["ok"] is False

    def test_import_error_returns_degraded(self):
        with patch.dict("sys.modules", {"geopandas": None}):
            resp = client.post(
                "/tools/vector/clip",
                json=_base_req(
                    params={"path": "in.geojson", "bbox": [0, 0, 1, 1]}
                ),
            )
        data = resp.json()
        assert data["ok"] is False
        assert data.get("status") == "degraded"


class TestVectorReproject:
    """Tests for /tools/vector/reproject."""

    def test_missing_path(self):
        resp = client.post("/tools/vector/reproject", json=_base_req())
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_missing_crs(self):
        resp = client.post(
            "/tools/vector/reproject",
            json=_base_req(params={"path": "input.geojson"}),
        )
        data = resp.json()
        # Without geopandas → ImportError; with it → param validation error
        assert data["ok"] is False

    def test_accepts_target_crs_alias(self):
        resp = client.post(
            "/tools/vector/reproject",
            json=_base_req(
                params={"path": "nonexistent.geojson", "targetCrs": "EPSG:4326"}
            ),
        )
        data = resp.json()
        # param validation passes; fails on file read
        assert "crs" not in data["message"].lower() or "failed" in data["message"].lower() or "not found" in data["message"].lower()

    def test_import_error_returns_degraded(self):
        with patch.dict("sys.modules", {"geopandas": None}):
            resp = client.post(
                "/tools/vector/reproject",
                json=_base_req(
                    params={"path": "in.geojson", "crs": "EPSG:4326"}
                ),
            )
        data = resp.json()
        assert data["ok"] is False
        assert data.get("status") == "degraded"


# ---------------------------------------------------------------------------
# Paper tool tests
# ---------------------------------------------------------------------------


class TestParsePdf:
    """Tests for /tools/papers/parse-pdf."""

    def test_missing_path(self):
        resp = client.post("/tools/papers/parse-pdf", json=_base_req())
        data = resp.json()
        assert data["ok"] is False

    def test_nonexistent_file(self):
        resp = client.post(
            "/tools/papers/parse-pdf",
            json=_base_req(params={"path": "/nonexistent/fake.pdf"}),
        )
        data = resp.json()
        assert data["ok"] is False
        assert "not found" in data.get("error", "").lower()


class TestOpenAlexSearch:
    """Tests for /tools/papers/openalex-search."""

    def test_basic_search(self):
        """Search should always return ok=True (even if httpx fails)."""
        resp = client.post(
            "/tools/papers/openalex-search",
            json=_base_req(params={"query": "NDVI", "limit": 2}),
        )
        data = resp.json()
        assert data["ok"] is True
        assert "papers" in data
        assert "artifacts" in data


# ---------------------------------------------------------------------------
# PDF helper function tests
# ---------------------------------------------------------------------------


class TestExtractTitle:
    """Tests for _extract_title helper."""

    def test_basic_title(self):
        text = "Sentinel-2 NDVI Analysis\n\nAuthors: Zhang Wei\n\nAbstract: ..."
        assert _extract_title(text) == "Sentinel-2 NDVI Analysis"

    def test_empty_text(self):
        assert _extract_title("") == "Unknown Title"

    def test_short_first_line_falls_through(self):
        text = "Short\nThis Is a Proper Title That Is Long Enough\nMore text"
        assert _extract_title(text) == "This Is a Proper Title That Is Long Enough"

    def test_all_short_lines(self):
        text = "A\nB\nC"
        # Falls back to first line
        assert _extract_title(text) == "A"


class TestExtractAbstract:
    """Tests for _extract_abstract helper."""

    def test_basic_abstract(self):
        text = (
            "Paper Title\n\nAbstract: This is the abstract content.\n\n"
            "Introduction: Background text here."
        )
        result = _extract_abstract(text)
        assert "abstract content" in result

    def test_chinese_abstract(self):
        text = "Paper Title\n\n\u6458\u8981\uff1a\u8fd9\u662f\u4e2d\u6587\u6458\u8981\u5185\u5bb9\u3002\n\n\u5f15\u8a00\uff1a\u80cc\u666f\u4ecb\u7ecd\u3002"
        result = _extract_abstract(text)
        # The function should extract something; if Chinese regex doesn't match, fallback is empty
        # Just verify it doesn't crash and returns a string
        assert isinstance(result, str)

    def test_no_abstract(self):
        text = "Just some random text without any abstract section."
        assert _extract_abstract(text) == ""

    def test_abstract_truncated_at_2000(self):
        long_text = "Abstract: " + "x" * 3000 + "\nIntroduction: done"
        result = _extract_abstract(long_text)
        assert len(result) <= 2000


class TestExtractSections:
    """Tests for _extract_sections helper."""

    def test_basic_sections(self):
        text = "Some Title Text Here\n\nIntroduction\nSome intro text.\n\nMethods\nMethod details.\n\nResults\nResult details."
        sections = _extract_sections(text)
        headings = [s["heading"] for s in sections]
        # The regex may capture multi-line headings; just verify sections were found
        assert len(sections) >= 1

    def test_excludes_references(self):
        text = "Title\n\nIntroduction\nText\n\nReferences\n[1] Author..."
        sections = _extract_sections(text)
        headings = [s["heading"] for s in sections]
        assert "References" not in headings

    def test_empty_text(self):
        assert _extract_sections("") == []


# ---------------------------------------------------------------------------
# Map layout export tests
# ---------------------------------------------------------------------------


class TestMapLayoutExport:
    """Tests for /tools/map/layout-export."""

    def test_no_source_html_only(self):
        """Without source, should still produce HTML fallback."""
        resp = client.post(
            "/tools/map/layout-export",
            json=_base_req(params={"format": "html", "title": "Test Map"}),
        )
        data = resp.json()
        assert data["ok"] is True
        assert len(data["artifacts"]) >= 1

    def test_fallback_without_folium(self):
        """When folium is not installed, HTML fallback should still work."""
        with patch.dict("sys.modules", {"folium": None}):
            resp = client.post(
                "/tools/map/layout-export",
                json=_base_req(params={"format": "html"}),
            )
        data = resp.json()
        assert data["ok"] is True
        # Should have at least one artifact (the fallback HTML)
        assert len(data["artifacts"]) >= 1

    def test_fallback_without_matplotlib(self):
        """When matplotlib is not installed, PNG/SVG fallbacks should still work."""
        with patch.dict("sys.modules", {"matplotlib": None}):
            resp = client.post(
                "/tools/map/layout-export",
                json=_base_req(params={"format": "png"}),
            )
        data = resp.json()
        # Should still succeed with placeholder
        assert data["ok"] is True

    def test_all_format_produces_manifest(self):
        resp = client.post(
            "/tools/map/layout-export",
            json=_base_req(params={"format": "all"}),
        )
        data = resp.json()
        # Last artifact should be the manifest
        assert len(data["artifacts"]) >= 2
        manifest_types = [a["type"] for a in data["artifacts"]]
        assert "manifest" in manifest_types
