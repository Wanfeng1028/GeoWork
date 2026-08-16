// Package auth — 性能基线 benchmark（P6）。
//
// bcrypt 是登录/注册路径的主导开销（成本因子固定在 hashPassword 里），
// 基线用于：升级 bcrypt 参数、更换算法或依赖版本时对比回归。
// CI 不设阈值（runner 性能波动大），跑 `go test -bench=. -run=^$` 记录对比。
package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func BenchmarkHashPassword(b *testing.B) {
	for i := 0; i < b.N; i++ {
		if _, err := hashPassword("Password123"); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkVerifyPassword(b *testing.B) {
	hash, err := hashPassword("Password123")
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !verifyPassword(hash, "Password123") {
			b.Fatal("verify failed")
		}
	}
}

func BenchmarkVerifyPasswordLegacy(b *testing.B) {
	// SHA-256 遗留分支：每个存量用户登录时都会先试 bcrypt 再落回这里，
	// 该路径退化会放大老账号的登录延迟。
	h := sha256.Sum256([]byte("Password123"))
	hash := hex.EncodeToString(h[:])
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !verifyPassword(hash, "Password123") {
			b.Fatal("verify failed")
		}
	}
}
