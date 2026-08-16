package api

import (
	"encoding/json"
	"os"
	"testing"
)

// TestOpenAPISpecInSync 保证 testdata/openapi.json 与代码路由表一致（P5）。
// 新增/修改路由导致本测试失败时，运行：
//
//	go run ./cmd/openapi-gen > internal/api/testdata/openapi.json
//
// 重新生成并连同路由改动一并提交——spec 是前后端共同引用的单一事实源，
// 不允许只改代码不改 spec（doc/15 §2.4）。
func TestOpenAPISpecInSync(t *testing.T) {
	spec := BuildEndpointSpec()
	got, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		t.Fatalf("marshal generated spec: %v", err)
	}
	want, err := os.ReadFile("testdata/openapi.json")
	if err != nil {
		t.Fatalf("读取 testdata/openapi.json 失败（首次生成请运行 go run ./cmd/openapi-gen > internal/api/testdata/openapi.json）: %v", err)
	}
	if string(got)+"\n" != string(want) {
		t.Errorf("openapi.json 与代码路由表不一致。\n生成值:\n%s\n请运行: go run ./cmd/openapi-gen > internal/api/testdata/openapi.json", string(got))
	}
}

// TestBuildEndpointSpecShape 冒烟：非空、/health 存在、典型保护路由带全部方法。
func TestBuildEndpointSpecShape(t *testing.T) {
	spec := BuildEndpointSpec()
	if len(spec.Paths) == 0 {
		t.Fatal("spec.paths 为空")
	}
	if _, ok := spec.Paths["/health"]["get"]; !ok {
		t.Error("缺少 GET /health")
	}
	ops, ok := spec.Paths["/api/teams/:id/members/:userid"]
	if !ok {
		t.Fatal("缺少 /api/teams/:id/members/:userid")
	}
	for _, m := range []string{"patch", "delete"} {
		if _, ok := ops[m]; !ok {
			t.Errorf("/api/teams/:id/members/:userid 缺少 %s", m)
		}
	}
}
