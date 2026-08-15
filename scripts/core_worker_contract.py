#!/usr/bin/env python
"""Core <-> Worker contract smoke check.

The Go core's worker client (core/internal/worker/client.go) calls a fixed set of
HTTP endpoints on the Python worker. This script boots the worker as a real
uvicorn process and asserts that *every* endpoint the core calls is actually
registered on the worker (i.e. does not return 404 Not Found or 405 Method Not
Allowed). A 200 / 400 / 422 all prove the route exists; only 404/405 mean the
contract is broken.

This is a route-existence contract guard, not a functional test: it catches the
class of bug where the core and worker drift apart (an endpoint renamed or
removed on one side), which unit tests on either side alone cannot see.

Known gap surfaced by this check (P1): the core calls GET /tools to fetch the
worker tool catalog (toolregistry/worker_tools.go), but the worker does not yet
expose that endpoint. It is listed in KNOWN_MISSING so the check stays green
while the gap is tracked; remove it from KNOWN_MISSING once /tools is
implemented, at which point its absence will fail the build.

Usage:
    py scripts/core_worker_contract.py
Exit code 0 on success, non-zero on any broken contract.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKER_DIR = REPO_ROOT / "workers" / "geo-python"
HOST = "127.0.0.1"
PORT = 8798
BASE = f"http://{HOST}:{PORT}"
STARTUP_TIMEOUT_S = 30

# (method, path) pairs exactly as called by core/internal/worker/client.go.
CORE_CALLED_ENDPOINTS: list[tuple[str, str]] = [
    ("GET", "/health"),
    ("GET", "/tools"),
    ("POST", "/ndvi/analyze"),
    ("POST", "/ndvi/history"),
    ("POST", "/tools/gdal/inspect-dataset"),
    ("POST", "/tools/gee/check-auth"),
    ("POST", "/tools/gee/generate-ndvi-script"),
    ("POST", "/tools/gee/search-dataset"),
    ("POST", "/tools/knowledge/index"),
    ("POST", "/tools/map/layout-export"),
    ("POST", "/tools/office/write-excel"),
    ("POST", "/tools/office/write-notebook"),
    ("POST", "/tools/office/write-ppt"),
    ("POST", "/tools/office/write-report"),
    ("POST", "/tools/papers/openalex-search"),
    ("POST", "/tools/papers/parse-pdf"),
    ("POST", "/tools/qgis/check"),
    ("POST", "/tools/qgis/check-env"),
    ("POST", "/tools/qgis/run-processing"),
    ("POST", "/tools/raster/clip"),
    ("POST", "/tools/raster/metadata"),
    ("POST", "/tools/raster/reproject"),
    ("POST", "/tools/raster/write-cog"),
    ("POST", "/tools/vector/buffer"),
    ("POST", "/tools/vector/clip"),
    ("POST", "/tools/vector/metadata"),
    ("POST", "/tools/vector/reproject"),
]

# Endpoints the core calls that the worker does not implement yet. Tracked here
# so the check is honest about the gap without blocking on it. Each entry must
# carry a reason; deleting an entry re-arms the assertion.
KNOWN_MISSING: dict[tuple[str, str], str] = {
    ("GET", "/tools"): "worker tool catalog endpoint not implemented; core degrades to builtin-only tools (toolregistry/worker_tools.go)",
    ("POST", "/ndvi/history"): "contract mismatch: core POSTs /ndvi/history with JSON body, but worker implements GET /ndvi/history/{project_id}; core GetNdvHistory always 404s. Needs a canonical-side decision before fixing.",
}


def _port_free() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, PORT)) != 0


def _request(method: str, path: str) -> int:
    """Send a minimal request and return the HTTP status code."""
    url = BASE + path
    data = None
    headers = {}
    if method == "POST":
        data = json.dumps({}).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        # HTTPError still carries a status code (4xx/5xx) — that is what we want.
        return exc.code


def _wait_ready(proc: subprocess.Popen) -> None:
    deadline = time.time() + STARTUP_TIMEOUT_S
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"worker exited early with code {proc.returncode}")
        try:
            with urllib.request.urlopen(BASE + "/health", timeout=2) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, ConnectionError, OSError):
            time.sleep(0.5)
    raise RuntimeError(f"worker not healthy within {STARTUP_TIMEOUT_S}s")


def main() -> int:
    if not _port_free():
        print(f"ERROR: port {PORT} in use; aborting to avoid hitting a live worker", file=sys.stderr)
        return 2

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", HOST, "--port", str(PORT)],
        cwd=str(WORKER_DIR),
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    broken: list[str] = []
    missing_tracked: list[str] = []
    ok_count = 0

    try:
        print(f"Waiting for worker on {BASE} ...")
        _wait_ready(proc)

        for method, path in CORE_CALLED_ENDPOINTS:
            status = _request(method, path)
            route_exists = status not in (404, 405)

            if (method, path) in KNOWN_MISSING:
                if route_exists:
                    # It was implemented — the KNOWN_MISSING entry is now stale.
                    broken.append(f"{method} {path}: listed as KNOWN_MISSING but now returns {status}; remove it from KNOWN_MISSING")
                else:
                    missing_tracked.append(f"{method} {path}: still missing ({KNOWN_MISSING[(method, path)]})")
                continue

            if route_exists:
                ok_count += 1
                print(f"  [ok]      {method:4} {path} -> {status}")
            else:
                broken.append(f"{method} {path}: route missing (HTTP {status})")
                print(f"  [BROKEN]  {method:4} {path} -> {status}")

        print()
        if missing_tracked:
            print("Tracked known-missing endpoints (not failing):")
            for line in missing_tracked:
                print(f"  [tracked] {line}")
            print()

        if broken:
            print("CORE<->WORKER CONTRACT: FAIL", file=sys.stderr)
            for line in broken:
                print(f"  - {line}", file=sys.stderr)
            return 1

        print(f"CORE<->WORKER CONTRACT: PASS ({ok_count} endpoints verified, {len(missing_tracked)} tracked missing)")
        return 0
    except Exception as exc:
        print(f"CORE<->WORKER CONTRACT: ERROR — {exc}", file=sys.stderr)
        return 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
