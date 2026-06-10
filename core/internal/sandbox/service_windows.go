//go:build windows

package sandbox

import (
	"os/exec"
	"syscall"
)

func setSysProcAttr(cmd *exec.Cmd) {
	// Windows doesn't support Setpgid
	cmd.SysProcAttr = &syscall.SysProcAttr{}
}
