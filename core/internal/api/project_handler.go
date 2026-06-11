// GeoWork Go Core - Project & Health Handler

package api

import (
	"encoding/json"
	"net/http"

	gruntime "geowork/core/internal/runtime"
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
	// NOTE: These routes reference h.app.XXXHandler methods that are not yet
	// defined on runtime.App.  They are commented out so the Core can compile;
	// uncomment when the corresponding handler methods are implemented.

	// mux.HandleFunc("GET /api/deliveries", h.app.DeliveriesHandler)
	// mux.HandleFunc("GET /api/skills", h.app.SkillsHandler)
	// mux.HandleFunc("POST /api/skills/{id}/run", h.app.SkillRunHandler)
	// mux.HandleFunc("GET /api/plugins", h.app.PluginsHandler)
	// mux.HandleFunc("POST /api/plugins/{id}/enable", h.app.PluginEnableHandler)
	// mux.HandleFunc("POST /api/plugins/{id}/disable", h.app.PluginDisableHandler)
	// mux.HandleFunc("GET /api/models", h.app.ModelsHandler)
	// mux.HandleFunc("POST /api/models", h.app.SaveModelHandler)
	// mux.HandleFunc("POST /api/models/test", h.app.TestModelHandler)
	// mux.HandleFunc("GET /api/usage/summary", h.app.UsageHandler)
	// mux.HandleFunc("GET /api/usage/records", h.app.UsageRecordsHandler)
	// mux.HandleFunc("GET /api/settings", h.app.SettingsHandler)
	// mux.HandleFunc("POST /api/settings", h.app.UpdateSettingsHandler)
	// mux.HandleFunc("GET /api/environment/checks", h.app.EnvironmentChecksHandler)
	// mux.HandleFunc("GET /api/worker/geo/check", h.app.WorkerGeoCheckHandler)
	// mux.HandleFunc("GET /api/datasets", h.app.DatasetsHandler)
	// mux.HandleFunc("POST /api/datasets", h.app.RegisterDatasetHandler)
	// mux.HandleFunc("GET /api/map/layers", h.app.LayersHandler)
	// mux.HandleFunc("POST /api/map/layers/{id}", h.app.UpdateLayerHandler)
	// mux.HandleFunc("GET /api/automations", h.app.AutomationsHandler)
	// mux.HandleFunc("POST /api/automations", h.app.CreateAutomationHandler)
	// mux.HandleFunc("POST /api/automations/{id}/trigger", h.app.TriggerAutomationHandler)
	// mux.HandleFunc("GET /api/automation-runs", h.app.AutomationRunsHandler)
	// mux.HandleFunc("GET /api/experts", h.app.ExpertsHandler)
	// mux.HandleFunc("GET /api/papers", h.app.SearchPapersHandler)
	// mux.HandleFunc("GET /api/knowledge", h.app.KnowledgeHandler)
	// mux.HandleFunc("POST /api/knowledge", h.app.IndexKnowledgeHandler)
	// mux.HandleFunc("GET /api/security/decisions", h.app.SecurityDecisionsHandler)
	// mux.HandleFunc("POST /api/security/approvals", h.app.RequestSecurityApprovalHandler)
	// mux.HandleFunc("POST /api/security/decisions/{id}", h.app.ResolveSecurityDecisionHandler)
	// mux.HandleFunc("GET /api/tools", h.app.ToolCatalogHandler)
	// mux.HandleFunc("GET /api/eino/schema", h.app.EinoSchemaHandler)
	// mux.HandleFunc("GET /api/mcp", h.app.MCPConnectorsHandler)
	// mux.HandleFunc("POST /api/v1/papers/search", h.app.PaperSearchV1Handler)
	// mux.HandleFunc("POST /api/v1/papers/{id}/index", h.app.PaperIndexV1Handler)
	// mux.HandleFunc("GET /api/v1/knowledge/categories", h.app.KnowledgeCategoriesHandler)
	// mux.HandleFunc("GET /api/v1/knowledge/entries", h.app.KnowledgeEntriesHandler)
	// mux.HandleFunc("POST /api/v1/knowledge/categories", h.app.CreateKnowledgeCategoryHandler)
	// mux.HandleFunc("POST /api/v1/knowledge/index", h.app.IndexKnowledgeEntryHandler)
	// mux.HandleFunc("POST /api/v1/knowledge/import", h.app.ImportKnowledgeFileHandler)
	// mux.HandleFunc("DELETE /api/v1/knowledge/entries/{id}", h.app.DeleteKnowledgeEntryHandler)
	// mux.HandleFunc("PUT /api/v1/knowledge/entries/{id}", h.app.UpdateKnowledgeEntryHandler)
	// mux.HandleFunc("GET /api/v1/knowledge/entries/{id}", h.app.GetKnowledgeEntryHandler)
	// mux.HandleFunc("POST /api/v1/ndvi/analyze", h.app.NDVIAnalyzeHandler)
	// mux.HandleFunc("GET /api/v1/ndvi/history/{id}", h.app.NDVIAHistoryHandler)
	// mux.HandleFunc("POST /api/v1/cron/due", h.app.RunDueAutomationsHandler)
	// mux.HandleFunc("POST /api/v1/files/watch/scan", h.app.ScanFileTriggersHandler)
	// mux.HandleFunc("GET /api/v1/workflows", h.app.WorkflowsListHandler)
	// mux.HandleFunc("POST /api/v1/workflows", h.app.WorkflowsCreateHandler)
	// mux.HandleFunc("GET /api/v1/workflows/{id}", h.app.WorkflowsGetHandler)
	// mux.HandleFunc("PUT /api/v1/workflows/{id}", h.app.WorkflowsUpdateHandler)
	// mux.HandleFunc("DELETE /api/v1/workflows/{id}", h.app.WorkflowsDeleteHandler)
	// mux.HandleFunc("POST /api/v1/workflows/{id}/run", h.app.WorkflowsRunHandler)
	// mux.HandleFunc("POST /api/v1/workflows/{id}/stop", h.app.WorkflowsStopHandler)
	// mux.HandleFunc("GET /api/v1/runs", h.app.RunsListHandler)
	// mux.HandleFunc("GET /api/v1/runs/{id}", h.app.RunsGetHandler)
	// mux.HandleFunc("GET /api/v1/runs/{id}/logs", h.app.RunsLogsHandler)
	// mux.HandleFunc("GET /api/v1/runs/{id}/logs/stream", h.app.RunsLogsStreamHandler)
	// mux.HandleFunc("GET /api/v1/files/{id}", h.app.FileGetHandler)
	// mux.HandleFunc("POST /api/v1/files/{id}/folder", h.app.FileFolderHandler)
	// mux.HandleFunc("POST /api/v1/files/{id}/upload", h.app.FileUploadHandler)
	// mux.HandleFunc("DELETE /api/v1/files/{id}/{node_id}", h.app.FileDeleteHandler)
	// mux.HandleFunc("PUT /api/v1/files/{id}/{node_id}/rename", h.app.FileRenameHandler)
}
