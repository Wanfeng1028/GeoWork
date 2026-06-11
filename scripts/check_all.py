from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(name: str, command: list[str], cwd: Path = ROOT, required: bool = True) -> bool:
    print(f"\n== {name} ==")
    try:
        completed = subprocess.run(command, cwd=cwd, text=True, check=False)
    except FileNotFoundError:
        print(f"SKIP: command not found: {command[0]}")
        return not required
    if completed.returncode == 0:
        print(f"PASS: {name}")
        return True
    print(f"FAIL: {name} exited with {completed.returncode}")
    return not required


def main() -> None:
    ok = True
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    local_go = ROOT / ".tools" / "go" / "bin" / ("go.exe" if os.name == "nt" else "go")
    go = shutil.which("go") or shutil.which("go.exe") or (str(local_go) if local_go.exists() else None)
    ok &= run("static V1 coverage", ["py", "scripts/verify_v1_static.py"])
    ok &= run("V1 flow verification", ["py", "scripts/verify_v1_flows.py"])
    ok &= run("worker syntax", ["py", "-m", "py_compile", "app/main.py"], ROOT / "workers" / "geo-python")
    ok &= run("worker tests", ["py", "-m", "pytest"], ROOT / "workers" / "geo-python")

    if go:
        ok &= run("Go tests", [go, "test", "./..."], ROOT / "core")
        ok &= run("Go server build", [go, "build", "./..."], ROOT / "server")
        ok &= run("Go server tests", [go, "test", "./...", "-count=1"], ROOT / "server")
    else:
        print("\n== Go tests/build ==\nSKIP: go is not on PATH")

    if (ROOT / "node_modules").exists() and npm:
        ok &= run("frontend tests", [npm, "test"])
        ok &= run("frontend build", [npm, "run", "build"])
    elif (ROOT / "node_modules").exists() and os.name == "nt":
        ok &= run("frontend tests", ["cmd", "/c", "npm", "test"])
        ok &= run("frontend build", ["cmd", "/c", "npm", "run", "build"])
    else:
        print("\n== frontend tests/build ==\nSKIP: node_modules is missing; run npm install when registry access is available")

    if not ok:
        raise SystemExit(1)
    print("\nGeoWork available checks passed")


if __name__ == "__main__":
    main()
