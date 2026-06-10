# GeoWork Python Worker - Scripts API
# Sandbox script runner for agent tasks

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import os
import sys
import json
import tempfile
import traceback
from typing import Optional, Dict, List

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


class ScriptRunRequest(BaseModel):
    script_path: Optional[str] = None
    inline_code: Optional[str] = None
    workspace_id: Optional[str] = None
    env: Optional[Dict[str, str]] = {}
    timeout: int = 300
    working_dir: Optional[str] = None


class ScriptResult(BaseModel):
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    artifacts: List[Dict] = []
    duration_ms: int = 0


@router.post("/run")
async def run_script(req: ScriptRunRequest):
    """Run a Python script in sandbox. Must be called via Go Core, not directly from renderer."""
    import time
    start = time.time()

    result = ScriptResult()

    try:
        # Determine working directory
        work_dir = req.working_dir or os.getcwd()
        if req.workspace_id:
            work_dir = os.path.join(work_dir, "workspaces", req.workspace_id)

        # Prepare script content
        script_content = ""
        if req.inline_code:
            script_content = req.inline_code
        elif req.script_path:
            script_path = os.path.join(work_dir, req.script_path)
            if not os.path.exists(script_path):
                raise HTTPException(status_code=404, detail=f"Script not found: {req.script_path}")
            with open(script_path, "r", encoding="utf-8") as f:
                script_content = f.read()
        else:
            raise HTTPException(status_code=400, detail="No script provided")

        # Create temporary file for execution
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tmp:
            tmp.write(script_content)
            tmp_path = tmp.name

        try:
            # Prepare environment
            env = os.environ.copy()
            if req.env:
                env.update(req.env)

            # Execute script
            process = subprocess.run(
                [sys.executable, tmp_path],
                cwd=work_dir,
                env=env,
                capture_output=True,
                text=True,
                timeout=req.timeout
            )

            result.stdout = process.stdout
            result.stderr = process.stderr
            result.exit_code = process.returncode

            # Scan for generated artifacts (common geo formats)
            result.artifacts = scan_artifacts(work_dir)

        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except subprocess.TimeoutExpired:
        result.stderr = f"Script timed out after {req.timeout}s"
        result.exit_code = -1
    except Exception as e:
        result.stderr = f"Error: {str(e)}\n{traceback.format_exc()}"
        result.exit_code = -1

    result.duration_ms = int((time.time() - start) * 1000)
    return result


def scan_artifacts(work_dir: str) -> List[Dict]:
    """Scan workspace for generated artifacts."""
    extensions = {
        ".tif": "raster", ".tiff": "raster", ".geojson": "vector",
        ".shp": "vector", ".csv": "data", ".png": "image",
        ".jpg": "image", ".pdf": "document", ".html": "map",
        ".mml": "map", ".qgz": "project", ".prj": "project"
    }

    artifacts = []
    for root, _, files in os.walk(work_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in extensions:
                full_path = os.path.join(root, f)
                artifacts.append({
                    "name": f,
                    "path": os.path.relpath(full_path, work_dir),
                    "type": extensions[ext],
                    "size": os.path.getsize(full_path)
                })

    return artifacts
