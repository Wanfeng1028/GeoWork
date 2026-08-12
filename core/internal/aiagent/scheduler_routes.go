// GeoWork Go Core - Scheduler + Trigger HTTP Routes (P2-4 §5.5)
//
// Routes for managing ScheduledTasks and Triggers:
//
//	GET    /api/agent/schedule           list scheduled tasks
//	POST   /api/agent/schedule           create scheduled task
//	PUT    /api/agent/schedule/{id}      update scheduled task
//	DELETE /api/agent/schedule/{id}      delete scheduled task
//	GET    /api/agent/triggers           list triggers
//	POST   /api/agent/triggers            create trigger
//	DELETE /api/agent/triggers/{id}      delete trigger
//	POST   /api/agent/triggers/event     inject an event into TriggerManager

package aiagent

import (
	"encoding/json"
	"net/http"
)

// WithScheduler attaches a Scheduler to the Routes so the schedule
// endpoints become live. Returns the receiver for chaining.
func (r *Routes) WithScheduler(s *Scheduler) *Routes {
	r.scheduler = s
	return r
}

// WithTriggerManager attaches a TriggerManager to the Routes.
func (r *Routes) WithTriggerManager(tm *TriggerManager) *Routes {
	r.triggers = tm
	return r
}

// registerSchedulerRoutes wires the scheduler/trigger endpoints. Called
// from Routes.Register; silently skips endpoints whose dependency is nil
// so callers without a scheduler still boot.
func (r *Routes) registerSchedulerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/agent/schedule", r.handleListSchedule)
	mux.HandleFunc("POST /api/agent/schedule", r.handleCreateSchedule)
	mux.HandleFunc("PUT /api/agent/schedule/{id}", r.handleUpdateSchedule)
	mux.HandleFunc("DELETE /api/agent/schedule/{id}", r.handleDeleteSchedule)
	mux.HandleFunc("GET /api/agent/triggers", r.handleListTriggers)
	mux.HandleFunc("POST /api/agent/triggers", r.handleCreateTrigger)
	mux.HandleFunc("DELETE /api/agent/triggers/{id}", r.handleDeleteTrigger)
	mux.HandleFunc("POST /api/agent/triggers/event", r.handleFireTriggerEvent)
}

func (r *Routes) handleListSchedule(w http.ResponseWriter, req *http.Request) {
	if r.scheduler == nil {
		writeError(w, http.StatusServiceUnavailable, "scheduler not configured")
		return
	}
	writeJSON(w, r.scheduler.List())
}

func (r *Routes) handleCreateSchedule(w http.ResponseWriter, req *http.Request) {
	if r.scheduler == nil {
		writeError(w, http.StatusServiceUnavailable, "scheduler not configured")
		return
	}
	var task ScheduledTask
	if err := json.NewDecoder(req.Body).Decode(&task); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if task.ID == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	if err := r.scheduler.Add(&task); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, task)
}

func (r *Routes) handleUpdateSchedule(w http.ResponseWriter, req *http.Request) {
	if r.scheduler == nil {
		writeError(w, http.StatusServiceUnavailable, "scheduler not configured")
		return
	}
	id := req.PathValue("id")
	var patch ScheduledTask
	if err := json.NewDecoder(req.Body).Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.scheduler.Update(id, patch); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	updated, _ := r.scheduler.Get(id)
	writeJSON(w, updated)
}

func (r *Routes) handleDeleteSchedule(w http.ResponseWriter, req *http.Request) {
	if r.scheduler == nil {
		writeError(w, http.StatusServiceUnavailable, "scheduler not configured")
		return
	}
	id := req.PathValue("id")
	if err := r.scheduler.Remove(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handleListTriggers(w http.ResponseWriter, req *http.Request) {
	if r.triggers == nil {
		writeError(w, http.StatusServiceUnavailable, "triggers not configured")
		return
	}
	writeJSON(w, r.triggers.List())
}

func (r *Routes) handleCreateTrigger(w http.ResponseWriter, req *http.Request) {
	if r.triggers == nil {
		writeError(w, http.StatusServiceUnavailable, "triggers not configured")
		return
	}
	var t Trigger
	if err := json.NewDecoder(req.Body).Decode(&t); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if t.ID == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	t.Enabled = true
	if err := r.triggers.Add(&t); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, t)
}

func (r *Routes) handleDeleteTrigger(w http.ResponseWriter, req *http.Request) {
	if r.triggers == nil {
		writeError(w, http.StatusServiceUnavailable, "triggers not configured")
		return
	}
	id := req.PathValue("id")
	if err := r.triggers.Remove(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (r *Routes) handleFireTriggerEvent(w http.ResponseWriter, req *http.Request) {
	if r.triggers == nil {
		writeError(w, http.StatusServiceUnavailable, "triggers not configured")
		return
	}
	var payload struct {
		Event string         `json:"event"`
		Data  map[string]any `json:"data"`
	}
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if payload.Event == "" {
		writeError(w, http.StatusBadRequest, "event is required")
		return
	}
	if payload.Data == nil {
		payload.Data = map[string]any{}
	}
	r.triggers.HandleEvent(payload.Event, payload.Data)
	writeJSON(w, map[string]string{"status": "dispatched"})
}
