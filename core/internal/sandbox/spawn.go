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
// Isolation provided here (doc/25 W3 honest list):
//
//   - process-tree kill ✅ both platforms. Windows: the child is assigned
//     to a Job Object with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; closing the
//     job in cleanup kills the entire process tree. Unix: the child gets
//     its own process group (Setpgid); cleanup kills the whole group
//     (-PGID).
//   - memory cap ✅ Windows only. MemLimitMB becomes the Job Object
//     per-process commit cap (SandboxPolicy.MaxMemoryMB is its real source
//     on the Service path). NOT enforced on Unix — would need
//     cgroups/rlimits, out of scope; honestly documented, not pretended.
//   - low-integrity write scope ✅ best-effort, Windows only (doc/25 W2).
//     Degrades honestly with a note if the token cannot be created.
//   - network isolation ❌ NOT enforced anywhere. Job Objects do not
//     control network and WFP filtering is out of scope (needs admin).
//     Callers must not assume sandboxed children are network-restricted.
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
	"geowork/core/internal/sandbox/lowintegrity"
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

	// LowIntegrity starts the child with a Low-integrity token on
	// Windows (doc/25 W2), restricting its writes to Low-IL locations.
	// Best-effort: if the token cannot be created the child still runs
	// (honest degrade) and the returned note records that isolation is
	// NOT in effect. Ignored on Unix — honestly unenforced there.
	LowIntegrity bool
}

// Spawn starts the child process under sandbox isolation and returns the
// running cmd, a cleanup function that kills anything still alive in the
// process tree and releases the job object, and a note. The note is empty
// when full isolation is in effect; otherwise it records which isolation
// degraded so callers can annotate audit trails honestly (doc/25 W2).
func Spawn(cfg SpawnConfig, log *zap.Logger) (*exec.Cmd, func(), string, error) {
	if log == nil {
		log = zap.NewNop()
	}

	cmd := exec.CommandContext(cfg.Ctx, cfg.Name, cfg.Args...)
	cmd.Dir = cfg.Dir
	cmd.Env = cfg.Env
	cmd.Stdout = cfg.Stdout
	cmd.Stderr = cfg.Stderr

	var note string

	job, err := jobobject.New(cfg.MemLimitMB)
	if err != nil {
		// Honest degrade: run without tree-kill isolation rather than
		// block the tool call, but never claim isolation we don't have.
		log.Warn("sandbox: job object unavailable, process-tree isolation degraded",
			zap.Error(err))
		job = nil
		note = "process-tree isolation not in effect: " + err.Error()
	}

	setSysProcAttr(cmd)

	// doc/25 W2: low-integrity token (Windows). Created before Start so
	// it can be set on SysProcAttr; closed right after Start because the
	// OS hands the child its own copy. On non-Windows New returns
	// (nil, nil) — not applicable, not an error.
	var token *lowintegrity.Token
	if cfg.LowIntegrity {
		token, err = lowintegrity.New()
		if err != nil {
			log.Warn("sandbox: low-integrity token unavailable, write-scope isolation degraded",
				zap.Error(err))
			token = nil
			if note != "" {
				note += "; "
			}
			note += "low-integrity isolation not in effect: " + err.Error()
		} else if token != nil {
			token.Apply(cmd)
		}
	}

	// killAll releases the whole tree: group kill (Unix) and/or job close
	// (Windows). Shared by Cancel and cleanup so both kill identically and
	// stay idempotent (captureTreeID/killTree are nil/ESRCH-safe, job.Close
	// guards its handle). It reads cmd.Process only at call time, so it is
	// safe to define before Start.
	killAll := func() {
		killTree(captureTreeID(cmd))
		if job != nil {
			_ = job.Close()
		}
	}

	// Kill the entire process tree when the context is canceled — not just
	// the direct child, which is exec.CommandContext's default. Grandchildren
	// inherit the stdout/stderr pipe write-ends and keep them open, so
	// cmd.Wait() (which waits for pipe EOF) would block until they exit on
	// their own — defeating the timeout and hanging the Service path's HTTP
	// handler. Killing the group / closing the job releases the pipes at
	// once. The trailing direct Kill is a backstop for the degraded Windows
	// path (no job object) so Cancel is never weaker than exec's default.
	//
	// MUST be set before Start: exec launches its watchCtx goroutine inside
	// Start and it reads cmd.Cancel as of that moment. The closure captures
	// only `job` (written once, before Start) and reads cmd.Process at call
	// time (set by Start before watchCtx launches), so there is no race.
	cmd.Cancel = func() error {
		killAll()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return nil
	}

	if err := cmd.Start(); err != nil {
		if token != nil {
			_ = token.Close()
		}
		if job != nil {
			_ = job.Close()
		}
		return nil, func() {}, note, err
	}

	// The child now holds its own copy of the token; release ours.
	if token != nil {
		_ = token.Close()
	}

	if job != nil {
		if err := job.Assign(cmd.Process); err != nil {
			// Degraded: the process is not in the job, so closing it won't
			// kill the tree — Cancel's direct Kill backstop covers the direct
			// child. Keep `job` non-nil (never reassigned after Start, so the
			// Cancel closure sees a stable value) so cleanup still closes the
			// handle and we don't leak it.
			log.Warn("sandbox: failed to assign process to job object, tree-kill degraded",
				zap.Int("pid", cmd.Process.Pid),
				zap.Error(err))
			if note != "" {
				note += "; "
			}
			note += "process-tree isolation not in effect: " + err.Error()
		}
	}

	cleanup := func() {
		killAll()
	}
	return cmd, cleanup, note, nil
}
