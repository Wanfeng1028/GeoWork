package api

import (
	"encoding/json"
	"net/http"
	"strings"

	gruntime "geowork/core/internal/runtime"
)

type RouterDeps struct {
	App *gruntime.App
}

var PublicRoutes = []string{
	"/api/health",
	"/api/projects",
	"/api/projects/{id}/files",
	"/api/projects/{id}/delivery",
	"/api/deliveries",
	"/api/artifacts",
	"/api/tasks",
	"/api/tasks/{id}",
	"/api/tasks/{id}/events",
	"/api/tasks/{id}/run",
	"/api/tasks/{id}/pause",
	"/api/tasks/{id}/cancel",
	"/api/skills",
	"/api/skills/{id}/run",
	"/api/plugins",
	"/api/plugins/{id}/enable",
	"/api/models",
	"/api/models/test",
	"/api/usage/summary",
	"/api/usage/records",
	"/api/settings",
	"/api/environment/checks",
	"/api/worker/geo/check",
	"/api/datasets",
	"/api/map/layers",
	"/api/map/layers/{id}",
	"/api/automations",
	"/api/automations/{id}/trigger",
	"/api/automation-runs",
	"/api/experts",
	"/api/papers",
	"/api/knowledge",
	"/api/security/decisions",
	"/api/security/decisions/{id}",
	"/api/tools",
	"/api/eino/schema",
	"/api/mcp",
	"/api/v1/files/{id}",
	"/api/v1/files/{id}/folder",
	"/api/v1/files/{id}/upload",
	"/api/v1/files/{id}/{node_id}",
	"/api/v1/files/{id}/{node_id}/rename",
	"/api/v1/ndvi/analyze",
	"/api/v1/ndvi/history/{id}",
	"/api/v1/papers/search",
	"/api/v1/papers/{id}/index",
	"/api/v1/knowledge/categories",
	"/api/v1/knowledge/entries",
	"/api/v1/knowledge/entries/{id}",
}

