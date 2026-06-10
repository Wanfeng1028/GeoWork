// GeoWork Go Core - Task Routes

package tasks

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
	mux.HandleFunc("GET /api/tasks", r.handleList)
	mux.HandleFunc("GET /api/tasks/{id}", r.handleGet)
	mux.HandleFunc("POST /api/tasks", r.handleCreate)
	mux.HandleFunc("PATCH /api/tasks/{id}/status", r.handleUpdateStatus)
	mux.HandleFunc("GET /api/tasks/{id}/events", r.handleEvents)
	mux.HandleFunc("DELETE /api/tasks/{id}", r.handleDelete)
}

func (r *Routes) handleList(w http.ResponseWriter, req *http.Request) {
	workspaceID := req.URL.Query().Get("workspaceId")
	statusStr := req.URL.Query().Get("status")

	var status *Status
	if statusStr != "" {
		s := Status(statusStr)
		status = &s
	}

	tasks, err := r.service.ListByWorkspace(req.Context(), workspaceID, status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if tasks == nil {
		tasks = []Task{}
	}

	writeJSON(w, TaskListResponse{
		Total: len(tasks),
		Tasks: tasks,
	})
}

func (r *Routes) handleGet(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/tasks/")
	t, err := r.service.GetByID(req.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, t)
}

func (r *Routes) handleCreate(w http.ResponseWriter, req *http.Request) {
	var t Task
	if err := json.NewDecoder(req.Body).Decode(&t); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := r.service.Create(req.Context(), &t); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, t)
}

func (r *Routes) handleUpdateStatus(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/tasks/")
	var payload struct {
		Status Status `json:"status"`
	}
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := r.service.UpdateStatus(req.Context(), id, payload.Status); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	t, err := r.service.GetByID(req.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, t)
}

func (r *Routes) handleEvents(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/tasks/")
	events, err := r.service.ListEvents(req.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if events == nil {
		events = []TaskEvent{}
	}
	writeJSON(w, events)
}

func (r *Routes) handleDelete(w http.ResponseWriter, req *http.Request) {
	id := strings.TrimPrefix(req.URL.Path, "/api/tasks/")
	if err := r.service.Delete(req.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
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
