// GeoWork Go Core - Task Routes

package tasks

import (
	"encoding/json"
	"net/http"
)

type Routes struct {
	service *Service
	prefix  string
}

// NewRoutes builds task routes mounted at the default "/api/tasks" prefix.
func NewRoutes(service *Service) *Routes {
	return &Routes{service: service, prefix: "/api/tasks"}
}

// NewRoutesWithPrefix builds task routes mounted at a custom prefix (e.g.
// "/api/db/tasks"). This lets the DB-backed task API coexist with the
// in-memory task handler which owns "/api/tasks", avoiding a ServeMux
// duplicate-pattern panic.
func NewRoutesWithPrefix(service *Service, prefix string) *Routes {
	if prefix == "" {
		prefix = "/api/tasks"
	}
	return &Routes{service: service, prefix: prefix}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET "+r.prefix, r.handleList)
	mux.HandleFunc("GET "+r.prefix+"/{id}", r.handleGet)
	mux.HandleFunc("POST "+r.prefix, r.handleCreate)
	mux.HandleFunc("PATCH "+r.prefix+"/{id}/status", r.handleUpdateStatus)
	mux.HandleFunc("GET "+r.prefix+"/{id}/events", r.handleEvents)
	mux.HandleFunc("DELETE "+r.prefix+"/{id}", r.handleDelete)
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
	id := req.PathValue("id")
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
	id := req.PathValue("id")
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
	id := req.PathValue("id")
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
	id := req.PathValue("id")
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
