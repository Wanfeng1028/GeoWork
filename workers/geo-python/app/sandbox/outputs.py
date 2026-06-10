# GeoWork Python Worker - Sandbox Outputs
# Handles sandbox execution output processing

import json
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


@dataclass
class SandboxOutput:
    """Structured sandbox output."""
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 0
    artifacts: List[Dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    status: str = "unknown"

    def to_dict(self) -> Dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    @classmethod
    def from_dict(cls, data: Dict) -> 'SandboxOutput':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class OutputProcessor:
    """Processes and formats sandbox output."""

    GEO_EXTENSIONS = {
        ".tif": "raster", ".tiff": "raster", ".geojson": "vector",
        ".shp": "vector", ".csv": "data", ".png": "image",
        ".jpg": "image", ".pdf": "document", ".html": "map",
        ".mml": "map", ".qgz": "project", ".prj": "project",
        ".json": "data", ".xml": "data", ".yaml": "data", ".yml": "data",
    }

    @classmethod
    def process(cls, stdout: str, stderr: str, exit_code: int,
                workspace_dir: str, duration_ms: int = 0) -> SandboxOutput:
        """Process raw output into structured format."""
        artifacts = cls._scan_artifacts(workspace_dir)
        status = "completed" if exit_code == 0 else "failed"

        return SandboxOutput(
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            artifacts=artifacts,
            duration_ms=duration_ms,
            status=status,
        )

    @classmethod
    def _scan_artifacts(cls, workspace_dir: str) -> List[Dict]:
        """Scan workspace for geo artifacts."""
        artifacts = []
        if not os.path.exists(workspace_dir):
            return artifacts

        for root, _, files in os.walk(workspace_dir):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in cls.GEO_EXTENSIONS:
                    full_path = os.path.join(root, f)
                    artifacts.append({
                        "name": f,
                        "path": os.path.relpath(full_path, workspace_dir),
                        "type": cls.GEO_EXTENSIONS[ext],
                        "size": os.path.getsize(full_path),
                    })

        return artifacts

    @classmethod
    def format_tool_log(cls, output: SandboxOutput) -> str:
        """Format output for display in tool call log."""
        lines = []
        lines.append(f"[{output.status.upper()}] Exit code: {output.exit_code}")
        lines.append(f"Duration: {output.duration_ms}ms")

        if output.stdout:
            lines.append("--- stdout ---")
            lines.append(output.stdout[:2000])  # Truncate long output

        if output.stderr:
            lines.append("--- stderr ---")
            lines.append(output.stderr[:2000])

        if output.artifacts:
            lines.append(f"\n{len(output.artifacts)} artifact(s) generated:")
            for art in output.artifacts:
                lines.append(f"  [{art['type']}] {art['name']} ({art['size']} bytes)")

        return "\n".join(lines)
