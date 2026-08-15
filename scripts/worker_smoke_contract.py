#!/usr/bin/env python
"""Worker smoke contract check.

Boots the geo-python worker as a real uvicorn process, then exercises it over
real HTTP and asserts the *response schema* (field names and types) of the
health endpoint and one core tool endpoint. This is a lightweight contract
guard: any change that breaks the process startup or the inter-process JSON
contract fails fast, without needing the full GIS system stack.

Scope (P0): worker side only. The core<->worker full-chain smoke is deferred to
P1. Assertions pin response schema fields, not status-code menus, so they stay
meaningful rather than degenerating into "accept anything" checks.

Usage:
    py scripts/worker_smoke_contract.py
Exit code 0 on success, non-zero on any contract violation.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKER_DIR = REPO_ROOT / "workers" / "geo-python"
HOST = "127.0.0.1"
PORT = 8799  # dedicated port so we never collide with a dev worker on 8766
BASE = f"http://{HOST}:{PORT}"
STARTUP_TIMEOUT_S = 30


def _free_port_available() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, PORT)) != 0


def _get_json(path: str, timeout: float = 10.0):
    with urllib.request.urlopen(BASE + path, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _post_json(path: str, payload: dict, timeout: float = 20.0):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _wait_for_health(proc: subprocess.Popen) -> dict:
    deadline = time.time() + STARTUP_TIMEOUT_S
    last_err = None
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"worker exited early with code {proc.returncode}")
        try:
            return _get_json("/health", timeout=2.0)
        except (urllib.error.URLError, ConnectionError, OSError) as exc:
            last_err = exc
            time.sleep(0.5)
    raise RuntimeError(f"worker did not become healthy in {STARTUP_TIMEOUT_S}s: {last_err}")


def _require(cond: bool, message: str) -> None:
    if not cond:
        raise AssertionError(message)


def check_health_contract(health: dict) -> None:
    _require(isinstance(health, dict), "health response must be a JSON object")
    _require(health.get("status") == "ok", f"health.status must be 'ok', got {health.get('status')!r}")
    _require("service" in health, "health response must include 'service'")
    caps = health.get("capabilities")
    _require(isinstance(caps, list) and len(caps) > 0, "health.capabilities must be a non-empty list")
    print(f"  [ok] /health schema valid (service={health['service']}, {len(caps)} capabilities)")


def check_tool_contract(workspace: str) -> None:
    # generate-ndvi-script is dependency-free (writes script + manifest + map html),
    # so it exercises the real tool pipeline without the GIS system stack.
    body = _post_json(
        "/tools/gee/generate-ndvi-script",
        {"workspace": workspace, "taskId": "smoke_contract", "prompt": "NDVI"},
    )
    _require(isinstance(body, dict), "tool response must be a JSON object")
    _require(body.get("ok") is True, f"tool response ok must be true, got {body.get('ok')!r}: {body.get('message')}")
    _require("message" in body, "tool response must include 'message'")

    artifacts = body.get("artifacts")
    _require(isinstance(artifacts, list) and len(artifacts) > 0, "tool response must include non-empty 'artifacts'")
    for art in artifacts:
        for field in ("name", "path", "type", "mimeType"):
            _require(field in art, f"artifact missing required field {field!r}: {art}")
    print(f"  [ok] tool response schema valid ({len(artifacts)} artifacts)")

    # Contract: every declared artifact must actually exist on disk.
    for art in artifacts:
        _require(Path(art["path"]).exists(), f"declared artifact not on disk: {art['path']}")
    print("  [ok] all declared artifacts exist on disk")


def main() -> int:
    if not _free_port_available():
        print(f"ERROR: port {PORT} already in use; aborting to avoid hitting a live worker", file=sys.stderr)
        return 2

    env = os.environ.copy()
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", HOST, "--port", str(PORT)],
        cwd=str(WORKER_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    try:
        print(f"Waiting for worker on {BASE} ...")
        health = _wait_for_health(proc)
        check_health_contract(health)

        with tempfile.TemporaryDirectory(prefix="geowork_smoke_") as workspace:
            check_tool_contract(workspace)

        print("WORKER SMOKE CONTRACT: PASS")
        return 0
    except AssertionError as exc:
        print(f"WORKER SMOKE CONTRACT: FAIL — {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # startup / connectivity failures
        print(f"WORKER SMOKE CONTRACT: ERROR — {exc}", file=sys.stderr)
        return 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
