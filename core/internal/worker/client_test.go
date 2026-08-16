package worker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.Health(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result["status"] != "ok" {
		t.Fatalf("expected status ok, got %s", result["status"])
	}
}

func TestClientHealthError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error":"unavailable"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.Health(context.Background())
	if err == nil {
		t.Fatalf("expected error for unavailable worker")
	}
}

func TestClientGenerateNDVI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"ndvi.py","path":"workspace/scripts/ndvi.py"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.GenerateNDVI(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientWriteReport(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"report.md","path":"workspace/reports/report.md"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.WriteReport(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_2"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientInspectDataset(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"quality.json","path":"workspace/artifacts/quality.json"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.InspectDataset(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_3"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientSearchOpenAlex(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"matrix.csv","path":"workspace/knowledge/matrix.csv"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.SearchOpenAlex(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_4", "params": map[string]any{"query": "NDVI"}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientParsePDF(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"notes.md","path":"workspace/knowledge/notes.md"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.ParsePDF(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_5"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientIndexKnowledge(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"index.json","path":"workspace/knowledge/index.json"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.IndexKnowledge(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_6"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientCheckQGIS(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"artifacts":[{"name":"qgis_status.json","path":"workspace/artifacts/qgis_status.json"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	result, err := client.CheckQGIS(context.Background(), map[string]any{"workspace": "/tmp/test", "taskId": "test_7"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result["ok"].(bool) {
		t.Fatalf("expected ok true")
	}
}

func TestClientListTools(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/tools" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"tools":[{"name":"geo.gdal.inspect_dataset","description":"Inspect","input_schema":{"type":"object"},"risk_level":"low"}]}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	tools, err := client.ListTools(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(tools))
	}
	if tools[0].Name != "geo.gdal.inspect_dataset" || tools[0].RiskLevel != "low" {
		t.Errorf("WorkerToolDef fields not decoded correctly: %+v", tools[0])
	}
	if tools[0].InputSchema["type"] != "object" {
		t.Errorf("input_schema not decoded correctly: %v", tools[0].InputSchema)
	}
}

func TestClientListToolsError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	if _, err := client.ListTools(context.Background()); err == nil {
		t.Fatalf("expected error when /tools is missing")
	}
}

func TestClientListToolsUnconfigured(t *testing.T) {
	var client *Client
	if _, err := client.ListTools(context.Background()); err == nil {
		t.Fatalf("expected error for nil client")
	}
	if _, err := (&Client{}).ListTools(context.Background()); err == nil {
		t.Fatalf("expected error for empty BaseURL")
	}
}

func TestClientNdvHistory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("NdvHistory must use GET, got %s", r.Method)
		}
		if r.URL.Path != "/ndvi/history/proj-1" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[{"file":"ndvi_1.json","project_id":"proj-1","timestamp":"2026-01-01T00:00:00Z","statistics":{"mean":0.5}}]`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	history, err := client.NdvHistory(context.Background(), "proj-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 history entry, got %d", len(history))
	}
	if history[0]["project_id"] != "proj-1" {
		t.Errorf("history entry not decoded correctly: %v", history[0])
	}
}

func TestClientNdvHistoryEmptyProjectID(t *testing.T) {
	client := NewClient("http://127.0.0.1:1")
	if _, err := client.NdvHistory(context.Background(), ""); err == nil {
		t.Fatalf("expected error for empty projectID")
	}
}
