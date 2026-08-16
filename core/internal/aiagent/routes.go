// GeoWork Go Core - Agent Routes

package aiagent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"geowork/core/internal/toolregistry"

	"go.uber.org/zap"
)

type Routes struct {
	orchestrator *Orchestrator
	log          *zap.Logger
	scheduler    *Scheduler      // P2-4 §5.5
	triggers     *TriggerManager // P2-4 §5.5
}

func NewRoutes(orchestrator *Orchestrator, log *zap.Logger) *Routes {
	return &Routes{orchestrator: orchestrator, log: log}
}

func (r *Routes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/agent/runs", r.handleListRuns)
	mux.HandleFunc("GET /api/agent/runs/{id}", r.handleGetRun)
	mux.HandleFunc("POST /api/agent/runs", r.handleStartRun)
	mux.HandleFunc("POST /api/agent/runs/{id}/stop", r.handleStopRun)
	mux.HandleFunc("POST /api/agent/runs/{id}/pause", r.handlePauseRun)
	mux.HandleFunc("POST /api/agent/runs/{id}/resume", r.handleResumeRun)
	// doc/22 BP5: delete a finished run (and its checkpoint) from memory.
	mux.HandleFunc("DELETE /api/agent/runs/{id}", r.handleDeleteRun)
	mux.HandleFunc("GET /api/agent/checkpoints", r.handleListCheckpoints)
	mux.HandleFunc("GET /api/agent/checkpoints/{runId}", r.handleGetCheckpoint)
	// P1-6 §7.5: resume a run from its saved checkpoint. Loads the
	// checkpoint, reconstructs RunContext (state + memory + chatHistory),
	// and re-enters the ReAct loop at the saved turn index.
	mux.HandleFunc("POST /api/agent/checkpoints/{runId}/resume", r.handleResumeCheckpoint)
	mux.HandleFunc("DELETE /api/agent/checkpoints/{runId}", r.handleDeleteCheckpoint)
	mux.HandleFunc("GET /api/agent/events/stream", r.handleStreamEvents)

	// P1-1 §2.6 + P1-4 §5.5: approval + pause/resume API.
	// GET /approvals/{runId} lists pending approval requests attributed
	// to that run. POST /approvals/{reqId}/approve|reject resolves one.
	mux.HandleFunc("GET /api/agent/approvals/{runId}", r.handleListApprovals)
	mux.HandleFunc("POST /api/agent/approvals/{reqId}/approve", r.handleApprove)
	mux.HandleFunc("POST /api/agent/approvals/{reqId}/reject", r.handleReject)

	// P1-2 §3.6-3.7: observability APIs.
	// GET /trajectory/{runId} returns the full execution trace (turns +
	// tool calls + token usage) for replay / debugging.
	// GET /trajectory lists recent trajectories.
	// GET /usage/{runId} itemizes per-call token usage for one run.
	// GET /usage/summary returns global totals + per-provider/task/run
	// breakdowns for the cost audit dashboard.
	mux.HandleFunc("GET /api/agent/trajectory/{runId}", r.handleGetTrajectory)
	mux.HandleFunc("GET /api/agent/trajectory", r.handleListTrajectories)
	mux.HandleFunc("GET /api/agent/usage/summary", r.handleUsageSummary)
	mux.HandleFunc("GET /api/agent/usage/{runId}", r.handleRunUsage)

	// P2-4 §5.5: schedule + trigger APIs. Endpoints return 503 when
	// their dependency is not wired (caller did not call WithScheduler /
	// WithTriggerManager on Routes).
	r.registerSchedulerRoutes(mux)
}

// handleGetTrajectory returns the persisted trajectory for one run.
// Returns 404 when no recorder is configured or the run is unknown.
func (r *Routes) handleGetTrajectory(w http.ResponseWriter, req *http.Request) {
	rec := r.orchestrator.Trajectory()
	if rec == nil {
		writeError(w, http.StatusServiceUnavailable, "trajectory recorder not configured")
		return
	}
	runID := req.PathValue("runId")
	traj, err := rec.Load(runID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, traj)
}

// handleListTrajectories returns recent trajectories, most-recent first.
// Optional ?limit=N query caps the result (default 100).
func (r *Routes) handleListTrajectories(w http.ResponseWriter, req *http.Request) {
	rec := r.orchestrator.Trajectory()
	if rec == nil {
		writeJSON(w, []*Trajectory{})
		return
	}
	limit := 100
	if l := req.URL.Query().Get("limit"); l != "" {
		var n int
		_, _ = fmt.Sscanf(l, "%d", &n)
		if n > 0 {
			limit = n
		}
	}
	list, err := rec.List(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, list)
}

