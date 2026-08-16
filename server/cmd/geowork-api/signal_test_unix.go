//go:build !windows

package main

import (
	"os"
	"syscall"
)

// sendInterrupt 向测试进程发送 SIGINT，触发 Start 的优雅停机路径。
func sendInterrupt() error {
	return syscall.Kill(os.Getpid(), syscall.SIGINT)
}
