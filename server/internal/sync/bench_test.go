// Package sync — 性能基线 benchmark（P6）。
//
// isValidObjectType/isValidPayload 在每次 push/pull 的每条记录上执行，
// 大批量同步时是逐条开销；JSON 序列化路径一并纳入基线。
package sync

import (
	"encoding/json"
	"fmt"
	"testing"
)

func BenchmarkIsValidPayload(b *testing.B) {
	payload, _ := json.Marshal(map[string]any{
		"id":         "sync_bench_001",
		"updated_at": "2026-08-17T00:00:00Z",
		"data":       map[string]any{"key": "value"},
	})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !isValidPayload("task", string(payload)) {
			b.Fatal("payload should be valid")
		}
	}
}

func BenchmarkIsValidPayloadLarge(b *testing.B) {
	// 100 键的大 payload：模拟批量同步的单条大对象。
	data := map[string]any{"id": "sync_bench_002", "updated_at": "2026-08-17T00:00:00Z"}
	for i := 0; i < 100; i++ {
		data[fmt.Sprintf("field_%d", i)] = "value"
	}
	payload, _ := json.Marshal(data)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if !isValidPayload("task", string(payload)) {
			b.Fatal("payload should be valid")
		}
	}
}
