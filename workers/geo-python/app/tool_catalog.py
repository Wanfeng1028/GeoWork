# GeoWork Python Worker - Tool Catalog
#
# Single source of truth for the worker tool catalog exposed via GET /tools.
# The Go core (core/internal/worker/client.go) fetches this catalog at startup
# and registers each entry into its ToolRegistry, so every entry's "name" MUST
# match a key in client.go's RunTool dispatch table and each tool's endpoint
# MUST exist on this app. scripts/core_worker_contract.py enforces both sides.
#
# Response envelope: every tool endpoint accepts the ToolRequest shape
# ({workspace, taskId, prompt, mode, params}), so input_schema describes that
# envelope with tool-specific fields nested under "params".

from typing import Any

RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"

_VALID_RISK_LEVELS = {RISK_LOW, RISK_MEDIUM, RISK_HIGH}

# Envelope fields shared by every tool request (see ToolRequest in app/main.py).
_ENVELOPE_PROPERTIES: dict[str, Any] = {
    "workspace": {"type": "string", "description": "Absolute workspace directory for the task"},
    "taskId": {"type": "string", "description": "Task identifier used for artifact naming"},
    "prompt": {"type": "string", "description": "Original user prompt (optional context)"},
    "mode": {"type": "string", "description": "Task mode, e.g. Analysis"},
}


def _schema(params_properties: dict[str, Any] | None = None, required_params: list[str] | None = None) -> dict[str, Any]:
    """Build the ToolRequest envelope schema with tool-specific params fields."""
    params: dict[str, Any] = {"type": "object", "properties": params_properties or {}}
    if required_params:
        params["required"] = required_params
    return {
        "type": "object",
        "properties": {**_ENVELOPE_PROPERTIES, "params": params},
        "required": ["workspace"],
    }


def _tool(name: str, description: str, risk_level: str, params_properties: dict[str, Any] | None = None, required_params: list[str] | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "input_schema": _schema(params_properties, required_params),
        "risk_level": risk_level,
    }


_PATH = {"type": "string", "description": "Input file path"}
_OUTPUT = {"type": "string", "description": "Output file path (defaults to workspace artifacts dir)"}

