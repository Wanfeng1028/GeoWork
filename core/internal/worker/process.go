package worker

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

type Process struct {
	cmd *exec.Cmd
}

func StartProcess(ctx context.Context, repoRoot string) (*Process, error) {
	workerDir := filepath.Join(repoRoot, "workers", "geo-python")
	exe := "python"
	args := []string{"-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8766"}
	if runtime.GOOS == "windows" {
		exe = "py"
	}
	cmd := exec.CommandContext(ctx, exe, args...)
	cmd.Dir = workerDir
	cmd.Env = append(os.Environ(), "PYTHONUNBUFFERED=1")
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &Process{cmd: cmd}, nil
}

func (p *Process) Stop() {
	if p == nil || p.cmd == nil || p.cmd.Process == nil {
		return
	}
	_ = p.cmd.Process.Kill()
	done := make(chan struct{})
	go func() {
		_ = p.cmd.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
	}
}
