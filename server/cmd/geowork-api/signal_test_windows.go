//go:build windows

package main

import "errors"

// sendInterrupt 在 Windows 上不可用（syscall.Kill 不存在），
// 优雅停机测试由 CI 的 ubuntu runner 覆盖。
func sendInterrupt() error {
	return errors.New("sending SIGINT is not supported on windows")
}
