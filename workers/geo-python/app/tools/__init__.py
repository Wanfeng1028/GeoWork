# GeoWork Python Worker - Tool Implementations

"""Shared tool utilities for GeoWork worker operations.

Note: The actual GIS tool logic lives in ``app.api.gis`` (FastAPI router).
This module only keeps small cross-cutting helpers that are reused by
multiple endpoints.
"""

from typing import Any


# ---------------------------------------------------------------------------
# MIME-type helper
# ---------------------------------------------------------------------------

_MIME_MAP: dict[str, str] = {
    "html": "text/html",
    "png": "image/png",
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
    "geojson": "application/geo+json",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "json": "application/json",
    "csv": "text/csv",
    "md": "text/markdown",
}


def mime_for_format(fmt: str) -> str:
    """Return the MIME type for a given format string."""
    return _MIME_MAP.get(fmt.lower().lstrip("."), "application/octet-stream")


# ---------------------------------------------------------------------------
# Status helper
# ---------------------------------------------------------------------------


def ok_result(**extra: Any) -> dict[str, Any]:
    """Build a standard ``{"ok": True, ...}`` response dict."""
    return {"ok": True, **extra}


def error_result(message: str, **extra: Any) -> dict[str, Any]:
    """Build a standard ``{"ok": False, "error": ..., ...}`` response dict."""
    return {"ok": False, "error": message, **extra}
