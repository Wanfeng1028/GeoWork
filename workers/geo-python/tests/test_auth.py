"""Auth middleware tests (doc/22 BP4 / F6).

The worker previously served GEE/GDAL tools to ANY local process with no
authentication; these tests pin the fail-closed token contract.

Note: the middleware reads GEOWORK_WORKER_TOKEN per REQUEST (so operators
can rotate it), so the environment must stay patched for the duration of
each request — not just at import time.
"""

from __future__ import annotations

import os
from unittest import mock

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _env(token: str | None, insecure: str | None = None) -> dict[str, str]:
    return {
        "GEOWORK_WORKER_TOKEN": token or "",
        "GEOWORK_INSECURE_NO_AUTH": insecure or "",
    }


def test_missing_token_env_fails_closed():
    with mock.patch.dict(os.environ, _env(None)):
        resp = client.post("/tools/gee/check-auth", json={"taskId": "t1"})
    assert resp.status_code == 503


def test_no_header_401():
    with mock.patch.dict(os.environ, _env("secret-token")):
        resp = client.post("/tools/gee/check-auth", json={"taskId": "t1"})
    assert resp.status_code == 401


def test_wrong_token_401():
    with mock.patch.dict(os.environ, _env("secret-token")):
        resp = client.post(
            "/tools/gee/check-auth",
            json={"taskId": "t1"},
            headers={"X-GeoWork-Token": "wrong"},
        )
    assert resp.status_code == 401


def test_correct_token_passes_auth_layer():
    with mock.patch.dict(os.environ, _env("secret-token")):
        resp = client.post(
            "/tools/gee/check-auth",
            json={"taskId": "t1"},
            headers={"X-GeoWork-Token": "secret-token"},
        )
    # Auth layer passed; whatever status remains was decided by the route
    # itself (200/422/…), not by auth (401/503).
    assert resp.status_code != 401
    assert resp.status_code != 503


def test_insecure_mode_bypass():
    with mock.patch.dict(os.environ, _env(None, insecure="1")):
        resp = client.post("/tools/gee/check-auth", json={"taskId": "t1"})
    assert resp.status_code != 401
    assert resp.status_code != 503


def test_health_exempt():
    with mock.patch.dict(os.environ, _env("secret-token")):
        resp = client.get("/health")
    assert resp.status_code in (200, 404)


def test_health_open_when_auth_unconfigured():
    # Process managers (and the CI smoke contract) must be able to reach
    # /health even when GEOWORK_WORKER_TOKEN is unset — the fail-closed
    # 503 applies to tool endpoints only.
    with mock.patch.dict(os.environ, _env(None)):
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
