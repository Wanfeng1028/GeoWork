// GeoWork Go Core - Artifact Routes

package artifacts

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
	mux.HandleFunc("GET /api/artifacts", r.handleList)
	mux.HandleFunc("GET /api/artifacts/{id}", r.handleGet)
	mux.HandleFunc("POST /api/artifacts", r.handleCreate)
	mux.HandleFunc("DELETE /api/artifacts/{id}", r.handleDelete)
	mux.HandleFunc("GET /api/artifacts/{id}/preview", r.handlePreview)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	taskID := req.URL.Query().Get("taskId")
	workspaceID := req.URL.Query().Get("workspaceId")

	var artifacts []Artifact
	var err error

	switch {
	case taskID != "":
		artifacts, err = r.service.ListByTask(req.Context(), taskID)
	case workspaceID != "":
		artifacts, err = r.service.ListByWorkspace(req.Context(), workspaceID)
	default:
		artifacts, err = r.service.ListByWorkspace(req.Context(), "")
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if artifacts == nil {
		artifacts = []Artifact{}
	}

	writeJSON(w, ArtifactListResponse{
		Total:     len(artifacts),
		Artifacts: artifacts,
	})
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/artifacts/")
	a, err := r.service.GetByID(req.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, a)
}

func (r *Routes) handleCreate(w http.ResponseWriter, req *http.Request) {
	var a Artifact
	if err := json.NewDecoder(req.Body).Decode(&a); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := r.service.Create(req.Context(), &a); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, a)
}

func (r *Routes) handleDelete(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/artifacts/")
	if err := r.service.Delete(req.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handlePreview(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/artifacts/")
	preview, err := r.service.GetPreview(req.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, preview)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
