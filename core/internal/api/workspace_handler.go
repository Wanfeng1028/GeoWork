// GeoWork Go Core - Workspace Handler

package api

import (
	"encoding/json"
	"net/http"

	gruntime "geowork/core/internal/runtime"
	"geowork/core/internal/workspace"

	"go.uber.org/zap"
)

type workspaceHandler struct {
	app          *gruntime.App
	workspaceSvc *workspace.Service
	logDir       string
	logger       *zap.Logger
}

func newWorkspaceHandler(app *gruntime.App, svc *workspace.Service, logDir string, logger *zap.Logger) *workspaceHandler {
	return &workspaceHandler{app: app, workspaceSvc: svc, logDir: logDir, logger: logger}
}

func (h *workspaceHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/workspaces", h.handleList)
	mux.HandleFunc("GET /api/workspaces/tree", h.handleTree)
	mux.HandleFunc("GET /api/workspaces/files/read", h.handleRead)
	mux.HandleFunc("POST /api/workspaces/files/write", h.handleWrite)
	mux.HandleFunc("POST /api/workspaces/files/import", h.handleImport)
}

// GET /api/workspaces
func (h *workspaceHandler) handleList(w http.ResponseWriter, r *http.Request) {
	if h.workspaceSvc == nil {
		http.Error(w, "workspace service not available", http.StatusServiceUnavailable)
		return
	}
	ws, err := h.workspaceSvc.ListWorkspaces()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, ws)
}

// GET /api/workspaces/tree?workspaceId=xxx
func (h *workspaceHandler) handleTree(w http.ResponseWriter, r *http.Request) {
	if h.workspaceSvc == nil {
		http.Error(w, "workspace service not available", http.StatusServiceUnavailable)
		return
	}
	wsID := r.URL.Query().Get("workspaceId")
	if wsID == "" {
		http.Error(w, "workspaceId required", http.StatusBadRequest)
		return
	}
	tree, err := h.workspaceSvc.GetTree(wsID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, tree)
}

// GET /api/workspaces/files/read?workspaceId=xxx&path=yyy
func (h *workspaceHandler) handleRead(w http.ResponseWriter, r *http.Request) {
	if h.workspaceSvc == nil {
		http.Error(w, "workspace service not available", http.StatusServiceUnavailable)
		return
	}
	wsID := r.URL.Query().Get("workspaceId")
	fPath := r.URL.Query().Get("path")
	if wsID == "" || fPath == "" {
		http.Error(w, "workspaceId and path required", http.StatusBadRequest)
		return
	}
	data, err := h.workspaceSvc.ReadFile(wsID, fPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]interface{}{"content": string(data), "path": fPath})
}

// POST /api/workspaces/files/write
func (h *workspaceHandler) handleWrite(w http.ResponseWriter, r *http.Request) {
	if h.workspaceSvc == nil {
		http.Error(w, "workspace service not available", http.StatusServiceUnavailable)
		return
	}
	var input struct {
		WorkspaceID string `json:"workspaceId"`
		Path        string `json:"path"`
		Content     string `json:"content"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	if err := h.workspaceSvc.WriteFile(input.WorkspaceID, input.Path, []byte(input.Content)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

// POST /api/workspaces/files/import
func (h *workspaceHandler) handleImport(w http.ResponseWriter, r *http.Request) {
	if h.workspaceSvc == nil {
		http.Error(w, "workspace service not available", http.StatusServiceUnavailable)
		return
	}
	var input struct {
		WorkspaceID string   `json:"workspaceId"`
		SrcPaths    []string `json:"srcPaths"`
	}
	_ = json.NewDecoder(r.Body).Decode(&input)
	writeResult(w, nil, h.workspaceSvc.ImportFiles(input.WorkspaceID, input.SrcPaths))
}
