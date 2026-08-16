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
    ("GET", "/ndvi/history/test-project"),
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
KNOWN_MISSING: dict[tuple[str, str], str] = {}

# Tool names the Go core's RunTool dispatch table (client.go) can execute.
# The GET /tools catalog must be a subset of these: a catalog entry the core
# cannot dispatch would register a tool that always fails at runtime.
CORE_RUNTOOL_NAMES: set[str] = {
    "geo.gee.search_dataset",
    "geo.gee.check_auth",
    "geo.gee.generate_ndvi_script",
    "geo.ndvi.analyze",
    "geo.office.write_report",
    "geo.office.write_ppt",
    "geo.office.write_excel",
    "geo.office.write_notebook",
    "geo.gdal.inspect_dataset",
    "geo.raster.metadata",
    "geo.raster.clip",
    "geo.raster.reproject",
    "geo.raster.cog",
    "geo.vector.metadata",
    "geo.vector.buffer",
    "geo.vector.clip",
    "geo.vector.reproject",
    "research.openalex.search",
    "papers.parse_pdf",
    "knowledge.index",
    "qgis.check",
    "qgis.check_env",
    "qgis.processing.run",
    "geo.map.layout_export",
}

VALID_RISK_LEVELS = {"low", "medium", "high"}


def _fetch_json(method: str, path: str) -> tuple[int, object]:
    """Send a minimal request and return (status, parsed JSON body or None)."""
    url = BASE + path
    data = None
    headers = {}
    if method == "POST":
        data = json.dumps({}).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read()
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, None
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read()
            parsed = json.loads(body)
        except Exception:
            parsed = None
        return exc.code, parsed


def check_tools_schema() -> list[str]:
    """Schema-level assertions for GET /tools (WorkerToolDef contract)."""
    errors: list[str] = []
    status, body = _fetch_json("GET", "/tools")
    if status != 200:
        return [f"GET /tools: expected 200, got {status}"]
    if not isinstance(body, dict) or set(body.keys()) != {"tools"}:
        return ['GET /tools: response must be exactly {"tools": [...]}']
    tools = body["tools"]
    if not isinstance(tools, list) or not tools:
        return ["GET /tools: 'tools' must be a non-empty array"]

    names: set[str] = set()
    for entry in tools:
        if not isinstance(entry, dict):
            errors.append(f"GET /tools: entry is not an object: {entry!r}")
            continue
        if set(entry.keys()) != {"name", "description", "input_schema", "risk_level"}:
            errors.append(f"GET /tools: entry keys must be exactly WorkerToolDef fields, got {sorted(entry.keys())}")
            continue
        name = entry["name"]
        if not isinstance(name, str) or not name:
            errors.append(f"GET /tools: entry has invalid name: {name!r}")
            continue
        if name in names:
            errors.append(f"GET /tools: duplicate tool name {name}")
        names.add(name)
        if not isinstance(entry["description"], str) or not entry["description"]:
            errors.append(f"GET /tools: {name} has invalid description")
        if entry["risk_level"] not in VALID_RISK_LEVELS:
            errors.append(f"GET /tools: {name} has invalid risk_level {entry['risk_level']!r}")
        schema = entry["input_schema"]
        if not isinstance(schema, dict) or schema.get("type") != "object":
            errors.append(f"GET /tools: {name} input_schema must be an object schema")

    unknown = names - CORE_RUNTOOL_NAMES
    if unknown:
        errors.append(f"GET /tools: catalog names not dispatchable by core RunTool: {sorted(unknown)}")
    return errors


def check_ndvi_history_schema() -> list[str]:
    """Schema-level assertions for GET /ndvi/history/{project_id}."""
    errors: list[str] = []
    status, body = _fetch_json("GET", "/ndvi/history/test-project")
    if status != 200:
        return [f"GET /ndvi/history/{{project_id}}: expected 200, got {status}"]
    if not isinstance(body, list):
        return ["GET /ndvi/history/{project_id}: response must be a JSON array"]
    for entry in body:
        if not isinstance(entry, dict):
            errors.append(f"GET /ndvi/history: entry is not an object: {entry!r}")
            continue
        for field in ("file", "project_id", "timestamp", "statistics"):
            if field not in entry:
                errors.append(f"GET /ndvi/history: entry missing field {field!r}")
    return errors


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

        # Schema-level contract checks on top of route existence.
        print()
        print("Schema checks:")
        for label, check in (
            ("GET /tools (WorkerToolDef)", check_tools_schema),
            ("GET /ndvi/history/{id}", check_ndvi_history_schema),
        ):
            schema_errors = check()
            if schema_errors:
                broken.extend(f"{label}: {e}" for e in schema_errors)
                print(f"  [BROKEN]  {label}")
                for e in schema_errors:
                    print(f"            - {e}")
            else:
                print(f"  [ok]      {label}")

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
