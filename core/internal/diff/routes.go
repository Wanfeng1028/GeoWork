// GeoWork Go Core - Diff Routes

package diff

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	generator *Generator
	manager   *Manager
}

func NewRoutes(generator *Generator, manager *Manager) *Routes {
	return &Routes{generator: generator, manager: manager}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/security/diff", r.handleList)
	mux.HandleFunc("GET /api/security/diff/{id}", r.handleGet)
	mux.HandleFunc("POST /api/security/diff", r.handleGenerate)
	mux.HandleFunc("POST /api/security/diff/{id}/approve", r.handleApprove)
	mux.HandleFunc("POST /api/security/diff/{id}/reject", r.handleReject)
	mux.HandleFunc("POST /api/security/rollback", r.handleRollback)
	mux.HandleFunc("POST /api/security/apply-all", r.handleApplyAll)
	mux.HandleFunc("POST /api/security/recycle-delete", r.handleRecycleDelete)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	status := req.URL.Query().Get("status")
	var sp *string
	if status != "" {
		sp = &status
	}
	diffs := r.manager.List(sp)
	writeJSON(w, diffs)
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	d, ok := r.manager.Get(id)
	if !ok {
		writeError(w, http.StatusNotFound, "diff not found")
		return
	}
	writeJSON(w, d)
}

func (r *Routes) handleGenerate(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Path       string `json:"path"`
		OldContent string `json:"oldContent"`
		NewContent string `json:"newContent"`
		ToolCallID string `json:"toolCallId"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	result, err := r.generator.Generate(req.Context(), in.Path, in.OldContent, in.NewContent, in.ToolCallID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, result)
}

func (r *Routes) handleApprove(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.manager.Approve(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "approved"})
}

func (r *Routes) handleReject(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.manager.Reject(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "rejected"})
}

func (r *Routes) handleRollback(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Path string `json:"path"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	writeJSON(w, map[string]string{"status": "rolled_back"})
}

func (r *Routes) handleApplyAll(w http.ResponseWriter, req *http.Request) {
	if err := r.manager.ApproveAll(); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "applied_all"})
}

func (r *Routes) handleRecycleDelete(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Path string `json:"path"`
	}
	json.NewDecoder(req.Body).Decode(&in)
	writeJSON(w, map[string]string{"status": "recycled"})
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
