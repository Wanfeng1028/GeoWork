# GeoWork Python Worker - Sandbox Runner
# Executes Python code with sandboxing constraints

import os
import sys
import subprocess
import json
import tempfile
import time
from typing import Dict, Optional, List


class SandboxError(Exception):
    """Sandbox execution error."""
    pass


class SandboxRunner:
    """Sandbox runner for Python scripts with policy enforcement."""

    def __init__(self, policy: Optional[Dict] = None):
        self.policy = policy or {
            "allowed_paths": [],
            "blocked_cmds": ["rm", "sudo", "mkfs", "fdisk", "dd"],
            "network_access": False,
            "timeout": 300,
            "max_memory_mb": 512,
            "env_whitelist": ["PATH", "HOME", "LANG", "PYTHONPATH"],
        }

    def run_command(self, command: str, workspace: str, task_id: str = "") -> Dict:
        """Run a shell command in sandbox."""
        if self._is_blocked(command):
            raise SandboxError(f"Command blocked by sandbox policy: {command}")

        if not self._is_path_allowed(workspace):
            raise SandboxError(f"Workspace path not allowed: {workspace}")

        timeout = self.policy.get("timeout", 300)
        start = time.time()

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=workspace,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
                "duration_ms": int((time.time() - start) * 1000),
                "status": "completed" if result.returncode == 0 else "failed",
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "exit_code": -1,
                "duration_ms": int((time.time() - start) * 1000),
                "status": "timeout",
            }

    def run_python(self, script_path: str, workspace: str, env: Optional[Dict] = None,
                   timeout: Optional[int] = None) -> Dict:
        """Run a Python script in sandbox."""
        timeout = timeout or self.policy.get("timeout", 300)
        start = time.time()

        script_full = os.path.join(workspace, script_path) if not os.path.isabs(script_path) else script_path
        if not os.path.exists(script_full):
            raise SandboxError(f"Script not found: {script_path}")

        # Prepare environment
        os_env = os.environ.copy()
        whitelist = self.policy.get("env_whitelist", [])
        if env:
            for k, v in env.items():
                if k in whitelist:
                    os_env[k] = v

        try:
            result = subprocess.run(
                [sys.executable, script_full],
                cwd=workspace,
                env=os_env,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
                "duration_ms": int((time.time() - start) * 1000),
                "status": "completed" if result.returncode == 0 else "failed",
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"Script timed out after {timeout}s",
                "exit_code": -1,
                "duration_ms": int((time.time() - start) * 1000),
                "status": "timeout",
            }

    def _is_blocked(self, command: str) -> bool:
        """Check if command is blocked by policy."""
        blocked = self.policy.get("blocked_cmds", [])
        for cmd in blocked:
            if cmd in command.split():
                return True
        return False

    def _is_path_allowed(self, path: str) -> bool:
        """Check if path is allowed by policy."""
        allowed = self.policy.get("allowed_paths", [])
        if not allowed:
            return True  # No restrictions
        for ap in allowed:
            if path == ap or path.startswith(ap + os.sep):
                return True
        return False


# Singleton instance
_runner = None


def get_runner(policy: Optional[Dict] = None) -> SandboxRunner:
    global _runner
    if _runner is None:
        _runner = SandboxRunner(policy)
    return _runner
