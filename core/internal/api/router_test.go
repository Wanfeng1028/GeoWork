package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	gruntime "geowork/core/internal/runtime"
)

func TestRouterV1Endpoints(t *testing.T) {
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"ok":true,"message":"worker accepted request","artifacts":[]}`)
	}))
	defer worker.Close()

	app := gruntime.New(t.TempDir(), worker.URL)
	router := NewRouter(RouterDeps{App: app})

	projectID := postJSON(t, router, "/api/projects", `{"name":"Router Project","mode":"Research"}`, "id")
	taskID := postJSON(t, router, "/api/tasks", `{"projectId":"`+projectID+`","prompt":"论文 NDVI 综述","mode":"Research"}`, "id")

	for _, path := range []string{
		"/api/health",
		"/api/projects",
		"/api/projects/" + projectID,
		"/api/projects/" + projectID + "/files",
		"/api/tasks",
		"/api/tasks/" + taskID,
		"/api/tasks/" + taskID + "/events",
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

	postOK(t, router, "/api/tasks/"+taskID+"/retry", `{}`)

	plugins := app.Plugins()
	if len(plugins) == 0 {
		t.Fatal("expected plugins to be loaded")
	}
	postOK(t, router, "/api/plugins/"+plugins[0].ID+"/disable", `{}`)

	tracked := filepath.Join(app.Workspace(), "tracked.txt")
	if err := os.WriteFile(tracked, []byte("before\n"), 0644); err != nil {
		t.Fatal(err)
	}
	postOK(t, router, "/api/security/diff", `{"path":`+strconv.Quote(tracked)+`,"content":"after\n"}`)
	if err := os.WriteFile(tracked, []byte("after\n"), 0644); err != nil {
		t.Fatal(err)
	}
	postOK(t, router, "/api/security/rollback", `{"path":`+strconv.Quote(tracked)+`}`)
	rolledBack, err := os.ReadFile(tracked)
	if err != nil {
		t.Fatal(err)
	}
	if string(rolledBack) != "before\n" {
		t.Fatalf("rollback did not restore content: %q", string(rolledBack))
	}

	deleteTarget := filepath.Join(app.Workspace(), "delete-me.txt")
	if err := os.WriteFile(deleteTarget, []byte("remove"), 0644); err != nil {
		t.Fatal(err)
	}
	postOK(t, router, "/api/security/recycle-delete", `{"path":`+strconv.Quote(deleteTarget)+`}`)
	if _, err := os.Stat(deleteTarget); !os.IsNotExist(err) {
		t.Fatalf("expected recycle delete to move original file, stat err=%v", err)
	}

	postOK(t, router, "/api/security/approvals", `{"tool":"shell.exec","risk":"high","reason":"approval chain"}`)
	postOK(t, router, "/api/automations", `{"name":"Nightly literature","trigger":"cron:0 9 * * *","target":"Research","enabled":true}`)
	postOK(t, router, "/api/v1/cron/due", `{}`)
	postOK(t, router, "/api/automations", `{"name":"Data watch","trigger":"fsnotify:data/","target":"Data","enabled":true}`)
	postOK(t, router, "/api/v1/files/watch/scan", `{}`)
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

func postOK(t *testing.T, router http.Handler, path string, body string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s returned %d: %s", path, rec.Code, rec.Body.String())
	}
}
