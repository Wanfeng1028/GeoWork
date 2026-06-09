"""Tests for GIS processing API."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_clip_raster():
    """Test raster clipping endpoint."""
    response = client.post("/api/gis/clip", json={
        "layerId": "test_raster.tif",
        "extent": {
            "minX": 73.0,
            "minY": 18.0,
            "maxX": 135.0,
            "maxY": 54.0
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "output_path" in data


def test_reproject_layer():
    """Test layer reproject endpoint."""
    response = client.post("/api/gis/reproject", json={
        "layerId": "test_layer.tif",
        "targetCrs": "EPSG:3857"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_merge_layers():
    """Test layer merge endpoint."""
    response = client.post("/api/gis/merge", json={
        "layerIds": ["layer1.shp", "layer2.shp"],
        "outputPath": "merged.shp"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["output_path"].endswith("merged.shp")


def test_dissolve_layer():
    """Test vector dissolve endpoint."""
    response = client.post("/api/gis/dissolve", json={
        "layerId": "regions.shp",
        "field": "province"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_analyze_layer():
    """Test layer analysis endpoint."""
    response = client.post("/api/gis/analyze", json={
        "layerId": "ndvi.tif",
        "analysisType": "raster_stats"
    })
    assert response.status_code == 200
    data = response.json()
    assert "statistics" in data
    assert "extent" in data
    assert "crs" in data
    assert "bandCount" in data
    assert data["statistics"]["mean"] >= 0
    assert data["crs"] == "EPSG:4326"


def test_clip_raster_invalid_body():
    """Test clip with invalid request body."""
    response = client.post("/api/gis/clip", json={})
    assert response.status_code == 422


def test_reproject_layer_invalid_crs():
    """Test reproject with missing target CRS."""
    response = client.post("/api/gis/reproject", json={
        "layerId": "test.tif"
    })
    assert response.status_code == 422
