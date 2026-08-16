package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"geowork/core/internal/conversation"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/storage"
	"geowork/core/internal/tasks"

	_ "modernc.org/sqlite"
)

// TestDesktopCoreContract pins the HTTP surface the desktop renderer actually
// calls (apps/desktop/src). The renderer talks to the Go core on port 8765 via
// shared/api/client.ts; these are the exact endpoints and response envelopes it
// depends on. If a route or envelope shape changes here, the renderer breaks —
// so this test must be updated together with the frontend API layer.
func TestDesktopCoreContract(t *testing.T) {
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"ok":true}`)
	}))
	defer worker.Close()

	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if err := storage.RunMigrations(db); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	taskSvc := tasks.NewService(db)
	if err := taskSvc.Init(); err != nil {
		t.Fatalf("init task service: %v", err)
	}
	convStore := conversation.NewStore(db)

	app := gruntime.New(t.TempDir(), worker.URL)
	defer app.Close()
	router := NewRouter(RouterDeps{App: app, TaskSvc: taskSvc, ConvStore: convStore})
	defer router.Close()

	// --- /api/db/tasks CRUD (TasksPage.tsx + taskSidebarStore.ts) ---

	// POST /api/db/tasks -> 201 + task object with id.
	taskID := createAndExtractID(t, router, "/api/db/tasks", `{"workspaceId":"default","name":"Contract Task","mode":"Analysis"}`)

	// GET /api/db/tasks?workspaceId=default -> {total, tasks:[...]} envelope.
	rec := doRequest(t, router, http.MethodGet, "/api/db/tasks?workspaceId=default", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /api/db/tasks returned %d: %s", rec.Code, rec.Body.String())
	}
	var listBody struct {
		Total int `json:"total"`
		Tasks []struct {
			ID          string `json:"id"`
			WorkspaceID string `json:"workspaceId"`
			Name        string `json:"name"`
			Status      string `json:"status"`
		} `json:"tasks"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &listBody); err != nil {
		t.Fatalf("task list envelope decode failed: %v", err)
	}
	if listBody.Total < 1 || len(listBody.Tasks) < 1 {
		t.Fatalf("expected at least 1 task in list, got total=%d len=%d", listBody.Total, len(listBody.Tasks))
	}
	found := false
	for _, task := range listBody.Tasks {
		if task.ID == taskID {
			found = true
			if task.WorkspaceID != "default" || task.Name != "Contract Task" {
				t.Errorf("task fields not preserved: %+v", task)
			}
			if task.Status != "pending" {
				t.Errorf("new task must default to pending status, got %q", task.Status)
			}
		}
	}
	if !found {
		t.Fatalf("created task %s missing from list", taskID)
	}

	// PATCH /api/db/tasks/{id}/status -> updated task object.
	rec = doRequest(t, router, http.MethodPatch, "/api/db/tasks/"+taskID+"/status", `{"status":"running"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("PATCH status returned %d: %s", rec.Code, rec.Body.String())
	}
	var patched struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &patched); err != nil {
		t.Fatalf("patch response decode failed: %v", err)
	}
	if patched.ID != taskID || patched.Status != "running" {
		t.Errorf("patch did not persist status: %+v", patched)
	}

	// DELETE /api/db/tasks/{id} -> {status:"deleted"}.
	rec = doRequest(t, router, http.MethodDelete, "/api/db/tasks/"+taskID, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE task returned %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"deleted"`) {
		t.Errorf("delete response must confirm deletion, got %s", rec.Body.String())
	}

	// --- /api/conversations (NewTaskPage.tsx) ---

	// POST /api/conversations -> 201 + conversation object with id.
	convID := createAndExtractID(t, router, "/api/conversations", `{"workspaceId":"default","title":"Contract Conv","mode":"Work"}`)

	// GET /api/conversations/{id} -> conversation object.
	rec = doRequest(t, router, http.MethodGet, "/api/conversations/"+convID, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET conversation returned %d: %s", rec.Code, rec.Body.String())
	}
	var conv struct {
		ID          string `json:"id"`
		WorkspaceID string `json:"workspaceId"`
		Title       string `json:"title"`
		Mode        string `json:"mode"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &conv); err != nil {
		t.Fatalf("conversation decode failed: %v", err)
	}
	if conv.ID != convID || conv.Title != "Contract Conv" || conv.Mode != "Work" {
		t.Errorf("conversation fields mismatch: %+v", conv)
	}

	// GET /api/conversations/{id}/messages?limit=500 -> {total, messages:[...]} envelope.
	rec = doRequest(t, router, http.MethodGet, "/api/conversations/"+convID+"/messages?limit=500", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET messages returned %d: %s", rec.Code, rec.Body.String())
	}
	var msgBody struct {
		Total    int `json:"total"`
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &msgBody); err != nil {
		t.Fatalf("messages envelope decode failed: %v", err)
	}
	if msgBody.Messages == nil {
		t.Errorf("messages must be an array (possibly empty), not null")
	}
}

func doRequest(t *testing.T, router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// createAndExtractID POSTs a create request, asserts 201, and pulls "id" out of
// the JSON response.
func createAndExtractID(t *testing.T, router http.Handler, path, body string) string {
	t.Helper()
	rec := doRequest(t, router, http.MethodPost, path, body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST %s returned %d, want 201: %s", path, rec.Code, rec.Body.String())
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("POST %s response decode failed: %v", path, err)
	}
	if out.ID == "" {
		t.Fatalf("POST %s response missing id: %s", path, rec.Body.String())
	}
	return out.ID
}
