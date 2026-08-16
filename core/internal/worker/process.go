package worker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

// WorkerTokenEnv carries the runtime token from the Go core into the
// worker subprocess (doc/22 BP4 / F6). The Python side enforces it
// fail-closed (app/middleware/auth.py); the Go client sends it back as
// the X-GeoWork-Token header on every request.
const WorkerTokenEnv = "GEOWORK_WORKER_TOKEN"

type Process struct {
	cmd *exec.Cmd

	// Token is the shared secret injected into the subprocess; hand it
	// to the Client via SetToken. Empty when the parent environment
	// already provided GEOWORK_WORKER_TOKEN (a manually started worker).
	Token string
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

	// doc/22 BP4: mint a fresh token per worker launch. A pre-existing
	// env token (manual/debug runs) is reused so an operator-started
	// worker and the core client agree.
	token := os.Getenv(WorkerTokenEnv)
	if token == "" {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			return nil, err
		}
		token = hex.EncodeToString(buf)
	}
	cmd.Env = append(os.Environ(), "PYTHONUNBUFFERED=1", WorkerTokenEnv+"="+token)

	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &Process{cmd: cmd, Token: token}, nil
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
