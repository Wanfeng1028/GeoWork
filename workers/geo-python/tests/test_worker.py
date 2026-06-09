from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert "capabilities" in res.json()


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
    assert (tmp_path / "artifacts" / "task_1_map.html").exists()
    
    # 验证脚本内容
    script_content = (tmp_path / "scripts" / "task_1_gee_ndvi.py").read_text()
    assert "GeoWork generated GEE NDVI workflow" in script_content
    assert "ee.Initialize()" in script_content
    assert "normalizedDifference" in script_content


def test_write_report_and_inspect_dataset(tmp_path: Path):
    report = client.post(
        "/tools/office/write-report",
        json={"workspace": str(tmp_path), "taskId": "task_2", "prompt": "report"},
    )
    assert report.status_code == 200
    assert (tmp_path / "reports" / "task_2_report.md").exists()
    
    # 验证 Markdown 内容
    md_content = (tmp_path / "reports" / "task_2_report.md").read_text()
    assert "GeoWork Task Report" in md_content
    assert "report" in md_content

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
    
    csv_content = (tmp_path / "knowledge" / "task_4_literature_matrix.csv").read_text()
    assert "title,year,method,data,reproducibility" in csv_content

    paper_notes = client.post(
        "/tools/papers/parse-pdf",
        json={"workspace": str(tmp_path), "taskId": "task_5"},
    )
    assert paper_notes.status_code == 200
    assert (tmp_path / "knowledge" / "task_5_paper_notes.md").exists()

    index = client.post(
        "/tools/knowledge/index",
        json={"workspace": str(tmp_path), "taskId": "task_6"},
    )
    assert index.status_code == 200
    assert (tmp_path / "knowledge" / "geowork_index.json").exists()


def test_qgis_check(tmp_path: Path):
    qgis = client.post(
        "/tools/qgis/check",
        json={"workspace": str(tmp_path), "taskId": "task_7"},
    )
    assert qgis.status_code == 200
    assert (tmp_path / "artifacts" / "task_7_qgis_status.json").exists()


def test_workspace_isolation(tmp_path: Path):
    """验证工作区隔离"""
    res = client.post(
        "/tools/gee/generate-ndvi-script",
        json={"workspace": str(tmp_path), "taskId": "isolation_test"},
    )
    assert res.status_code == 200
    
    # 验证文件在工作区内
    workspace = tmp_path / "isolation_test_workspace"
    workspace.mkdir()
    res2 = client.post(
        "/tools/office/write-report",
        json={"workspace": str(workspace), "taskId": "isolation_test_2"},
    )
    assert res2.status_code == 200
    assert (workspace / "reports" / "isolation_test_2_report.md").exists()


def test_artifact_manifest_structure(tmp_path: Path):
    """验证 artifact manifest 结构"""
    import json
    
    res = client.post(
        "/tools/gee/generate-ndvi-script",
        json={"workspace": str(tmp_path), "taskId": "manifest_test"},
    )
    assert res.status_code == 200
    
    manifest_path = tmp_path / "artifacts" / "manifest_test_artifact_manifest.json"
    assert manifest_path.exists()
    
    manifest = json.loads(manifest_path.read_text())
    assert "taskId" in manifest
    assert "artifacts" in manifest
    assert "reproducibility" in manifest
    assert manifest["reproducibility"]["workspaceScoped"] is True
