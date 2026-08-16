package toolregistry

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"geowork/core/internal/worker"

	"go.uber.org/zap"
)

// fakeWorker serves the GET /tools catalog plus one dispatchable tool endpoint
// (geo.gdal.inspect_dataset -> POST /tools/gdal/inspect-dataset).
func fakeWorker(t *testing.T, catalog string, execLog *map[string]any) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /tools", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(catalog))
	})
	mux.HandleFunc("POST /tools/gdal/inspect-dataset", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if execLog != nil {
			_ = json.Unmarshal(body, execLog)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func TestRegisterWorkerTools_RegistersCatalog(t *testing.T) {
	catalog := `{"tools":[
		{"name":"geo.gdal.inspect_dataset","description":"Inspect a dataset","input_schema":{"type":"object"},"risk_level":"low"},
		{"name":"research.openalex.search","description":"Search papers","input_schema":{"type":"object"},"risk_level":""}
	]}`
	server := fakeWorker(t, catalog, nil)

	r := NewRegistry(zap.NewNop())
	client := worker.NewClient(server.URL)
	if err := RegisterWorkerTools(context.Background(), r, client, zap.NewNop()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	tool, ok := r.Get("geo.gdal.inspect_dataset")
	if !ok {
		t.Fatalf("expected geo.gdal.inspect_dataset to be registered")
	}
	if tool.Description() != "Inspect a dataset" {
		t.Errorf("description not mapped, got %q", tool.Description())
	}
	if tool.RiskLevel() != "low" {
		t.Errorf("risk level not mapped, got %q", tool.RiskLevel())
	}
	if tool.Permission() != "exec" {
		t.Errorf("worker tools must use exec permission, got %q", tool.Permission())
	}
	if tool.SandboxRequired() {
		t.Errorf("worker tools must not require sandbox")
	}

	// Empty risk_level must default to medium.
	paperTool, ok := r.Get("research.openalex.search")
	if !ok {
		t.Fatalf("expected research.openalex.search to be registered")
	}
	if paperTool.RiskLevel() != "medium" {
		t.Errorf("empty risk level must default to medium, got %q", paperTool.RiskLevel())
	}
}

func TestRegisterWorkerTools_SkipsEmptyAndDuplicateNames(t *testing.T) {
	catalog := `{"tools":[
		{"name":"","description":"no name","input_schema":{},"risk_level":"low"},
		{"name":"geo.gdal.inspect_dataset","description":"from worker","input_schema":{},"risk_level":"low"}
	]}`
	server := fakeWorker(t, catalog, nil)

	r := NewRegistry(zap.NewNop())
	// Pre-register a builtin with the same name; the worker entry must not replace it.
	builtin := NewBuilder("geo.gdal.inspect_dataset").Description("builtin").Build()
	if err := r.Register(builtin); err != nil {
		t.Fatalf("failed to seed builtin: %v", err)
	}

	client := worker.NewClient(server.URL)
	if err := RegisterWorkerTools(context.Background(), r, client, zap.NewNop()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	tool, ok := r.Get("geo.gdal.inspect_dataset")
	if !ok {
		t.Fatalf("expected tool to remain registered")
	}
	if tool.Description() != "builtin" {
		t.Errorf("duplicate registration must be skipped, got description %q", tool.Description())
	}
	if len(r.List()) != 1 {
		t.Errorf("expected exactly 1 registered tool, got %d", len(r.List()))
	}
}

func TestRegisterWorkerTools_ExecuteForwardsToWorker(t *testing.T) {
	catalog := `{"tools":[{"name":"geo.gdal.inspect_dataset","description":"Inspect","input_schema":{},"risk_level":"low"}]}`
	var execLog map[string]any
	server := fakeWorker(t, catalog, &execLog)

	r := NewRegistry(zap.NewNop())
	client := worker.NewClient(server.URL)
	if err := RegisterWorkerTools(context.Background(), r, client, zap.NewNop()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	tool, _ := r.Get("geo.gdal.inspect_dataset")
	result, err := tool.Execute(context.Background(), map[string]any{"workspace": "/tmp/ws", "params": map[string]any{"path": "a.tif"}})
	if err != nil {
		t.Fatalf("execute failed: %v", err)
	}
	if result["ok"] != true {
		t.Errorf("expected worker response to be forwarded, got %v", result)
	}
	if execLog["workspace"] != "/tmp/ws" {
		t.Errorf("args not forwarded to worker endpoint, got %v", execLog)
	}
}

func TestRegisterWorkerTools_CatalogFailureIsNonFatal(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)

	r := NewRegistry(zap.NewNop())
	client := worker.NewClient(server.URL)
	if err := RegisterWorkerTools(context.Background(), r, client, zap.NewNop()); err != nil {
		t.Fatalf("catalog fetch failure must be non-fatal, got: %v", err)
	}
	if len(r.List()) != 0 {
		t.Errorf("expected no tools registered after failed catalog fetch, got %d", len(r.List()))
	}
}

func TestRegisterWorkerTools_NilArguments(t *testing.T) {
	client := worker.NewClient("http://127.0.0.1:1")
	if err := RegisterWorkerTools(context.Background(), nil, client, nil); err == nil {
		t.Errorf("expected error for nil registry")
	}
	r := NewRegistry(zap.NewNop())
	if err := RegisterWorkerTools(context.Background(), r, nil, nil); err == nil {
		t.Errorf("expected error for nil worker client")
	}
}
