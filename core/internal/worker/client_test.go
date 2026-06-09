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
