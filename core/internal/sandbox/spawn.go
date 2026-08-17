// GeoWork Go Core - Unified sandbox process spawn (doc/25 W1)
//
// Spawn is the single choke point for starting sandboxed child
// processes. Both execution paths go through it:
//
//   - sandbox.Service (RunCommand / RunPythonScript, the HTTP API path)
//   - toolregistry builtin tools (run_shell / run_python, the path the
//     model actually drives)
//
// Before doc/25 these two paths spawned independently, and only the
// Service path set any SysProcAttr — the builtin tools had none, so a
// timeout there killed only the direct child and grandchildren escaped.
//
// Isolation provided here:
//
//   - Windows: the child is assigned to a Job Object with
//     JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; closing the job in cleanup
//     kills the entire process tree. Optional per-process memory cap.
//   - Unix: the child gets its own process group (Setpgid); cleanup
//     kills the whole group (-PGID). Memory limits are honestly NOT
//     enforced on Unix (would need cgroups/rlimits — out of scope).
//
// Degradation is honest: if the job object cannot be created or
// assigned, a warning is logged and the process still runs — without
// the tree-kill guarantee, never silently pretending to have it.
//
// Contract: caller invokes cmd.Wait(), then cleanup(). cleanup is
// idempotent and safe to defer as a backstop.

package sandbox

import (
	"context"
	"io"
	"os/exec"

	"go.uber.org/zap"

	"geowork/core/internal/sandbox/jobobject"
)

// SpawnConfig describes the child process to start.
type SpawnConfig struct {
	Ctx    context.Context
	Name   string
	Args   []string
	Dir    string
	Env    []string // nil = inherit parent environment
	Stdout io.Writer
	Stderr io.Writer

	// MemLimitMB caps per-process committed memory on Windows (job
	// object). 0 = no cap. Ignored on Unix — honestly unenforced there.
	MemLimitMB int
}

// Spawn starts the child process under sandbox isolation and returns the
// running cmd plus a cleanup function that kills anything still alive in
// the process tree and releases the job object.
func Spawn(cfg SpawnConfig, log *zap.Logger) (*exec.Cmd, func(), error) {
	if log == nil {
		log = zap.NewNop()
	}

	cmd := exec.CommandContext(cfg.Ctx, cfg.Name, cfg.Args...)
	cmd.Dir = cfg.Dir
	cmd.Env = cfg.Env
	cmd.Stdout = cfg.Stdout
	cmd.Stderr = cfg.Stderr

	job, err := jobobject.New(cfg.MemLimitMB)
	if err != nil {
		// Honest degrade: run without tree-kill isolation rather than
		// block the tool call, but never claim isolation we don't have.
		log.Warn("sandbox: job object unavailable, process-tree isolation degraded",
			zap.Error(err))
		job = nil
	}

	setSysProcAttr(cmd)

	if err := cmd.Start(); err != nil {
		if job != nil {
			_ = job.Close()
		}
		return nil, func() {}, err
	}

	if job != nil {
		if err := job.Assign(cmd.Process); err != nil {
			log.Warn("sandbox: failed to assign process to job object, tree-kill degraded",
				zap.Int("pid", cmd.Process.Pid),
				zap.Error(err))
			_ = job.Close()
			job = nil
		}
	}

	// Unix: capture the process-group ID now (Setpgid makes the child a
	// group leader, PGID == PID). Windows: no-op, the job owns the kill.
	treeID := captureTreeID(cmd)

	cleanup := func() {
		killTree(treeID)
		if job != nil {
			_ = job.Close()
		}
	}
	return cmd, cleanup, nil
}
