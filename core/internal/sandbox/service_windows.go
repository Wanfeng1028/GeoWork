//go:build windows

package sandbox

import (
	"os/exec"
	"syscall"
)

func setSysProcAttr(cmd *exec.Cmd) {
	// Windows doesn't support Setpgid. The process-tree kill comes from
	// the Job Object assigned in Spawn (doc/25 W1), not from SysProcAttr.
	// W2 will set SysProcAttr.Token here for the low-integrity token.
	cmd.SysProcAttr = &syscall.SysProcAttr{}
}

// captureTreeID is a no-op on Windows: the Job Object's
// JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE kills every assigned process when
// Spawn's cleanup closes the job handle — including grandchildren. If
// the job was unavailable (degraded path), exec.CommandContext already
// killed the direct child on ctx cancel; grandchildren escaping in that
// mode is the documented honest limitation.
func captureTreeID(cmd *exec.Cmd) int { return 0 }

func killTree(treeID int) {}
