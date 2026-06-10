// GeoWork Go Core - Workspace Routes

package workspace

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Routes struct {
	service *Service
}

func NewRoutes(service *Service) *Routes {
	return &Routes{service: service}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/workspaces", r.handleWorkspaces)
	mux.HandleFunc("/api/workspaces/tree", r.handleTree)
	mux.HandleFunc("/api/workspaces/files/read", r.handleReadFile)
	mux.HandleFunc("/api/workspaces/files/write", r.handleWriteFile)
	mux.HandleFunc("/api/workspaces/files/import", r.handleImportFiles)
}

func (r *Routes) handleWorkspaces(w http.ResponseWriter, req *http.Request) {
	parts := strings.Split(strings.TrimPrefix(req.URL.Path, "/api/workspaces"), "/")

	switch req.Method {
	case http.MethodGet:
		if len(parts) == 0 || parts[0] == "" {
			r.listWorkspaces(w, req)
			return
		}
		if len(parts) == 2 && parts[0] == "ws-001" {
			r.getWorkspace(w, req, parts[1])
			return
		}

	case http.MethodPost:
		r.createWorkspace(w, req)
	}
}

func (r *Routes) listWorkspaces(w http.ResponseWriter, req *http.Request) {
	workspaces, err := r.service.ListWorkspaces()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, workspaces)
}

func (r *Routes) getWorkspace(w http.ResponseWriter, req *http.Request, id string) {
	ws, err := r.service.GetWorkspace(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, ws)
}

func (r *Routes) createWorkspace(w http.ResponseWriter, req *http.Request) {
	var input struct {
		Name string `json:"name"`
		Path string `json:"path"`
		Mode string `json:"mode"`
	}
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if input.Name == "" || input.Path == "" {
		http.Error(w, "name and path required", http.StatusBadRequest)
		return
	}
	if input.Mode == "" {
		input.Mode = "Analysis"
	}

	ws, err := r.service.CreateWorkspace(input.Name, input.Path, input.Mode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, ws)
}

func (r *Routes) handleTree(w http.ResponseWriter, req *http.Request) {
	workspaceID := req.URL.Query().Get("workspaceId")
	if workspaceID == "" {
		http.Error(w, "workspaceId required", http.StatusBadRequest)
		return
	}

	tree, err := r.service.GetTree(workspaceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, tree)
}

func (r *Routes) handleReadFile(w http.ResponseWriter, req *http.Request) {
	workspaceID := req.URL.Query().Get("workspaceId")
	filePath := req.URL.Query().Get("path")
	if workspaceID == "" || filePath == "" {
		http.Error(w, "workspaceId and path required", http.StatusBadRequest)
		return
	}

	data, err := r.service.ReadFile(workspaceID, filePath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]interface{}{
		"content": string(data),
		"path":    filePath,
	})
}

func (r *Routes) handleWriteFile(w http.ResponseWriter, req *http.Request) {
	var input struct {
		WorkspaceID string `json:"workspaceId"`
		Path        string `json:"path"`
		Content     string `json:"content"`
	}
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if err := r.service.WriteFile(input.WorkspaceID, input.Path, []byte(input.Content)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func (r *Routes) handleImportFiles(w http.ResponseWriter, req *http.Request) {
	var input struct {
		WorkspaceID string   `json:"workspaceId"`
		SrcPaths    []string `json:"srcPaths"`
	}
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if err := r.service.ImportFiles(input.WorkspaceID, input.SrcPaths); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
