// GeoWork Go Core - doc/25 W1 spawn isolation tests

package sandbox

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

// TestSpawnPlainCommand pins the baseline: a simple command runs to
// completion and cleanup is harmless when nothing is left to kill.
func TestSpawnPlainCommand(t *testing.T) {
	var name string
	var args []string
	if runtime.GOOS == "windows" {
		name, args = "cmd", []string{"/C", "echo hello"}
	} else {
		name, args = "sh", []string{"-c", "echo hello"}
	}

	var stdout, stderr bytes.Buffer
	cmd, cleanup, note, err := Spawn(SpawnConfig{
		Ctx:    context.Background(),
		Name:   name,
		Args:   args,
		Stdout: &stdout,
		Stderr: &stderr,
	}, nil)
	if err != nil {
		t.Fatalf("Spawn: %v", err)
	}
	if note != "" {
		t.Errorf("expected no degrade note for a plain command, got %q", note)
	}
	if err := cmd.Wait(); err != nil {
		t.Fatalf("Wait: %v (stderr=%s)", err, stderr.String())
	}
	cleanup()
	if got := stdout.String(); len(got) == 0 || got[:5] != "hello" {
		t.Errorf("stdout = %q, want hello", got)
	}
}

// TestSpawnKillsProcessTree pins the doc/25 W1 fix: before the job
// object / process-group wiring, canceling a sandboxed command killed
// only the direct child — grandchildren (start /b, background &) kept
// running after the timeout. The direct child stays alive (ping / wait)
// while a grandchild writes a marker file after ~2-3s; canceling at
// ~500ms must kill the whole tree, so the marker never appears.
func TestSpawnKillsProcessTree(t *testing.T) {
	dir := t.TempDir()
	marker := filepath.Join(dir, "marker.txt")

	var name string
	var args []string
	if runtime.GOOS == "windows" {
		// Grandchild: ~3s delay then writes the marker. Direct child:
		// ping keeps it alive so the cancel hits a running tree.
		name = "cmd"
		args = []string{"/C",
			`start /b cmd /C "ping -n 4 127.0.0.1 >nul & echo done > "` + marker + `"` +
				` & ping -n 30 127.0.0.1 >nul`}
	} else {
		name = "sh"
		args = []string{"-c", `(sleep 2; echo done > "` + marker + `") & wait`}
	}

	ctx, cancel := context.WithCancel(context.Background())
	var stdout, stderr bytes.Buffer
	cmd, cleanup, _, err := Spawn(SpawnConfig{
		Ctx:    ctx,
		Name:   name,
		Args:   args,
		Dir:    dir,
		Stdout: &stdout,
		Stderr: &stderr,
	}, nil)
	if err != nil {
		t.Fatalf("Spawn: %v", err)
	}
	// cleanup 幂等（spawn.go 契约），defer 作兜底；但进程树 kill 必须在
	// marker 轮询断言之前生效，所以 Wait 后还要显式调一次（见下）。
	defer cleanup()

	// Give the grandchild time to spawn, then kill the tree.
	time.Sleep(500 * time.Millisecond)
	cancel()

	_ = cmd.Wait() // killed processes return an error; outcome is irrelevant
	// 契约是 Wait→cleanup：进程树 kill（Unix kill(-PGID) / Windows job close）
	// 在 cleanup 里，不在 cancel 里——cancel（exec.CommandContext）只杀直接子进程。
	// 必须在 marker 轮询断言之前显式收树，否则孙子进程逃逸、测试必挂。
	cleanup()

	// If the grandchild survived, the marker appears ~2-3s after start.
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(marker); err == nil {
			t.Fatalf("grandchild survived the tree kill: marker file appeared")
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// TestSpawnMemoryLimit pins the Windows job object memory cap: a process
// inside a job with a 256MB per-process commit cap cannot allocate
// 512MB (the allocation fails, nonzero exit), while the same allocation
// succeeds without the cap. Requires python; skipped when absent.
func TestSpawnMemoryLimit(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("job object memory limits are Windows-only (honestly unenforced elsewhere)")
	}
	python, err := exec.LookPath("python")
	if err != nil {
		t.Skip("python not on PATH")
	}

	script := "x = bytearray(512 * 1024 * 1024); print('allocated')"

	// Control: without a cap the allocation succeeds.
	var stdout, stderr bytes.Buffer
	cmd, cleanup, _, err := Spawn(SpawnConfig{
		Ctx:    context.Background(),
		Name:   python,
		Args:   []string{"-c", script},
		Stdout: &stdout,
		Stderr: &stderr,
	}, nil)
	if err != nil {
		t.Fatalf("Spawn (no cap): %v", err)
	}
	if err := cmd.Wait(); err != nil {
		t.Skipf("control allocation failed on this machine, cannot validate cap: %v (stderr=%s)", err, stderr.String())
	}
	cleanup()
	if stdout.String() == "" || stdout.String()[:9] != "allocated" {
		t.Skipf("control did not allocate as expected (stdout=%q)", stdout.String())
	}

	// Capped: the 512MB allocation must fail under the 256MB job cap.
	stdout.Reset()
	stderr.Reset()
	cmd, cleanup, _, err = Spawn(SpawnConfig{
		Ctx:        context.Background(),
		Name:       python,
		Args:       []string{"-c", script},
		Stdout:     &stdout,
		Stderr:     &stderr,
		MemLimitMB: 256,
	}, nil)
	if err != nil {
		t.Fatalf("Spawn (capped): %v", err)
	}
	waitErr := cmd.Wait()
	cleanup()
	if waitErr == nil {
		t.Fatalf("allocation beyond the job memory cap must fail; stdout=%q", stdout.String())
	}
}

// TestSpawnLowIntegrity pins the doc/25 W2 fix: with LowIntegrity set,
// the child process runs at Low mandatory integrity level. Verified via
// `whoami /groups`, which lists the process's mandatory label. Windows
// only — the token is a Windows security mechanism.
func TestSpawnLowIntegrity(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("low-integrity tokens are Windows-only (honestly unenforced elsewhere)")
	}

	var stdout, stderr bytes.Buffer
	cmd, cleanup, note, err := Spawn(SpawnConfig{
		Ctx:          context.Background(),
		Name:         "cmd",
		Args:         []string{"/C", "whoami /groups"},
		Stdout:       &stdout,
		Stderr:       &stderr,
		LowIntegrity: true,
	}, nil)
	if err != nil {
		t.Fatalf("Spawn: %v", err)
	}
	waitErr := cmd.Wait()
	cleanup()
	if waitErr != nil {
		t.Fatalf("whoami failed: %v (stderr=%s)", waitErr, stderr.String())
	}
	if note != "" {
		t.Errorf("expected no degrade note when the token is available, got %q", note)
	}
	// The mandatory label line must report Low integrity.
	if !bytes.Contains(stdout.Bytes(), []byte("Mandatory Label\\Low")) {
		t.Errorf("child did not run at Low integrity; whoami output:\n%s", stdout.String())
	}
}
