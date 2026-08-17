package sandbox

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestIsPathAllowed_DevMode(t *testing.T) {
	svc := NewService()

	// dev mode: empty AllowedPaths should allow any workspace
	if !svc.isPathAllowed("/some/workspace") {
		t.Error("dev mode should allow any workspace when AllowedPaths is empty")
	}
	if !svc.isPathAllowed("C:\\Users\\test\\workspace") {
		t.Error("dev mode should allow Windows paths when AllowedPaths is empty")
	}
}

func TestIsPathAllowed_RestrictedMode(t *testing.T) {
	svc := NewService()
	svc.SetPolicy(&SandboxPolicy{
		AllowedPaths: []string{"/home/user/workspace"},
	})

	// exact match
	if !svc.isPathAllowed("/home/user/workspace") {
		t.Error("should allow exact match of allowed path")
	}

	// subdirectory
	if !svc.isPathAllowed("/home/user/workspace/project1") {
		t.Error("should allow subdirectory of allowed path")
	}

	// parent directory - should NOT allow
	if svc.isPathAllowed("/home/user") {
		t.Error("should not allow parent directory")
	}

	// different path - should NOT allow
	if svc.isPathAllowed("/tmp/other") {
		t.Error("should not allow different path")
	}

	// prefix attack - path that starts with allowed but has different separator
	if svc.isPathAllowed("/home/user/workspace_evil") {
		t.Error("should not allow path with same prefix but different directory")
	}
}

func TestIsBlocked(t *testing.T) {
	svc := NewService()

	// blocked commands
	blockedCmds := []string{"rm -rf /", "sudo apt-get install", "mkfs /dev/sda", "fdisk /dev/sda"}
	for _, cmd := range blockedCmds {
		if !svc.isBlocked(cmd) {
			t.Errorf("should block command: %s", cmd)
		}
	}

	// allowed commands
	allowedCmds := []string{"ls -la", "echo hello", "python script.py", "go test ./..."}
	for _, cmd := range allowedCmds {
		if svc.isBlocked(cmd) {
			t.Errorf("should not block command: %s", cmd)
		}
	}
}

func TestRunCommand_DevMode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	svc := NewService()

	var cmd string
	if runtime.GOOS == "windows" {
		cmd = "echo hello"
	} else {
		cmd = "echo hello"
	}

	proc, err := svc.RunCommand("test-task", t.TempDir(), cmd)
	if err != nil {
		t.Fatalf("RunCommand failed: %v", err)
	}

	// A fast command may finish before we get here, so accept either the
	// in-flight or the terminal state — but never a start failure.
	if st := proc.Snapshot().Status; st != "running" && st != "completed" {
		t.Errorf("expected status running or completed, got %s", st)
	}

	// wait for completion; cancel fires after the final status is written,
	// so the snapshot taken after Done() is guaranteed to be terminal.
	<-proc.ctx.Done()

	if proc.Snapshot().Status != "completed" {
		t.Errorf("expected status completed, got %s", proc.Snapshot().Status)
	}
}

func TestRunCommand_BlockedCommand(t *testing.T) {
	svc := NewService()

	_, err := svc.RunCommand("test-task", t.TempDir(), "rm -rf /")
	if err == nil {
		t.Error("should reject blocked command")
	}
}

func TestRunCommand_RestrictedPath(t *testing.T) {
	svc := NewService()
	svc.SetPolicy(&SandboxPolicy{
		AllowedPaths: []string{"/allowed/workspace"},
	})

	_, err := svc.RunCommand("test-task", "/not/allowed", "echo hello")
	if err == nil {
		t.Error("should reject workspace outside allowed paths")
	}
}

func TestStopProcess(t *testing.T) {
	svc := NewService()

	var cmd string
	if runtime.GOOS == "windows" {
		cmd = "timeout /t 10"
	} else {
		cmd = "sleep 10"
	}

	proc, err := svc.RunCommand("test-task", t.TempDir(), cmd)
	if err != nil {
		t.Fatalf("RunCommand failed: %v", err)
	}

	err = svc.StopProcess(proc.ID)
	if err != nil {
		t.Fatalf("StopProcess failed: %v", err)
	}

	if proc.Snapshot().Status != "stopped" {
		t.Errorf("expected status stopped, got %s", proc.Snapshot().Status)
	}
}

func TestListProcesses(t *testing.T) {
	svc := NewService()

	// create a few processes
	svc.RunCommand("task-1", t.TempDir(), "echo 1")
	svc.RunCommand("task-1", t.TempDir(), "echo 2")
	svc.RunCommand("task-2", t.TempDir(), "echo 3")

	procs := svc.ListProcesses("task-1")
	if len(procs) != 2 {
		t.Errorf("expected 2 processes for task-1, got %d", len(procs))
	}

	procs = svc.ListProcesses("task-2")
	if len(procs) != 1 {
		t.Errorf("expected 1 process for task-2, got %d", len(procs))
	}

	procs = svc.ListProcesses("task-3")
	if len(procs) != 0 {
		t.Errorf("expected 0 processes for task-3, got %d", len(procs))
	}
}

// TestRunPythonScript_MemoryLimitEnforced pins the doc/25 W3 fix: the
// SandboxPolicy.MaxMemoryMB field is the real source of the job-object
// memory cap (policy -> Spawn -> jobobject.New). Before W3 the field was
// dead; a script allocating beyond the cap must now fail. Windows only —
// the cap is a Job Object limit, honestly unenforced on Unix.
func TestRunPythonScript_MemoryLimitEnforced(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("job object memory limits are Windows-only (honestly unenforced elsewhere)")
	}
	if _, err := exec.LookPath("python"); err != nil {
		t.Skip("python not on PATH")
	}

	dir := t.TempDir()
	script := filepath.Join(dir, "alloc.py")
	body := "x = bytearray(512 * 1024 * 1024)\nprint('allocated')\n"
	if err := os.WriteFile(script, []byte(body), 0o644); err != nil {
		t.Fatalf("write script: %v", err)
	}

	svc := NewService()
	policy := *svc.policy // copy the default policy, then tighten the cap
	policy.MaxMemoryMB = 256
	svc.SetPolicy(&policy)

	proc, err := svc.RunPythonScript("test-task", dir, script, nil, 60)
	if err != nil {
		t.Fatalf("RunPythonScript: %v", err)
	}
	<-proc.ctx.Done()

	snap := proc.Snapshot()
	// The 512MB allocation must fail under the 256MB cap: the process exits
	// nonzero (MemoryError) rather than printing "allocated".
	if snap.Status == "completed" && snap.ExitCode != nil && *snap.ExitCode == 0 {
		t.Fatalf("allocation beyond the policy memory cap must fail; stdout=%q", snap.Stdout)
	}
}
