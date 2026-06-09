package runtime

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProjectTaskSkillPluginUsageFlow(t *testing.T) {
	worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/health":
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		case "/tools/gee/generate-ndvi-script":
			_, _ = w.Write([]byte(`{"ok":true,"artifacts":[{"name":"ndvi.py","path":"workspace/scripts/ndvi.py","type":"script","mimeType":"text/x-python"}]}`))
		case "/tools/office/write-report":
			_, _ = w.Write([]byte(`{"ok":true,"artifacts":[{"name":"report.md","path":"workspace/reports/report.md","type":"report","mimeType":"text/markdown"}]}`))
		default:
			_, _ = w.Write([]byte(`{"ok":true}`))
		}
	}))
	defer worker.Close()

	app := New(t.TempDir(), worker.URL)
	project, err := app.CreateProject("Course NDVI", "Analysis")
	if err != nil {
		t.Fatal(err)
	}
	task, err := app.CreateTask(project.ID, "NDVI 实验报告", "Analysis")
	if err != nil {
		t.Fatal(err)
	}
	task, err = app.RunTask(context.Background(), task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if task.Status != "completed" {
		t.Fatalf("expected completed, got %s", task.Status)
	}
	if len(task.Artifacts) != 2 {
		t.Fatalf("expected two artifacts, got %d", len(task.Artifacts))
	}
	if len(app.Skills()) != 12 {
		t.Fatalf("expected 12 skills")
	}
	if _, err := app.EnablePlugin("qgis", true); err != nil {
		t.Fatal(err)
	}
	if app.Usage().Tasks != 1 {
		t.Fatalf("usage did not count task")
	}
}
