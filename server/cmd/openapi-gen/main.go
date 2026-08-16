// openapi-gen 导出 server 的 OpenAPI 端点集到 stdout（P5 单一事实源）。
//
// 用法：
//
//	go run ./cmd/openapi-gen > internal/api/testdata/openapi.json
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"server/internal/api"
)

func main() {
	spec := api.BuildEndpointSpec()
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(spec); err != nil {
		fmt.Fprintln(os.Stderr, "encode failed:", err)
		os.Exit(1)
	}
}
