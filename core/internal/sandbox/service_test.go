package sandbox

import (
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

	if proc.Status != "running" {
		t.Errorf("expected status running, got %s", proc.Status)
	}

	// wait for completion
	<-proc.ctx.Done()

	if proc.Status != "completed" {
		t.Errorf("expected status completed, got %s", proc.Status)
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

	if proc.Status != "stopped" {
		t.Errorf("expected status stopped, got %s", proc.Status)
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
