"""Runtime token authentication for the GeoWork Python worker.

doc/22 BP4 / F6: the Go core guards its API with a runtime token
(api/auth.go), but the worker previously accepted unauthenticated
requests from ANY local process on 127.0.0.1:8766 — GEE/GDAL tools that
write files to disk. This middleware enforces the same shared-secret
contract:

- The Go core mints ``GEOWORK_WORKER_TOKEN`` and injects it into the
  worker subprocess environment (worker/process.go), then sends it as
  the ``X-GeoWork-Token`` header on every request (worker/client.go).
- The worker compares with ``hmac.compare_digest`` (constant time).
- Fail-closed: when the env var is unset the worker refuses every
  request unless ``GEOWORK_INSECURE_NO_AUTH=1`` is explicitly set
  (mirrors the Go core's dev escape hatch, logged loudly at startup).
- ``/health`` stays open for process managers.
"""

from __future__ import annotations

import hmac
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("geowork.worker.auth")

TOKEN_HEADER = "X-GeoWork-Token"
TOKEN_ENV = "GEOWORK_WORKER_TOKEN"
INSECURE_ENV = "GEOWORK_INSECURE_NO_AUTH"

EXEMPT_PATHS = {"/health"}


def get_worker_token() -> str | None:
    return os.environ.get(TOKEN_ENV) or None


def is_insecure_mode() -> bool:
    return os.environ.get(INSECURE_ENV) == "1"


def register_auth_middleware(app: FastAPI) -> None:
    """Attach the fail-closed token check to the app."""

    @app.middleware("http")
    async def verify_token(request: Request, call_next):
        token = get_worker_token()
        insecure = is_insecure_mode()

        # Health endpoint must always be reachable, even when auth is
        # not configured, so process managers can monitor the worker.
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        if token is None and not insecure:
            # Fail-closed: no token configured and no explicit dev opt-in.
            return JSONResponse(
                status_code=503,
                content={"error": f"{TOKEN_ENV} not configured; worker refuses unauthenticated startup"},
            )

        if insecure:
            if token is None:
                logger.warning(
                    "AUTH DISABLED via %s=1: any local process can drive the worker — dev only",
                    INSECURE_ENV,
                )
            return await call_next(request)

        presented = request.headers.get(TOKEN_HEADER, "")
        if not presented or not hmac.compare_digest(presented, token):
            return JSONResponse(
                status_code=401,
                content={"error": "missing or invalid worker token"},
            )
        return await call_next(request)
