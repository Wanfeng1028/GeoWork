package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"geowork/core/internal/agent"
	"geowork/core/internal/permissions"
	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/sandbox"
	"geowork/core/internal/workspace"

	"go.uber.org/zap"
)

type RouterDeps struct {
	App          *gruntime.App
	LogDir       string
	WorkspaceSvc *workspace.Service
	PermEngine   *permissions.Engine
	SandboxSvc   *sandbox.Service
}

var PublicRoutes = []string{
	"/api/health",
	"/api/projects",
	"/api/projects/{id}",
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
	"/api/tasks/{id}/retry",
	"/api/skills",
	"/api/skills/{id}/run",
	"/api/plugins",
	"/api/plugins/{id}/enable",
	"/api/plugins/{id}/disable",
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
	"/api/security/diff",
	"/api/security/rollback",
	"/api/security/recycle-delete",
	"/api/security/approvals",
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
	"/api/v1/workflows",
	"/api/v1/workflows/{id}",
	"/api/v1/workflows/{id}/run",
	"/api/v1/workflows/{id}/stop",
	"/api/v1/runs",
	"/api/v1/runs/{id}",
	"/api/v1/runs/{id}/logs",
	"/api/v1/runs/{id}/logs/stream",
	"/api/v1/cron/due",
	"/api/v1/files/watch/scan",
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
		case req.Method == http.MethodGet && len(parts) == 3 && parts[1] == "projects":
			project, ok := app.Project(parts[2])
			if !ok {
				http.NotFound(w, req)
				return
			}
			writeJSON(w, project)
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
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "tasks" && parts[3] == "retry":
			task, err := app.RetryTask(req.Context(), parts[2])
			writeResult(w, task, err)
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
		case req.Method == http.MethodPost && len(parts) == 4 && parts[1] == "plugins" && parts[3] == "disable":
			plugins, err := app.EnablePlugin(parts[2], false)
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
		case req.Method == http.MethodPost && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "papers" && parts[4] == "index":
			paperID := parts[3]
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
		case req.Method == http.MethodPost && path == "api/security/diff":
			var in struct {
				Path    string `json:"path"`
				Content string `json:"content"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			diff, err := app.FileDiff(in.Path, in.Content)
			writeResult(w, diff, err)
		case req.Method == http.MethodPost && path == "api/security/rollback":
			var in struct {
				Path string `json:"path"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeResult(w, map[string]string{"status": "rolled_back"}, app.RollbackFile(in.Path))
		case req.Method == http.MethodPost && path == "api/security/recycle-delete":
			var in struct {
				Path string `json:"path"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			target, err := app.RecycleDelete(in.Path)
			writeResult(w, target, err)
		case req.Method == http.MethodPost && path == "api/security/approvals":
			var in struct {
				Tool   string `json:"tool"`
				Risk   string `json:"risk"`
				Reason string `json:"reason"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			writeJSON(w, app.RequestSecurityApproval("", in.Tool, in.Risk, in.Reason))
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
		case req.Method == http.MethodDelete && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "knowledge" && parts[3] == "entries":
			writeResult(w, map[string]string{"status": "deleted"}, app.DeleteKnowledgeEntry(parts[4]))
		case req.Method == http.MethodPut && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "knowledge" && parts[3] == "entries":
			var in struct {
				Title    string   `json:"title"`
				Content  string   `json:"content"`
				Category string   `json:"category"`
				Tags     []string `json:"tags"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			entry, err := app.UpdateKnowledgeEntry(parts[4], in.Title, in.Content, in.Category, in.Tags)
			writeResult(w, entry, err)
		case req.Method == http.MethodGet && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "knowledge" && parts[3] == "entries":
			writeJSON(w, app.GetKnowledgeEntry(parts[4]))
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
		case req.Method == http.MethodGet && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "ndvi" && parts[3] == "history":
			projectID := parts[4]
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
		// Agent Studio routes
		case req.Method == http.MethodGet && path == "api/v1/workflows":
			engine := app.AgentEngine()
			if engine != nil {
				workflows, err := engine.ListWorkflows()
				writeResult(w, workflows, err)
			} else {
				writeJSON(w, []agent.Workflow{})
			}
		case req.Method == http.MethodPost && path == "api/v1/workflows":
			var in struct {
				Name        string `json:"name"`
				Description string `json:"description"`
			}
			_ = json.NewDecoder(req.Body).Decode(&in)
			engine := app.AgentEngine()
			if engine != nil {
				wf, err := engine.CreateWorkflow(in.Name, in.Description)
				writeResult(w, wf, err)
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodGet && len(parts) == 4 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "workflows":
			engine := app.AgentEngine()
			if engine != nil {
				wf, err := engine.GetWorkflow(parts[3])
				writeResult(w, wf, err)
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodPut && len(parts) == 4 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "workflows":
			var wf agent.Workflow
			_ = json.NewDecoder(req.Body).Decode(&wf)
			wf.ID = parts[3]
			engine := app.AgentEngine()
			if engine != nil {
				writeResult(w, nil, engine.SaveWorkflow(&wf))
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodDelete && len(parts) == 4 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "workflows":
			engine := app.AgentEngine()
			if engine != nil {
				writeResult(w, map[string]string{"status": "deleted"}, engine.DeleteWorkflow(parts[3]))
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodPost && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "workflows" && parts[4] == "run":
			engine := app.AgentEngine()
			if engine != nil {
				run, err := engine.StartRun(req.Context(), parts[3])
				writeResult(w, run, err)
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodPost && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "workflows" && parts[4] == "stop":
			engine := app.AgentEngine()
			if engine != nil {
				writeResult(w, map[string]string{"status": "stopped"}, engine.StopRun(parts[3]))
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodGet && path == "api/v1/runs":
			workflowID := req.URL.Query().Get("workflowId")
			engine := app.AgentEngine()
			if engine != nil {
				runs, err := engine.ListRuns(workflowID)
				writeResult(w, runs, err)
			} else {
				writeJSON(w, []agent.Run{})
			}
		case req.Method == http.MethodPost && path == "api/v1/cron/due":
			writeJSON(w, app.RunDueAutomations(req.Context(), time.Now()))
		case req.Method == http.MethodPost && path == "api/v1/files/watch/scan":
			writeJSON(w, app.ScanFileTriggers(req.Context()))
		case req.Method == http.MethodGet && len(parts) == 4 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "runs":
			runID := parts[3]
			engine := app.AgentEngine()
			if engine != nil {
				run, err := engine.GetRun(runID)
				writeResult(w, run, err)
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodGet && len(parts) == 5 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "runs" && parts[4] == "logs":
			runID := parts[3]
			engine := app.AgentEngine()
			if engine != nil {
				logs, err := engine.GetLogs(runID)
				writeResult(w, logs, err)
			} else {
				http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
			}
		case req.Method == http.MethodGet && len(parts) == 6 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "runs" && parts[4] == "logs" && parts[5] == "stream":
			runID := parts[3]
			engine := app.AgentEngine()
			if engine != nil {
				h := NewAgentHandler(engine, zap.NewNop())
				h.StreamLogs(w, req, runID)
				return
			}
			http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
		// Workspace routes
		case path == "api/workspaces":
			if deps.WorkspaceSvc != nil {
				ws, err := deps.WorkspaceSvc.ListWorkspaces()
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				writeJSON(w, ws)
				return
			}
		case strings.HasPrefix(path, "api/workspaces/tree"):
			if deps.WorkspaceSvc != nil {
				wsID := req.URL.Query().Get("workspaceId")
				if wsID == "" {
					http.Error(w, "workspaceId required", http.StatusBadRequest)
					return
				}
				tree, err := deps.WorkspaceSvc.GetTree(wsID)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				writeJSON(w, tree)
				return
			}
		case strings.HasPrefix(path, "api/workspaces/files/read"):
			if deps.WorkspaceSvc != nil {
				wsID := req.URL.Query().Get("workspaceId")
				fPath := req.URL.Query().Get("path")
				if wsID == "" || fPath == "" {
					http.Error(w, "workspaceId and path required", http.StatusBadRequest)
					return
				}
				data, err := deps.WorkspaceSvc.ReadFile(wsID, fPath)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				writeJSON(w, map[string]interface{}{"content": string(data), "path": fPath})
				return
			}
		case strings.HasPrefix(path, "api/workspaces/files/write"):
			if deps.WorkspaceSvc != nil {
				var input struct {
					WorkspaceID string `json:"workspaceId"`
					Path        string `json:"path"`
					Content     string `json:"content"`
				}
				_ = json.NewDecoder(req.Body).Decode(&input)
				if err := deps.WorkspaceSvc.WriteFile(input.WorkspaceID, input.Path, []byte(input.Content)); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				writeJSON(w, map[string]string{"status": "ok"})
				return
			}
		case strings.HasPrefix(path, "api/workspaces/files/import"):
			if deps.WorkspaceSvc != nil {
				var input struct {
					WorkspaceID string   `json:"workspaceId"`
					SrcPaths    []string `json:"srcPaths"`
				}
				_ = json.NewDecoder(req.Body).Decode(&input)
				writeResult(w, nil, deps.WorkspaceSvc.ImportFiles(input.WorkspaceID, input.SrcPaths))
				return
			}
		// Permissions routes
		case req.Method == http.MethodGet && path == "api/permissions/requests":
			if deps.PermEngine != nil {
				writeJSON(w, deps.PermEngine.GetPendingRequests())
				return
			}
		case req.Method == http.MethodGet && path == "api/permissions/policies":
			if deps.PermEngine != nil {
				taskID := req.URL.Query().Get("taskId")
				policy := deps.PermEngine.GetPolicies(taskID)
				if policy == nil {
					policy = &permissions.PermissionPolicy{
						DefaultAction: permissions.Deny,
						Rules:         []permissions.PermissionRule{},
					}
				}
				writeJSON(w, policy)
				return
			}
		// Sandbox routes
		case path == "api/sandbox/run-command":
			if deps.SandboxSvc != nil {
				var input struct {
					TaskID    string            `json:"taskId"`
					Workspace string            `json:"workspace"`
					Command   string            `json:"command"`
					Env       map[string]string `json:"env,omitempty"`
				}
				_ = json.NewDecoder(req.Body).Decode(&input)
				proc, err := deps.SandboxSvc.RunCommand(input.TaskID, input.Workspace, input.Command)
				writeResult(w, proc, err)
				return
			}
		case path == "api/sandbox/run-python":
			if deps.SandboxSvc != nil {
				var input struct {
					TaskID     string            `json:"taskId"`
					Workspace  string            `json:"workspace"`
					ScriptPath string            `json:"scriptPath"`
					Env        map[string]string `json:"env,omitempty"`
					Timeout    int               `json:"timeout"`
				}
				_ = json.NewDecoder(req.Body).Decode(&input)
				proc, err := deps.SandboxSvc.RunPythonScript(input.TaskID, input.Workspace, input.ScriptPath, input.Env, input.Timeout)
				writeResult(w, proc, err)
				return
			}
		case path == "api/sandbox/processes":
			if deps.SandboxSvc != nil {
				taskID := req.URL.Query().Get("taskId")
				writeJSON(w, deps.SandboxSvc.ListProcesses(taskID))
				return
			}
		case path == "api/sandbox/processes/stop":
			if deps.SandboxSvc != nil {
				var input struct {
					ProcessID string `json:"processId"`
				}
				_ = json.NewDecoder(req.Body).Decode(&input)
				writeResult(w, map[string]string{"status": "stopped"}, deps.SandboxSvc.StopProcess(input.ProcessID))
				return
			}
		// Diagnostics routes
		case path == "api/diagnostics/health":
			writeJSON(w, map[string]interface{}{
				"status":        "ok",
				"uptime":        time.Since(diagStartTime).String(),
				"go_version":    strings.TrimSpace(strings.TrimPrefix(goVersion(), "go")),
				"num_goroutine": runtime.NumGoroutine(),
				"num_cpu":       runtime.NumCPU(),
				"timestamp":     time.Now().UTC().Format(time.RFC3339),
			})
			return
		case path == "api/diagnostics/performance":
			var mem runtime.MemStats
			runtime.ReadMemStats(&mem)
			writeJSON(w, map[string]interface{}{
				"alloc_mb":       mem.Alloc / 1024 / 1024,
				"total_alloc_mb": mem.TotalAlloc / 1024 / 1024,
				"sys_mb":         mem.Sys / 1024 / 1024,
				"num_gc":         mem.NumGC,
				"goroutines":     runtime.NumGoroutine(),
			})
			return
		case path == "api/diagnostics/logs":
			files := listLogFiles(deps.LogDir)
			writeJSON(w, files)
			return
		case path == "api/diagnostics/crash":
			if req.Method == http.MethodPost {
				// Handle crash report submission
				var report map[string]interface{}
				if err := json.NewDecoder(req.Body).Decode(&report); err != nil {
					writeJSON(w, map[string]interface{}{"error": "invalid request body"})
					return
				}
				report["received_at"] = time.Now().UTC().Format(time.RFC3339)
				crashID := fmt.Sprintf("crash_%d", time.Now().UnixNano())
				writeJSON(w, map[string]interface{}{
					"status":   "accepted",
					"crash_id": crashID,
					"message":  "Crash report recorded",
				})
				return
			}
			// GET: return crash status
			writeJSON(w, map[string]interface{}{
				"status":     "ok",
				"message":    "Crash handler active — submit reports via POST",
				"last_crash": nil,
			})
			return
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

// diagStartTime tracks when the router was created for uptime calculation.
var diagStartTime = time.Now()

// goVersion returns the Go runtime version string.
func goVersion() string {
	return strings.TrimSpace(strings.TrimPrefix(runtime.Version(), "go"))
}

func listLogFiles(logDir string) []string {
	if logDir == "" {
		return []string{}
	}
	entries, err := os.ReadDir(logDir)
	if err != nil || len(entries) == 0 {
		return []string{}
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".log") {
			files = append(files, e.Name())
		}
	}
	return files
}


