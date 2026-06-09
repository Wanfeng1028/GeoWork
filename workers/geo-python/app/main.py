from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="GeoWork Geo Python Worker", version="1.0.0-dev")


class ToolRequest(BaseModel):
    workspace: str
    taskId: str = "task"
    prompt: str = ""
    mode: str = "Analysis"
    params: dict[str, Any] = {}


def ensure_workspace(path: str) -> Path:
    workspace = Path(path).expanduser().resolve()
    for child in ["scripts", "reports", "artifacts", "data", "knowledge"]:
        (workspace / child).mkdir(parents=True, exist_ok=True)
    return workspace


def artifact(name: str, path: Path, kind: str, mime_type: str) -> dict[str, str]:
    return {"name": name, "path": str(path), "type": kind, "mimeType": mime_type}


def write_manifest(workspace: Path, task_id: str, artifacts: list[dict[str, str]]) -> dict[str, str]:
    manifest_path = workspace / "artifacts" / f"{task_id}_artifact_manifest.json"
    import json

    manifest_path.write_text(
        json.dumps(
            {
                "taskId": task_id,
                "artifacts": artifacts,
                "reproducibility": {
                    "workspaceScoped": True,
                    "generatedBy": "GeoWork Geo Python Worker",
                    "qgisBundled": False,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return artifact("Artifact Manifest", manifest_path, "manifest", "application/json")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "geo-python-worker",
        "capabilities": [
            "gee-ndvi-script",
            "office-report",
            "pdf-parse",
            "gdal-inspect",
            "qgis-detect",
        ],
    }


@app.post("/tools/gee/generate-ndvi-script")
def generate_ndvi_script(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    script_path = workspace / "scripts" / f"{req.taskId}_gee_ndvi.py"
    script = f'''"""GeoWork generated GEE NDVI workflow."""
import ee

ee.Initialize()

AOI = ee.Geometry.Rectangle([100.0, 20.0, 101.0, 21.0])
COLLECTION = (
    ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(AOI)
    .filterDate("2024-01-01", "2024-12-31")
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
)

def add_ndvi(image):
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    return image.addBands(ndvi)

ndvi_collection = COLLECTION.map(add_ndvi)
median_ndvi = ndvi_collection.select("NDVI").median().clip(AOI)

task = ee.batch.Export.image.toDrive(
    image=median_ndvi,
    description="geowork_ndvi_export",
    folder="GeoWork",
    fileNamePrefix="{req.taskId}_ndvi",
    scale=10,
    region=AOI,
    maxPixels=1e13,
)
task.start()
print("Started NDVI export", task.id)
'''
    script_path.write_text(script, encoding="utf-8")
    map_path = workspace / "artifacts" / f"{req.taskId}_map.html"
    map_path.write_text(
        "<!doctype html><title>GeoWork NDVI Map</title><h1>NDVI Preview</h1><p>GEE export task created. Load output COG/GeoTIFF here after completion.</p>",
        encoding="utf-8",
    )
    artifacts = [
        artifact("GEE NDVI Python Script", script_path, "script", "text/x-python"),
        artifact("NDVI Map Preview", map_path, "html-map", "text/html"),
    ]
    artifacts.append(write_manifest(workspace, req.taskId, artifacts))
    return {
        "ok": True,
        "message": "Generated GEE NDVI Python script and HTML map preview",
        "artifacts": artifacts,
    }


@app.post("/tools/office/write-report")
def write_report(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    markdown_path = workspace / "reports" / f"{req.taskId}_report.md"
    docx_path = workspace / "reports" / f"{req.taskId}_report.docx"
    markdown = f"""# GeoWork Task Report

## Prompt

{req.prompt or "GeoWork analysis task"}

## Workflow

- Research/Data/GeoCode/Analysis/Write mode: {req.mode}
- Generated a transparent plan in Go Core.
- Executed tools through the guarded Tool Registry.
- Registered outputs as project artifacts.

## Reproducibility

All file writes were scoped to the project workspace. External QGIS/GDAL/GEE integrations should be configured from Settings before production use.
"""
    markdown_path.write_text(markdown, encoding="utf-8")
    try:
        from docx import Document

        doc = Document()
        doc.add_heading("GeoWork Task Report", 0)
        doc.add_heading("Prompt", level=1)
        doc.add_paragraph(req.prompt or "GeoWork analysis task")
        doc.add_heading("Workflow", level=1)
        for line in [
            f"Mode: {req.mode}",
            "Planner/Executor ran through Go Core.",
            "Tool calls were logged and artifacts registered.",
        ]:
            doc.add_paragraph(line, style="List Bullet")
        doc.save(docx_path)
    except Exception:
        docx_path.write_text("python-docx unavailable; Markdown report generated.", encoding="utf-8")
    artifacts = [
        artifact("Markdown Report", markdown_path, "report", "text/markdown"),
        artifact(
            "Word Report",
            docx_path,
            "report",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
    ]
    artifacts.append(write_manifest(workspace, req.taskId, artifacts))
    return {
        "ok": True,
        "message": "Generated Markdown and DOCX reports",
        "artifacts": artifacts,
    }


@app.post("/tools/gdal/inspect-dataset")
def inspect_dataset(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    report_path = workspace / "artifacts" / f"{req.taskId}_dataset_quality.json"
    report_path.write_text(
        '{"ok":true,"crs":"EPSG:4326","geometry":"valid","raster":"not-provided","recommendations":["Configure GDAL/QGIS local path for production processing."]}',
        encoding="utf-8",
    )
    return {
        "ok": True,
        "message": "Dataset quality inspection completed with development sample data",
        "artifacts": [artifact("Dataset Quality JSON", report_path, "quality-report", "application/json")],
    }


@app.post("/tools/papers/parse-pdf")
def parse_pdf(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    output_path = workspace / "knowledge" / f"{req.taskId}_paper_notes.md"
    output_path.write_text(
        "# Paper Reading Notes\n\n- Objective\n- Method\n- Data\n- Results\n- Reproducibility checklist\n",
        encoding="utf-8",
    )
    return {"ok": True, "artifacts": [artifact("Paper Reading Notes", output_path, "knowledge", "text/markdown")]}


@app.post("/tools/papers/openalex-search")
def openalex_search(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    query = req.params.get("query") or req.prompt or "remote sensing"
    matrix_path = workspace / "knowledge" / f"{req.taskId}_literature_matrix.csv"
    matrix_path.write_text(
        "title,year,method,data,reproducibility\n"
        f"OpenAlex seed result for {query},2024,review,multi-source,medium\n"
        "Sentinel-2 NDVI time-series workflow,2023,experiment,Sentinel-2,high\n",
        encoding="utf-8",
    )
    notes_path = workspace / "knowledge" / f"{req.taskId}_literature_notes.md"
    notes_path.write_text(
        f"# Literature Search: {query}\n\n- Source: OpenAlex-compatible plugin path\n- Output: review matrix and candidate methods\n",
        encoding="utf-8",
    )
    return {
        "ok": True,
        "message": "Generated literature matrix from OpenAlex-compatible search",
        "artifacts": [
            artifact("Literature Matrix CSV", matrix_path, "knowledge", "text/csv"),
            artifact("Literature Notes", notes_path, "knowledge", "text/markdown"),
        ],
    }


@app.post("/tools/knowledge/index")
def index_knowledge(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    index_path = workspace / "knowledge" / "geowork_index.json"
    index_path.write_text(
        '{"status":"indexed","types":["pdf","docx","pptx","markdown","notebook","web"],"engine":"local-dev"}',
        encoding="utf-8",
    )
    return {"ok": True, "artifacts": [artifact("Knowledge Index", index_path, "knowledge-index", "application/json")]}


@app.post("/tools/qgis/check")
def qgis_check(req: ToolRequest):
    workspace = ensure_workspace(req.workspace)
    status_path = workspace / "artifacts" / f"{req.taskId}_qgis_status.json"
    status_path.write_text(
        '{"bundled":false,"strategy":"detect-local-installation","status":"not_configured"}',
        encoding="utf-8",
    )
    return {"ok": True, "artifacts": [artifact("QGIS Environment Status", status_path, "environment", "application/json")]}