// handleRunUsage returns per-call usage records attributed to runId plus
// the run's total token count and cost. Frontend uses this to render
// the per-run cost badge in the run history view.
func (r *Routes) handleRunUsage(w http.ResponseWriter, req *http.Request) {
	meter := r.orchestrator.UsageMeter()
	if meter == nil {
		writeError(w, http.StatusServiceUnavailable, "usage meter not configured")
		return
	}
	runID := req.PathValue("runId")
	records := meter.GetRunRecords(runID)
	totalTokens := meter.GetRunUsage(runID)

	// Aggregate cost from records (already computed by estimateCost).
	totalCost := 0.0
	cached := 0
	for _, rec := range records {
		totalCost += rec.EstimatedCost
		cached += rec.CachedTokens
	}
	writeJSON(w, map[string]any{
		"runId":        runID,
		"records":      records,
		"totalTokens":  totalTokens,
		"cachedTokens": cached,
		"totalCost":    totalCost,
	})
}

// handleUsageSummary returns global usage totals plus per-provider /
// per-task / per-run breakdowns. Powers the global cost audit dashboard.
func (r *Routes) handleUsageSummary(w http.ResponseWriter, req *http.Request) {
	meter := r.orchestrator.UsageMeter()
	if meter == nil {
		writeError(w, http.StatusServiceUnavailable, "usage meter not configured")
		return
	}
	writeJSON(w, meter.Summary())
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

// handleDeleteRun removes a finished run (and its checkpoint) from the
// orchestrator's in-memory maps. Refuses runs that are still executing —
// the caller must stop them first (doc/22 BP5).
func (r *Routes) handleDeleteRun(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.orchestrator.DeleteRun(id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "deleted", "runId": id})
}

// handlePauseRun pauses a run via Orchestrator.PauseRun.
// Idempotent: pausing an already-paused run returns 200 with status=paused.
func (r *Routes) handlePauseRun(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	reason := req.URL.Query().Get("reason")
	if reason == "" {
		reason = "user paused"
	}
	if err := r.orchestrator.PauseRun(id, reason); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "paused", "runId": id, "reason": reason})
}

// handleResumeRun unblocks a paused run via Orchestrator.ResumeRun.
// Idempotent: resuming a non-paused run returns 200 with status=running.
func (r *Routes) handleResumeRun(w http.ResponseWriter, req *http.Request) {
	id := req.PathValue("id")
	if err := r.orchestrator.ResumeRun(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "running", "runId": id})
}

// handleListApprovals returns the pending approval requests attributed
// to runId. Used by the frontend to render the approval dialog when an
// approval_request SSE event arrives.
func (r *Routes) handleListApprovals(w http.ResponseWriter, req *http.Request) {
	runID := req.PathValue("runId")
	governor := r.orchestrator.Approver()
	if governor == nil {
		writeJSON(w, []any{})
		return
	}
	pending := governor.PendingApprovals(runID)
	if pending == nil {
		pending = []*toolregistry.ApprovalRequest{}
	}
	// Marshal as a stable shape: id/runId/toolName/args/riskLevel/createdAt.
	out := make([]map[string]any, 0, len(pending))
	for _, p := range pending {
		out = append(out, map[string]any{
			"id":        p.ID,
			"runId":     p.RunID,
			"toolName":  p.ToolName,
			"args":      p.Args,
			"riskLevel": p.RiskLevel,
			"createdAt": p.CreatedAt,
			"decision":  string(p.Decision),
		})
	}
	writeJSON(w, out)
}

// handleApprove resolves an approval request as ApprovalApproved.
// The waiting orchestrator goroutine picks the decision up via the
// request's DecisionCh and retries the tool call.
func (r *Routes) handleApprove(w http.ResponseWriter, req *http.Request) {
	reqID := req.PathValue("reqId")
	governor := r.orchestrator.Approver()
	if governor == nil {
		writeError(w, http.StatusServiceUnavailable, "approval governor not configured")
		return
	}
	if err := governor.ResolveApproval(reqID, toolregistry.ApprovalApproved, "user approved"); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "approved", "approvalId": reqID})
}

// handleReject resolves an approval request as ApprovalDenied.
// The orchestrator surfaces the denial to the model so the next turn
// can react ("user denied the call").
func (r *Routes) handleReject(w http.ResponseWriter, req *http.Request) {
	reqID := req.PathValue("reqId")
	governor := r.orchestrator.Approver()
	if governor == nil {
		writeError(w, http.StatusServiceUnavailable, "approval governor not configured")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(req.Body).Decode(&body)
	if body.Reason == "" {
		body.Reason = "user denied"
	}
	if err := governor.ResolveApproval(reqID, toolregistry.ApprovalDenied, body.Reason); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, map[string]string{"status": "denied", "approvalId": reqID, "reason": body.Reason})
}

func (r *Routes) handleListCheckpoints(w http.ResponseWriter, req *http.Request) {
	writeJSON(w, r.orchestrator.recovery.List())
}

// handleGetCheckpoint returns the full Checkpoint record for one run,
// including the P1-6 TurnIndex / State / Reason fields so the frontend
// can render "Run paused at turn N, state=editing, reason=paused" in
// the resume dialog.
func (r *Routes) handleGetCheckpoint(w http.ResponseWriter, req *http.Request) {
	runID := req.PathValue("runId")
	cp, ok := r.orchestrator.recovery.LoadCheckpoint(runID)
	if !ok {
		writeError(w, http.StatusNotFound, "checkpoint not found")
		return
	}
	writeJSON(w, cp)
}

