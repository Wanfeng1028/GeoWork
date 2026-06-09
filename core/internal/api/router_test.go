package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	gruntime "geowork/core/internal/runtime"
)

func TestRouterV1Endpoints(t *testing.T) {
	app := gruntime.New(t.TempDir(), "http://127.0.0.1:1")
	router := NewRouter(RouterDeps{App: app})

	projectID := postJSON(t, router, "/api/projects", `{"name":"Router Project","mode":"Research"}`, "id")
	taskID := postJSON(t, router, "/api/tasks", `{"projectId":"`+projectID+`","prompt":"论文 NDVI 综述","mode":"Research"}`, "id")

	for _, path := range []string{
		"/api/health",
		"/api/projects",
		"/api/projects/" + projectID + "/files",
		"/api/tasks",
		"/api/tasks/" + taskID,
		"/api/tasks/" + taskID + "/events",
		"/api/skills",
		"/api/plugins",
		"/api/models",
		"/api/usage/summary",
		"/api/usage/records",
		"/api/settings",
		"/api/automations",
		"/api/automation-runs",
		"/api/experts",
		"/api/papers?q=ndvi",
		"/api/knowledge",
		"/api/security/decisions",
		"/api/tools",
		"/api/eino/schema",
		"/api/mcp",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s returned %d: %s", path, rec.Code, rec.Body.String())
		}
	}
}

func postJSON(t *testing.T, router http.Handler, path string, body string, contains string) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s returned %d: %s", path, rec.Code, rec.Body.String())
	}
	text := rec.Body.String()
	idx := strings.Index(text, `"`+contains+`":"`)
	if idx < 0 {
		t.Fatalf("missing %s in %s", contains, text)
	}
	start := idx + len(contains) + 4
	end := strings.Index(text[start:], `"`)
	if end < 0 {
		t.Fatalf("malformed id in %s", text)
	}
	return text[start : start+end]
}
