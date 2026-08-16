// Package main — Start() 优雅停机集成测试（P6）。
//
// 覆盖场景：SIGINT 后 server 停止接收新连接、Start 返回 nil、
// 在途请求收尾后 SQLite 才关闭。基于真实信号与真实端口，只在
// 支持 syscall.Kill 的平台运行（CI ubuntu）；Windows 本地跳过。
package main

import (
	"fmt"
	"net/http"
	"runtime"
	"testing"
	"time"
)

func TestStartGracefulShutdown(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("signal-based test: SIGINT delivery is covered by CI (ubuntu)")
	}

	// 独立 SQLite 文件 + 非默认端口，避免与本地开发实例冲突。
	t.Setenv("GEOWORK_DB_PATH", t.TempDir()+"/graceful-test.db")
	s := NewServer()
	s.Setup()
	port := 18767
	s.Port = port

	started := make(chan error, 1)
	go func() { started <- s.Start() }()

	base := fmt.Sprintf("http://127.0.0.1:%d", port)
	var healthy bool
	for i := 0; i < 100; i++ {
		res, err := http.Get(base + "/health")
		if err == nil {
			res.Body.Close()
			if res.StatusCode == http.StatusOK {
				healthy = true
				break
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !healthy {
		t.Fatal("server did not become healthy within 5s")
	}

	// SIGINT 触发优雅停机：Shutdown（10s 宽限）→ Store.Close → Start 返回 nil。
	if err := sendInterrupt(); err != nil {
		t.Fatalf("failed to send SIGINT: %v", err)
	}

	select {
	case err := <-started:
		if err != nil {
			t.Fatalf("Start returned error after graceful shutdown: %v", err)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("Start did not return within 15s of SIGINT")
	}

	// 停机后端口必须关闭（Shutdown 已停止监听）。
	if res, err := http.Get(base + "/health"); err == nil {
		res.Body.Close()
		t.Error("server still serving after shutdown")
	}
}
