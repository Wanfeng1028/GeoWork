// GeoWork Go Core - Agent Routes

package aiagent

import (
	"encoding/json"
	"net/http"
	"time"

	"go.uber.org/zap"
)

type Routes struct {
	orchestrator *Orchestrator
	log          *zap.Logger
}

func NewRoutes(orchestrator *Orchestrator, log *zap.Logger) *Routes {
	return &Routes{orchestrator: orchestrator, log: log}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/agent/runs", r.handleListRuns)
	mux.HandleFunc("GET /api/agent/runs/{id}", r.handleGetRun)
	mux.HandleFunc("POST /api/agent/runs", r.handleStartRun)
	mux.HandleFunc("POST /api/agent/runs/{id}/stop", r.handleStopRun)
	mux.HandleFunc("GET /api/agent/checkpoints", r.handleListCheckpoints)
	mux.HandleFunc("GET /api/agent/events/stream", r.handleStreamEvents)
}

func (r *Routes) handleListRuns(w http.ResponseWriter, req *http.Request) {
	runs := r.orchestrator.ListRuns()
	writeJSON(w, runs)
}

func (r *Routes) handleGetRun(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	run, ok := r.orchestrator.GetRun(id)
	if !ok {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}
	writeJSON(w, run)
}

func (r *Routes) handleStartRun(w http.ResponseWriter, req *http.Request) {
	var in struct {
		Mode   string `json:"mode"`
		Prompt string `json:"prompt"`
	}
	if err := json.NewDecoder(req.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if in.Mode == "" {
		in.Mode = "Work"
	}
	run, err := r.orchestrator.StartRun(req.Context(), in.Mode, in.Prompt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, run)
}

func (r *Routes) handleStopRun(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	r.orchestrator.StopRun(id)
	writeJSON(w, map[string]string{"status": "stopping"})
}

func (r *Routes) handleListCheckpoints(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.orchestrator.recovery.List())
}

func (r *Routes) handleStreamEvents(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := r.orchestrator.StreamEvents()
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-req.Context().Done():
			return
		case e, ok := <-ch:
			if !ok {
				return
			}
			data, _ := json.Marshal(e)
			w.Write([]byte("data: "))
			w.Write(data)
			w.Write([]byte("\n\n"))
			w.(http.Flusher).Flush()
		case <-ticker.C:
			w.Write([]byte(": ping\n\n"))
			w.(http.Flusher).Flush()
		}
	}
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
