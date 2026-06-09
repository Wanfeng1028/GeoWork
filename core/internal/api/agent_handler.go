package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"geowork/core/internal/agent"

	"go.uber.org/zap"
)

// AgentHandler serves HTTP endpoints for the Agent Studio.
type AgentHandler struct {
	engine *agent.Engine
	logger *zap.Logger
}

// NewAgentHandler creates a new agent handler.
func NewAgentHandler(engine *agent.Engine, logger *zap.Logger) *AgentHandler {
	return &AgentHandler{engine: engine, logger: logger}
}

// RegisterRoutes attaches agent routes to the given mux.
func (h *AgentHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/workflows", h.handleListWorkflows)
	mux.HandleFunc("POST /api/v1/workflows", h.handleCreateWorkflow)
	mux.HandleFunc("GET /api/v1/workflows/{id}", h.handleGetWorkflow)
	mux.HandleFunc("PUT /api/v1/workflows/{id}", h.handleSaveWorkflow)
	mux.HandleFunc("DELETE /api/v1/workflows/{id}", h.handleDeleteWorkflow)
	mux.HandleFunc("POST /api/v1/workflows/{id}/run", h.handleStartRun)
	mux.HandleFunc("POST /api/v1/workflows/{id}/stop", h.handleStopRun)
	mux.HandleFunc("GET /api/v1/runs", h.handleListRuns)
	mux.HandleFunc("GET /api/v1/runs/{id}", h.handleGetRun)
	mux.HandleFunc("GET /api/v1/runs/{id}/logs", h.handleGetLogs)
	mux.HandleFunc("GET /api/v1/runs/{id}/logs/stream", h.handleStreamLogs)
}

func (h *AgentHandler) handleListWorkflows(w http.ResponseWriter, r *http.Request) {
	workflows, err := h.engine.ListWorkflows()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, workflows)
}

func (h *AgentHandler) handleCreateWorkflow(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	wf, err := h.engine.CreateWorkflow(in.Name, in.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, wf)
}

func (h *AgentHandler) handleGetWorkflow(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/workflows/")
	if id == "" {
		http.Error(w, `{"error":"workflow id is required"}`, http.StatusBadRequest)
		return
	}
	wf, err := h.engine.GetWorkflow(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, wf)
}

func (h *AgentHandler) handleSaveWorkflow(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/workflows/")
	if id == "" {
		http.Error(w, `{"error":"workflow id is required"}`, http.StatusBadRequest)
		return
	}
	var wf agent.Workflow
	if err := json.NewDecoder(r.Body).Decode(&wf); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	wf.ID = id
	if err := h.engine.SaveWorkflow(&wf); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func (h *AgentHandler) handleDeleteWorkflow(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/workflows/")
	if id == "" {
		http.Error(w, `{"error":"workflow id is required"}`, http.StatusBadRequest)
		return
	}
	if err := h.engine.DeleteWorkflow(id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (h *AgentHandler) handleStartRun(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/workflows/")
	if id == "" {
		http.Error(w, `{"error":"workflow id is required"}`, http.StatusBadRequest)
		return
	}
	run, err := h.engine.StartRun(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, run)
}

func (h *AgentHandler) handleStopRun(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/workflows/")
	if id == "" {
		http.Error(w, `{"error":"workflow id is required"}`, http.StatusBadRequest)
		return
	}
	if err := h.engine.StopRun(id); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "stopped"})
}

func (h *AgentHandler) handleListRuns(w http.ResponseWriter, r *http.Request) {
	workflowID := r.URL.Query().Get("workflowId")
	runs, err := h.engine.ListRuns(workflowID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, runs)
}

func (h *AgentHandler) handleGetRun(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/runs/")
	if id == "" {
		http.Error(w, `{"error":"run id is required"}`, http.StatusBadRequest)
		return
	}
	run, err := h.engine.GetRun(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, run)
}

func (h *AgentHandler) handleGetLogs(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/runs/")
	if id == "" {
		http.Error(w, `{"error":"run id is required"}`, http.StatusBadRequest)
		return
	}
	logs, err := h.engine.GetLogs(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, logs)
}

// handleStreamLogs streams run logs via Server-Sent Events.
func (h *AgentHandler) handleStreamLogs(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/runs/")
	if id == "" {
		http.Error(w, `{"error":"run id is required"}`, http.StatusBadRequest)
		return
	}
	h.streamLogs(w, r, id)
}

// StreamLogs streams run logs via Server-Sent Events (public method for router integration).
func (h *AgentHandler) StreamLogs(w http.ResponseWriter, r *http.Request, runID string) {
	h.streamLogs(w, r, runID)
}

func (h *AgentHandler) streamLogs(w http.ResponseWriter, r *http.Request, runID string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ticker := newTicker()
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			logs, err := h.engine.GetLogs(runID)
			if err != nil {
				eventData(w, "error", err.Error())
				return
			}
			payload, _ := json.Marshal(map[string]any{
				"logs": logs,
				"time": time.Now().UTC().Format(time.RFC3339),
			})
			eventData(w, "log", string(payload))
			flusher.Flush()
		}
	}
}

// --- helpers ---

// simpleTicker is a thread-safe ticker.
type simpleTicker struct {
	mu   sync.Mutex
	ch   chan struct{}
	C    chan struct{}
	stop chan struct{}
}

func newTicker() *simpleTicker {
	t := &simpleTicker{ch: make(chan struct{}, 1), C: make(chan struct{}, 1), stop: make(chan struct{})}
	go t.loop()
	return t
}

func (t *simpleTicker) loop() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			select {
			case t.ch <- struct{}{}:
			default:
			}
		case <-t.stop:
			return
		}
	}
}

func (t *simpleTicker) Stop() { close(t.stop) }

func eventData(w http.ResponseWriter, event string, data string) {
	w.Write([]byte("event: " + event + "\n"))
	w.Write([]byte("data: " + data + "\n\n"))
}
