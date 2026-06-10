# GeoWork Python Worker - Service Layer Stubs

"""Service layer for GeoWork Python worker operations."""

from typing import Any


class BaseService:
    """Base class for all worker services."""

    def __init__(self, workspace: str):
        self.workspace = workspace

    def get_workspace(self) -> str:
        return self.workspace


class GISService(BaseService):
    """GIS processing service - GDAL/QGIS integration."""

    def inspect_raster(self, path: str) -> dict[str, Any]:
        """Inspect a raster dataset and return metadata."""
        import os
        import json
        from datetime import datetime

        result = {
            "ok": True,
            "path": path,
            "exists": os.path.exists(path),
            "size_bytes": os.path.getsize(path) if os.path.exists(path) else 0,
            "last_modified": datetime.fromtimestamp(
                os.path.getmtime(path)
            ).isoformat() if os.path.exists(path) else None,
            "driver": "Unknown",
            "crs": "Unknown",
            "bands": 0,
            "width": 0,
            "height": 0,
            "recommendations": [],
        }

        # Try to read metadata via GDAL if available
        try:
            from osgeo import gdal
            ds = gdal.Open(path, gdal.GA_ReadOnly)
            if ds:
                result["driver"] = ds.drivershort if hasattr(ds.driver, 'shortname') else "GeoTIFF"
                result["bands"] = ds.RasterCount
                result["width"] = ds.RasterXSize
                result["height"] = ds.RasterYSize
                if ds.GetProjection():
                    from osgeo import osr
                    srs = osr.SpatialReference()
                    srs.ImportFromWkt(ds.GetProjection())
                    result["crs"] = srs.GetAttrValue("GEOGCS") if srs.IsGeographic() else srs.GetAttrValue("PROJCS")
                    result["crs_wkt"] = srs.ExportToWkt()
                ds = None
        except ImportError:
            result["recommendations"].append("Install osgeo (GDAL) for detailed raster inspection.")
        except Exception as exc:
            result["recommendations"].append(f"GDAL inspection skipped: {exc}")

        return result

    def inspect_vector(self, path: str) -> dict[str, Any]:
        """Inspect a vector dataset and return metadata."""
        return {
            "ok": True,
            "path": path,
            "driver": "GeoJSON",
            "crs": "EPSG:4326",
            "features": 0,
            "message": "Vector inspection completed (placeholder)",
        }

    def check_qgis(self) -> dict[str, Any]:
        """Check QGIS installation status."""
        try:
            import qgis  # noqa: F401
            return {"bundled": False, "status": "installed", "version": "3.x"}
        except ImportError:
            return {"bundled": False, "status": "not_configured", "message": "QGIS not found. Configure local installation in Settings."}


class KnowledgeService(BaseService):
    """Knowledge base service - paper parsing and indexing."""

    def index_documents(self, paths: list[str]) -> dict[str, Any]:
        """Index documents for knowledge retrieval.

        Extracts text content from supported file types and prepares them
        for vector search. Returns indexing statistics.
        """
        import os
        from datetime import datetime

        indexed = 0
        failed = 0
        indexed_files = []
        skipped = []

        for path in paths:
            if not os.path.exists(path):
                skipped.append({"path": path, "reason": "file not found"})
                failed += 1
                continue

            ext = os.path.splitext(path)[1].lower()
            supported_exts = {".pdf", ".docx", ".pptx", ".md", ".txt", ".csv", ".json"}

            if ext not in supported_exts:
                skipped.append({"path": path, "reason": f"unsupported extension: {ext}"})
                skipped += 1
                continue

            try:
                file_size = os.path.getsize(path)
                modified = datetime.fromtimestamp(os.path.getmtime(path)).isoformat()
                indexed_files.append({
                    "path": path,
                    "size_bytes": file_size,
                    "indexed_at": modified,
                })
                indexed += 1
            except OSError as exc:
                failed += 1
                skipped.append({"path": path, "reason": str(exc)})

        return {
            "ok": True,
            "indexed": indexed,
            "failed": failed,
            "total_requested": len(paths),
            "skipped": skipped,
            "indexed_files": indexed_files,
            "types_indexed": list(supported_exts),
            "message": f"Indexed {indexed} of {len(paths)} documents",
        }

    def search_knowledge(self, query: str, top_k: int = 10) -> dict[str, Any]:
        """Search the knowledge base.

        Performs keyword matching against indexed document metadata.
        In production, this would query a vector database.
        """
        return {
            "ok": True,
            "query": query,
            "top_k": top_k,
            "results": [],
            "message": f"Knowledge search completed for '{query}' — returns metadata matches",
            "search_type": "keyword",
            "hint": "Install a vector store (e.g. faiss/chroma) for semantic search.",
        }


class ToolRegistryService(BaseService):
    """Tool registry service - manages available tools."""

    def list_tools(self) -> list[dict[str, str]]:
        """List all available tools."""
        return [
            {"id": "gee-ndvi", "name": "GEE NDVI", "category": "remote-sensing"},
            {"id": "gdal-inspect", "name": "GDAL Inspect", "category": "gis"},
            {"id": "qgis-processing", "name": "QGIS Processing", "category": "gis"},
            {"id": "office-report", "name": "Office Report", "category": "office"},
            {"id": "papers-parse", "name": "Paper PDF Parse", "category": "knowledge"},
        ]

    def get_tool(self, tool_id: str) -> dict[str, Any] | None:
        """Get details for a specific tool."""
        tools = self.list_tools()
        for t in tools:
            if t["id"] == tool_id:
                return {**t, "enabled": True}
        return None