func NewRouter(deps RouterDeps) http.Handler {
	return cors(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		app := deps.App
		path := strings.Trim(req.URL.Path, "/")
		parts := []string{}
		if path != "" {
			parts = strings.Split(path, "/")
		}
		if len(parts) < 2 || parts[0] != "api" {
			http.NotFound(w, req)
			return
		}

		switch {
		case req.Method == http.MethodGet && path == "api/health":
			writeJSON(w, app.Health(req.Context()))
		case req.Method == http.MethodGet && path == "api/projects":
			writeJSON(w, app.Projects())
		case req.Method == http.MethodPost && path == "api/projects":
			var in struct {
				Name string `json:"name"`
				Mode string `json:"mode"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			project, err := app.CreateProject(in.Name, in.Mode)
			writeResult(w, project, err)
		case req.Method == http.MethodGet && len(parts) == 4 && parts[1] == "projects" && parts[3] == "files":
			files, err := app.ProjectFiles(parts[2])
			writeResult(w, files, err)
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "projects" && parts[3] == "delivery":
			delivery, err := app.CreateDelivery(parts[2])
			writeResult(w, delivery, err)
		case req.Method == http.MethodGet && path == "api/deliveries":
			writeJSON(w, app.Deliveries())
		case req.Method == http.MethodGet && path == "api/artifacts":
			writeJSON(w, app.AllArtifacts())
		case req.Method == http.MethodGet && path == "api/tasks":
			writeJSON(w, app.Tasks())
		case req.Method == http.MethodPost && path == "api/tasks":
			var in struct {
				ProjectID string `json:"projectId"`
				Prompt    string `json:"prompt"`
				Mode      string `json:"mode"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			task, err := app.CreateTask(in.ProjectID, in.Prompt, in.Mode)
			writeResult(w, task, err)
		case req.Method == http.MethodGet && len(parts) == 3 && parts[1] == "tasks":
			if task, ok := app.Task(parts[2]); ok {
				writeJSON(w, task)
				return
			}
			http.NotFound(w, req)
		case req.Method == http.MethodGet && len(parts) == 4 && parts[1] == "tasks" && parts[3] == "events":
			if strings.Contains(req.Header.Get("Accept"), "text/event-stream") {
				app.StreamEvents(w, req, parts[2])
				return
			}
			writeJSON(w, app.Events(parts[2]))
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "tasks" && parts[3] == "run":
			task, err := app.RunTask(req.Context(), parts[2])
			writeResult(w, task, err)
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "tasks" && parts[3] == "pause":
			writeResult(w, map[string]string{"status": "paused"}, app.PauseTask(parts[2]))
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "tasks" && parts[3] == "cancel":
			writeResult(w, map[string]string{"status": "cancelled"}, app.CancelTask(parts[2]))
		case req.Method == http.MethodGet && path == "api/skills":
			writeJSON(w, app.Skills())
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "skills" && parts[3] == "run":
			task, err := app.CreateTask("", "运行 "+parts[2]+" Skill 并生成成果", "Analysis")
			if err == nil {
				task, err = app.RunTask(req.Context(), task.ID)
			}
			writeResult(w, task, err)
		case req.Method == http.MethodGet && path == "api/plugins":
			writeJSON(w, app.Plugins())
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "plugins" && parts[3] == "enable":
			var in struct {
				Enabled bool `json:"enabled"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			plugins, err := app.EnablePlugin(parts[2], in.Enabled)
			writeResult(w, plugins, err)
		case req.Method == http.MethodGet && path == "api/models":
			writeJSON(w, app.Models())
		case req.Method == http.MethodPost && path == "api/models":
			var in gruntime.ModelConfig
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeJSON(w, app.SaveModel(in))
		case req.Method == http.MethodPost && path == "api/models/test":
			var in gruntime.ModelConfig
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeJSON(w, app.TestModel(in))
		case req.Method == http.MethodGet && path == "api/usage/summary":
			writeJSON(w, app.Usage())
		case req.Method == http.MethodGet && path == "api/usage/records":
			writeJSON(w, app.UsageRecords())
		case req.Method == http.MethodGet && path == "api/settings":
			writeJSON(w, app.Settings())
		case req.Method == http.MethodPost && path == "api/settings":
			var in gruntime.SettingsState
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeJSON(w, app.UpdateSettings(in))
		case req.Method == http.MethodGet && path == "api/environment/checks":
			writeJSON(w, app.EnvironmentChecks())
		case req.Method == http.MethodGet && path == "api/worker/geo/check":
			writeJSON(w, app.Health(req.Context())["worker"])
		case req.Method == http.MethodGet && path == "api/datasets":
			writeJSON(w, app.Datasets())
		case req.Method == http.MethodPost && path == "api/datasets":
			var in struct {
				ProjectID string `json:"projectId"`
				Name      string `json:"name"`
				Type      string `json:"type"`
				Path      string `json:"path"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			dataset, err := app.RegisterDataset(in.ProjectID, in.Name, in.Type, in.Path)
			writeResult(w, dataset, err)
		case req.Method == http.MethodGet && path == "api/map/layers":
			writeJSON(w, app.Layers())
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "map" && parts[2] == "layers":
			var in struct {
				Visible bool    `json:"visible"`
				Opacity float64 `json:"opacity"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			layer, err := app.UpdateLayer(parts[3], in.Visible, in.Opacity)
			writeResult(w, layer, err)
		case req.Method == http.MethodGet && path == "api/automations":
			writeJSON(w, app.Automations())
		case req.Method == http.MethodPost && path == "api/automations":
			var in gruntime.Automation
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeJSON(w, app.CreateAutomation(in))
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "automations" && parts[3] == "trigger":
			run, err := app.TriggerAutomation(req.Context(), parts[2])
			writeResult(w, run, err)
		case req.Method == http.MethodGet && path == "api/automation-runs":
			writeJSON(w, app.AutomationRuns())
		case req.Method == http.MethodGet && path == "api/experts":
			writeJSON(w, app.Experts())
		case req.Method == http.MethodGet && path == "api/papers":
			writeJSON(w, app.SearchPapers(req.URL.Query().Get("q")))
		// Paper search v1 routes (full-featured with advanced filters)
		case req.Method == http.MethodPost && path == "api/v1/papers/search":
			var in struct {
				Query    string `json:"query"`
				Author   string `json:"author,omitempty"`
				YearFrom *int   `json:"yearFrom,omitempty"`
				YearTo   *int   `json:"yearTo,omitempty"`
				Topic    string `json:"topic,omitempty"`
				Page     int    `json:"page"`
				PageSize int    `json:"pageSize"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			if in.Page <= 0 {
				in.Page = 1
			}
			if in.PageSize <= 0 {
				in.PageSize = 20
			}
			workerPayload := map[string]any{
				"query":     in.Query,
				"author":    in.Author,
				"page":      in.Page,
				"page_size": in.PageSize,
			}
			if in.YearFrom != nil {
				workerPayload["year_from"] = *in.YearFrom
			}
			if in.YearTo != nil {
				workerPayload["year_to"] = *in.YearTo
			}
			if in.Topic != "" {
				workerPayload["topic"] = in.Topic
			}
			result, err := app.WorkerClient().SearchOpenAlex(req.Context(), workerPayload)
			writeResult(w, result, err)
		case req.Method == http.MethodPost && len(parts) == 5 && parts[1] == "api" && parts[2] == "v1" && parts[3] == "papers" && parts[4] == "index":
			paperID := parts[4]
			if paperID == "" {
				http.Error(w, `{"error":"paper_id is required"}`, http.StatusBadRequest)
				return
			}
			workerPayload := map[string]any{"paper_id": paperID}
			result, err := app.WorkerClient().IndexKnowledge(req.Context(), workerPayload)
			writeResult(w, result, err)
		case req.Method == http.MethodGet && path == "api/knowledge":
			writeJSON(w, app.Knowledge())
		case req.Method == http.MethodPost && path == "api/knowledge":
			var in struct {
				Title string `json:"title"`
				Type  string `json:"type"`
				Path  string `json:"path"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeJSON(w, app.IndexKnowledge(in.Title, in.Type, in.Path))
		case req.Method == http.MethodGet && path == "api/security/decisions":
			writeJSON(w, app.SecurityDecisions())
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "security" && parts[2] == "decisions":
			var in struct {
				Decision string `json:"decision"`
				Reason   string `json:"reason"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			decision, err := app.ResolveSecurityDecision(parts[3], in.Decision, in.Reason)
			writeResult(w, decision, err)
		case req.Method == http.MethodGet && path == "api/tools":
			writeJSON(w, app.ToolCatalog())
		case req.Method == http.MethodGet && path == "api/eino/schema":
			writeJSON(w, app.EinoSchema())
		case req.Method == http.MethodGet && path == "api/mcp":
			writeJSON(w, app.MCPConnectors())
		// Knowledge base routes (v1)
		case req.Method == http.MethodGet && path == "api/v1/knowledge/categories":
			writeJSON(w, app.KnowledgeCategories())
		case req.Method == http.MethodGet && path == "api/v1/knowledge/entries":
			categoryID := req.URL.Query().Get("categoryId")
			query := req.URL.Query().Get("q")
			writeJSON(w, app.KnowledgeEntries(categoryID, query))
		case req.Method == http.MethodPost && path == "api/v1/knowledge/categories":
			var in struct {
				Name     string `json:"name"`
				ParentID string `json:"parentId,omitempty"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			cat, err := app.CreateKnowledgeCategory(in.Name, in.ParentID)
			writeResult(w, cat, err)
		case req.Method == http.MethodPost && path == "api/v1/knowledge/index":
			var in struct {
				PaperID string   `json:"paperId"`
				Title   string   `json:"title"`
				Content string   `json:"content"`
				Tags    []string `json:"tags"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeResult(w, nil, app.IndexKnowledgeEntry(in.PaperID, in.Title, in.Content, in.Tags))
		case req.Method == http.MethodPost && path == "api/v1/knowledge/import":
			var in struct {
				FilePath   string `json:"filePath"`
				Title      string `json:"title"`
				Content    string `json:"content"`
				Source     string `json:"source"`
				CategoryID string `json:"categoryId,omitempty"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeResult(w, nil, app.ImportKnowledgeFile(in.FilePath, in.Title, in.Content, in.Source, in.CategoryID))
		case req.Method == http.MethodDelete && len(parts) == 6 && parts[1] == "api" && parts[2] == "v1" && parts[3] == "knowledge" && parts[4] == "entries":
			writeResult(w, nil, app.DeleteKnowledgeEntry(parts[5]))
		case req.Method == http.MethodGet && len(parts) == 6 && parts[1] == "api" && parts[2] == "v1" && parts[3] == "knowledge" && parts[4] == "entries":
			writeJSON(w, app.GetKnowledgeEntry(parts[5]))
		// NDVI analysis routes
		case req.Method == http.MethodPost && path == "api/v1/ndvi/analyze":
			var in struct {
				ProjectID  string `json:"projectId"`
				DataSource string `json:"dataSource"`
				Bands      struct {
					Red string `json:"red"`
					NIR string `json:"nir"`
				} `json:"bands"`
				Thresholds struct {
					Min float64 `json:"min"`
					Max float64 `json:"max"`
				} `json:"thresholds"`
				Workspace string `json:"workspace"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			workerPayload := map[string]any{
				"project_id":  in.ProjectID,
				"data_source": in.DataSource,
				"red_band":    in.Bands.Red,
				"nir_band":    in.Bands.NIR,
				"min_value":   in.Thresholds.Min,
				"max_value":   in.Thresholds.Max,
				"workspace":   in.Workspace,
			}
			result, err := app.WorkerClient().GenerateNDVI(req.Context(), workerPayload)
			writeResult(w, result, err)
		case req.Method == http.MethodGet && len(parts) == 6 && parts[1] == "api" && parts[2] == "v1" && parts[3] == "ndvi" && parts[4] == "history":
			projectID := parts[5]
			if projectID == "" {
				http.Error(w, `{"error":"project_id is required"}`, http.StatusBadRequest)
				return
			}
			workerURL := app.WorkerClient().BaseURL + "/ndvi/history/" + projectID
			workerReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, workerURL, nil)
			if err != nil {
				http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
				return
			}
			workerResp, err := app.WorkerClient().HTTP.Do(workerReq)
			if err != nil {
				http.Error(w, `{"error":"NDVI history failed: `+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			defer workerResp.Body.Close()
			if workerResp.StatusCode >= 400 {
				http.Error(w, `{"error":"NDVI history worker error"}`, http.StatusInternalServerError)
				return
			}
			var workerResult map[string]any
			_ = json.NewDecoder(workerResp.Body).Decode(&workerResult)
			writeJSON(w, workerResult)
		default:
			http.NotFound(w, req)
		}
	}))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeResult(w http.ResponseWriter, value any, err error) {
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, value)
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}
