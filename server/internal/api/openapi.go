// Package api — OpenAPI 端点单一事实源（P5）。
//
// server/testdata/openapi.json 由本文件的 BuildEndpointSpec 生成
// （go run ./cmd/openapi-gen），契约上它是唯一权威的端点清单：
//   - server 侧 TestOpenAPISpecInSync 保证它与代码路由表一致；
//   - E2E 侧 api-integration.spec.ts 读取它做全端点存在性探测。
// 新增/修改路由后运行 `go run ./cmd/openapi-gen > testdata/openapi.json`
// 重新生成并一并提交。

package api

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// EndpointSpecInfo 是 OpenAPI info 对象的最小子集。
type EndpointSpecInfo struct {
	Title   string `json:"title"`
	Version string `json:"version"`
}

// Operation 是单个 (method, path) 的最小描述。OperationID 来自 gin 的
// handler 名（形如 "auth.(*Service).Login"），只作定位用，不是稳定 API。
type Operation struct {
	OperationID string `json:"operationId"`
}

// EndpointSpec 是 OpenAPI 3 的端点级子集（不含请求/响应 schema——
// 类型级生成见 doc/15 §2.4 的后续计划）。
type EndpointSpec struct {
	OpenAPI string                              `json:"openapi"`
	Info    EndpointSpecInfo                    `json:"info"`
	Paths   map[string]map[string]Operation     `json:"paths"`
}

// BuildEndpointSpec 用与生产 main.go 相同的路由注册逻辑构建完整路由表，
// 导出为端点集。注册阶段不触发任何 service 方法体，因此全部传 nil 即可。
func BuildEndpointSpec() *EndpointSpec {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	// 与 cmd/geowork-api/main.go 保持一致：/health 注册在 SetupRoutes 之前。
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	SetupRoutes(r,
		nil, // authSvc
		nil, // accountSvc
		nil, // teamSvc
		nil, // rbacSvc
		nil, // usageSvc
		nil, // billingSvc
		nil, // modelProxySvc
		nil, // syncSvc
		nil, // marketplaceSvc
		nil, // telemetrySvc
		nil, // crashSvc
		nil, // collabSvc
		nil, // channelSvc
		nil, // conversationSvc
	)

	spec := &EndpointSpec{
		OpenAPI: "3.0.3",
		Info:    EndpointSpecInfo{Title: "GeoWork Cloud API", Version: "endpoint-spec"},
		Paths:   map[string]map[string]Operation{},
	}
	for _, ri := range r.Routes() {
		if spec.Paths[ri.Path] == nil {
			spec.Paths[ri.Path] = map[string]Operation{}
		}
		spec.Paths[ri.Path][strings.ToLower(ri.Method)] = Operation{
			OperationID: operationID(ri.Handler),
		}
	}
	return spec
}

// operationID 把 gin 的 handler 全名压缩成 "包.类型.方法" 形式。
// 例："server/internal/auth.(*Service).Login-fm" → "auth.(*Service).Login"
func operationID(handler string) string {
	name := strings.TrimSuffix(handler, "-fm")
	if idx := strings.LastIndex(name, "/"); idx >= 0 {
		name = name[idx+1:]
	}
	return name
}
