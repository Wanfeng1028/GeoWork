// GeoWork Go Core - Project & Health Handler

package api

import (
	"encoding/json"
	"net/http"
	"time"

	"geowork/core/internal/agent"
	gruntime "geowork/core/internal/runtime"
	"go.uber.org/zap"
)

type projectHandler struct {
	app *gruntime.App
}

func newProjectHandler(app *gruntime.App) *projectHandler {
	return &projectHandler{app: app}
}

func (h *projectHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/projects", h.handleList)
	mux.HandleFunc("POST /api/projects", h.handleCreate)
	mux.HandleFunc("GET /api/projects/{id}", h.handleGet)
	mux.HandleFunc("GET /api/projects/{id}/files", h.handleFiles)
	mux.HandleFunc("POST /api/projects/{id}/delivery", h.handleDelivery)
}

func (h *projectHandler) handleList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Projects())
}

func (h *projectHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
		Mode string `json:"mode"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	project, err := h.app.CreateProject(in.Name, in.Mode)
	writeResult(w, project, err)
}

func (h *projectHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	project, ok := h.app.Project(id)
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, project)
}

func (h *projectHandler) handleFiles(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	files, err := h.app.ProjectFiles(id)
	writeResult(w, files, err)
}

func (h *projectHandler) handleDelivery(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	delivery, err := h.app.CreateDelivery(id)
	writeResult(w, delivery, err)
}

// healthHandler handles /api/health
type healthHandler struct {
	app *gruntime.App
}

func newHealthHandler(app *gruntime.App) *healthHandler {
	return &healthHandler{app: app}
}

func (h *healthHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", h.handleHealth)
}

func (h *healthHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Health(r.Context()))
}

// globalHandler handles routes that don't fit other categories.
type globalHandler struct {
	app *gruntime.App
}

func newGlobalHandler(app *gruntime.App) *globalHandler {
	return &globalHandler{app: app}
}

func (h *globalHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/deliveries", h.handleDeliveries)
	mux.HandleFunc("GET /api/skills", h.handleSkills)
	mux.HandleFunc("POST /api/skills/{id}/run", h.handleSkillRun)
	mux.HandleFunc("GET /api/plugins", h.handlePlugins)
	mux.HandleFunc("POST /api/plugins/{id}/enable", h.handlePluginEnable)
	mux.HandleFunc("POST /api/plugins/{id}/disable", h.handlePluginDisable)
	mux.HandleFunc("GET /api/models", h.handleModels)
	mux.HandleFunc("POST /api/models", h.handleSaveModel)
	mux.HandleFunc("POST /api/models/test", h.handleTestModel)
	mux.HandleFunc("GET /api/usage/summary", h.handleUsage)
	mux.HandleFunc("GET /api/usage/records", h.handleUsageRecords)
	mux.HandleFunc("GET /api/settings", h.handleSettings)
	mux.HandleFunc("POST /api/settings", h.handleUpdateSettings)
	mux.HandleFunc("GET /api/environment/checks", h.handleEnvChecks)
	mux.HandleFunc("GET /api/worker/geo/check", h.handleWorkerGeoCheck)
	mux.HandleFunc("GET /api/datasets", h.handleDatasets)
	mux.HandleFunc("POST /api/datasets", h.handleRegisterDataset)
	mux.HandleFunc("GET /api/map/layers", h.handleLayers)
	mux.HandleFunc("POST /api/map/layers/{id}", h.handleUpdateLayer)
	mux.HandleFunc("GET /api/automations", h.handleAutomations)
	mux.HandleFunc("POST /api/automations", h.handleCreateAutomation)
	mux.HandleFunc("POST /api/automations/{id}/trigger", h.handleTriggerAutomation)
	mux.HandleFunc("GET /api/automation-runs", h.handleAutomationRuns)
	mux.HandleFunc("GET /api/experts", h.handleExperts)
	mux.HandleFunc("GET /api/papers", h.handleSearchPapers)
	mux.HandleFunc("GET /api/knowledge", h.handleKnowledge)
	mux.HandleFunc("POST /api/knowledge", h.handleIndexKnowledge)
	mux.HandleFunc("GET /api/security/decisions", h.handleSecurityDecisions)
	mux.HandleFunc("POST /api/security/approvals", h.handleRequestApproval)
	mux.HandleFunc("POST /api/security/decisions/{id}", h.handleResolveDecision)
	mux.HandleFunc("GET /api/tools", h.handleToolCatalog)
	mux.HandleFunc("GET /api/eino/schema", h.handleEinoSchema)
	mux.HandleFunc("GET /api/mcp", h.handleMCPConnectors)
	mux.HandleFunc("POST /api/v1/cron/due", h.handleRunDueAutomations)
	mux.HandleFunc("POST /api/v1/files/watch/scan", h.handleScanFileTriggers)
}

func (h *globalHandler) handleDeliveries(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Deliveries())
}
func (h *globalHandler) handleSkills(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Skills())
}
func (h *globalHandler) handleSkillRun(w http.ResponseWriter, r *http.Request) {
	task, err := h.app.CreateTask("", "运行 "+r.PathValue("id")+" Skill 并生成成果", "Analysis")
	if err == nil {
		task, err = h.app.RunTask(r.Context(), task.ID)
	}
	writeResult(w, task, err)
}
func (h *globalHandler) handlePlugins(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Plugins())
}
func (h *globalHandler) handlePluginEnable(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled bool `json:"enabled"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	plugins, err := h.app.EnablePlugin(r.PathValue("id"), in.Enabled)
	writeResult(w, plugins, err)
}
func (h *globalHandler) handlePluginDisable(w http.ResponseWriter, r *http.Request) {
	plugins, err := h.app.EnablePlugin(r.PathValue("id"), false)
	writeResult(w, plugins, err)
}
func (h *globalHandler) handleModels(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Models())
}
func (h *globalHandler) handleSaveModel(w http.ResponseWriter, r *http.Request) {
	var in gruntime.ModelConfig
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeJSON(w, h.app.SaveModel(in))
}
func (h *globalHandler) handleTestModel(w http.ResponseWriter, r *http.Request) {
	var in gruntime.ModelConfig
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeJSON(w, h.app.TestModel(in))
}
func (h *globalHandler) handleUsage(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Usage())
}
func (h *globalHandler) handleUsageRecords(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.UsageRecords())
}
func (h *globalHandler) handleSettings(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Settings())
}
func (h *globalHandler) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var in gruntime.SettingsState
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeJSON(w, h.app.UpdateSettings(in))
}
func (h *globalHandler) handleEnvChecks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.EnvironmentChecks())
}
func (h *globalHandler) handleWorkerGeoCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Health(r.Context())["worker"])
}
func (h *globalHandler) handleDatasets(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Datasets())
}
func (h *globalHandler) handleRegisterDataset(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ProjectID string `json:"projectId"`
		Name      string `json:"name"`
		Type      string `json:"type"`
		Path      string `json:"path"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	dataset, err := h.app.RegisterDataset(in.ProjectID, in.Name, in.Type, in.Path)
	writeResult(w, dataset, err)
}
func (h *globalHandler) handleLayers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Layers())
}
func (h *globalHandler) handleUpdateLayer(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Visible bool    `json:"visible"`
		Opacity float64 `json:"opacity"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	layer, err := h.app.UpdateLayer(r.PathValue("id"), in.Visible, in.Opacity)
	writeResult(w, layer, err)
}
func (h *globalHandler) handleAutomations(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Automations())
}
func (h *globalHandler) handleCreateAutomation(w http.ResponseWriter, r *http.Request) {
	var in gruntime.Automation
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeJSON(w, h.app.CreateAutomation(in))
}
func (h *globalHandler) handleTriggerAutomation(w http.ResponseWriter, r *http.Request) {
	run, err := h.app.TriggerAutomation(r.Context(), r.PathValue("id"))
	writeResult(w, run, err)
}
func (h *globalHandler) handleAutomationRuns(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.AutomationRuns())
}
func (h *globalHandler) handleExperts(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Experts())
}
func (h *globalHandler) handleSearchPapers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.SearchPapers(r.URL.Query().Get("q")))
}
func (h *globalHandler) handleKnowledge(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Knowledge())
}
func (h *globalHandler) handleIndexKnowledge(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title string `json:"title"`
		Type  string `json:"type"`
		Path  string `json:"path"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeJSON(w, h.app.IndexKnowledge(in.Title, in.Type, in.Path))
}
func (h *globalHandler) handleSecurityDecisions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.SecurityDecisions())
}
func (h *globalHandler) handleRequestApproval(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Tool   string `json:"tool"`
		Risk   string `json:"risk"`
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeJSON(w, h.app.RequestSecurityApproval("", in.Tool, in.Risk, in.Reason))
}
func (h *globalHandler) handleResolveDecision(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Decision string `json:"decision"`
		Reason   string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	decision, err := h.app.ResolveSecurityDecision(r.PathValue("id"), in.Decision, in.Reason)
	writeResult(w, decision, err)
}
func (h *globalHandler) handleToolCatalog(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.ToolCatalog())
}
func (h *globalHandler) handleEinoSchema(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.EinoSchema())
}
func (h *globalHandler) handleMCPConnectors(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.MCPConnectors())
}
func (h *globalHandler) handleRunDueAutomations(w http.ResponseWriter, r *http.Request) {
	runs := h.app.RunDueAutomations(r.Context(), time.Now())
	writeJSON(w, runs)
}
func (h *globalHandler) handleScanFileTriggers(w http.ResponseWriter, r *http.Request) {
	runs := h.app.ScanFileTriggers(r.Context())
	writeJSON(w, runs)
}
func (h *globalHandler) handlePaperSearchV1(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Query    string `json:"query"`
		Author   string `json:"author,omitempty"`
		YearFrom *int   `json:"yearFrom,omitempty"`
		YearTo   *int   `json:"yearTo,omitempty"`
		Topic    string `json:"topic,omitempty"`
		Page     int    `json:"page"`
		PageSize int    `json:"pageSize"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
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
	result, err := h.app.WorkerClient().SearchOpenAlex(r.Context(), workerPayload)
	writeResult(w, result, err)
}
func (h *globalHandler) handlePaperIndexV1(w http.ResponseWriter, r *http.Request) {
	paperID := r.PathValue("id")
	if paperID == "" {
		http.Error(w, `{"error":"paper_id is required"}`, http.StatusBadRequest)
		return
	}
	workerPayload := map[string]any{"paper_id": paperID}
	result, err := h.app.WorkerClient().IndexKnowledge(r.Context(), workerPayload)
	writeResult(w, result, err)
}
func (h *globalHandler) handleKnowledgeCategories(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.KnowledgeCategories())
}
func (h *globalHandler) handleKnowledgeEntries(w http.ResponseWriter, r *http.Request) {
	categoryID := r.URL.Query().Get("categoryId")
	query := r.URL.Query().Get("q")
	writeJSON(w, h.app.KnowledgeEntries(categoryID, query))
}
func (h *globalHandler) handleCreateKnowledgeCategory(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId,omitempty"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	cat, err := h.app.CreateKnowledgeCategory(in.Name, in.ParentID)
	writeResult(w, cat, err)
}
func (h *globalHandler) handleIndexKnowledgeEntry(w http.ResponseWriter, r *http.Request) {
	var in struct {
		PaperID string   `json:"paperId"`
		Title   string   `json:"title"`
		Content string   `json:"content"`
		Tags    []string `json:"tags"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeResult(w, nil, h.app.IndexKnowledgeEntry(in.PaperID, in.Title, in.Content, in.Tags))
}
func (h *globalHandler) handleImportKnowledgeFile(w http.ResponseWriter, r *http.Request) {
	var in struct {
		FilePath   string `json:"filePath"`
		Title      string `json:"title"`
		Content    string `json:"content"`
		Source     string `json:"source"`
		CategoryID string `json:"categoryId,omitempty"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	writeResult(w, nil, h.app.ImportKnowledgeFile(in.FilePath, in.Title, in.Content, in.Source, in.CategoryID))
}
func (h *globalHandler) handleDeleteKnowledgeEntry(w http.ResponseWriter, r *http.Request) {
	writeResult(w, map[string]string{"status": "deleted"}, h.app.DeleteKnowledgeEntry(r.PathValue("id")))
}
func (h *globalHandler) handleUpdateKnowledgeEntry(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title    string   `json:"title"`
		Content  string   `json:"content"`
		Category string   `json:"category"`
		Tags     []string `json:"tags"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	entry, err := h.app.UpdateKnowledgeEntry(r.PathValue("id"), in.Title, in.Content, in.Category, in.Tags)
	writeResult(w, entry, err)
}
func (h *globalHandler) handleGetKnowledgeEntry(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.GetKnowledgeEntry(r.PathValue("id")))
}
func (h *globalHandler) handleNDVIAnalyze(w http.ResponseWriter, r *http.Request) {
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
	_ = json.NewDecoder(r.Body).Decode(&in)
	workerPayload := map[string]any{
		"project_id":  in.ProjectID,
		"data_source": in.DataSource,
		"red_band":    in.Bands.Red,
		"nir_band":    in.Bands.NIR,
		"min_value":   in.Thresholds.Min,
		"max_value":   in.Thresholds.Max,
		"workspace":   in.Workspace,
	}
	result, err := h.app.WorkerClient().GenerateNDVI(r.Context(), workerPayload)
	writeResult(w, result, err)
}
func (h *globalHandler) handleNDVIAHistory(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	if projectID == "" {
		http.Error(w, `{"error":"project_id is required"}`, http.StatusBadRequest)
		return
	}
	workerURL := h.app.WorkerClient().BaseURL + "/ndvi/history/" + projectID
	workerReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, workerURL, nil)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	workerResp, err := h.app.WorkerClient().HTTP.Do(workerReq)
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
}
func (h *globalHandler) handleWorkflowsList(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		workflows, err := engine.ListWorkflows()
		writeResult(w, workflows, err)
	} else {
		writeJSON(w, []agent.Workflow{})
	}
}
func (h *globalHandler) handleWorkflowsCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	engine := h.app.AgentEngine()
	if engine != nil {
		wf, err := engine.CreateWorkflow(in.Name, in.Description)
		writeResult(w, wf, err)
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleWorkflowsGet(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		wf, err := engine.GetWorkflow(r.PathValue("id"))
		writeResult(w, wf, err)
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleWorkflowsUpdate(w http.ResponseWriter, r *http.Request) {
	var wf agent.Workflow
	_ = json.NewDecoder(r.Body).Decode(&wf)
	wf.ID = r.PathValue("id")
	engine := h.app.AgentEngine()
	if engine != nil {
		writeResult(w, nil, engine.SaveWorkflow(&wf))
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleWorkflowsDelete(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		writeResult(w, map[string]string{"status": "deleted"}, engine.DeleteWorkflow(r.PathValue("id")))
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleWorkflowsRun(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		run, err := engine.StartRun(r.Context(), r.PathValue("id"))
		writeResult(w, run, err)
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleWorkflowsStop(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		writeResult(w, map[string]string{"status": "stopped"}, engine.StopRun(r.PathValue("id")))
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleRunsList(w http.ResponseWriter, r *http.Request) {
	workflowID := r.URL.Query().Get("workflowId")
	engine := h.app.AgentEngine()
	if engine != nil {
		runs, err := engine.ListRuns(workflowID)
		writeResult(w, runs, err)
	} else {
		writeJSON(w, []agent.Run{})
	}
}
func (h *globalHandler) handleRunsGet(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		run, err := engine.GetRun(r.PathValue("id"))
		writeResult(w, run, err)
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleRunsLogs(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		logs, err := engine.GetLogs(r.PathValue("id"))
		writeResult(w, logs, err)
	} else {
		http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
	}
}
func (h *globalHandler) handleRunsLogsStream(w http.ResponseWriter, r *http.Request) {
	engine := h.app.AgentEngine()
	if engine != nil {
		h := NewAgentHandler(engine, zap.NewNop())
		h.StreamLogs(w, r, r.PathValue("id"))
		return
	}
	http.Error(w, `{"error":"agent engine not available"}`, http.StatusServiceUnavailable)
}
func (h *globalHandler) handleFileGet(w http.ResponseWriter, r *http.Request) {
	// Stub: file detail view
	writeJSON(w, map[string]string{"id": r.PathValue("id")})
}
func (h *globalHandler) handleFileFolder(w http.ResponseWriter, r *http.Request) {
	// Stub: create folder
	writeJSON(w, map[string]string{"status": "created"})
}
func (h *globalHandler) handleFileUpload(w http.ResponseWriter, r *http.Request) {
	// Stub: upload file
	writeJSON(w, map[string]string{"status": "uploaded"})
}
func (h *globalHandler) handleFileDelete(w http.ResponseWriter, r *http.Request) {
	// Stub: delete file
	writeJSON(w, map[string]string{"status": "deleted"})
}
func (h *globalHandler) handleFileRename(w http.ResponseWriter, r *http.Request) {
	// Stub: rename file
	writeJSON(w, map[string]string{"status": "renamed"})
}
