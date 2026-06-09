from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_generate_ndvi_script(tmp_path: Path):
    res = client.post(
        "/tools/gee/generate-ndvi-script",
        json={"workspace": str(tmp_path), "taskId": "task_1", "prompt": "NDVI"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert len(body["artifacts"]) == 3
    assert (tmp_path / "scripts" / "task_1_gee_ndvi.py").exists()
    assert (tmp_path / "artifacts" / "task_1_artifact_manifest.json").exists()


def test_write_report_and_inspect_dataset(tmp_path: Path):
    report = client.post(
        "/tools/office/write-report",
        json={"workspace": str(tmp_path), "taskId": "task_2", "prompt": "report"},
    )
    assert report.status_code == 200
    assert (tmp_path / "reports" / "task_2_report.md").exists()

    inspect = client.post(
        "/tools/gdal/inspect-dataset",
        json={"workspace": str(tmp_path), "taskId": "task_3"},
    )
    assert inspect.status_code == 200
    assert (tmp_path / "artifacts" / "task_3_dataset_quality.json").exists()


def test_research_and_knowledge_tools(tmp_path: Path):
    search = client.post(
        "/tools/papers/openalex-search",
        json={"workspace": str(tmp_path), "taskId": "task_4", "prompt": "NDVI"},
    )
    assert search.status_code == 200
    assert (tmp_path / "knowledge" / "task_4_literature_matrix.csv").exists()

    index = client.post(
        "/tools/knowledge/index",
        json={"workspace": str(tmp_path), "taskId": "task_5"},
    )
    assert index.status_code == 200
    assert (tmp_path / "knowledge" / "geowork_index.json").exists()
