//go:build !windows

package sandbox

import (
	"os/exec"
	"syscall"
)

func setSysProcAttr(cmd *exec.Cmd) {
	// Own process group so killTree can signal the whole tree with one
	// kill(-PGID) — the Unix counterpart of the Windows Job Object
	// (doc/25 W1).
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// captureTreeID returns the process-group ID to kill on cleanup. With
// Setpgid the child becomes its own group leader, so PGID == child PID.
// Captured at start (not at kill time) because once Wait reaps the
// child, Getpgid(pid) fails and the group kill would silently no-op —
// exactly when backgrounded grandchildren escape.
func captureTreeID(cmd *exec.Cmd) int {
	if cmd.Process == nil {
		return 0
	}
	return cmd.Process.Pid
}

// killTree signals the captured process group. -PGID reaches every
// grandchild that didn't start its own group. ESRCH means the tree
// already exited — harmless. Without this, exec.CommandContext kills
// only the direct child and backgrounded grandchildren escape timeout.
func killTree(treeID int) {
	if treeID <= 0 {
		return
	}
	_ = syscall.Kill(-treeID, syscall.SIGKILL)
}
