// GeoWork Go Core - Task Handler

package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	gruntime "geowork/core/internal/runtime"
)

type taskHandler struct {
	app    *gruntime.App
	bridge *EventBridge
}

func newTaskHandler(app *gruntime.App, bridge *EventBridge) *taskHandler {
	return &taskHandler{app: app, bridge: bridge}
}

func (h *taskHandler) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/tasks", h.handleList)
	mux.HandleFunc("POST /api/tasks", h.handleCreate)
	mux.HandleFunc("GET /api/tasks/{id}", h.handleGet)
	mux.HandleFunc("GET /api/tasks/{id}/events", h.handleEvents)
	mux.HandleFunc("POST /api/tasks/{id}/run", h.handleRun)
	mux.HandleFunc("POST /api/tasks/{id}/pause", h.handlePause)
	mux.HandleFunc("POST /api/tasks/{id}/cancel", h.handleCancel)
	mux.HandleFunc("POST /api/tasks/{id}/retry", h.handleRetry)
}

// GET /api/tasks
func (h *taskHandler) handleList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, h.app.Tasks())
}

// POST /api/tasks
func (h *taskHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ProjectID string `json:"projectId"`
		Prompt    string `json:"prompt"`
		Mode      string `json:"mode"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	task, err := h.app.CreateTask(in.ProjectID, in.Prompt, in.Mode)
	writeResult(w, task, err)
}

// GET /api/tasks/{id}
func (h *taskHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if task, ok := h.app.Task(id); ok {
		writeJSON(w, task)
		return
	}
	http.NotFound(w, r)
}

// GET /api/tasks/{id}/events
func (h *taskHandler) handleEvents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
		h.streamEvents(w, r, id)
		return
	}
	writeJSON(w, h.app.Events(id))
}

func (h *taskHandler) streamEvents(w http.ResponseWriter, r *http.Request, taskID string) {
	sse := NewSSEWriter(w)

	// Send existing events first
	existingEvents := h.app.Events(taskID)
	for _, evt := range existingEvents {
		sse.Send(TaskEventType(evt.Type), map[string]any{
			"id":        evt.ID,
			"type":      evt.Type,
			"message":   evt.Message,
			"timestamp": evt.Time,
			"data":      evt.Data,
		})
	}

	// Subscribe for new events
	ch := h.bridge.Subscribe(taskID)

	done := r.Context().Done()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			h.bridge.Unsubscribe(taskID, ch)
			return
		case evt, ok := <-ch:
			if !ok {
				return
			}
			sse.Send(evt.Type, evt)
		case <-ticker.C:
			sse.Ping()
		}
	}
}

// POST /api/tasks/{id}/run
func (h *taskHandler) handleRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := h.app.RunTask(r.Context(), id)
	writeResult(w, task, err)
}

// POST /api/tasks/{id}/pause
func (h *taskHandler) handlePause(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	writeResult(w, map[string]string{"status": "paused"}, h.app.PauseTask(id))
}

// POST /api/tasks/{id}/cancel
func (h *taskHandler) handleCancel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	writeResult(w, map[string]string{"status": "cancelled"}, h.app.CancelTask(id))
}

// POST /api/tasks/{id}/retry
func (h *taskHandler) handleRetry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := h.app.RetryTask(r.Context(), id)
	writeResult(w, task, err)
}
