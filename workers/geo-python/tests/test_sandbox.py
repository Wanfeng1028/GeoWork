"""Tests for SandboxRunner in app/sandbox/runner.py."""

import os
import sys
import tempfile
import threading
from unittest.mock import patch

import pytest

from app.sandbox.runner import SandboxError, SandboxRunner, _lock, get_runner


@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset the global singleton between tests."""
    import app.sandbox.runner as mod
    mod._runner = None
    yield
    mod._runner = None


# ---------------------------------------------------------------------------
# Command blocking tests
# ---------------------------------------------------------------------------


class TestCommandBlocking:
    """Test that dangerous commands are blocked."""

    def test_rm_blocked(self):
        runner = SandboxRunner()
        assert runner._is_blocked("rm -rf /")

    def test_sudo_blocked(self):
        runner = SandboxRunner()
        assert runner._is_blocked("sudo apt install foo")

    def test_dd_blocked(self):
        runner = SandboxRunner()
        assert runner._is_blocked("dd if=/dev/zero of=/dev/sda")

    def test_safe_command_allowed(self):
        runner = SandboxRunner()
        assert not runner._is_blocked("echo hello")
        assert not runner._is_blocked("python script.py")
        assert not runner._is_blocked("ls -la")

    def test_custom_blocked_cmds(self):
        runner = SandboxRunner(policy={"blocked_cmds": ["curl", "wget"]})
        assert runner._is_blocked("curl http://evil.com")
        assert runner._is_blocked("wget http://evil.com")
        assert not runner._is_blocked("echo hello")

    def test_run_command_raises_on_blocked(self):
        runner = SandboxRunner()
        with pytest.raises(SandboxError, match="blocked"):
            runner.run_command("rm -rf /", workspace=tempfile.gettempdir())


# ---------------------------------------------------------------------------
# Path validation tests
# ---------------------------------------------------------------------------


class TestPathValidation:
    """Test workspace path restrictions."""

    def test_no_restrictions_when_empty(self):
        runner = SandboxRunner(policy={"allowed_paths": []})
        assert runner._is_path_allowed("/any/path")
        assert runner._is_path_allowed("/tmp")

    def test_exact_match_allowed(self):
        runner = SandboxRunner(policy={"allowed_paths": ["/workspace"]})
        assert runner._is_path_allowed("/workspace")

    def test_subpath_allowed(self):
        runner = SandboxRunner(policy={"allowed_paths": ["/workspace"]})
        # Use os.sep-aware path to work on both Windows and POSIX
        subpath = "/workspace" + os.sep + "subdir"
        assert runner._is_path_allowed(subpath)

    def test_outside_path_rejected(self):
        runner = SandboxRunner(policy={"allowed_paths": ["/workspace"]})
        assert not runner._is_path_allowed("/etc/passwd")
        assert not runner._is_path_allowed("/workspace_other")

    def test_run_command_raises_on_bad_path(self):
        runner = SandboxRunner(policy={"allowed_paths": ["/allowed"]})
        with pytest.raises(SandboxError, match="not allowed"):
            runner.run_command("echo hi", workspace="/forbidden")


# ---------------------------------------------------------------------------
# Singleton / thread-safety tests
# ---------------------------------------------------------------------------


class TestSingleton:
    """Test get_runner singleton behaviour."""

    def test_returns_same_instance(self):
        r1 = get_runner()
        r2 = get_runner()
        assert r1 is r2

    def test_custom_policy_applied(self):
        policy = {"blocked_cmds": ["evil"], "allowed_paths": [], "timeout": 60}
        runner = get_runner(policy=policy)
        assert runner.policy["blocked_cmds"] == ["evil"]
        assert runner.policy["timeout"] == 60

    def test_thread_safety(self):
        """Multiple threads should all get the same runner instance."""
        results = []

        def _get():
            results.append(get_runner())

        threads = [threading.Thread(target=_get) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(results) == 10
        assert all(r is results[0] for r in results)


# ---------------------------------------------------------------------------
# Timeout tests
# ---------------------------------------------------------------------------


class TestTimeout:
    """Test timeout handling."""

    def test_run_command_timeout(self):
        runner = SandboxRunner(policy={"timeout": 1, "blocked_cmds": [], "allowed_paths": []})
        result = runner.run_command(
            "python -c \"import time; time.sleep(5)\"",
            workspace=tempfile.gettempdir(),
        )
        assert result["status"] == "timeout"
        assert result["exit_code"] == -1
        assert "timed out" in result["stderr"].lower()

    def test_default_timeout_from_policy(self):
        runner = SandboxRunner(policy={"timeout": 42})
        assert runner.policy["timeout"] == 42


# ---------------------------------------------------------------------------
# run_command / run_python basic tests
# ---------------------------------------------------------------------------


class TestRunCommand:
    """Test basic run_command functionality."""

    def test_echo_command(self):
        runner = SandboxRunner()
        result = runner.run_command("echo hello", workspace=tempfile.gettempdir())
        assert result["status"] == "completed"
        assert result["exit_code"] == 0
        assert "hello" in result["stdout"]

    def test_failing_command(self):
        runner = SandboxRunner()
        result = runner.run_command("python -c \"exit(1)\"", workspace=tempfile.gettempdir())
        assert result["status"] == "failed"
        assert result["exit_code"] == 1

    def test_duration_ms_recorded(self):
        runner = SandboxRunner()
        result = runner.run_command("echo hi", workspace=tempfile.gettempdir())
        assert "duration_ms" in result
        assert result["duration_ms"] >= 0


class TestRunPython:
    """Test basic run_python functionality."""

    def test_script_not_found(self):
        runner = SandboxRunner()
        with pytest.raises(SandboxError, match="not found"):
            runner.run_python("nonexistent.py", workspace=tempfile.gettempdir())

    def test_run_simple_script(self):
        runner = SandboxRunner()
        with tempfile.TemporaryDirectory() as tmpdir:
            script = os.path.join(tmpdir, "hello.py")
            with open(script, "w") as f:
                f.write("print('sandbox works')\n")

            result = runner.run_python("hello.py", workspace=tmpdir)
            assert result["status"] == "completed"
            assert "sandbox works" in result["stdout"]

    def test_run_failing_script(self):
        runner = SandboxRunner()
        with tempfile.TemporaryDirectory() as tmpdir:
            script = os.path.join(tmpdir, "fail.py")
            with open(script, "w") as f:
                f.write("import sys; sys.exit(2)\n")

            result = runner.run_python(script, workspace=tmpdir)
            assert result["status"] == "failed"
            assert result["exit_code"] == 2

    def test_run_python_timeout(self):
        runner = SandboxRunner(policy={"timeout": 1, "blocked_cmds": [], "allowed_paths": []})
        with tempfile.TemporaryDirectory() as tmpdir:
            script = os.path.join(tmpdir, "sleep.py")
            with open(script, "w") as f:
                f.write("import time; time.sleep(10)\n")

            result = runner.run_python(script, workspace=tmpdir, timeout=1)
            assert result["status"] == "timeout"