# Names must match the RunTool dispatch keys in core/internal/worker/client.go exactly.
TOOL_CATALOG: list[dict[str, Any]] = [
    _tool(
        "geo.gee.search_dataset",
        "Search Google Earth Engine dataset candidates for a query",
        RISK_LOW,
        {"query": {"type": "string", "description": "Dataset search query"}},
    ),
    _tool(
        "geo.gee.check_auth",
        "Check Google Earth Engine authentication status",
        RISK_LOW,
    ),
    _tool(
        "geo.gee.generate_ndvi_script",
        "Generate a GEE NDVI Python script and HTML map preview",
        RISK_MEDIUM,
    ),
    _tool(
        "geo.ndvi.analyze",
        "Run NDVI analysis on red/NIR bands and produce statistics plus a rendered image",
        RISK_MEDIUM,
        {
            "project_id": {"type": "string", "description": "NDVI project identifier"},
            "data_source": {"type": "string", "description": "sentinel2 or landsat"},
            "red_band": {"type": "string", "description": "Red band path or identifier"},
            "nir_band": {"type": "string", "description": "NIR band path or identifier"},
            "min_value": {"type": "number", "description": "NDVI clamp minimum (-1..1)"},
            "max_value": {"type": "number", "description": "NDVI clamp maximum (-1..1)"},
        },
        ["project_id", "data_source", "red_band", "nir_band"],
    ),
    _tool(
        "geo.office.write_report",
        "Write a task report as Markdown and DOCX",
        RISK_MEDIUM,
    ),
    _tool(
        "geo.office.write_ppt",
        "Write a task presentation as PPTX",
        RISK_MEDIUM,
    ),
    _tool(
        "geo.office.write_excel",
        "Write task tabular results as XLSX",
        RISK_MEDIUM,
    ),
    _tool(
        "geo.office.write_notebook",
        "Write a reproducible Jupyter notebook for the task",
        RISK_MEDIUM,
    ),
    _tool(
        "geo.gdal.inspect_dataset",
        "Inspect a raster/vector dataset and report metadata",
        RISK_LOW,
        {"path": _PATH},
        ["path"],
    ),
    _tool(
        "geo.raster.metadata",
        "Read raster metadata (CRS, bounds, bands, resolution)",
        RISK_LOW,
        {"path": _PATH},
        ["path"],
    ),
    _tool(
        "geo.raster.clip",
        "Clip a raster by bounding box",
        RISK_MEDIUM,
        {
            "path": _PATH,
            "output": _OUTPUT,
            "bbox": {"type": "array", "items": {"type": "number"}, "description": "[minx, miny, maxx, maxy]"},
        },
        ["path"],
    ),
    _tool(
        "geo.raster.reproject",
        "Reproject a raster to a target CRS",
        RISK_MEDIUM,
        {
            "path": _PATH,
            "output": _OUTPUT,
            "dst_crs": {"type": "string", "description": "Target CRS (alias: targetCrs)"},
        },
        ["path", "dst_crs"],
    ),
    _tool(
        "geo.raster.cog",
        "Convert a raster to Cloud Optimized GeoTIFF",
        RISK_MEDIUM,
        {"path": _PATH, "output": _OUTPUT},
        ["path"],
    ),
    _tool(
        "geo.vector.metadata",
        "Read vector dataset metadata (CRS, feature count, geometry types)",
        RISK_LOW,
        {"path": _PATH},
        ["path"],
    ),
    _tool(
        "geo.vector.buffer",
        "Buffer vector geometries by a distance",
        RISK_MEDIUM,
        {
            "path": _PATH,
            "output": _OUTPUT,
            "distance": {"type": "number", "description": "Buffer distance in layer units"},
        },
        ["path", "distance"],
    ),
    _tool(
        "geo.vector.clip",
        "Clip a vector layer by another layer or bounding box",
        RISK_MEDIUM,
        {
            "path": _PATH,
            "output": _OUTPUT,
            "clip": {"type": "string", "description": "Clip layer path (alias: clip_path)"},
            "bbox": {"type": "array", "items": {"type": "number"}, "description": "[minx, miny, maxx, maxy]"},
        },
        ["path"],
    ),
    _tool(
        "geo.vector.reproject",
        "Reproject a vector layer to a target CRS",
        RISK_MEDIUM,
        {
            "path": _PATH,
            "output": _OUTPUT,
            "crs": {"type": "string", "description": "Target CRS (aliases: targetCrs, dst_crs)"},
        },
        ["path", "crs"],
    ),
    _tool(
        "research.openalex.search",
        "Search academic papers via the OpenAlex API",
        RISK_LOW,
        {
            "query": {"type": "string", "description": "Paper search query"},
            "limit": {"type": "integer", "description": "Max results (default 10)"},
        },
    ),
    _tool(
        "papers.parse_pdf",
        "Parse a PDF paper and extract text/metadata",
        RISK_LOW,
        {"path": {"type": "string", "description": "PDF file path (alias: pdf_path)"}},
        ["path"],
    ),
    _tool(
        "knowledge.index",
        "Build/refresh the local workspace knowledge index",
        RISK_MEDIUM,
    ),
    _tool(
        "qgis.check",
        "Check QGIS availability and write an environment status artifact",
        RISK_LOW,
    ),
    _tool(
        "qgis.check_env",
        "Alias of qgis.check: inspect the QGIS environment",
        RISK_LOW,
    ),
    _tool(
        "qgis.processing.run",
        "Run a QGIS processing algorithm",
        RISK_HIGH,
        {"algorithm": {"type": "string", "description": "QGIS algorithm id, e.g. native:buffer"}},
        ["algorithm"],
    ),
    _tool(
        "geo.map.layout_export",
        "Export a map layout as HTML/PNG/SVG",
        RISK_MEDIUM,
        {
            "path": {"type": "string", "description": "Source dataset or project path (alias: source)"},
            "title": {"type": "string", "description": "Layout title"},
            "format": {"type": "string", "description": "html, png, svg, or all"},
        },
    ),
]


def tool_names() -> list[str]:
    return [t["name"] for t in TOOL_CATALOG]


def validate_catalog() -> None:
    """Raise ValueError if the catalog violates the WorkerToolDef contract."""
    seen: set[str] = set()
    for entry in TOOL_CATALOG:
        name = entry.get("name", "")
        if not name:
            raise ValueError("tool entry missing name")
        if name in seen:
            raise ValueError(f"duplicate tool name: {name}")
        seen.add(name)
        if not entry.get("description"):
            raise ValueError(f"tool {name} missing description")
        if entry.get("risk_level") not in _VALID_RISK_LEVELS:
            raise ValueError(f"tool {name} has invalid risk_level: {entry.get('risk_level')!r}")
        schema = entry.get("input_schema")
        if not isinstance(schema, dict) or schema.get("type") != "object":
            raise ValueError(f"tool {name} input_schema must be an object schema")
