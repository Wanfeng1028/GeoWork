"""FastAPI exception handlers for GeoWork Python worker.

Registers handlers that convert exceptions into a uniform JSON shape:
{"ok": false, "error": "...", "code": "..."}
"""

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.exceptions import GeoWorkError

logger = logging.getLogger(__name__)


async def geowork_exception_handler(request: Request, exc: GeoWorkError) -> JSONResponse:
    """Handle GeoWorkError subclasses with their defined status codes."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": exc.message, "code": exc.code},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unexpected exceptions."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": str(exc), "code": "INTERNAL_ERROR"},
    )