// handleResumeCheckpoint triggers Orchestrator.ResumeFromCheckpoint.
// Returns 404 if no checkpoint exists, 409 if the run is still running.
func (r *Routes) handleResumeCheckpoint(w http.ResponseWriter, req *http.Request) {
	runID := req.PathValue("runId")
	if err := r.orchestrator.ResumeFromCheckpoint(req.Context(), runID); err != nil {
		// Distinguish "not found" (404) from "still running" (409) so
		// the frontend can render the right error state.
		msg := err.Error()
		code := http.StatusInternalServerError
		if strings.Contains(msg, "not found") || strings.Contains(msg, "not exist") {
			code = http.StatusNotFound
		} else if strings.Contains(msg, "still running") {
			code = http.StatusConflict
		}
		writeError(w, code, msg)
		return
	}
	writeJSON(w, map[string]string{"status": "resuming", "runId": runID})
}

// handleDeleteCheckpoint removes a saved checkpoint. Used by the UI when
// the user discards a paused run rather than resuming it.
func (r *Routes) handleDeleteCheckpoint(w http.ResponseWriter, req *http.Request) {
	runID := req.PathValue("runId")
	r.orchestrator.recovery.Delete(runID)
	writeJSON(w, map[string]string{"status": "deleted", "runId": runID})
}

func (r *Routes) handleStreamEvents(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable proxy buffering

	// Support per-run filtering via ?run_id= query parameter
	runID := req.URL.Query().Get("run_id")

	// P1-3 §4.5.2: Last-Event-ID reconnect replay. EventSource echoes
	// the last-seen `id:` back as the `Last-Event-ID` request header.
	// If present and points at our run, replay buffered events with
	// seq > lastSeq before live streaming. If the requested seq is
	// older than the buffer, emit a state_snapshot so the client can
	// rebuild its UI.
	lastEventID := req.Header.Get("Last-Event-ID")
	if lastEventID != "" {
		rid, seq, ok := parseLastEventID(lastEventID)
		if ok && (runID == "" || runID == rid) {
			r.replayBufferedEvents(w, rid, seq)
		}
	}

	var ch <-chan Event
	if runID != "" {
		ch = r.orchestrator.StreamEventsForRun(runID)
	} else {
		ch = r.orchestrator.StreamEvents()
	}

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
			r.writeSSEEvent(w, e)
		case <-ticker.C:
			w.Write([]byte(": ping\n\n"))
			w.(http.Flusher).Flush()
		}
	}
}

// replayBufferedEvents writes buffered events with seq > afterSeq to the
// SSE stream. If the buffer has overflowed (the requested seq is older
// than the oldest buffered event), emits a state_snapshot instead so the
// client can rebuild its UI from scratch. P1-3 §4.5.4.
func (r *Routes) replayBufferedEvents(w http.ResponseWriter, runID string, afterSeq int) {
	buf := r.orchestrator.GetEventBuffer(runID)
	if buf == nil {
		return
	}
	events, err := buf.Replay(afterSeq)
	if err == ErrBufferOverflow {
		// Client was disconnected too long — send a state_snapshot.
		snapshot := r.orchestrator.BuildStateSnapshot(runID)
		data, _ := json.Marshal(snapshot)
		w.Write([]byte("event: state_snapshot\n"))
		w.Write([]byte("id: "))
		w.Write([]byte(runID))
		w.Write([]byte(":"))
		w.Write([]byte(fmt.Sprintf("%d", buf.LatestSeq())))
		w.Write([]byte("\n"))
		w.Write([]byte("data: "))
		w.Write(data)
		w.Write([]byte("\n\n"))
		w.(http.Flusher).Flush()
		return
	}
	for _, ev := range events {
		w.Write([]byte("event: "))
		w.Write([]byte(ev.Type))
		w.Write([]byte("\n"))
		w.Write([]byte("id: "))
		w.Write([]byte(runID))
		w.Write([]byte(":"))
		w.Write([]byte(fmt.Sprintf("%d", ev.Seq)))
		w.Write([]byte("\n"))
		w.Write([]byte("data: "))
		w.Write([]byte(ev.Data))
		w.Write([]byte("\n\n"))
	}
	if len(events) > 0 {
		w.(http.Flusher).Flush()
	}
}

// writeSSEEvent serializes one Event in the SSE wire format with
// `event:`, `id:`, and `data:` lines. The `id:` line enables
// EventSource's automatic Last-Event-ID reconnect (P1-3 §4.5.2).
func (r *Routes) writeSSEEvent(w http.ResponseWriter, e Event) {
	if e.Type != "" {
		w.Write([]byte("event: "))
		w.Write([]byte(e.Type))
		w.Write([]byte("\n"))
	}
	if e.RunID != "" {
		w.Write([]byte("id: "))
		w.Write([]byte(e.RunID))
		w.Write([]byte(":"))
		w.Write([]byte(fmt.Sprintf("%d", e.Seq)))
		w.Write([]byte("\n"))
	}
	data, _ := json.Marshal(e)
	w.Write([]byte("data: "))
	w.Write(data)
	w.Write([]byte("\n\n"))
	w.(http.Flusher).Flush()
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
