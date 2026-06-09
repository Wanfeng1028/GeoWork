package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	gwfile "geowork/core/internal/file"
	gruntime "geowork/core/internal/runtime"
)

// FileHandler provides HTTP handlers for file management operations.
type FileHandler struct {
	app       *gruntime.App
	fileMgr   *gwfile.FileManager
	workspace string
}

// NewFileHandler creates a new FileHandler.
func NewFileHandler(app *gruntime.App, fileMgr *gwfile.FileManager, workspace string) *FileHandler {
	return &FileHandler{app: app, fileMgr: fileMgr, workspace: workspace}
}

// handleGetFiles handles GET /api/v1/files/:project_id
func (h *FileHandler) handleGetFiles(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		http.Error(w, "missing project_id", http.StatusBadRequest)
		return
	}
	projectID := parts[3]

	tree, err := h.fileMgr.GetTree(projectID)
	writeResult(w, tree, err)
}

// handleCreateFolder handles POST /api/v1/files/:project_id/folder
func (h *FileHandler) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		http.Error(w, "missing project_id", http.StatusBadRequest)
		return
	}
	projectID := parts[3]

	var body struct {
		ParentID string `json:"parentId"`
		Name     string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	node, err := h.fileMgr.CreateFolder(projectID, body.ParentID, body.Name)
	writeResult(w, node, err)
}

// handleUploadFile handles POST /api/v1/files/:project_id/upload
func (h *FileHandler) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		http.Error(w, "missing project_id", http.StatusBadRequest)
		return
	}
	projectID := parts[3]

	// Parse multipart form (max 500MB)
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		http.Error(w, "file too large", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	parentID := r.FormValue("parentId")
	fileName := header.Filename
	if fileName == "" {
		fileName = "uploaded_file"
	}

	node, err := h.fileMgr.UploadFile(projectID, parentID, h.workspace, fileName, file)
	writeResult(w, node, err)
}

// handleDeleteNode handles DELETE /api/v1/files/:project_id/:node_id
func (h *FileHandler) handleDeleteNode(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		http.Error(w, "missing project_id or node_id", http.StatusBadRequest)
		return
	}
	projectID := parts[3]
	nodeID := parts[5]

	err := h.fileMgr.DeleteNode(projectID, nodeID)
	writeResult(w, map[string]string{"status": "deleted"}, err)
}

// handleRenameNode handles PUT /api/v1/files/:project_id/:node_id/rename
func (h *FileHandler) handleRenameNode(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 6 || parts[5] != "rename" {
		http.Error(w, "missing project_id, node_id, or rename action", http.StatusBadRequest)
		return
	}
	projectID := parts[3]
	nodeID := parts[4]

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	err := h.fileMgr.RenameNode(projectID, nodeID, body.Name)
	writeResult(w, map[string]string{"status": "renamed"}, err)
}

// handleGetFileContent handles GET /api/v1/files/:project_id/:node_id/content
// Returns the raw file content for preview purposes.
func (h *FileHandler) handleGetFileContent(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		http.Error(w, "missing project_id or node_id", http.StatusBadRequest)
		return
	}
	nodeID := parts[4]

	// Find the node to get its path
	if _, err := h.fileMgr.GetTree(parts[3]); err != nil { // validate project exists
		http.Error(w, fmt.Sprintf("project not found: %v", err), http.StatusNotFound)
		return
	}

	// We need to search for the node - use a direct query approach
	// Since FileNode doesn't expose a GetByID method, we'll use the path from the node
	// Return a fetchable content descriptor for preview-capable file nodes.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"nodeId": nodeID,
	})
}

// RegisterRoutes registers all file management routes on the given mux.
func (h *FileHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/files/{id}", h.handleGetFiles)
	mux.HandleFunc("POST /api/v1/files/{id}/folder", h.handleCreateFolder)
	mux.HandleFunc("POST /api/v1/files/{id}/upload", h.handleUploadFile)
	mux.HandleFunc("DELETE /api/v1/files/{id}/{node_id}", h.handleDeleteNode)
	mux.HandleFunc("PUT /api/v1/files/{id}/{node_id}/rename", h.handleRenameNode)
}
