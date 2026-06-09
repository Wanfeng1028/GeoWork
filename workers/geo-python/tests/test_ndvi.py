"""Tests for NDVI analysis API."""

import pytest

from app.api.ndvi import _compute_ndvi_stats, NdvRequest, NdvResponse, NdvStatistics


class TestNdvRequest:
    """Test NdvRequest model validation."""

    def test_valid_request(self):
        req = NdvRequest(
            project_id="proj-001",
            data_source="sentinel2",
            red_band="/data/red.tif",
            nir_band="/data/nir.tif",
        )
        assert req.project_id == "proj-001"
        assert req.data_source == "sentinel2"
        assert req.min_value == -1.0
        assert req.max_value == 1.0

    def test_custom_thresholds(self):
        req = NdvRequest(
            project_id="proj-002",
            data_source="landsat",
            red_band="/data/red.tif",
            nir_band="/data/nir.tif",
            min_value=0.0,
            max_value=0.8,
        )
        assert req.min_value == 0.0
        assert req.max_value == 0.8

    def test_invalid_min_value(self):
        with pytest.raises(Exception):
            NdvRequest(
                project_id="proj-003",
                data_source="sentinel2",
                red_band="/data/red.tif",
                nir_band="/data/nir.tif",
                min_value=-2.0,
            )

    def test_missing_required_fields(self):
        with pytest.raises(Exception):
            NdvRequest(
                project_id="proj-004",
                data_source="sentinel2",
                red_band="",
                nir_band="",
            )


class TestNdvStatistics:
    """Test NdvStatistics model."""

    def test_statistics_defaults(self):
        stats = NdvStatistics(
            mean=0.44,
            median=0.48,
            std=0.18,
            min=-0.12,
            max=0.82,
            valid_pixels=152340,
            cloud_pixels=3210,
            nodata_pixels=1050,
        )
        assert stats.mean == 0.44
        assert stats.valid_pixels == 152340


class TestNdvCalculation:
    """Test NDVI calculation logic."""

    def test_ndvi_formula_range(self):
        """NDVI = (NIR - Red) / (NIR + Red) should be in [-1, 1]."""
        # Pure vegetation: high NIR, low Red -> NDVI close to 1
        # Water: low NIR, low Red -> NDVI close to 0 or negative
        # Bare soil: moderate NIR, moderate Red -> NDVI moderate

        # Simulate with numpy if available
        try:
            import numpy as np

            # Test case 1: dense vegetation
            nir = np.array([0.5, 0.6, 0.55])
            red = np.array([0.05, 0.06, 0.04])
            ndvi = (nir - red) / (nir + red)
            assert all(ndvi >= 0.8)
            assert all(ndvi <= 1.0)

            # Test case 2: water body
            nir = np.array([0.05, 0.04, 0.06])
            red = np.array([0.08, 0.07, 0.09])
            ndvi = (nir - red) / (nir + red)
            assert all(ndvi < 0)
            assert all(ndvi >= -1.0)

            # Test case 3: bare soil
            nir = np.array([0.2, 0.25, 0.22])
            red = np.array([0.18, 0.20, 0.19])
            ndvi = (nir - red) / (nir + red)
            assert all(ndvi >= 0)
            assert all(ndvi <= 0.2)
        except ImportError:
            # numpy not available in test env — skip numeric tests
            pytest.skip("numpy not available")

    def test_identifier_statistics(self):
        """Test that _compute_ndvi_stats returns valid stats for band identifiers."""
        stats = _compute_ndvi_stats("/data/red.tif", "/data/nir.tif")
        assert isinstance(stats, NdvStatistics)
        assert -1.0 <= stats.min <= stats.max <= 1.0
        assert stats.valid_pixels > 0
        assert stats.mean >= stats.min
        assert stats.mean <= stats.max


class TestNdvResponse:
    """Test NdvResponse model."""

    def test_success_response(self):
        stats = NdvStatistics(
            mean=0.44,
            median=0.48,
            std=0.18,
            min=-0.12,
            max=0.82,
            valid_pixels=152340,
            cloud_pixels=3210,
            nodata_pixels=1050,
        )
        resp = NdvResponse(
            status="success",
            ndvi_image_path="/artifacts/ndvi_20240101.json",
            statistics=stats,
            message="NDVI computed successfully",
        )
        assert resp.status == "success"
        assert resp.message == "NDVI computed successfully"
        assert resp.timestamp is not None
        assert len(resp.request_id) == 12

    def test_failed_response(self):
        stats = NdvStatistics(
            mean=0.0,
            median=0.0,
            std=0.0,
            min=0.0,
            max=0.0,
            valid_pixels=0,
            cloud_pixels=0,
            nodata_pixels=0,
        )
        resp = NdvResponse(
            status="failed",
            ndvi_image_path="",
            statistics=stats,
            message="Computation failed",
        )
        assert resp.status == "failed"
        assert resp.ndvi_image_path == ""


@pytest.mark.asyncio
async def test_ndvi_analyze():
    """Test NDVI analysis API endpoint (integration-level)."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.post("/ndvi/analyze", json={
        "project_id": "test-project",
        "data_source": "sentinel2",
        "red_band": "/data/red.tif",
        "nir_band": "/data/nir.tif",
        "min_value": -1.0,
        "max_value": 1.0,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("success", "failed")
    assert "statistics" in data
    assert "request_id" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_ndvi_history():
    """Test NDVI history endpoint."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.get("/ndvi/history/test-project")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
