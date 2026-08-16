// Package rbac — 性能基线 benchmark（P6）。
//
// getAllPermissions 是每次鉴权决策（CheckPermission 与 HTTP 中间件）的
// 热路径；权限矩阵扩张或实现改动时用本基线对比回归。
package rbac

import (
	"testing"

	"server/internal/testutil"
)

func BenchmarkGetAllPermissions(b *testing.B) {
	store := testutil.NewTestStore(b)
	svc := NewService(store)
	user := testutil.SeedTestUser(b, store)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = svc.getAllPermissions(user)
	}
}

func BenchmarkCheckPermissionMatrix(b *testing.B) {
	store := testutil.NewTestStore(b)
	svc := NewService(store)
	user := testutil.SeedTestUser(b, store)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc.checkPermission(user, "billing:admin", "")
	}
}
